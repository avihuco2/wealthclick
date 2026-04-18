import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/apiAuth";
import { getDb } from "@/lib/db";
import { upsertCategoryRule } from "@/lib/categoryRules";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await authenticateApiKey(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized — provide a valid Bearer token" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const { description, amount, type, date, category_id, account } = body;

  // At least one field required
  if (description === undefined && amount === undefined && type === undefined &&
      date === undefined && category_id === undefined && account === undefined) {
    return NextResponse.json({ error: "At least one field required" }, { status: 400 });
  }

  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (date !== undefined && !dateRe.test(date))
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  if (amount !== undefined && (typeof amount !== "number" || amount <= 0))
    return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
  if (type !== undefined && type !== "income" && type !== "expense")
    return NextResponse.json({ error: "type must be 'income' or 'expense'" }, { status: 400 });

  const sql = getDb();

  // Fetch current row to merge with partial update
  const [existing] = await sql<{
    description: string; amount: string; type: string; date: Date; category_id: string | null; account: string | null;
  }[]>`
    SELECT description, amount, type, date, category_id, account
    FROM transactions WHERE id = ${id} AND user_id = ${userId}
  `;
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const newDescription = description?.trim() ?? existing.description;
  const newAmount      = amount ?? parseFloat(existing.amount);
  const newType        = type ?? existing.type;
  const newDate        = date ?? (existing.date instanceof Date ? existing.date.toISOString().slice(0, 10) : String(existing.date));
  const newCategoryId  = category_id !== undefined ? (category_id ?? null) : existing.category_id;
  const newAccount     = account !== undefined ? (account?.trim() || null) : existing.account;

  await sql`
    UPDATE transactions
    SET description = ${newDescription},
        amount      = ${newAmount},
        type        = ${newType},
        date        = ${newDate},
        category_id = ${newCategoryId},
        account     = ${newAccount},
        updated_at  = NOW()
    WHERE id = ${id} AND user_id = ${userId}
  `;

  if (newCategoryId && newDescription) {
    await upsertCategoryRule(userId, newDescription, newCategoryId);
  }

  return NextResponse.json({ id });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await authenticateApiKey(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized — provide a valid Bearer token" }, { status: 401 });
  }

  const { id } = await params;
  const sql = getDb();

  const rows = await sql`
    DELETE FROM transactions WHERE id = ${id} AND user_id = ${userId} RETURNING id
  `;

  if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ deleted: id });
}
