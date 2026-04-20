import { getDb } from "./db";

export type CategoryBudgetRow = {
  category_id: string;
  name_en: string;
  name_he: string;
  color: string;
  emoji: string;
  monthly_budget: string;       // budget for the requested month (0 if none)
  avg_3m: string;               // avg monthly expense last 3 full months
  avg_6m: string;               // avg monthly expense last 6 full months
  current_month_actual: string; // actual expense in requested month
};

export type BudgetIncomeRow = {
  forecasted_amount: string;    // forecasted income for the month
  actual_income: string;        // real income transactions for the month
};

function prevMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function getCategoryBudgets(
  userId: string,
  month: string,
): Promise<CategoryBudgetRow[]> {
  const sql = getDb();
  const prior = prevMonth(month);
  const monthStart = `${month}-01`;

  const rows = await sql<CategoryBudgetRow[]>`
    SELECT
      c.id  AS category_id,
      c.name_en,
      c.name_he,
      c.color,
      c.emoji,

      -- Budget: only what was explicitly saved for this month, 0 if none
      COALESCE(
        (SELECT monthly_amount FROM category_budgets
         WHERE user_id = ${userId} AND category_id = c.id AND month = ${month}),
        0
      )::text AS monthly_budget,

      -- 3-month average (3 full months before requested month)
      COALESCE((
        SELECT ROUND(SUM(t.amount) / 3, 2)
        FROM transactions t
        WHERE t.user_id     = ${userId}
          AND t.category_id = c.id
          AND t.type        = 'expense'
          AND t.date >= (${monthStart}::date - INTERVAL '3 months')
          AND t.date <   ${monthStart}::date
      ), 0)::text AS avg_3m,

      -- 6-month average (6 full months before requested month)
      COALESCE((
        SELECT ROUND(SUM(t.amount) / 6, 2)
        FROM transactions t
        WHERE t.user_id     = ${userId}
          AND t.category_id = c.id
          AND t.type        = 'expense'
          AND t.date >= (${monthStart}::date - INTERVAL '6 months')
          AND t.date <   ${monthStart}::date
      ), 0)::text AS avg_6m,

      -- Actual spending in requested month
      COALESCE((
        SELECT SUM(t.amount)
        FROM transactions t
        WHERE t.user_id     = ${userId}
          AND t.category_id = c.id
          AND t.type        = 'expense'
          AND to_char(t.date, 'YYYY-MM') = ${month}
      ), 0)::text AS current_month_actual

    FROM categories c
    WHERE c.user_id = ${userId}
      AND (
        -- Has an explicit budget set for this month
        EXISTS (
          SELECT 1 FROM category_budgets cb
          WHERE cb.user_id = ${userId} AND cb.category_id = c.id AND cb.month = ${month} AND cb.monthly_amount > 0
        )
        -- Or has expense transactions in the last 6 months
        OR EXISTS (
          SELECT 1 FROM transactions t
          WHERE t.user_id = ${userId} AND t.category_id = c.id AND t.type = 'expense'
            AND t.date >= (${monthStart}::date - INTERVAL '6 months')
        )
        -- Or has expense transactions in the current month
        OR EXISTS (
          SELECT 1 FROM transactions t
          WHERE t.user_id = ${userId} AND t.category_id = c.id AND t.type = 'expense'
            AND to_char(t.date, 'YYYY-MM') = ${month}
        )
      )
    ORDER BY c.name_en
  `;

  return rows;
}

export async function upsertCategoryBudget(
  userId: string,
  categoryId: string,
  month: string,
  monthlyAmount: number,
): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO category_budgets (user_id, category_id, month, monthly_amount, updated_at)
    VALUES (${userId}, ${categoryId}, ${month}, ${monthlyAmount}, now())
    ON CONFLICT (user_id, category_id, month)
    DO UPDATE SET monthly_amount = ${monthlyAmount}, updated_at = now()
  `;
}

export async function getBudgetIncome(
  userId: string,
  month: string,
): Promise<BudgetIncomeRow> {
  const sql = getDb();
  const prior = prevMonth(month);

  const [row] = await sql<{ forecasted_amount: string; actual_income: string }[]>`
    SELECT
      -- Forecasted: this month's saved entry, else last month's actual income as hint
      COALESCE(
        (SELECT forecasted_amount FROM budget_income
         WHERE user_id = ${userId} AND month = ${month}),
        (SELECT SUM(amount) FROM transactions
         WHERE user_id = ${userId} AND type = 'income'
           AND to_char(date, 'YYYY-MM') = ${prior}),
        0
      )::text AS forecasted_amount,

      -- Actual income this month
      COALESCE((
        SELECT SUM(amount) FROM transactions
        WHERE user_id = ${userId} AND type = 'income'
          AND to_char(date, 'YYYY-MM') = ${month}
      ), 0)::text AS actual_income
  `;

  return row ?? { forecasted_amount: "0", actual_income: "0" };
}

export async function upsertBudgetIncome(
  userId: string,
  month: string,
  forecastedAmount: number,
): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO budget_income (user_id, month, forecasted_amount, updated_at)
    VALUES (${userId}, ${month}, ${forecastedAmount}, now())
    ON CONFLICT (user_id, month)
    DO UPDATE SET forecasted_amount = ${forecastedAmount}, updated_at = now()
  `;
}
