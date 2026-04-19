import { getDb } from "./db";

export type CategoryBudgetRow = {
  category_id: string;
  name_en: string;
  name_he: string;
  color: string;
  emoji: string;
  monthly_budget: string;
  avg_3m: string;
  avg_6m: string;
  current_month_actual: string;
};

export async function getCategoryBudgets(userId: string): Promise<CategoryBudgetRow[]> {
  const sql = getDb();

  const rows = await sql<CategoryBudgetRow[]>`
    SELECT
      c.id                              AS category_id,
      c.name_en,
      c.name_he,
      c.color,
      c.emoji,
      COALESCE(b.monthly_amount, 0)::text AS monthly_budget,

      -- 3-month average: months 1-3 before current month
      COALESCE((
        SELECT ROUND(SUM(t.amount) / 3, 2)
        FROM transactions t
        WHERE t.user_id     = ${userId}
          AND t.category_id = c.id
          AND t.type        = 'expense'
          AND t.date >= date_trunc('month', CURRENT_DATE) - INTERVAL '3 months'
          AND t.date <  date_trunc('month', CURRENT_DATE)
      ), 0)::text AS avg_3m,

      -- 6-month average: months 1-6 before current month
      COALESCE((
        SELECT ROUND(SUM(t.amount) / 6, 2)
        FROM transactions t
        WHERE t.user_id     = ${userId}
          AND t.category_id = c.id
          AND t.type        = 'expense'
          AND t.date >= date_trunc('month', CURRENT_DATE) - INTERVAL '6 months'
          AND t.date <  date_trunc('month', CURRENT_DATE)
      ), 0)::text AS avg_6m,

      -- current month actual
      COALESCE((
        SELECT SUM(t.amount)
        FROM transactions t
        WHERE t.user_id     = ${userId}
          AND t.category_id = c.id
          AND t.type        = 'expense'
          AND t.date >= date_trunc('month', CURRENT_DATE)
      ), 0)::text AS current_month_actual

    FROM categories c
    LEFT JOIN category_budgets b
      ON b.category_id = c.id AND b.user_id = ${userId}
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
      COALESCE((
        SELECT SUM(t.amount)
        FROM transactions t
        WHERE t.user_id     = ${userId}
          AND t.category_id = c.id
          AND t.type        = 'expense'
          AND t.date >= date_trunc('month', CURRENT_DATE)
      ), 0)::text AS actual
    FROM categories c
    JOIN category_budgets b ON b.category_id = c.id AND b.user_id = ${userId}
    WHERE c.user_id = ${userId}
      AND b.monthly_amount > 0
    ORDER BY b.monthly_amount DESC
  `;

  const total_budget = rows.reduce((s, r) => s + parseFloat(r.budget), 0).toFixed(2);
  const total_actual = rows.reduce((s, r) => s + parseFloat(r.actual), 0).toFixed(2);

  return { total_budget, total_actual, categories: rows };
}
