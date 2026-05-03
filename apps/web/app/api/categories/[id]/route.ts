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
  let body: { name_en?: string; name_he?: string; emoji?: string; color?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name_en, name_he, emoji, color } = body;
  if (!name_en?.trim() || !name_he?.trim())
    return NextResponse.json({ error: "name_en and name_he required" }, { status: 400 });

  const sql = getDb();
  const rows = await sql<{ id: string; name_en: string; name_he: string; emoji: string; color: string }[]>`
    UPDATE categories
    SET name_en = ${name_en.trim()},
        name_he = ${name_he.trim()},
        emoji   = ${emoji?.trim() || "📌"},
        color   = ${color?.trim() || "#8E8E93"}
    WHERE id = ${id} AND user_id = ${session.user.id}
    RETURNING id, name_en, name_he, emoji, color
  `;

  if (rows.length === 0)
    return NextResponse.json({ error: "Category not found" }, { status: 404 });

  return NextResponse.json(rows[0]);
}
