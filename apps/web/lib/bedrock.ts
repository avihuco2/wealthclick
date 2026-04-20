/**
 * AWS Bedrock Converse API with tool use loop.
 * Model is configurable per user from the settings UI.
 */

import {
  BedrockRuntimeClient,
  ConverseCommand,
  type Message,
  type Tool,
  type ContentBlock,
} from "@aws-sdk/client-bedrock-runtime";

export type { BedrockModelId } from "./bedrockModels";
import { BEDROCK_MODELS } from "./bedrockModels";
export { BEDROCK_MODELS };

function modelSupportsTools(modelId: string): boolean {
  const entry = BEDROCK_MODELS.find((m) => m.id === modelId);
  return entry ? entry.supportsTools : true;
}

function modelSupportsSystem(modelId: string): boolean {
  const entry = BEDROCK_MODELS.find((m) => m.id === modelId);
  return entry ? entry.supportsSystem : true;
}

// ─── Tool definitions for Bedrock ─────────────────────────────────────────────

const AGENT_TOOLS: Tool[] = [
  {
    toolSpec: {
      name: "get_transactions",
      description: "List financial transactions for a date range.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            from:  { type: "string", description: "Start date YYYY-MM-DD (inclusive)" },
            to:    { type: "string", description: "End date YYYY-MM-DD (inclusive)" },
            type:  { type: "string", enum: ["income", "expense"], description: "Filter by type (optional)" },
            limit: { type: "number", description: "Max results, default 100, max 500 (optional)" },
          },
          required: ["from", "to"],
        },
      },
    },
  },
  {
    toolSpec: {
      name: "get_spending_summary",
      description: "Monthly spending report: income vs expenses, category breakdown, top expenses, spending pace, and month-over-month comparison.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            month: { type: "string", description: "Month in YYYY-MM format e.g. 2025-03" },
          },
          required: ["month"],
        },
      },
    },
  },
  {
    toolSpec: {
      name: "list_categories",
      description: "List all spending categories with name (English and Hebrew), color, emoji, and ID.",
      inputSchema: { json: { type: "object", properties: {} } },
    },
  },
  {
    toolSpec: {
      name: "create_transaction",
      description: "Create a new financial transaction.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            description: { type: "string" },
            amount:      { type: "number", description: "Positive amount in ILS" },
            type:        { type: "string", enum: ["income", "expense"] },
            date:        { type: "string", description: "YYYY-MM-DD" },
            category_id: { type: "string", description: "Category UUID (optional)" },
            account:     { type: "string", description: "Account name e.g. Visa (optional)" },
          },
          required: ["description", "amount", "type", "date"],
        },
      },
    },
  },
  {
    toolSpec: {
      name: "update_transaction",
      description: "Partially update an existing transaction. Only provide fields to change.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            id:          { type: "string", description: "Transaction UUID" },
            description: { type: "string" },
            amount:      { type: "number" },
            type:        { type: "string", enum: ["income", "expense"] },
            date:        { type: "string", description: "YYYY-MM-DD" },
            category_id: { type: "string" },
            account:     { type: "string" },
          },
          required: ["id"],
        },
      },
    },
  },
  {
    toolSpec: {
      name: "delete_transaction",
      description: "Delete a transaction by ID.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            id: { type: "string", description: "Transaction UUID" },
          },
          required: ["id"],
        },
      },
    },
  },
  {
    toolSpec: {
      name: "get_budget",
      description: "Get the monthly budget plan: forecasted income, per-category budgets, actual spending, and 3mo/6mo averages.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            month: { type: "string", description: "Month in YYYY-MM format e.g. 2025-03" },
          },
          required: ["month"],
        },
      },
    },
  },
  {
    toolSpec: {
      name: "set_category_budget",
      description: "Set or update the monthly budget for a specific category. Use list_categories to get category IDs.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            month:          { type: "string", description: "Month in YYYY-MM format" },
            category_id:    { type: "string", description: "Category UUID" },
            monthly_amount: { type: "number", description: "Budget amount in ILS (non-negative)" },
          },
          required: ["month", "category_id", "monthly_amount"],
        },
      },
    },
  },
  {
    toolSpec: {
      name: "set_forecasted_income",
      description: "Set the expected (forecasted) income for a month.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            month:              { type: "string", description: "Month in YYYY-MM format" },
            forecasted_amount:  { type: "number", description: "Expected income in ILS (non-negative)" },
          },
          required: ["month", "forecasted_amount"],
        },
      },
    },
  },
];

// ─── Tool execution router ─────────────────────────────────────────────────────

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

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  userId: string,
): Promise<string> {
  switch (name) {
    case "get_transactions":     return toolGetTransactions(userId, input as Parameters<typeof toolGetTransactions>[1]);
    case "get_spending_summary": return toolGetSpendingSummary(userId, input as { month: string });
    case "list_categories":      return toolListCategories(userId);
    case "create_transaction":   return toolCreateTransaction(userId, input as Parameters<typeof toolCreateTransaction>[1]);
    case "update_transaction":   return toolUpdateTransaction(userId, input as Parameters<typeof toolUpdateTransaction>[1]);
    case "delete_transaction":      return toolDeleteTransaction(userId, input as { id: string });
    case "get_budget":              return toolGetBudget(userId, input as { month: string });
    case "set_category_budget":     return toolSetCategoryBudget(userId, input as Parameters<typeof toolSetCategoryBudget>[1]);
    case "set_forecasted_income":   return toolSetForecastedIncome(userId, input as Parameters<typeof toolSetForecastedIncome>[1]);
    default: throw new Error(`Unknown tool: ${name}`);
  }
}

// ─── Converse with tool use loop ──────────────────────────────────────────────

const DEFAULT_SYSTEM = `You are a personal finance assistant for WealthClick, a private finance app.
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

export interface ConverseTurnResult {
  reply: string;
  updatedMessages: Message[];
}

export async function converseWithTools(opts: {
  userId: string;
  modelId: string;
  messages: Message[];
  systemPrompt?: string;
}): Promise<ConverseTurnResult> {
  const { userId, modelId, messages, systemPrompt } = opts;

  const client = new BedrockRuntimeClient({ region: process.env.AWS_BEDROCK_REGION ?? "us-east-1" });
  const withTools  = modelSupportsTools(modelId);
  const withSystem = modelSupportsSystem(modelId);

  const conversationMessages: Message[] = [...messages];

  // Tool use loop — max 5 rounds to prevent runaway
  for (let round = 0; round < 5; round++) {
    const cmd = new ConverseCommand({
      modelId,
      ...(withSystem ? { system: [{ text: systemPrompt || DEFAULT_SYSTEM }] } : {}),
      messages: conversationMessages,
      ...(withTools ? { toolConfig: { tools: AGENT_TOOLS } } : {}),
      inferenceConfig: { maxTokens: 1024, temperature: 0.3 },
    });

    const response = await client.send(cmd);
    const output = response.output?.message;
    if (!output) throw new Error("Empty response from Bedrock");

    conversationMessages.push(output);

    if (response.stopReason === "end_turn") {
      // Extract text reply
      const text = (output.content ?? [])
        .filter((b): b is ContentBlock.TextMember => "text" in b)
        .map((b) => b.text)
        .join("\n")
        .trim();
      return { reply: text || "Done.", updatedMessages: conversationMessages };
    }

    if (response.stopReason === "tool_use") {
      // Execute all tool calls in parallel
      const toolUseBlocks = (output.content ?? []).filter(
        (b): b is ContentBlock.ToolUseMember => "toolUse" in b,
      );

      const toolResults = await Promise.all(
        toolUseBlocks.map(async (b) => {
          let result: string;
          try {
            result = await executeTool(b.toolUse.name!, b.toolUse.input as Record<string, unknown>, userId);
          } catch (e) {
            result = `Error: ${e instanceof Error ? e.message : String(e)}`;
          }
          return {
            toolUseId: b.toolUse.toolUseId!,
            content: [{ text: result }],
          };
        }),
      );

      conversationMessages.push({
        role: "user",
        content: toolResults.map((r) => ({ toolResult: r })),
      });
      continue;
    }

    // stop_reason is something else (max_tokens etc.) — return what we have
    const text = (output.content ?? [])
      .filter((b): b is ContentBlock.TextMember => "text" in b)
      .map((b) => b.text)
      .join("\n")
      .trim();
    return { reply: text || "...", updatedMessages: conversationMessages };
  }

  throw new Error("Tool use loop exceeded 5 rounds");
}
