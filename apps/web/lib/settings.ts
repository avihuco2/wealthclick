import { getDb } from "./db";

export async function getSetting(key: string, fallback: string): Promise<string> {
  const sql = getDb();
  const rows = await sql<{ value: string }[]>`
    SELECT value FROM settings WHERE key = ${key}
  `;
  return rows[0]?.value ?? fallback;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO settings (key, value, updated_at)
    VALUES (${key}, ${value}, now())
    ON CONFLICT (key) DO UPDATE SET value = ${value}, updated_at = now()
  `;
}

export async function getScrapeIntervalHours(): Promise<number> {
  // Env var takes precedence for ops overrides; DB is the user-facing setting
  if (process.env.SCRAPE_INTERVAL_HOURS) {
    return Math.max(1, parseInt(process.env.SCRAPE_INTERVAL_HOURS, 10));
  }
  const val = await getSetting("scrape_interval_hours", "6");
  return Math.max(1, parseInt(val, 10));
}

export async function getScrapeHistoryMonths(): Promise<number> {
  const val = await getSetting("scrape_history_months", "6");
  return Math.max(1, Math.min(24, parseInt(val, 10)));
}

export async function getAutoSyncEnabled(): Promise<boolean> {
  const val = await getSetting("auto_sync_enabled", "true");
  return val !== "false";
}
