/**
 * Shared tool execution layer — called by both the MCP server and the Bedrock WhatsApp agent.
 * Each function accepts userId + args and returns a plain-text string result (or throws).
 */

import { getDb } from "./db";
import { getTransactionsByDateRange } from "./transactions";
import { getInsightsData } from "./insights";
import { upsertCategoryRule } from "./categoryRules";

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmt(n: string | number): string {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    minimumFractionDigits: 0,
  }).format(Number(n));
}

// ─── Tool implementations ─────────────────────────────────────────────────────

export async function toolGetTransactions(
  userId: string,
  args: { from: string; to: string; type?: "income" | "expense"; limit?: number },
): Promise<string> {
  const { from, to, type, limit = 100 } = args;
  if (!from || !to) throw new Error("from and to are required");
  if (from > to) throw new Error("from must be before or equal to to");

  const rows = await getTransactionsByDateRange(userId, from, to, type, limit);
  if (rows.length === 0) return `No transactions found between ${from} and ${to}.`;

  const lines = rows.map((t) => {
    const dateStr = t.date instanceof Date ? t.date.toISOString().slice(0, 10) : String(t.date);
    const cat = t.category_name_en ? ` [${t.category_emoji || ""} ${t.category_name_en}]` : " [Uncategorized]";
    const acc = t.account ? ` (${t.account})` : "";
    const sign = t.type === "income" ? "+" : "-";
    return `• ${dateStr} ${sign}${fmt(t.amount)} — ${t.description}${cat}${acc}`;
  });

  const total = rows.reduce((s, t) => s + (t.type === "income" ? 1 : -1) * parseFloat(t.amount), 0);
  const summary = `${rows.length} transactions, net: ${total >= 0 ? "+" : ""}${fmt(total)}`;
  return `Transactions from ${from} to ${to} (${summary}):\n\n${lines.join("\n")}`;
}

export async function toolGetSpendingSummary(userId: string, args: { month: string }): Promise<string> {
  const { month } = args;
  if (!month || !/^\d{4}-\d{2}$/.test(month)) throw new Error("month must be in YYYY-MM format");

  const data = await getInsightsData(userId, month);

  const cmp = data.periodComparison;
  const income   = parseFloat(cmp.current_income);
  const expenses = parseFloat(cmp.current_expenses);
  const net      = parseFloat(cmp.current_net);
  const priorInc = parseFloat(cmp.prior_income);
  const priorExp = parseFloat(cmp.prior_expenses);

  const pct = (a: number, b: number) =>
    b === 0 ? (a === 0 ? "—" : "new") : `${((a - b) / b * 100).toFixed(0)}%`;

  const breakdownLines = data.categoryBreakdown.map((c) =>
    `  • ${c.category_emoji || "🏷️"} ${c.category_name_en || "Uncategorized"}: ${fmt(c.total)} (${c.pct.toFixed(0)}%)`
  );
  const topLines = data.topExpenses.map((t, i) => {
    const d = t.date instanceof Date ? t.date.toISOString().slice(0, 10) : String(t.date);
    return `  ${i + 1}. ${t.description} — ${fmt(t.amount)} on ${d}`;
  });
  const pace = data.spendingPace;

  return [
    `📊 Spending Summary — ${month}`,
    "",
    `💰 Income:   ${fmt(income)} (${pct(income, priorInc)} vs last month)`,
    `💸 Expenses: ${fmt(expenses)} (${pct(expenses, priorExp)} vs last month)`,
    `📈 Net:      ${net >= 0 ? "+" : ""}${fmt(net)}`,
    "",
    "📂 Expenses by category:",
    ...breakdownLines,
    "",
    "🔝 Top expenses:",
    ...topLines,
    "",
    `⏱️ Spending pace: ${pace.active_days}/${pace.total_days} days active, avg ${fmt(pace.avg_per_day)}/day`,
  ].join("\n");
}

export async function toolListCategories(userId: string): Promise<string> {
  const sql = getDb();
  const rows = await sql<{ id: string; name_en: string; name_he: string; color: string; emoji: string }[]>`
    SELECT id, name_en, name_he, color, emoji FROM categories WHERE user_id = ${userId} ORDER BY name_en
  `;
  if (rows.length === 0) return "No categories found.";
  const lines = rows.map((c) => `• ${c.emoji || "🏷️"} ${c.name_en} / ${c.name_he}  (id: ${c.id})`);
  return `Your categories:\n\n${lines.join("\n")}`;
}

export async function toolCreateTransaction(
  userId: string,
  args: {
    description: string;
    amount: number;
    type: "income" | "expense";
    date: string;
    category_id?: string;
    account?: string;
  },
): Promise<string> {
  const { description, amount, type, date, category_id, account } = args;
  if (!description) throw new Error("description required");
  if (typeof amount !== "number" || amount <= 0) throw new Error("amount must be positive");
  if (type !== "income" && type !== "expense") throw new Error("type must be income or expense");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("date must be YYYY-MM-DD");

  const sql = getDb();
  const catId: string | null = category_id ?? null;
  const acc: string | null = account?.trim() || null;

  const [row] = await sql<{ id: string }[]>`
    INSERT INTO transactions (user_id, category_id, account, date, amount, description, type)
    VALUES (${userId}, ${catId}, ${acc}, ${date}, ${amount}, ${description.trim()}, ${type})
    RETURNING id
  `;
  if (catId) await upsertCategoryRule(userId, description.trim(), catId);
  return `Transaction created with id: ${row.id}`;
}

export async function toolUpdateTransaction(
  userId: string,
  args: {
    id: string;
    description?: string;
    amount?: number;
    type?: "income" | "expense";
    date?: string;
    category_id?: string | null;
    account?: string | null;
  },
): Promise<string> {
  const { id, description, amount, type, date, category_id, account } = args;
  if (!id) throw new Error("id required");
  if (amount !== undefined && (typeof amount !== "number" || amount <= 0)) throw new Error("amount must be positive");
  if (type !== undefined && type !== "income" && type !== "expense") throw new Error("type must be income or expense");
  if (date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("date must be YYYY-MM-DD");

  const sql = getDb();
  const [existing] = await sql<{
    description: string; amount: string; type: string; date: Date; category_id: string | null; account: string | null;
  }[]>`SELECT description, amount, type, date, category_id, account FROM transactions WHERE id = ${id} AND user_id = ${userId}`;
  if (!existing) throw new Error("Transaction not found");

  const newDesc   = description?.trim() ?? existing.description;
  const newAmount = amount ?? parseFloat(existing.amount);
  const newType   = type ?? existing.type;
  const newDate   = date ?? (existing.date instanceof Date ? existing.date.toISOString().slice(0, 10) : String(existing.date));
  const newCatId  = category_id !== undefined ? (category_id ?? null) : existing.category_id;
  const newAcc    = account !== undefined ? (account?.trim() || null) : existing.account;

  await sql`
    UPDATE transactions SET description=${newDesc}, amount=${newAmount}, type=${newType},
      date=${newDate}, category_id=${newCatId}, account=${newAcc}, updated_at=NOW()
    WHERE id=${id} AND user_id=${userId}
  `;
  if (newCatId) await upsertCategoryRule(userId, newDesc, newCatId);
  return `Transaction ${id} updated.`;
}

export async function toolDeleteTransaction(userId: string, args: { id: string }): Promise<string> {
  const { id } = args;
  if (!id) throw new Error("id required");
  const sql = getDb();
  const rows = await sql`DELETE FROM transactions WHERE id = ${id} AND user_id = ${userId} RETURNING id`;
  if (rows.length === 0) throw new Error("Transaction not found");
  return `Transaction ${id} deleted.`;
}
