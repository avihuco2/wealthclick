import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

function prevMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { month } = await request.json() as { month: string };
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "Invalid month" }, { status: 400 });
  }

  const prior = prevMonth(month);
  const sql = getDb();

  // Copy all category budgets from prior month into current month (skip if already saved)
  await sql`
    INSERT INTO category_budgets (user_id, category_id, month, monthly_amount, updated_at)
    SELECT user_id, category_id, ${month}, monthly_amount, now()
    FROM category_budgets
    WHERE user_id = ${session.user.id} AND month = ${prior}
    ON CONFLICT (user_id, category_id, month) DO NOTHING
  `;

  // Copy forecasted income from prior month (skip if already saved)
  await sql`
    INSERT INTO budget_income (user_id, month, forecasted_amount, updated_at)
    SELECT user_id, ${month}, forecasted_amount, now()
    FROM budget_income
    WHERE user_id = ${session.user.id} AND month = ${prior}
    ON CONFLICT (user_id, month) DO NOTHING
  `;

  return NextResponse.json({ ok: true });
}
