import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/apiAuth";
import { getBudgetIncome, upsertBudgetIncome } from "@/lib/budgets";

export async function GET(request: Request) {
  const userId = await authenticateApiKey(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized — provide a valid Bearer token" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month))
    return NextResponse.json({ error: "month must be in YYYY-MM format" }, { status: 400 });

  const income = await getBudgetIncome(userId, month);
  return NextResponse.json({
    month,
    forecasted_amount: parseFloat(income.forecasted_amount),
    actual_income: parseFloat(income.actual_income),
  });
}

export async function PUT(request: Request) {
  const userId = await authenticateApiKey(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized — provide a valid Bearer token" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const { month, forecasted_amount } = body as { month: string; forecasted_amount: number };

  if (!month || !/^\d{4}-\d{2}$/.test(month))
    return NextResponse.json({ error: "month must be in YYYY-MM format" }, { status: 400 });
  if (typeof forecasted_amount !== "number" || forecasted_amount < 0)
    return NextResponse.json({ error: "forecasted_amount must be a non-negative number" }, { status: 400 });

  await upsertBudgetIncome(userId, month, forecasted_amount);
  return NextResponse.json({ ok: true });
}
