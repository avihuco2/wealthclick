import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sql = getDb();
  const userId = session.user.id;

  const txns   = await sql`DELETE FROM transactions WHERE user_id = ${userId} RETURNING id`;
  await sql`DELETE FROM whatsapp_conversations WHERE user_id = ${userId}`;
  await sql`DELETE FROM scrape_history WHERE bank_account_id IN (SELECT id FROM bank_accounts WHERE user_id = ${userId})`;

  console.log(`[admin/clear-data] cleared ${txns.length} transactions for user ${userId}`);
  return NextResponse.json({ ok: true, transactions_deleted: txns.length });
}
