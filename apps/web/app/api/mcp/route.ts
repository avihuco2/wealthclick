/**
 * WealthClick MCP Server — Streamable HTTP transport (manual implementation)
 *
 * Auth: Bearer token (wc_...) on the initialize request only.
 * Subsequent requests use Mcp-Session-Id header.
 *
 * Connect from Claude.ai: Settings → Integrations → MCP → add URL: <your-domain>/api/mcp
 */

import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { authenticateApiKey } from "@/lib/apiAuth";
import { getTransactionsByDateRange } from "@/lib/transactions";
import { getInsightsData } from "@/lib/insights";
import { getDb } from "@/lib/db";
import { upsertCategoryRule } from "@/lib/categoryRules";
import { toolGetBudget, toolSetCategoryBudget, toolSetForecastedIncome } from "@/lib/agentTools";

// ─── Session store — persists in PM2 process on EC2 ────────────────────────

const sessions = new Map<string, string>(); // sessionId → userId

// ─── Protocol constants ──────────────────────────────────────────────────────

const PROTOCOL_VERSION = "2024-11-05";
const SERVER_INFO = { name: "WealthClick", version: "1.0.0" };
const CAPABILITIES = { tools: {} };

// ─── JSON-RPC helpers ────────────────────────────────────────────────────────

function ok(id: unknown, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id, result });
}
function err(id: unknown, code: number, message: string, status = 200) {
  return NextResponse.json({ jsonrpc: "2.0", id, error: { code, message } }, { status });
}
function textContent(text: string) {
  return { content: [{ type: "text", text }] };
}
function errorContent(message: string) {
  return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "get_transactions",
    description: "List your financial transactions for a date range. Returns income, expenses, amounts, categories, and accounts.",
    inputSchema: {
      type: "object",
      properties: {
        from:    { type: "string", description: "Start date, format YYYY-MM-DD (inclusive)" },
        to:      { type: "string", description: "End date, format YYYY-MM-DD (inclusive)" },
        type:    { type: "string", enum: ["income", "expense"], description: "Filter by transaction type (optional)" },
        account: { type: "string", description: "Filter by account name (partial match, optional). Use list_accounts to see available accounts." },
        limit:   { type: "number", description: "Max results, default 100, max 500 (optional)" },
      },
      required: ["from", "to"],
    },
  },
  {
    name: "list_accounts",
    description: "List all bank/credit card accounts that have transactions, with transaction count and total amount.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_spending_summary",
    description: "Get a monthly spending summary: income vs expenses, net, top categories, spending pace, and comparison to the prior month.",
    inputSchema: {
      type: "object",
      properties: {
        month: { type: "string", description: "Month in YYYY-MM format, e.g. 2025-03" },
      },
      required: ["month"],
    },
  },
  {
    name: "list_categories",
    description: "List all your spending categories (name in English and Hebrew, color, emoji).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "create_transaction",
    description: "Create a new financial transaction.",
    inputSchema: {
      type: "object",
      properties: {
        description: { type: "string", description: "Transaction description" },
        amount:      { type: "number", description: "Amount in ILS (positive)" },
        type:        { type: "string", enum: ["income", "expense"] },
        date:        { type: "string", description: "Date in YYYY-MM-DD format" },
        category_id: { type: "string", description: "Category UUID (optional)" },
        account:     { type: "string", description: "Account name e.g. Visa (optional)" },
      },
      required: ["description", "amount", "type", "date"],
    },
  },
  {
    name: "update_transaction",
    description: "Partially update an existing transaction. Only provide fields you want to change.",
    inputSchema: {
      type: "object",
      properties: {
        id:          { type: "string", description: "Transaction UUID" },
        description: { type: "string" },
        amount:      { type: "number" },
        type:        { type: "string", enum: ["income", "expense"] },
        date:        { type: "string", description: "YYYY-MM-DD" },
        category_id: { type: "string", nullable: true },
        account:     { type: "string", nullable: true },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_transaction",
    description: "Delete a transaction by ID.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Transaction UUID to delete" },
      },
      required: ["id"],
    },
  },
  {
    name: "get_budget",
    description: "Get the monthly budget plan: forecasted income, per-category budgets, actual spending this month, and 3mo/6mo spending averages.",
    inputSchema: {
      type: "object",
      properties: {
        month: { type: "string", description: "Month in YYYY-MM format, e.g. 2025-03" },
      },
      required: ["month"],
    },
  },
  {
    name: "set_category_budget",
    description: "Set or update the monthly budget for a specific category. Use list_categories to look up category IDs.",
    inputSchema: {
      type: "object",
      properties: {
        month:          { type: "string", description: "Month in YYYY-MM format" },
        category_id:    { type: "string", description: "Category UUID" },
        monthly_amount: { type: "number", description: "Budget amount in ILS (non-negative)" },
      },
      required: ["month", "category_id", "monthly_amount"],
    },
  },
  {
    name: "set_forecasted_income",
    description: "Set the expected (forecasted) income for a month.",
    inputSchema: {
      type: "object",
      properties: {
        month:             { type: "string", description: "Month in YYYY-MM format" },
        forecasted_amount: { type: "number", description: "Expected income in ILS (non-negative)" },
      },
      required: ["month", "forecasted_amount"],
    },
  },
];

// ─── Tool handlers ────────────────────────────────────────────────────────────

async function callTool(name: string, args: Record<string, unknown>, userId: string) {
  switch (name) {

    case "get_transactions": {
      const from    = args.from as string;
      const to      = args.to as string;
      const type    = args.type as "income" | "expense" | undefined;
      const account = args.account as string | undefined;
      const limit   = typeof args.limit === "number" ? args.limit : 100;

      if (!from || !to) return errorContent("from and to are required");
      if (from > to)    return errorContent("from must be before or equal to to");

      const rows = await getTransactionsByDateRange(userId, from, to, type, account, limit);
      if (rows.length === 0) return textContent(`No transactions found between ${from} and ${to}.`);

      const fmt = (n: string | number) =>
        new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", minimumFractionDigits: 0 }).format(Number(n));

      const lines = rows.map((t) => {
        const dateStr = t.date instanceof Date ? t.date.toISOString().slice(0, 10) : String(t.date);
        const cat = t.category_name_en ? ` [${t.category_emoji || ""} ${t.category_name_en}]` : " [Uncategorized]";
        const acc = t.account ? ` (${t.account})` : "";
        const sign = t.type === "income" ? "+" : "-";
        return `• ${dateStr} ${sign}${fmt(t.amount)} — ${t.description}${cat}${acc}`;
      });

      const total = rows.reduce((s, t) => s + (t.type === "income" ? 1 : -1) * parseFloat(t.amount), 0);
      const summary = `${rows.length} transactions, net: ${total >= 0 ? "+" : ""}${fmt(total)}`;

      return textContent(`Transactions from ${from} to ${to} (${summary}):\n\n${lines.join("\n")}`);
    }

    case "get_spending_summary": {
      const month = args.month as string;
      if (!month || !/^\d{4}-\d{2}$/.test(month)) return errorContent("month must be in YYYY-MM format");

      const data = await getInsightsData(userId, month);
      const fmt  = (n: string | number) =>
        new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", minimumFractionDigits: 0 }).format(Number(n));

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

      const lines = [
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
      ];

      return textContent(lines.join("\n"));
    }

    case "list_accounts": {
      const sql  = getDb();
      const rows = await sql<{ account: string; count: string; total: string }[]>`
        SELECT account, COUNT(*)::text AS count, SUM(amount)::text AS total
        FROM transactions WHERE user_id = ${userId} AND account IS NOT NULL AND account <> ''
        GROUP BY account ORDER BY SUM(amount) DESC
      `;
      if (rows.length === 0) return textContent("No accounts found (transactions may not have account info).");
      const fmtAmt = (n: string) => new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", minimumFractionDigits: 0 }).format(Number(n));
      const lines = rows.map((r) => `• ${r.account} — ${r.count} transactions, total ${fmtAmt(r.total)}`);
      return textContent(`Your accounts:\n\n${lines.join("\n")}`);
    }

    case "list_categories": {
      const sql  = getDb();
      const rows = await sql<{ id: string; name_en: string; name_he: string; color: string; emoji: string }[]>`
        SELECT id, name_en, name_he, color, emoji FROM categories WHERE user_id = ${userId} ORDER BY name_en
      `;
      if (rows.length === 0) return textContent("No categories found.");
      const lines = rows.map((c) => `• ${c.emoji || "🏷️"} ${c.name_en} / ${c.name_he}  (id: ${c.id})`);
      return textContent(`Your categories:\n\n${lines.join("\n")}`);
    }

    case "create_transaction": {
      const { description, amount, type, date, category_id, account } = args;
      if (!description || typeof description !== "string") return errorContent("description required");
      if (typeof amount !== "number" || amount <= 0)        return errorContent("amount must be positive");
      if (type !== "income" && type !== "expense")          return errorContent("type must be income or expense");
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date as string)) return errorContent("date must be YYYY-MM-DD");

      const sql = getDb();
      const catId: string | null = (category_id as string) ?? null;
      const acc:   string | null = (account as string)?.trim() || null;

      const [row] = await sql<{ id: string }[]>`
        INSERT INTO transactions (user_id, category_id, account, date, amount, description, type)
        VALUES (${userId}, ${catId}, ${acc}, ${date as string}, ${amount}, ${(description as string).trim()}, ${type as string})
        RETURNING id
      `;
      if (catId) await upsertCategoryRule(userId, (description as string).trim(), catId);
      return textContent(`Transaction created with id: ${row.id}`);
    }

    case "update_transaction": {
      const { id, description, amount, type, date, category_id, account } = args;
      if (!id) return errorContent("id required");
      if (amount !== undefined && (typeof amount !== "number" || amount <= 0)) return errorContent("amount must be positive");
      if (type !== undefined && type !== "income" && type !== "expense") return errorContent("type must be income or expense");
      if (date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(date as string)) return errorContent("date must be YYYY-MM-DD");

      const sql = getDb();
      const [existing] = await sql<{
        description: string; amount: string; type: string; date: Date; category_id: string | null; account: string | null;
      }[]>`SELECT description, amount, type, date, category_id, account FROM transactions WHERE id = ${id as string} AND user_id = ${userId}`;
      if (!existing) return errorContent("Transaction not found");

      const newDesc   = (description as string)?.trim() ?? existing.description;
      const newAmount = (amount as number)  ?? parseFloat(existing.amount);
      const newType   = (type as string)    ?? existing.type;
      const newDate   = (date as string)    ?? (existing.date instanceof Date ? existing.date.toISOString().slice(0, 10) : String(existing.date));
      const newCatId  = category_id !== undefined ? ((category_id as string) ?? null) : existing.category_id;
      const newAcc    = account !== undefined ? ((account as string)?.trim() || null) : existing.account;

      await sql`
        UPDATE transactions SET description=${newDesc}, amount=${newAmount}, type=${newType},
          date=${newDate}, category_id=${newCatId}, account=${newAcc}, updated_at=NOW()
        WHERE id=${id as string} AND user_id=${userId}
      `;
      if (newCatId) await upsertCategoryRule(userId, newDesc, newCatId);
      return textContent(`Transaction ${id} updated.`);
    }

    case "delete_transaction": {
      const { id } = args;
      if (!id) return errorContent("id required");
      const sql  = getDb();
      const rows = await sql`DELETE FROM transactions WHERE id = ${id as string} AND user_id = ${userId} RETURNING id`;
      if (rows.length === 0) return errorContent("Transaction not found");
      return textContent(`Transaction ${id} deleted.`);
    }

    case "get_budget": {
      const month = args.month as string;
      try {
        return textContent(await toolGetBudget(userId, { month }));
      } catch (e) {
        return errorContent(e instanceof Error ? e.message : "Error");
      }
    }

    case "set_category_budget": {
      const { month, category_id, monthly_amount } = args;
      try {
        return textContent(await toolSetCategoryBudget(userId, {
          month: month as string,
          category_id: category_id as string,
          monthly_amount: monthly_amount as number,
        }));
      } catch (e) {
        return errorContent(e instanceof Error ? e.message : "Error");
      }
    }

    case "set_forecasted_income": {
      const { month, forecasted_amount } = args;
      try {
        return textContent(await toolSetForecastedIncome(userId, {
          month: month as string,
          forecasted_amount: forecasted_amount as number,
        }));
      } catch (e) {
        return errorContent(e instanceof Error ? e.message : "Error");
      }
    }

    default:
      return errorContent(`Unknown tool: ${name}`);
  }
}

// ─── Route handlers ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return err(null, -32700, "Parse error", 400);
  }

  const msgId    = (body as Record<string, unknown>).id ?? null;
  const method   = (body as Record<string, unknown>).method as string;
  const params   = ((body as Record<string, unknown>).params ?? {}) as Record<string, unknown>;
  const isNotif  = !("id" in (body as object));

  // ── initialize ───────────────────────────────────────────────────────────
  if (method === "initialize") {
    const userId = await authenticateApiKey(request);
    if (!userId) return err(msgId, -32001, "Unauthorized — provide a valid Bearer token", 401);

    const sessionId = randomUUID();
    sessions.set(sessionId, userId);

    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: msgId,
        result: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: CAPABILITIES,
          serverInfo: SERVER_INFO,
        },
      },
      { headers: { "Content-Type": "application/json", "Mcp-Session-Id": sessionId } },
    );
  }

  // ── all other requests require a valid session ───────────────────────────
  const sessionId = request.headers.get("mcp-session-id");
  const userId    = sessionId ? (sessions.get(sessionId) ?? null) : null;

  if (!userId && !isNotif) {
    return err(msgId, -32000, "Not initialized — send initialize request first", 400);
  }

  // ── notifications (no id) — always 202 ──────────────────────────────────
  if (isNotif) return new Response(null, { status: 202 });

  // ── ping ─────────────────────────────────────────────────────────────────
  if (method === "ping") return ok(msgId, {});

  // ── tools/list ───────────────────────────────────────────────────────────
  if (method === "tools/list") return ok(msgId, { tools: TOOLS });

  // ── tools/call ───────────────────────────────────────────────────────────
  if (method === "tools/call") {
    const toolName = params.name as string;
    const toolArgs = (params.arguments ?? {}) as Record<string, unknown>;
    if (!toolName) return err(msgId, -32602, "params.name required");
    try {
      const result = await callTool(toolName, toolArgs, userId!);
      return ok(msgId, result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Internal error";
      return ok(msgId, errorContent(msg));
    }
  }

  return err(msgId, -32601, `Method not found: ${method}`);
}

// GET — we don't support SSE listening streams, return 405
export async function GET() {
  return new Response("Method Not Allowed", { status: 405 });
}

// DELETE — session termination
export async function DELETE(request: Request) {
  const sessionId = request.headers.get("mcp-session-id");
  if (sessionId) sessions.delete(sessionId);
  return new Response(null, { status: 200 });
}
