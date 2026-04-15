import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  if (!("category_id" in body))
    return NextResponse.json({ error: "category_id required" }, { status: 400 });

  const categoryId: string | null = body.category_id ?? null;

  const sql = getDb();
  const rows = await sql`
    UPDATE transactions
    SET category_id = ${categoryId}, updated_at = NOW()
    WHERE id = ${id} AND user_id = ${session.user.id}
    RETURNING id
  `;

  if (rows.length === 0)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ id });
}
