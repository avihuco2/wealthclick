import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/apiAuth";
import { getDb } from "@/lib/db";

export async function GET(request: Request) {
  const userId = await authenticateApiKey(request);
  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized — provide a valid Bearer token" },
      { status: 401 },
    );
  }

  const sql = getDb();
  const rows = await sql<{ account: string; transaction_count: string; total_income: string; total_expenses: string; last_transaction_date: string }[]>`
    SELECT
      account,
      COUNT(*)::text                                                     AS transaction_count,
      COALESCE(SUM(amount) FILTER (WHERE type = 'income'),  0)::text    AS total_income,
      COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0)::text    AS total_expenses,
      MAX(date)::text                                                    AS last_transaction_date
    FROM transactions
    WHERE user_id = ${userId} AND account IS NOT NULL AND account <> ''
    GROUP BY account
    ORDER BY MAX(date) DESC, SUM(amount) DESC
  `;

  const data = rows.map((r) => ({
    account: r.account,
    transaction_count: parseInt(r.transaction_count, 10),
    total_income: parseFloat(r.total_income),
    total_expenses: parseFloat(r.total_expenses),
    last_transaction_date: r.last_transaction_date,
  }));

  return NextResponse.json({ data, count: data.length });
}
