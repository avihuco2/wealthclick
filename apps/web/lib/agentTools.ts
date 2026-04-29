/**
 * Shared tool execution layer — called by both the MCP server and the Bedrock WhatsApp agent.
 * Each function accepts userId + args and returns a plain-text string result (or throws).
 */

import { getDb } from "./db";
import { getTransactionsByDateRange } from "./transactions";
import { getInsightsData } from "./insights";
import { upsertCategoryRule } from "./categoryRules";
import { getCategoryBudgets, getBudgetIncome, upsertCategoryBudget, upsertBudgetIncome } from "./budgets";
import { getBankAccounts, createScrapeJob } from "./bankAccounts";
import { startScrapeJob } from "./scraper";

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmt(n: string | number): string {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    minimumFractionDigits: 0,
  }).format(Number(n));
}

// ─── Tool implementations ─────────────────────────────────────────────────────

export async function toolListAccounts(userId: string): Promise<string> {
  const sql = getDb();
  const rows = await sql<{ account: string; count: string; total: string }[]>`
    SELECT account, COUNT(*)::text AS count, SUM(amount)::text AS total
    FROM transactions
    WHERE user_id = ${userId} AND account IS NOT NULL AND account <> ''
    GROUP BY account ORDER BY SUM(amount) DESC
  `;
  if (rows.length === 0) return "No accounts found (transactions may not have account info).";
  const lines = rows.map((r) => `• ${r.account} — ${r.count} transactions, total ${fmt(r.total)}`);
  return `Your accounts:\n\n${lines.join("\n")}`;
}

export async function toolGetTransactions(
  userId: string,
  args: { from: string; to: string; type?: "income" | "expense"; account?: string; limit?: number },
): Promise<string> {
  const { from, to, type, account, limit = 100 } = args;
  if (!from || !to) throw new Error("from and to are required");
  if (from > to) throw new Error("from must be before or equal to to");

  const rows = await getTransactionsByDateRange(userId, from, to, type, account, limit);
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
  const accountNote = account ? ` (account filter: "${account}")` : "";
  return `Transactions from ${from} to ${to}${accountNote} (${summary}):\n\n${lines.join("\n")}`;
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

export async function toolGetBudget(userId: string, args: { month: string }): Promise<string> {
  const { month } = args;
  if (!month || !/^\d{4}-\d{2}$/.test(month)) throw new Error("month must be YYYY-MM");

  const [rows, income] = await Promise.all([
    getCategoryBudgets(userId, month),
    getBudgetIncome(userId, month),
  ]);

  const forecasted = parseFloat(income.forecasted_amount);
  const actual     = parseFloat(income.actual_income);
  const totalBudget = rows.reduce((s, r) => s + parseFloat(r.monthly_budget), 0);
  const totalActual = rows.reduce((s, r) => s + parseFloat(r.current_month_actual), 0);

  const lines = rows.map((r) => {
    const budget = parseFloat(r.monthly_budget);
    const spent  = parseFloat(r.current_month_actual);
    const avg3   = parseFloat(r.avg_3m);
    const avg6   = parseFloat(r.avg_6m);
    const pct    = forecasted > 0 && budget > 0 ? ` (${Math.round((budget / forecasted) * 100)}% of income)` : "";
    const status = budget > 0 ? (spent > budget ? " ⚠️ over budget" : ` remaining: ${fmt(budget - spent)}`) : "";
    return `  • ${r.emoji || "🏷️"} ${r.name_en}: budget ${fmt(budget)}${pct}, spent ${fmt(spent)}${status} | 3mo avg ${fmt(avg3)}, 6mo avg ${fmt(avg6)}`;
  });

  return [
    `📋 Budget — ${month}`,
    "",
    `💰 Forecasted income: ${fmt(forecasted)} | Actual income: ${fmt(actual)}`,
    `📊 Total budgeted: ${fmt(totalBudget)} | Total spent: ${fmt(totalActual)} | Remaining: ${fmt(totalBudget - totalActual)}`,
    "",
    "Per category:",
    ...lines,
  ].join("\n");
}

export async function toolSetCategoryBudget(
  userId: string,
  args: { month: string; category_id: string; monthly_amount: number },
): Promise<string> {
  const { month, category_id, monthly_amount } = args;
  if (!month || !/^\d{4}-\d{2}$/.test(month)) throw new Error("month must be YYYY-MM");
  if (!category_id) throw new Error("category_id required");
  if (typeof monthly_amount !== "number" || monthly_amount < 0) throw new Error("monthly_amount must be a non-negative number");

  await upsertCategoryBudget(userId, category_id, month, monthly_amount);
  return `Budget for category ${category_id} in ${month} set to ${fmt(monthly_amount)}.`;
}

export async function toolSetForecastedIncome(
  userId: string,
  args: { month: string; forecasted_amount: number },
): Promise<string> {
  const { month, forecasted_amount } = args;
  if (!month || !/^\d{4}-\d{2}$/.test(month)) throw new Error("month must be YYYY-MM");
  if (typeof forecasted_amount !== "number" || forecasted_amount < 0) throw new Error("forecasted_amount must be a non-negative number");

  await upsertBudgetIncome(userId, month, forecasted_amount);
  return `Forecasted income for ${month} set to ${fmt(forecasted_amount)}.`;
}

export async function toolGetScraperStatus(userId: string): Promise<string> {
  const accounts = await getBankAccounts(userId);
  if (accounts.length === 0) return "No bank accounts connected.";

  const sql = getDb();
  const lines: string[] = [];

  for (const acc of accounts) {
    const [job] = await sql<{
      status: string;
      started_at: Date;
      finished_at: Date | null;
      error: string | null;
      imported_count: number | null;
    }[]>`
      SELECT status, started_at, finished_at, error, imported_count
      FROM scrape_jobs
      WHERE bank_account_id = ${acc.id}
      ORDER BY created_at DESC LIMIT 1
    `;

    const nick = acc.nickname || acc.company_id;
    const enabled = acc.scrape_enabled ? "auto-sync on" : "auto-sync off";
    const lastSync = acc.last_scraped_at
      ? new Date(acc.last_scraped_at).toLocaleString("he-IL")
      : "never";

    let statusLine = `• ${nick} (${enabled}) — last sync: ${lastSync}`;

    if (job) {
      if (job.status === "running" || job.status === "awaiting_otp") {
        const elapsed = Math.round((Date.now() - new Date(job.started_at).getTime()) / 1000);
        statusLine += ` | Current: ${job.status} (${elapsed}s ago)`;
      } else if (job.status === "done") {
        statusLine += ` | Status: ✅ success (${job.imported_count || 0} new txns)`;
      } else if (job.status === "failed") {
        const err = job.error ? ` — ${job.error.slice(0, 60)}` : "";
        statusLine += ` | Status: ❌ failed${err}`;
      }
    }

    if (acc.status === "error" && acc.last_error) {
      statusLine += `\n  Error: ${acc.last_error.slice(0, 80)}`;
    }

    lines.push(statusLine);
  }

  return `Bank account scraper status:\n\n${lines.join("\n")}`;
}

export async function toolListUncategorized(
  userId: string,
  args: { limit?: number; offset?: number },
): Promise<string> {
  const { limit = 20, offset = 0 } = args;
  if (limit < 1 || limit > 100) throw new Error("limit must be 1-100");
  if (offset < 0) throw new Error("offset must be non-negative");

  const sql = getDb();
  const rows = await sql<{
    id: string;
    date: Date | string;
    description: string;
    amount: string;
    type: string;
    account: string | null;
  }[]>`
    SELECT id, date, description, amount, type, account
    FROM transactions
    WHERE user_id = ${userId} AND category_id IS NULL
    ORDER BY date DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  if (rows.length === 0) {
    return offset === 0
      ? "🎉 All transactions are categorized!"
      : `No more uncategorized transactions (offset ${offset}).`;
  }

  const [{ count }] = await sql<{ count: string }[]>`
    SELECT COUNT(*)::text AS count FROM transactions WHERE user_id = ${userId} AND category_id IS NULL
  `;
  const total = parseInt(count, 10);

  const lines = rows.map((t, i) => {
    const dateStr = t.date instanceof Date ? t.date.toISOString().slice(0, 10) : String(t.date).slice(0, 10);
    const acc = t.account ? ` (${t.account})` : "";
    const sign = t.type === "income" ? "+" : "-";
    return `${offset + i + 1}. [ID: ${t.id.slice(0, 8)}] ${dateStr} ${sign}${fmt(t.amount)} — ${t.description}${acc}`;
  });

  const showing = `Showing ${offset + 1}-${offset + rows.length} of ${total} uncategorized transactions`;
  return `${showing}\n\n${lines.join("\n")}\n\n💡 Use categorize_transaction with the ID to assign a category, or create_category to add a new one.`;
}

export async function toolCategorizeTransaction(
  userId: string,
  args: { id: string; category_id: string },
): Promise<string> {
  const { id, category_id } = args;
  if (!id || !category_id) throw new Error("id and category_id required");

  const sql = getDb();

  // Verify category belongs to user
  const [cat] = await sql<{ name_en: string; emoji: string }[]>`
    SELECT name_en, emoji FROM categories WHERE id = ${category_id} AND user_id = ${userId}
  `;
  if (!cat) throw new Error("Category not found");

  // Verify transaction belongs to user
  const [txn] = await sql<{ description: string; amount: string }[]>`
    SELECT description, amount FROM transactions WHERE id = ${id} AND user_id = ${userId}
  `;
  if (!txn) throw new Error("Transaction not found");

  await sql`
    UPDATE transactions SET category_id = ${category_id}, updated_at = NOW()
    WHERE id = ${id} AND user_id = ${userId}
  `;

  // Create category rule for future auto-categorization
  await upsertCategoryRule(userId, txn.description, category_id);

  return `✅ Transaction "${txn.description}" (${fmt(txn.amount)}) categorized as ${cat.emoji} ${cat.name_en}`;
}

export async function toolCreateCategory(
  userId: string,
  args: { name_en: string; name_he: string; emoji?: string; color?: string },
): Promise<string> {
  const { name_en, name_he, emoji, color } = args;
  if (!name_en || !name_he) throw new Error("name_en and name_he required");

  const sql = getDb();
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO categories (user_id, name_en, name_he, emoji, color, icon)
    VALUES (${userId}, ${name_en.trim()}, ${name_he.trim()}, ${emoji || "📌"}, ${color || "#8E8E93"}, ${"circle"})
    RETURNING id
  `;

  return `✅ Category created: ${emoji || "📌"} ${name_en} / ${name_he} (id: ${row.id})`;
}

export async function toolTriggerScrape(userId: string, args: { company_id?: string }): Promise<string> {
  const { company_id } = args;
  const accounts = await getBankAccounts(userId);

  if (accounts.length === 0) return "No bank accounts connected.";

  let targetAccounts = company_id
    ? accounts.filter((a) => a.company_id === company_id)
    : accounts;

  if (targetAccounts.length === 0) {
    const available = accounts.map((a) => a.company_id).join(", ");
    return `No account found for company_id "${company_id}". Available: ${available}`;
  }

  const sql = getDb();
  const started: string[] = [];

  for (const acc of targetAccounts) {
    // Check if already running
    const [running] = await sql<{ id: string }[]>`
      SELECT id FROM scrape_jobs
      WHERE bank_account_id = ${acc.id} AND status IN ('running', 'awaiting_otp')
      ORDER BY created_at DESC LIMIT 1
    `;

    if (running) {
      started.push(`${acc.nickname || acc.company_id}: already running (job ${running.id})`);
      continue;
    }

    const job = await createScrapeJob(userId, acc.id);
    startScrapeJob(job.id, userId, acc.id, acc.company_id, acc.credentials_encrypted);
    started.push(`${acc.nickname || acc.company_id}: started (job ${job.id})`);
  }

  return `Manual scrape triggered:\n\n${started.map(s => `• ${s}`).join("\n")}`;
}
