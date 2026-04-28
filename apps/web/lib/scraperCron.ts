import { getDb } from "./db";
import { createScrapeJob } from "./bankAccounts";
import { startScrapeJob } from "./scraper";
import { getScrapeIntervalHours, getAutoSyncEnabled } from "./settings";

// Fallback used before DB is reachable (e.g. during startup)
export const SCRAPE_INTERVAL_HOURS = Math.max(
  1,
  parseInt(process.env.SCRAPE_INTERVAL_HOURS ?? "6", 10),
);

let cronStarted = false;

export function initScraperCron(): void {
  if (cronStarted) return;
  cronStarted = true;

  console.log(`[scraperCron] Auto-sync initialized — checking every 5 minutes`);

  // Check every 5 minutes for accounts due to scrape
  async function tick() {
    const enabled = await getAutoSyncEnabled();
    if (enabled) {
      await runScheduledScrapes();
    } else {
      console.log("[scraperCron] Auto-sync disabled — skipping");
    }
    setTimeout(tick, 5 * 60 * 1000);
  }

  // First tick after 1 minute
  setTimeout(tick, 60 * 1000);
}

function getNextScrapeTime(): Date {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(2, 0, 0, 0);

  // Random time between 2-5 AM tomorrow
  const randomMinutes = Math.floor(Math.random() * 180);
  tomorrow.setMinutes(randomMinutes);
  return tomorrow;
}

export async function runScheduledScrapes(): Promise<{ started: number }> {
  const sql = getDb();

  const accounts = await sql<
    { id: string; user_id: string; company_id: string; credentials_encrypted: string; next_scrape_at: Date | null }[]
  >`
    SELECT id, user_id, company_id, credentials_encrypted, next_scrape_at
    FROM bank_accounts
    WHERE scrape_enabled = true
      AND status != 'scraping'
      AND (next_scrape_at IS NULL OR next_scrape_at <= now())
  `;

  if (accounts.length === 0) return { started: 0 };

  console.log(`[scraperCron] Found ${accounts.length} account(s) due for scrape`);

  let started = 0;
  for (const account of accounts) {
    try {
      const job = await createScrapeJob(account.user_id, account.id);

      // Schedule next scrape before starting (avoids race if process restarts mid-scrape)
      const nextTime = getNextScrapeTime();
      await sql`
        UPDATE bank_accounts
        SET next_scrape_at = ${nextTime}
        WHERE id = ${account.id}
      `;

      startScrapeJob(
        job.id,
        account.user_id,
        account.id,
        account.company_id,
        account.credentials_encrypted,
      );
      started++;

      console.log(`[scraperCron] Started scrape for account ${account.id}, next at ${nextTime.toISOString()}`);

      // Stagger by 10 minutes to avoid parallel scrape overload
      if (started < accounts.length) {
        await new Promise(resolve => setTimeout(resolve, 10 * 60 * 1000));
      }
    } catch (err) {
      console.error(`[scraperCron] Failed to start job for account ${account.id}:`, err);
    }
  }

  console.log(`[scraperCron] Started ${started} scrape job(s)`);
  return { started };
}
