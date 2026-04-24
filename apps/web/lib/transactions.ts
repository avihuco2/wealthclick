import { getDb } from "./db";

export type DbTransaction = {
  id: string;
  user_id: string;
  category_id: string | null;
  account: string | null;
  date: Date;
  amount: string; // NUMERIC returns as string from the postgres driver
  description: string;
  type: "income" | "expense";
  installment_total: number | null;
  installment_current: number | null;
  installment_group_id: string | null;
  created_at: Date;
  updated_at: Date;
  // joined from categories
  category_name_en: string | null;
  category_name_he: string | null;
  category_color: string | null;
  category_emoji: string | null;
};

export type TransactionStats = {
  total_income: string;
  total_expenses: string;
  net: string;
};

export async function getTransactions(
  userId: string,
  month: string, // "YYYY-MM"
): Promise<DbTransaction[]> {
  const sql = getDb();
  return sql<DbTransaction[]>`
    SELECT
      t.*,
      c.name_en AS category_name_en,
      c.name_he AS category_name_he,
      c.color   AS category_color,
      c.emoji   AS category_emoji
    FROM transactions t
    LEFT JOIN categories c ON c.id = t.category_id
    WHERE t.user_id = ${userId}
      AND to_char(t.date, 'YYYY-MM') = ${month}
    ORDER BY t.date DESC, t.created_at DESC
  `;
}

export async function getTransactionsByDateRange(
  userId: string,
  from: string,   // YYYY-MM-DD
  to: string,     // YYYY-MM-DD
  type?: "income" | "expense",
  account?: string,
  limit = 100,
): Promise<DbTransaction[]> {
  const sql = getDb();
  const typeFilter    = type    ? sql`AND t.type = ${type}`                                    : sql``;
  const accountFilter = account ? sql`AND LOWER(t.account) LIKE ${"%" + account.toLowerCase() + "%"}` : sql``;
  const safeLimit = Math.min(Math.max(1, limit), 500);
  return sql<DbTransaction[]>`
    SELECT
      t.*,
      c.name_en AS category_name_en,
      c.name_he AS category_name_he,
      c.color   AS category_color,
      c.emoji   AS category_emoji
    FROM transactions t
    LEFT JOIN categories c ON c.id = t.category_id
    WHERE t.user_id = ${userId}
      AND t.date >= ${from}::date
      AND t.date <= ${to}::date
      ${typeFilter}
      ${accountFilter}
    ORDER BY t.date DESC, t.created_at DESC
    LIMIT ${safeLimit}
  `;
}

export async function getTransactionStats(
  userId: string,
  month?: string, // omit for all-time
): Promise<TransactionStats> {
  const sql = getDb();
  const monthFilter = month
    ? sql`AND to_char(date, 'YYYY-MM') = ${month}`
    : sql``;
  const [row] = await sql<TransactionStats[]>`
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE type = 'income'),  0)::text AS total_income,
      COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0)::text AS total_expenses,
      COALESCE(
        SUM(amount) FILTER (WHERE type = 'income') -
        SUM(amount) FILTER (WHERE type = 'expense'),
        0
      )::text AS net
    FROM transactions
    WHERE user_id = ${userId} ${monthFilter}
  `;
  return row;
}
