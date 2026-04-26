import { createHash } from "crypto";
import { getDb } from "./db";
import { decrypt } from "./crypto";
import {
  setBankAccountStatus,
  finishScrapeJob,
} from "./bankAccounts";
import { getScrapeHistoryMonths } from "./settings";
import { loadCategoryRules, applyRulesToUncategorized } from "./categoryRules";

const PUPPETEER_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  // Residential proxy — bypasses Cloudflare TLS fingerprint block on Israeli bank sites
  ...(process.env.SCRAPER_PROXY_URL ? [`--proxy-server=${process.env.SCRAPER_PROXY_URL}`] : []),
];

// Set DEBUG=israeli-bank-scrapers:* in the environment to enable verbose library logs
const SCRAPER_DEBUG = process.env.SCRAPER_DEBUG === "true";

/** Deterministic external ID for deduplication */
function makeExternalId(
  companyId: string,
  accountNumber: string,
  txn: { date: string; description: string; chargedAmount: number; identifier?: string | number },
): string {
  const key = txn.identifier
    ? `${companyId}:${accountNumber}:${txn.identifier}`
    : `${companyId}:${accountNumber}:${txn.date}:${txn.description}:${txn.chargedAmount}`;
  return Buffer.from(key).toString("base64url").slice(0, 128);
}

/**
 * Deterministic UUID for an installment group.
 * Stable across re-scrapes: same series → same group_id every time.
 */
function makeInstallmentGroupId(
  companyId: string,
  accountNumber: string,
  description: string,
  amount: number,
  total: number,
): string {
  const seed = `installment:${companyId}:${accountNumber}:${description}:${amount}:${total}`;
  const h = createHash("sha256").update(seed).digest("hex");
  return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;
}

/** Add N months to a YYYY-MM-DD date string */
function addMonths(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + n, d));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Run a scrape job in the background (fire-and-forget).
 * Returns immediately; updates DB asynchronously.
 */
export function startScrapeJob(
  jobId: string,
  userId: string,
  bankAccountId: string,
  companyId: string,
  credentialsEncrypted: string,
): void {
  console.log(`[scraper] job ${jobId} queued — account=${bankAccountId} company=${companyId}`);
  // Intentionally not awaited — runs in background on EC2 Node.js process
  runScrape(jobId, userId, bankAccountId, companyId, credentialsEncrypted).catch(
    (err) => {
      console.error(`[scraper] job ${jobId} unhandled error:`, err);
    },
  );
}

async function runScrape(
  jobId: string,
  userId: string,
  bankAccountId: string,
  companyId: string,
  credentialsEncrypted: string,
): Promise<void> {
  console.log(`[scraper] job ${jobId} started`);
  await setBankAccountStatus(bankAccountId, "scraping");

  try {
    // Dynamic import keeps Puppeteer/Chromium out of the Next.js client bundle
    const { createScraper, CompanyTypes } = await import("israeli-bank-scrapers");

    const companyType = CompanyTypes[companyId as keyof typeof CompanyTypes];
    if (!companyType) throw new Error(`Unknown companyId: ${companyId}`);

    const credentials = JSON.parse(decrypt(credentialsEncrypted));

    const historyMonths = await getScrapeHistoryMonths();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - historyMonths);
    console.log(`[scraper] job ${jobId} — scraping ${companyId} from ${startDate.toISOString().slice(0, 10)} (${historyMonths} months)`);

    const scraper = createScraper({
      companyId: companyType,
      startDate,
      verbose: SCRAPER_DEBUG,
      browserLaunchOptions: {
        args: PUPPETEER_ARGS,
        // Use real Chrome/Edge binary if SCRAPER_BROWSER_PATH is set — bypasses
        // Cloudflare's bundled-Chromium fingerprint detection (e.g. Isracard)
        ...(process.env.SCRAPER_BROWSER_PATH
          ? { executablePath: process.env.SCRAPER_BROWSER_PATH }
          : {}),
      },
      preparePage: async (page) => {
        // Manual stealth patches — applied before any navigation
        await page.evaluateOnNewDocument(() => {
          // 1. Hide webdriver flag
          Object.defineProperty(navigator, "webdriver", { get: () => false });

          // 2. Fake plugins (real Chrome has plugins; headless has none)
          Object.defineProperty(navigator, "plugins", {
            get: () => [1, 2, 3, 4, 5],
          });

          // 3. Fake languages
          Object.defineProperty(navigator, "languages", {
            get: () => ["he-IL", "he", "en-US", "en"],
          });

          // 4. Restore chrome runtime object (removed in headless)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).chrome = { runtime: {} };

          // 5. Fix permissions query (headless returns "denied" for notifications which leaks)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const originalQuery = (window.navigator.permissions as any).query;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window.navigator.permissions as any).query = (parameters: any) =>
            parameters.name === "notifications"
              ? Promise.resolve({ state: Notification.permission } as PermissionStatus)
              : originalQuery(parameters);
        });
      },
    } as Parameters<typeof createScraper>[0]);

    console.log(`[scraper] job ${jobId} — browser launched, logging in…`);
    const result = await scraper.scrape(credentials);

    if (!result.success) {
      throw new Error(`${result.errorType}: ${result.errorMessage}`);
    }

    const totalTxns = (result.accounts ?? []).reduce((s, a) => s + a.txns.length, 0);
    console.log(`[scraper] job ${jobId} — scrape succeeded: ${result.accounts?.length ?? 0} account(s), ${totalTxns} transaction(s) fetched`);

    const sql = getDb();
    let importedCount = 0;

    // Preload category rules so each insert can be auto-categorized inline
    const categoryRules = await loadCategoryRules(userId);

    for (const account of result.accounts ?? []) {
      for (const txn of account.txns) {
        const externalId = makeExternalId(companyId, account.accountNumber, txn);
        const amount = Math.abs(txn.chargedAmount);
        const type = txn.chargedAmount < 0 ? "expense" : "income";
        const date = txn.date.slice(0, 10); // YYYY-MM-DD
        const categoryId = categoryRules.get(txn.description.trim()) ?? null;

        // Installment info — present on Max (and other) credit card transactions
        // txn.type === "installments" and txn.installments = { number, total }
        const inst = txn.installments;

        try {
          if (inst && inst.total > 1) {
            const groupId = makeInstallmentGroupId(
              companyId, account.accountNumber, txn.description, amount, inst.total,
            );

            // Upsert the actual scraped row, replacing any synthetic future row for this slot
            const rows = await sql`
              INSERT INTO transactions
                (user_id, date, amount, description, type, account, external_id, category_id,
                 installment_group_id, installment_current, installment_total)
              VALUES
                (${userId}, ${date}, ${amount}, ${txn.description}, ${type},
                 ${account.accountNumber}, ${externalId}, ${categoryId},
                 ${groupId}::uuid, ${inst.number}, ${inst.total})
              ON CONFLICT (user_id, installment_group_id, installment_current)
                WHERE installment_group_id IS NOT NULL
              DO UPDATE SET
                external_id  = EXCLUDED.external_id,
                date         = EXCLUDED.date,
                updated_at   = now()
              WHERE transactions.external_id IS NULL
              RETURNING id
            `;
            if (rows.length > 0) importedCount++;

            // Generate future installment rows (synthetic forecasts)
            for (let i = inst.number + 1; i <= inst.total; i++) {
              const futureDate = addMonths(date, i - inst.number);
              await sql`
                INSERT INTO transactions
                  (user_id, date, amount, description, type, account, category_id,
                   installment_group_id, installment_current, installment_total)
                VALUES
                  (${userId}, ${futureDate}, ${amount}, ${txn.description}, ${type},
                   ${account.accountNumber}, ${categoryId},
                   ${groupId}::uuid, ${i}, ${inst.total})
                ON CONFLICT (user_id, installment_group_id, installment_current)
                  WHERE installment_group_id IS NOT NULL
                DO NOTHING
              `;
            }
          } else {
            // Regular (non-installment) transaction
            const rows = await sql`
              INSERT INTO transactions
                (user_id, date, amount, description, type, account, external_id, category_id)
              VALUES
                (${userId}, ${date}, ${amount}, ${txn.description}, ${type},
                 ${account.accountNumber}, ${externalId}, ${categoryId})
              ON CONFLICT (user_id, external_id) WHERE external_id IS NOT NULL
              DO NOTHING
              RETURNING id
            `;
            if (rows.length > 0) importedCount++;
          }
        } catch (insertErr) {
          console.warn(`[scraper] job ${jobId} — insert skipped:`, insertErr instanceof Error ? insertErr.message : insertErr);
        }
      }
    }

    // Catch any remaining uncategorized rows (e.g. ON CONFLICT updates) using learned rules
    const autoCatCount = await applyRulesToUncategorized(userId);
    if (autoCatCount > 0) {
      console.log(`[scraper] job ${jobId} — auto-categorized ${autoCatCount} transaction(s)`);
    }

    console.log(`[scraper] job ${jobId} — done: ${importedCount} new transaction(s) inserted`);
    await setBankAccountStatus(bankAccountId, "active");
    await finishScrapeJob(jobId, "done", importedCount);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[scraper] job ${jobId} failed:`, message);
    await setBankAccountStatus(bankAccountId, "error", message);
    await finishScrapeJob(jobId, "failed", undefined, message);
  }
}
