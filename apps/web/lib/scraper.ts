import { getDb } from "./db";
import { decrypt } from "./crypto";
import {
  setBankAccountStatus,
  finishScrapeJob,
} from "./bankAccounts";

const PUPPETEER_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
];

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
  await setBankAccountStatus(bankAccountId, "scraping");

  try {
    // Dynamic import keeps Puppeteer/Chromium out of the Next.js client bundle
    const { createScraper, CompanyTypes } = await import("israeli-bank-scrapers");

    const companyType = CompanyTypes[companyId as keyof typeof CompanyTypes];
    if (!companyType) throw new Error(`Unknown companyId: ${companyId}`);

    const credentials = JSON.parse(decrypt(credentialsEncrypted));

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 3); // last 3 months

    const scraper = createScraper({
      companyId: companyType,
      startDate,
      browserLaunchOptions: { args: PUPPETEER_ARGS },
    } as Parameters<typeof createScraper>[0]);

    const result = await scraper.scrape(credentials);

    if (!result.success) {
      throw new Error(`${result.errorType}: ${result.errorMessage}`);
    }

    const sql = getDb();
    let importedCount = 0;

    for (const account of result.accounts ?? []) {
      for (const txn of account.txns) {
        const externalId = makeExternalId(companyId, account.accountNumber, txn);
        const amount = Math.abs(txn.chargedAmount);
        const type = txn.chargedAmount < 0 ? "expense" : "income";
        const date = txn.date.slice(0, 10); // YYYY-MM-DD

        try {
          await sql`
            INSERT INTO transactions
              (user_id, date, amount, description, type, account, external_id)
            VALUES
              (${userId}, ${date}, ${amount}, ${txn.description}, ${type},
               ${account.accountNumber}, ${externalId})
            ON CONFLICT (user_id, external_id) WHERE external_id IS NOT NULL
            DO NOTHING
          `;
          importedCount++;
        } catch {
          // Skip individual insert errors (e.g. constraint violations)
        }
      }
    }

    await setBankAccountStatus(bankAccountId, "active");
    await finishScrapeJob(jobId, "done", importedCount);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[scraper] job ${jobId} failed:`, message);
    await setBankAccountStatus(bankAccountId, "error", message);
    await finishScrapeJob(jobId, "failed", undefined, message);
  }
}
