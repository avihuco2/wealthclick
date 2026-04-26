import { getDb } from "./db";

// ─── Types ────────────────────────────────────────────────────────────────

export type CategoryBreakdown = {
  category_id: string | null;
  category_name_en: string | null;
  category_name_he: string | null;
  category_color: string | null;
  category_emoji: string | null;
  total: string;
  pct: number;
};

export type TopExpense = {
  id: string;
  date: Date;
  description: string;
  amount: string;
  category_name_en: string | null;
  category_name_he: string | null;
  category_color: string | null;
  category_emoji: string | null;
};

export type SpendingPace = {
  active_days: number;
  total_days: number;
  avg_per_day: string;
  total_expenses: string;
};

export type CategoryTrend = {
  category_id: string | null;
  category_name_en: string | null;
  category_name_he: string | null;
  category_color: string | null;
  category_emoji: string | null;
  current_total: string;
  prior_total: string;
};

export type PeriodComparison = {
  current_income: string;
  current_expenses: string;
  current_net: string;
  prior_income: string;
  prior_expenses: string;
  prior_net: string;
};

export type InsightsData = {
  month: string;
  periodComparison: PeriodComparison;
  categoryBreakdown: CategoryBreakdown[];
  topExpenses: TopExpense[];
  spendingPace: SpendingPace;
  categoryTrends: CategoryTrend[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────

function priorMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 2, 1); // m-1 for zero-index, then -1 for prior month
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ─── Queries ──────────────────────────────────────────────────────────────

async function getPeriodComparison(
  userId: string,
  month: string,
): Promise<PeriodComparison> {
  const sql = getDb();
  const prior = priorMonth(month);

  const [row] = await sql<PeriodComparison[]>`
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE type = 'income'  AND to_char(date,'YYYY-MM') = ${month}), 0)::text  AS current_income,
      COALESCE(SUM(amount) FILTER (WHERE type = 'expense' AND to_char(date,'YYYY-MM') = ${month}), 0)::text  AS current_expenses,
      COALESCE(
        SUM(amount) FILTER (WHERE type = 'income'  AND to_char(date,'YYYY-MM') = ${month}) -
        SUM(amount) FILTER (WHERE type = 'expense' AND to_char(date,'YYYY-MM') = ${month}),
        0
      )::text AS current_net,
      COALESCE(SUM(amount) FILTER (WHERE type = 'income'  AND to_char(date,'YYYY-MM') = ${prior}), 0)::text  AS prior_income,
      COALESCE(SUM(amount) FILTER (WHERE type = 'expense' AND to_char(date,'YYYY-MM') = ${prior}), 0)::text  AS prior_expenses,
      COALESCE(
        SUM(amount) FILTER (WHERE type = 'income'  AND to_char(date,'YYYY-MM') = ${prior}) -
        SUM(amount) FILTER (WHERE type = 'expense' AND to_char(date,'YYYY-MM') = ${prior}),
        0
      )::text AS prior_net
    FROM transactions
    WHERE user_id = ${userId}
      AND to_char(date,'YYYY-MM') IN (${month}, ${prior})
  `;

  return row;
}

export type AccountBreakdown = {
  account: string;
  total: string;
  pct: number;
};

// ─── Monthly Totals (for dashboard cash flow chart) ───────────────────────

export type MonthlyTotals = {
  month: string; // YYYY-MM
  income: string;
  expenses: string;
  net: string;
};

export async function getMonthlyTotals(
  userId: string,
  months = 6,
): Promise<MonthlyTotals[]> {
  const sql = getDb();
  const start = new Date();
  start.setDate(1);
  start.setMonth(start.getMonth() - (months - 1));
  const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-01`;

  const rows = await sql<MonthlyTotals[]>`
    SELECT
      to_char(date, 'YYYY-MM') AS month,
      COALESCE(SUM(amount) FILTER (WHERE type = 'income'),  0)::text AS income,
      COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0)::text AS expenses,
      COALESCE(
        SUM(amount) FILTER (WHERE type = 'income') -
        SUM(amount) FILTER (WHERE type = 'expense'),
        0
      )::text AS net
    FROM transactions
    WHERE user_id = ${userId}
      AND date >= ${startStr}::date
    GROUP BY to_char(date, 'YYYY-MM')
    ORDER BY month ASC
  `;

  // Fill in missing months so the caller always gets exactly `months` entries
  const filled: MonthlyTotals[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    filled.push(rows.find((r) => r.month === m) ?? { month: m, income: "0", expenses: "0", net: "0" });
  }
  return filled;
}

export async function getCategoryBreakdown(
  userId: string,
  month: string,
): Promise<CategoryBreakdown[]> {
  const sql = getDb();

  const rows = await sql<Omit<CategoryBreakdown, "pct">[]>`
    SELECT
      t.category_id,
      c.name_en  AS category_name_en,
      c.name_he  AS category_name_he,
      c.color    AS category_color,
      c.emoji    AS category_emoji,
      SUM(t.amount)::text AS total
    FROM transactions t
    LEFT JOIN categories c ON c.id = t.category_id
    WHERE t.user_id = ${userId}
      AND t.type = 'expense'
      AND to_char(t.date, 'YYYY-MM') = ${month}
    GROUP BY t.category_id, c.name_en, c.name_he, c.color, c.emoji
    ORDER BY SUM(t.amount) DESC
  `;

  const grandTotal = rows.reduce((s, r) => s + parseFloat(r.total), 0);
  return rows.map((r) => ({
    ...r,
    pct: grandTotal > 0 ? (parseFloat(r.total) / grandTotal) * 100 : 0,
  }));
}

async function getTopExpenses(
  userId: string,
  month: string,
): Promise<TopExpense[]> {
  const sql = getDb();

  return sql<TopExpense[]>`
    SELECT
      t.id,
      t.date,
      t.description,
      t.amount::text AS amount,
      c.name_en  AS category_name_en,
      c.name_he  AS category_name_he,
      c.color    AS category_color,
      c.emoji    AS category_emoji
    FROM transactions t
    LEFT JOIN categories c ON c.id = t.category_id
    WHERE t.user_id = ${userId}
      AND t.type = 'expense'
      AND to_char(t.date, 'YYYY-MM') = ${month}
    ORDER BY t.amount DESC
    LIMIT 5
  `;
}

async function getSpendingPace(
  userId: string,
  month: string,
): Promise<SpendingPace> {
  const sql = getDb();
  const monthStart = `${month}-01`;

  const [row] = await sql<SpendingPace[]>`
    SELECT
      COUNT(DISTINCT t.date)::int AS active_days,
      EXTRACT(DAY FROM
        LEAST(
          (date_trunc('month', ${monthStart}::date) + interval '1 month - 1 day')::date,
          CURRENT_DATE
        )
      )::int AS total_days,
      COALESCE(SUM(t.amount), 0)::text AS total_expenses,
      CASE WHEN COUNT(DISTINCT t.date) > 0
           THEN (SUM(t.amount) / COUNT(DISTINCT t.date))::text
           ELSE '0'
      END AS avg_per_day
    FROM transactions t
    WHERE t.user_id = ${userId}
      AND t.type = 'expense'
      AND to_char(t.date, 'YYYY-MM') = ${month}
  `;

  return row;
}

async function getCategoryTrends(
  userId: string,
  month: string,
): Promise<CategoryTrend[]> {
  const sql = getDb();
  const prior = priorMonth(month);

  return sql<CategoryTrend[]>`
    SELECT
      COALESCE(cur.category_id, pri.category_id)          AS category_id,
      COALESCE(cur.name_en,  pri.name_en)                 AS category_name_en,
      COALESCE(cur.name_he,  pri.name_he)                 AS category_name_he,
      COALESCE(cur.color,    pri.color)                   AS category_color,
      COALESCE(cur.emoji,    pri.emoji)                   AS category_emoji,
      COALESCE(cur.total, 0)::text                        AS current_total,
      COALESCE(pri.total, 0)::text                        AS prior_total
    FROM (
      SELECT t.category_id, c.name_en, c.name_he, c.color, c.emoji,
             SUM(t.amount) AS total
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id
      WHERE t.user_id = ${userId} AND t.type = 'expense'
        AND to_char(t.date, 'YYYY-MM') = ${month}
      GROUP BY t.category_id, c.name_en, c.name_he, c.color, c.emoji
    ) cur
    FULL OUTER JOIN (
      SELECT t.category_id, c.name_en, c.name_he, c.color, c.emoji,
             SUM(t.amount) AS total
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id
      WHERE t.user_id = ${userId} AND t.type = 'expense'
        AND to_char(t.date, 'YYYY-MM') = ${prior}
      GROUP BY t.category_id, c.name_en, c.name_he, c.color, c.emoji
    ) pri
    ON COALESCE(cur.category_id::text, 'uncategorized') =
       COALESCE(pri.category_id::text, 'uncategorized')
    ORDER BY COALESCE(cur.total, 0) DESC
  `;
}

export async function getAccountBreakdown(
  userId: string,
  month: string,
): Promise<AccountBreakdown[]> {
  const sql = getDb();

  const rows = await sql<{ account: string | null; total: string }[]>`
    SELECT
      COALESCE(account, 'Other') AS account,
      SUM(amount)::text AS total
    FROM transactions
    WHERE user_id = ${userId}
      AND type = 'expense'
      AND to_char(date, 'YYYY-MM') = ${month}
    GROUP BY COALESCE(account, 'Other')
    ORDER BY SUM(amount) DESC
  `;

  const grandTotal = rows.reduce((s, r) => s + parseFloat(r.total), 0);
  return rows.map((r) => ({
    account: r.account!,
    total: r.total,
    pct: grandTotal > 0 ? (parseFloat(r.total) / grandTotal) * 100 : 0,
  }));
}

// ─── Public API ───────────────────────────────────────────────────────────

export async function getInsightsData(
  userId: string,
  month: string,
): Promise<InsightsData> {
  const [periodComparison, categoryBreakdown, topExpenses, spendingPace, categoryTrends] = await Promise.all([
    getPeriodComparison(userId, month),
    getCategoryBreakdown(userId, month),
    getTopExpenses(userId, month),
    getSpendingPace(userId, month),
    getCategoryTrends(userId, month),
  ]);

  return {
    month,
    periodComparison,
    categoryBreakdown,
    topExpenses,
    spendingPace,
    categoryTrends,
  };
}
