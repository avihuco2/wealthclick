import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getBudgetIncome, upsertBudgetIncome } from "@/lib/budgets";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") ?? new Date().toISOString().slice(0, 7);

  const row = await getBudgetIncome(session.user.id, month);
  return NextResponse.json(row);
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { month, forecasted_amount } = await request.json() as {
    month: string;
    forecasted_amount: number;
  };

  if (!month || typeof forecasted_amount !== "number" || forecasted_amount < 0) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  await upsertBudgetIncome(session.user.id, month, forecasted_amount);
  return NextResponse.json({ ok: true });
}
