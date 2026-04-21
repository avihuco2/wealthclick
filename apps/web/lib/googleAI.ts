/**
 * Google AI (Gemini API) provider — used for Gemma 3 models.
 * Shares the same ConverseTurnResult interface as bedrock.ts.
 */

import { GoogleGenAI, Type, type Content, type Part, type FunctionDeclaration } from "@google/genai";
import type { Message, ContentBlock } from "@aws-sdk/client-bedrock-runtime";
import type { ConverseTurnResult } from "./bedrock";
import {
  toolGetTransactions,
  toolGetSpendingSummary,
  toolListCategories,
  toolCreateTransaction,
  toolUpdateTransaction,
  toolDeleteTransaction,
  toolGetBudget,
  toolSetCategoryBudget,
  toolSetForecastedIncome,
} from "./agentTools";

// ─── Tool declarations for Google AI ─────────────────────────────────────────

const GOOGLE_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "get_transactions",
    description: "List financial transactions for a date range.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        from:  { type: Type.STRING, description: "Start date YYYY-MM-DD (inclusive)" },
        to:    { type: Type.STRING, description: "End date YYYY-MM-DD (inclusive)" },
        type:  { type: Type.STRING, description: "Filter by type: income or expense (optional)" },
        limit: { type: Type.NUMBER, description: "Max results, default 100 (optional)" },
      },
      required: ["from", "to"],
    },
  },
  {
    name: "get_spending_summary",
    description: "Monthly spending report: income vs expenses, category breakdown, top expenses, spending pace.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        month: { type: Type.STRING, description: "Month in YYYY-MM format e.g. 2025-03" },
      },
      required: ["month"],
    },
  },
  {
    name: "list_categories",
    description: "List all spending categories with name, color, emoji, and ID.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "create_transaction",
    description: "Create a new financial transaction.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        description: { type: Type.STRING },
        amount:      { type: Type.NUMBER, description: "Positive amount in ILS" },
        type:        { type: Type.STRING, description: "income or expense" },
        date:        { type: Type.STRING, description: "YYYY-MM-DD" },
        category_id: { type: Type.STRING, description: "Category UUID (optional)" },
        account:     { type: Type.STRING, description: "Account name (optional)" },
      },
      required: ["description", "amount", "type", "date"],
    },
  },
  {
    name: "update_transaction",
    description: "Partially update an existing transaction.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        id:          { type: Type.STRING, description: "Transaction UUID" },
        description: { type: Type.STRING },
        amount:      { type: Type.NUMBER },
        type:        { type: Type.STRING },
        date:        { type: Type.STRING, description: "YYYY-MM-DD" },
        category_id: { type: Type.STRING },
        account:     { type: Type.STRING },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_transaction",
    description: "Delete a transaction by ID.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING, description: "Transaction UUID" },
      },
      required: ["id"],
    },
  },
  {
    name: "get_budget",
    description: "Get the monthly budget: forecasted income, per-category budgets, actual spending, averages.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        month: { type: Type.STRING, description: "Month in YYYY-MM format" },
      },
      required: ["month"],
    },
  },
  {
    name: "set_category_budget",
    description: "Set the monthly budget for a specific category.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        month:          { type: Type.STRING, description: "Month in YYYY-MM format" },
        category_id:    { type: Type.STRING, description: "Category UUID" },
        monthly_amount: { type: Type.NUMBER, description: "Budget amount in ILS" },
      },
      required: ["month", "category_id", "monthly_amount"],
    },
  },
  {
    name: "set_forecasted_income",
    description: "Set the expected income for a month.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        month:             { type: Type.STRING, description: "Month in YYYY-MM format" },
        forecasted_amount: { type: Type.NUMBER, description: "Expected income in ILS" },
      },
      required: ["month", "forecasted_amount"],
    },
  },
];

// ─── Tool executor (same as bedrock.ts) ──────────────────────────────────────

async function executeTool(name: string, args: Record<string, unknown>, userId: string): Promise<string> {
  switch (name) {
    case "get_transactions":      return toolGetTransactions(userId, args as Parameters<typeof toolGetTransactions>[1]);
    case "get_spending_summary":  return toolGetSpendingSummary(userId, args as { month: string });
    case "list_categories":       return toolListCategories(userId);
    case "create_transaction":    return toolCreateTransaction(userId, args as Parameters<typeof toolCreateTransaction>[1]);
    case "update_transaction":    return toolUpdateTransaction(userId, args as Parameters<typeof toolUpdateTransaction>[1]);
    case "delete_transaction":    return toolDeleteTransaction(userId, args as { id: string });
    case "get_budget":            return toolGetBudget(userId, args as { month: string });
    case "set_category_budget":   return toolSetCategoryBudget(userId, args as Parameters<typeof toolSetCategoryBudget>[1]);
    case "set_forecasted_income": return toolSetForecastedIncome(userId, args as Parameters<typeof toolSetForecastedIncome>[1]);
    default: throw new Error(`Unknown tool: ${name}`);
  }
}

// ─── Message format converters ────────────────────────────────────────────────

function bedrockToGoogleContent(messages: Message[]): Content[] {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: (m.content ?? []).map((block): Part => {
      if ("text" in block) return { text: (block as ContentBlock.TextMember).text };
      // Tool use/result blocks: convert to text representation
      if ("toolUse" in block) {
        const tu = (block as ContentBlock.ToolUseMember).toolUse;
        return { text: `[Tool call: ${tu.name} ${JSON.stringify(tu.input)}]` };
      }
      if ("toolResult" in block) {
        const tr = (block as ContentBlock.ToolResultMember).toolResult;
        const text = (tr.content ?? []).map((c) => ("text" in c ? c.text : "")).join("");
        return { text: `[Tool result: ${text}]` };
      }
      return { text: "" };
    }),
  }));
}

// ─── Main function ────────────────────────────────────────────────────────────

const DEFAULT_SYSTEM_WITH_TOOLS = `You are a personal finance assistant for WealthClick, a private finance app.
You are speaking with the app's owner — you have full permission to access and manage their financial data.
You have tools to:
- Retrieve and manage transactions (list, create, update, delete)
- Get monthly spending summaries with category breakdowns and trends
- List spending categories
- View and manage monthly budgets: get_budget, set_category_budget, set_forecasted_income
ALWAYS use the available tools to answer questions about money, spending, income, transactions, or budgets.
Never say you cannot access financial data — you have the tools and permission to do so.
When asked about budgets: use get_budget to show the current budget, actual spending, and remaining amounts.
When asked to set or update a budget: use list_categories first to get the category ID, then set_category_budget.
When asked to set income: use set_forecasted_income.
Answer in the same language the user writes in (Hebrew or English).
Keep responses concise and friendly. Format currency as ₪.
Today's date: ${new Date().toISOString().slice(0, 10)}.`;

const DEFAULT_SYSTEM_CHAT_ONLY = `You are a friendly personal finance assistant for WealthClick.
Answer in the same language the user writes in (Hebrew or English).
Keep responses concise. Today's date: ${new Date().toISOString().slice(0, 10)}.
Do not simulate tool calls or show internal reasoning — just respond naturally.`;

export async function converseWithGoogleAI(opts: {
  userId: string;
  modelId: string;
  messages: Message[];
  systemPrompt?: string;
  supportsTools?: boolean;
}): Promise<ConverseTurnResult> {
  const { userId, modelId, messages, systemPrompt, supportsTools = true } = opts;

  const apiKey = process.env.GOOGLE_AI_API_KEY ?? process.env.GOOGLE_AI_KEY;
  if (!apiKey) throw new Error("GOOGLE_AI_API_KEY env var not set");

  const ai = new GoogleGenAI({ apiKey });

  const history = bedrockToGoogleContent(messages.slice(0, -1));
  const lastMessage = messages[messages.length - 1];
  const userText = (lastMessage?.content ?? [])
    .filter((b): b is ContentBlock.TextMember => "text" in b)
    .map((b) => b.text)
    .join("\n");

  const effectiveSystem = systemPrompt
    || (supportsTools ? DEFAULT_SYSTEM_WITH_TOOLS : DEFAULT_SYSTEM_CHAT_ONLY);

  // Tool use loop — max 5 rounds
  const conversationContents: Content[] = [...history];
  let currentUserText = userText;

  for (let round = 0; round < 5; round++) {
    conversationContents.push({ role: "user", parts: [{ text: currentUserText }] });

    const response = await ai.models.generateContent({
      model: modelId,
      contents: conversationContents,
      config: {
        systemInstruction: effectiveSystem,
        ...(supportsTools ? { tools: [{ functionDeclarations: GOOGLE_TOOL_DECLARATIONS }] } : {}),
        temperature: 0.3,
        maxOutputTokens: 1024,
      },
    });

    const candidate = response.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];
    const modelContent: Content = { role: "model", parts };
    conversationContents.push(modelContent);

    // Check for function calls
    const funcCalls = parts.filter((p) => p.functionCall);
    if (funcCalls.length > 0 && supportsTools) {
      const toolResultParts: Part[] = await Promise.all(
        funcCalls.map(async (p) => {
          const { name, args } = p.functionCall!;
          let result: string;
          try {
            result = await executeTool(name!, args as Record<string, unknown>, userId);
          } catch (e) {
            result = `Error: ${e instanceof Error ? e.message : String(e)}`;
          }
          return { functionResponse: { name: name!, response: { result } } };
        })
      );
      conversationContents.push({ role: "user", parts: toolResultParts });
      currentUserText = "";
      continue;
    }

    // Text response — done
    const text = parts.filter((p) => p.text).map((p) => p.text).join("\n").trim();

    // Convert back to Bedrock Message format for consistent history storage
    const updatedMessages: Message[] = [
      ...messages,
      { role: "assistant" as const, content: [{ text: text || "Done." }] },
    ];
    return { reply: text || "Done.", updatedMessages };
  }

  throw new Error("Tool use loop exceeded 5 rounds");
}
