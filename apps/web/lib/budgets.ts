import { getDb } from "./db";

export type CategoryBudgetRow = {
  category_id: string;
  name_en: string;
  name_he: string;
  color: string;
  emoji: string;
  monthly_budget: string;      // stored budget (0 if unset)
  avg_3m: string;              // average monthly expense last 3 full months
  avg_6m: string;              // average monthly expense last 6 full months
  current_month_actual: string; // expense this calendar month so far
};

export async function getCategoryBudgets(userId: string): Promise<CategoryBudgetRow[]> {
  const sql = getDb();

  const rows = await sql<CategoryBudgetRow[]>`
    WITH
    -- last 6 full months (not the current in-progress month)
    months AS (
      SELECT to_char(
        date_trunc('month', CURRENT_DATE) - (n || ' month')::interval,
        'YYYY-MM'
      ) AS ym
      FROM generate_series(1, 6) n
    ),
    spending AS (
      SELECT
        t.category_id,
        to_char(t.date, 'YYYY-MM') AS ym,
        SUM(t.amount) AS total
      FROM transactions t
      JOIN months m ON to_char(t.date, 'YYYY-MM') = m.ym
      WHERE t.user_id = ${userId} AND t.type = 'expense'
      GROUP BY t.category_id, to_char(t.date, 'YYYY-MM')
    ),
    current_month AS (
      SELECT
        category_id,
        COALESCE(SUM(amount), 0) AS actual
      FROM transactions
      WHERE user_id = ${userId}
        AND type = 'expense'
        AND to_char(date, 'YYYY-MM') = to_char(CURRENT_DATE, 'YYYY-MM')
      GROUP BY category_id
    )
    SELECT
      c.id                                                          AS category_id,
      c.name_en,
      c.name_he,
      c.color,
      c.emoji,
      COALESCE(b.monthly_amount, 0)::text                          AS monthly_budget,
      -- 3-month average (months 1-3 back)
      COALESCE(
        (SELECT AVG(s.total) FROM spending s
         JOIN (SELECT to_char(date_trunc('month', CURRENT_DATE) - (n || ' month')::interval, 'YYYY-MM') AS ym
               FROM generate_series(1,3) n) m3 ON s.ym = m3.ym
         WHERE s.category_id = c.id),
        0
      )::numeric(12,2)::text                                        AS avg_3m,
      -- 6-month average
      COALESCE(
        (SELECT AVG(s.total) FROM spending s WHERE s.category_id = c.id),
        0
      )::numeric(12,2)::text                                        AS avg_6m,
      COALESCE(cm.actual, 0)::text                                 AS current_month_actual
    FROM categories c
    LEFT JOIN category_budgets b ON b.category_id = c.id AND b.user_id = ${userId}
    LEFT JOIN current_month cm   ON cm.category_id = c.id
    WHERE c.user_id = ${userId}
    ORDER BY c.name_en
  `;

  return rows;
}

export async function upsertCategoryBudget(
  userId: string,
  categoryId: string,
  monthlyAmount: number,
): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO category_budgets (user_id, category_id, monthly_amount, updated_at)
    VALUES (${userId}, ${categoryId}, ${monthlyAmount}, now())
    ON CONFLICT (user_id, category_id)
    DO UPDATE SET monthly_amount = ${monthlyAmount}, updated_at = now()
  `;
}

export type BudgetDashboard = {
  total_budget: string;
  total_actual: string;
  categories: {
    category_id: string;
    name_en: string;
    name_he: string;
    color: string;
    emoji: string;
    budget: string;
    actual: string;
  }[];
};

export async function getBudgetDashboard(userId: string): Promise<BudgetDashboard> {
  const sql = getDb();

  const rows = await sql<{
    category_id: string;
    name_en: string;
    name_he: string;
    color: string;
    emoji: string;
    budget: string;
    actual: string;
  }[]>`
    SELECT
      c.id       AS category_id,
      c.name_en,
      c.name_he,
      c.color,
      c.emoji,
      COALESCE(b.monthly_amount, 0)::text AS budget,
      COALESCE(SUM(t.amount) FILTER (
        WHERE t.type = 'expense'
          AND to_char(t.date, 'YYYY-MM') = to_char(CURRENT_DATE, 'YYYY-MM')
      ), 0)::text AS actual
    FROM categories c
    LEFT JOIN category_budgets b ON b.category_id = c.id AND b.user_id = ${userId}
    LEFT JOIN transactions t     ON t.category_id  = c.id AND t.user_id  = ${userId}
    WHERE c.user_id = ${userId}
    GROUP BY c.id, c.name_en, c.name_he, c.color, c.emoji, b.monthly_amount
    HAVING COALESCE(b.monthly_amount, 0) > 0
        OR COALESCE(SUM(t.amount) FILTER (
             WHERE t.type = 'expense'
               AND to_char(t.date, 'YYYY-MM') = to_char(CURRENT_DATE, 'YYYY-MM')
           ), 0) > 0
    ORDER BY COALESCE(b.monthly_amount, 0) DESC
  `;

  const total_budget = rows.reduce((s, r) => s + parseFloat(r.budget), 0).toFixed(2);
  const total_actual = rows.reduce((s, r) => s + parseFloat(r.actual), 0).toFixed(2);

  return { total_budget, total_actual, categories: rows };
}
