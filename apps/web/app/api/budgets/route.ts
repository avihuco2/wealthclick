import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCategoryBudgets, upsertCategoryBudget } from "@/lib/budgets";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await getCategoryBudgets(session.user.id);
  return NextResponse.json(rows);
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { category_id, monthly_amount } = await request.json() as {
    category_id: string;
    monthly_amount: number;
  };

  if (!category_id || typeof monthly_amount !== "number" || monthly_amount < 0) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  await upsertCategoryBudget(session.user.id, category_id, monthly_amount);
  return NextResponse.json({ ok: true });
}
