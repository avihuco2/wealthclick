import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/apiAuth";
import { getCategoryBudgets, upsertCategoryBudget, getBudgetIncome } from "@/lib/budgets";

export async function GET(request: Request) {
  const userId = await authenticateApiKey(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized — provide a valid Bearer token" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month))
    return NextResponse.json({ error: "month must be in YYYY-MM format" }, { status: 400 });

  const [rows, income] = await Promise.all([
    getCategoryBudgets(userId, month),
    getBudgetIncome(userId, month),
  ]);

  const categories = rows.map((r) => ({
    category_id: r.category_id,
    name_en: r.name_en,
    name_he: r.name_he,
    color: r.color,
    emoji: r.emoji,
    monthly_budget: parseFloat(r.monthly_budget),
    avg_3m: parseFloat(r.avg_3m),
    avg_6m: parseFloat(r.avg_6m),
    actual: parseFloat(r.current_month_actual),
    remaining: parseFloat(r.monthly_budget) - parseFloat(r.current_month_actual),
  }));

  const totalBudget = categories.reduce((s, c) => s + c.monthly_budget, 0);
  const totalActual = categories.reduce((s, c) => s + c.actual, 0);

  return NextResponse.json({
    month,
    income: {
      forecasted_amount: parseFloat(income.forecasted_amount),
      actual_income: parseFloat(income.actual_income),
    },
    categories,
    summary: {
      total_budget: totalBudget,
      total_actual: totalActual,
      remaining: totalBudget - totalActual,
    },
  });
}

export async function PUT(request: Request) {
  const userId = await authenticateApiKey(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized — provide a valid Bearer token" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const { month, categories } = body as { month: string; categories: { category_id: string; monthly_amount: number }[] };

  if (!month || !/^\d{4}-\d{2}$/.test(month))
    return NextResponse.json({ error: "month must be in YYYY-MM format" }, { status: 400 });
  if (!Array.isArray(categories) || categories.length === 0)
    return NextResponse.json({ error: "categories must be a non-empty array" }, { status: 400 });

  for (const c of categories) {
    if (!c.category_id || typeof c.monthly_amount !== "number" || c.monthly_amount < 0)
      return NextResponse.json({ error: "each item needs category_id and non-negative monthly_amount" }, { status: 400 });
  }

  await Promise.all(
    categories.map((c) => upsertCategoryBudget(userId, c.category_id, month, c.monthly_amount))
  );

  return NextResponse.json({ ok: true, updated: categories.length });
}
