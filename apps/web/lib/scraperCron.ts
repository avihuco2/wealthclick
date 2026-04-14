import { getDb } from "./db";
import { createScrapeJob } from "./bankAccounts";
import { startScrapeJob } from "./scraper";
import { getScrapeIntervalHours } from "./settings";

// Fallback used before DB is reachable (e.g. during startup)
export const SCRAPE_INTERVAL_HOURS = Math.max(
  1,
  parseInt(process.env.SCRAPE_INTERVAL_HOURS ?? "6", 10),
);

let cronStarted = false;

export function initScraperCron(): void {
  if (cronStarted) return;
  cronStarted = true;

  console.log(`[scraperCron] Auto-sync initialized — default interval ${SCRAPE_INTERVAL_HOURS}h`);

  // Re-reads interval from DB on every tick so changes take effect without restart
  async function tick() {
    const intervalHours = await getScrapeIntervalHours();
    await runScheduledScrapes();
    console.log(`[scraperCron] Next run in ${intervalHours}h`);
    setTimeout(tick, intervalHours * 3600 * 1000);
  }

  // First tick after one full default interval
  setTimeout(tick, SCRAPE_INTERVAL_HOURS * 3600 * 1000);
}

export async function runScheduledScrapes(): Promise<{ started: number }> {
  console.log("[scraperCron] Running scheduled scrapes…");
  const sql = getDb();

  const accounts = await sql<
    { id: string; user_id: string; company_id: string; credentials_encrypted: string }[]
  >`
    SELECT id, user_id, company_id, credentials_encrypted
    FROM bank_accounts
    WHERE scrape_enabled = true AND status != 'scraping'
  `;

  let started = 0;
  for (const account of accounts) {
    try {
      const job = await createScrapeJob(account.user_id, account.id);
      startScrapeJob(
        job.id,
        account.user_id,
        account.id,
        account.company_id,
        account.credentials_encrypted,
      );
      started++;
    } catch (err) {
      console.error(`[scraperCron] Failed to start job for account ${account.id}:`, err);
    }
  }

  console.log(`[scraperCron] Started ${started} scrape job(s)`);
  return { started };
}
