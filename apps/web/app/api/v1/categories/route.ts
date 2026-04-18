import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/apiAuth";
import { getDb } from "@/lib/db";

export async function GET(request: Request) {
  const userId = await authenticateApiKey(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized — provide a valid Bearer token" }, { status: 401 });
  }

  const sql = getDb();
  const rows = await sql<{
    id: string; name_en: string; name_he: string; color: string; emoji: string; created_at: Date;
  }[]>`
    SELECT id, name_en, name_he, color, emoji, created_at
    FROM categories
    WHERE user_id = ${userId}
    ORDER BY name_en ASC
  `;

  const categories = rows.map((c) => ({
    id: c.id,
    name_en: c.name_en,
    name_he: c.name_he,
    color: c.color,
    emoji: c.emoji,
    created_at: c.created_at instanceof Date ? c.created_at.toISOString() : String(c.created_at),
  }));

  return NextResponse.json({ data: categories, count: categories.length });
}
