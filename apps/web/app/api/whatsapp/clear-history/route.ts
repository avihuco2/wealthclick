import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sql = getDb();
  const result = await sql<{ count: number }[]>`
    DELETE FROM whatsapp_conversations WHERE user_id = ${session.user.id}
    RETURNING 1
  `;

  console.log(`[whatsapp] cleared ${result.length} conversation(s) for user ${session.user.id}`);
  return NextResponse.json({ ok: true, cleared: result.length });
}
