import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/apiAuth";
import { getTransactionsByDateRange } from "@/lib/transactions";
import { getDb } from "@/lib/db";
import { upsertCategoryRule } from "@/lib/categoryRules";

export async function GET(request: Request) {
  const userId = await authenticateApiKey(request);
  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized — provide a valid Bearer token" },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const typeParam = searchParams.get("type");
  const limitParam = searchParams.get("limit");

  if (!from || !to) {
    return NextResponse.json(
      { error: "from and to query params are required (YYYY-MM-DD)" },
      { status: 400 },
    );
  }

  // Basic date format validation
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRe.test(from) || !dateRe.test(to)) {
    return NextResponse.json(
      { error: "from and to must be in YYYY-MM-DD format" },
      { status: 400 },
    );
  }

  if (from > to) {
    return NextResponse.json(
      { error: "from must be before or equal to to" },
      { status: 400 },
    );
  }

  let type: "income" | "expense" | undefined;
  if (typeParam) {
    if (typeParam !== "income" && typeParam !== "expense") {
      return NextResponse.json(
        { error: "type must be 'income' or 'expense'" },
        { status: 400 },
      );
    }
    type = typeParam;
  }

  const limit = limitParam ? parseInt(limitParam, 10) : 100;
  if (isNaN(limit) || limit < 1) {
    return NextResponse.json({ error: "limit must be a positive integer" }, { status: 400 });
  }

  const rows = await getTransactionsByDateRange(userId, from, to, type, limit);

  const transactions = rows.map((t) => ({
    id: t.id,
    date: t.date instanceof Date ? t.date.toISOString().slice(0, 10) : String(t.date),
    description: t.description,
    amount: parseFloat(t.amount),
    type: t.type,
    account: t.account ?? null,
    category: t.category_id
      ? {
          id: t.category_id,
          name_en: t.category_name_en,
          name_he: t.category_name_he,
          color: t.category_color,
          emoji: t.category_emoji,
        }
      : null,
    created_at: t.created_at instanceof Date ? t.created_at.toISOString() : String(t.created_at),
  }));

  return NextResponse.json({ data: transactions, count: transactions.length });
}

export async function POST(request: Request) {
  const userId = await authenticateApiKey(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized — provide a valid Bearer token" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const { description, amount, type, date, category_id, account } = body;

  if (!description || typeof description !== "string" || !description.trim())
    return NextResponse.json({ error: "description is required" }, { status: 400 });
  if (typeof amount !== "number" || amount <= 0)
    return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
  if (type !== "income" && type !== "expense")
    return NextResponse.json({ error: "type must be 'income' or 'expense'" }, { status: 400 });
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!date || !dateRe.test(date))
    return NextResponse.json({ error: "date is required (YYYY-MM-DD)" }, { status: 400 });

  const sql = getDb();
  const catId: string | null = category_id ?? null;
  const acc: string | null = account?.trim() || null;

  const [row] = await sql<{ id: string }[]>`
    INSERT INTO transactions (user_id, category_id, account, date, amount, description, type)
    VALUES (${userId}, ${catId}, ${acc}, ${date}, ${amount}, ${description.trim()}, ${type})
    RETURNING id
  `;

  if (catId && description.trim()) {
    await upsertCategoryRule(userId, description.trim(), catId);
  }

  return NextResponse.json({ id: row.id }, { status: 201 });
}
