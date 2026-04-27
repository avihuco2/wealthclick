import { createHash } from "crypto";
import { getDb } from "./db";
import { decrypt } from "./crypto";
import {
  setBankAccountStatus,
  finishScrapeJob,
  setJobAwaitingOtp,
  pollJobOtp,
} from "./bankAccounts";
import { getScrapeHistoryMonths } from "./settings";
import { loadCategoryRules, applyRulesToUncategorized } from "./categoryRules";
import { sendTextMessage } from "./evolutionApi";

const BASE_PUPPETEER_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  // Critical: removes the CDP automation fingerprint that bank sites detect
  "--disable-blink-features=AutomationControlled",
  // Use new headless mode (Chrome 112+) — behaves closer to real browser
  "--headless=new",
  // Mimic a real user-agent window size
  "--window-size=1280,800",
  // Residential proxy — bypasses Cloudflare TLS fingerprint block on Israeli bank sites
  ...(process.env.SCRAPER_PROXY_URL ? [`--proxy-server=${process.env.SCRAPER_PROXY_URL}`] : []),
];

/** Per-company user-data-dir → persists __cf_bm cookie across runs (avoids parallel-scrape conflict) */
function puppeteerArgsForCompany(companyId: string): string[] {
  return [
    ...BASE_PUPPETEER_ARGS,
    `--user-data-dir=/tmp/wealthclick-chrome-${companyId.replace(/[^a-z0-9_-]/gi, "")}`,
  ];
}

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

/** Send WhatsApp OTP request to the user owning this job, set job status to awaiting_otp */
async function notifyOtpViaWhatsApp(userId: string, jobId: string, companyId: string): Promise<void> {
  await setJobAwaitingOtp(jobId);
  const sql = getDb();
  const [cfg] = await sql<{
    evolution_url: string; api_key_enc: string; api_key_iv: string;
    api_key_tag: string; instance_name: string; allowed_numbers: string[] | string;
  }[]>`
    SELECT evolution_url, api_key_enc, api_key_iv, api_key_tag, instance_name, allowed_numbers
    FROM whatsapp_config WHERE user_id = ${userId} LIMIT 1
  `;
  if (!cfg) { console.warn(`[scraper] job ${jobId} — no WhatsApp config, OTP relay skipped`); return; }

  const { decryptApiKey } = await import("./whatsappCrypto");
  const apiKey = decryptApiKey(cfg.api_key_enc, cfg.api_key_iv, cfg.api_key_tag);
  const numbers: string[] = typeof cfg.allowed_numbers === "string"
    ? JSON.parse(cfg.allowed_numbers) : (cfg.allowed_numbers ?? []);
  if (numbers.length === 0) { console.warn(`[scraper] job ${jobId} — no allowed_numbers in WhatsApp config`); return; }

  const phone = numbers[0].replace(/^\+/, "") + "@s.whatsapp.net";
  await sendTextMessage(
    { url: cfg.evolution_url, apiKey, instance: cfg.instance_name },
    phone,
    `🔐 נדרש קוד אימות לחיבור בנק ${companyId}.\nשלח: *otiboti <קוד>*\n(לדוגמה: otiboti 123456)`,
  );
  console.log(`[scraper] job ${jobId} — OTP WhatsApp notification sent to ${numbers[0]}`);
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

    // Patch waitForRedirect once per process: extend its default 20s timeout to 180s.
    // The Hapoalim scraper calls waitForRedirect with no timeout arg, so default matters.
    // We do this by mutating the CommonJS exports object that all scrapers share.
    if (!(globalThis as Record<string, unknown>).__waitForRedirectPatched) {
      (globalThis as Record<string, unknown>).__waitForRedirectPatched = true;
      try {
        const { createRequire } = await import("module");
        const req = createRequire(import.meta.url);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const navMod = req("israeli-bank-scrapers/lib/helpers/navigation") as any;
        if (navMod?.waitForRedirect) {
          const orig = navMod.waitForRedirect as (...a: unknown[]) => unknown;
          navMod.waitForRedirect = (pageOrFrame: unknown, timeout = 180_000, ...rest: unknown[]) =>
            orig(pageOrFrame, timeout, ...rest);
          console.log("[scraper] waitForRedirect patched: default timeout → 180s");
        }
      } catch (e) {
        console.warn("[scraper] waitForRedirect patch failed:", e);
      }
    }

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
        args: puppeteerArgsForCompany(companyId),
        // Use real Chrome/Edge binary if SCRAPER_BROWSER_PATH is set — bypasses
        // Cloudflare's bundled-Chromium fingerprint detection (e.g. Isracard)
        ...(process.env.SCRAPER_BROWSER_PATH
          ? { executablePath: process.env.SCRAPER_BROWSER_PATH }
          : {}),
      },
      preparePage: async (page) => {
        // Set a realistic user-agent matching the real Chrome binary version
        await page.setUserAgent(
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36"
        );
        await page.setViewport({ width: 1280, height: 800 });

        // Manual stealth patches — applied before any navigation
        await page.evaluateOnNewDocument(() => {
          // 1. Hide webdriver flag (belt-and-suspenders alongside --disable-blink-features)
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

        // OTP relay — Node-side polling detects when password field disappears (OTP screen).
        // Runs in background; fills OTP form once code arrives via WhatsApp.
        let otpHandled = false;
        (async () => {
          // Brief wait for login form to render before polling starts
          await new Promise((r) => setTimeout(r, 2000));
          // Capture the login page URL — for SPAs (e.g. Hapoalim) the URL doesn't change
          // during OTP, only on successful login redirect. If URL changes, login succeeded
          // without OTP and we can stop watching.
          const loginUrl = page.url();
          const deadline = Date.now() + 170_000;
          while (Date.now() < deadline && !otpHandled) {
            try {
              // URL changed → login succeeded without OTP (navigated to banking dashboard)
              if (page.url() !== loginUrl) break;

              const state = await page.evaluate(() => {
                const inputs = Array.from(document.querySelectorAll("input"));
                const hasPassword = inputs.some((i) => i.type === "password");
                const visibleInputs = inputs.filter(
                  (i) => i.type !== "hidden" && i.offsetParent !== null,
                );
                return { hasPassword, visibleCount: visibleInputs.length };
              });
              // OTP page: password field gone, at least one visible input remains
              if (!state.hasPassword && state.visibleCount > 0 && !otpHandled) {
                otpHandled = true;
                console.log(`[scraper] job ${jobId} — OTP screen detected (no password field, ${state.visibleCount} input(s))`);
                await notifyOtpViaWhatsApp(userId, jobId, companyId);
                const code = await pollJobOtp(jobId, 120_000);
                if (!code) {
                  console.warn(`[scraper] job ${jobId} — OTP timeout after 120s`);
                  return;
                }
                console.log(`[scraper] job ${jobId} — OTP received, filling form`);
                // Type into whichever visible input is focused / first
                const filled = await page.evaluate((otpCode: string) => {
                  const inputs = Array.from(document.querySelectorAll("input")).filter(
                    (i) => i.type !== "hidden" && i.offsetParent !== null,
                  );
                  const el = (inputs.find((i) => i === document.activeElement) ?? inputs[0]) as HTMLInputElement | undefined;
                  if (!el) return null;
                  el.focus();
                  el.value = otpCode;
                  el.dispatchEvent(new Event("input", { bubbles: true }));
                  el.dispatchEvent(new Event("change", { bubbles: true }));
                  return el.outerHTML.slice(0, 80);
                }, code);
                if (filled) {
                  console.log(`[scraper] job ${jobId} — filled OTP into: ${filled}`);
                  await page.keyboard.press("Enter");
                } else {
                  console.warn(`[scraper] job ${jobId} — no visible input found for OTP`);
                }
                return;
              }
            } catch { /* page navigating, ignore */ }
            await new Promise((r) => setTimeout(r, 2000));
          }
        })().catch((e) => console.warn(`[scraper] job ${jobId} — OTP polling error:`, e));
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
        // DB constraint: amount > 0. Skip zero-value txns (canceled, fees, loan placeholders).
        if (amount === 0) continue;
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
