import { getDb } from "./db";

export type DbBankAccount = {
  id: string;
  user_id: string;
  company_id: string;
  nickname: string | null;
  credentials_encrypted: string;
  last_scraped_at: Date | null;
  last_error: string | null;
  status: "active" | "error" | "scraping";
  created_at: Date;
};

export type DbScrapeJob = {
  id: string;
  user_id: string;
  bank_account_id: string;
  status: "running" | "done" | "failed";
  imported_count: number | null;
  error: string | null;
  started_at: Date;
  finished_at: Date | null;
  created_at: Date;
};

export async function getBankAccounts(userId: string): Promise<DbBankAccount[]> {
  const sql = getDb();
  return sql<DbBankAccount[]>`
    SELECT * FROM bank_accounts
    WHERE user_id = ${userId}
    ORDER BY created_at ASC
  `;
}

export async function getBankAccount(
  userId: string,
  accountId: string,
): Promise<DbBankAccount | null> {
  const sql = getDb();
  const rows = await sql<DbBankAccount[]>`
    SELECT * FROM bank_accounts
    WHERE id = ${accountId} AND user_id = ${userId}
  `;
  return rows[0] ?? null;
}

export async function createBankAccount(
  userId: string,
  companyId: string,
  credentialsEncrypted: string,
  nickname?: string,
): Promise<DbBankAccount> {
  const sql = getDb();
  const [row] = await sql<DbBankAccount[]>`
    INSERT INTO bank_accounts (user_id, company_id, credentials_encrypted, nickname)
    VALUES (${userId}, ${companyId}, ${credentialsEncrypted}, ${nickname ?? null})
    RETURNING *
  `;
  return row;
}

export async function deleteBankAccount(userId: string, accountId: string): Promise<void> {
  const sql = getDb();
  await sql`
    DELETE FROM bank_accounts WHERE id = ${accountId} AND user_id = ${userId}
  `;
}

export async function setBankAccountStatus(
  accountId: string,
  status: DbBankAccount["status"],
  lastError?: string | null,
): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE bank_accounts
    SET status = ${status},
        last_error = ${lastError ?? null},
        last_scraped_at = CASE WHEN ${status} = 'active' THEN now() ELSE last_scraped_at END
    WHERE id = ${accountId}
  `;
}

export async function createScrapeJob(
  userId: string,
  bankAccountId: string,
): Promise<DbScrapeJob> {
  const sql = getDb();
  const [row] = await sql<DbScrapeJob[]>`
    INSERT INTO scrape_jobs (user_id, bank_account_id, status)
    VALUES (${userId}, ${bankAccountId}, 'running')
    RETURNING *
  `;
  return row;
}

export async function finishScrapeJob(
  jobId: string,
  status: "done" | "failed",
  importedCount?: number,
  error?: string,
): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE scrape_jobs
    SET status         = ${status},
        imported_count = ${importedCount ?? null},
        error          = ${error ?? null},
        finished_at    = now()
    WHERE id = ${jobId}
  `;
}

export async function getScrapeJob(jobId: string): Promise<DbScrapeJob | null> {
  const sql = getDb();
  const rows = await sql<DbScrapeJob[]>`
    SELECT * FROM scrape_jobs WHERE id = ${jobId}
  `;
  return rows[0] ?? null;
}

export async function getLatestScrapeJob(
  bankAccountId: string,
): Promise<DbScrapeJob | null> {
  const sql = getDb();
  const rows = await sql<DbScrapeJob[]>`
    SELECT * FROM scrape_jobs
    WHERE bank_account_id = ${bankAccountId}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return rows[0] ?? null;
}
