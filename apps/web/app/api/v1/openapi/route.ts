import { NextResponse } from "next/server";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://wealthclick.app";

export async function GET() {
  const spec = {
    openapi: "3.0.3",
    info: {
      title: "WealthClick API",
      version: "1.0.0",
      description:
        "Programmatic access to your WealthClick financial data. Authenticate with an API key generated from your account settings.",
    },
    servers: [{ url: `${BASE_URL}/api/v1`, description: "Production" }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "wc_<token>",
          description: "API key generated from WealthClick settings. Format: `wc_<64 hex chars>`",
        },
      },
      schemas: {
        Category: {
          type: "object",
          nullable: true,
          properties: {
            id: { type: "string", format: "uuid" },
            name_en: { type: "string", nullable: true, example: "Food & Dining" },
            name_he: { type: "string", nullable: true, example: "אוכל ומסעדות" },
            color: { type: "string", nullable: true, example: "#FF6B6B" },
            emoji: { type: "string", nullable: true, example: "🍔" },
          },
        },
        CategoryItem: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name_en: { type: "string", example: "Food & Dining" },
            name_he: { type: "string", example: "אוכל ומסעדות" },
            color: { type: "string", example: "#FF6B6B" },
            emoji: { type: "string", example: "🍔" },
            created_at: { type: "string", format: "date-time" },
          },
        },
        Transaction: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            date: { type: "string", format: "date", example: "2025-03-15" },
            description: { type: "string", example: "Super-Pharm" },
            amount: { type: "number", format: "float", example: 142.5 },
            type: { type: "string", enum: ["income", "expense"] },
            account: { type: "string", nullable: true, example: "Visa" },
            category: { $ref: "#/components/schemas/Category" },
            created_at: { type: "string", format: "date-time" },
          },
        },
        TransactionInput: {
          type: "object",
          required: ["description", "amount", "type", "date"],
          properties: {
            description: { type: "string", example: "Super-Pharm" },
            amount: { type: "number", format: "float", example: 142.5, description: "Must be positive" },
            type: { type: "string", enum: ["income", "expense"] },
            date: { type: "string", format: "date", example: "2025-03-15" },
            category_id: { type: "string", format: "uuid", nullable: true },
            account: { type: "string", nullable: true, example: "Visa" },
          },
        },
        TransactionPatch: {
          type: "object",
          description: "All fields optional — only provided fields are updated",
          properties: {
            description: { type: "string", example: "Super-Pharm" },
            amount: { type: "number", format: "float", example: 142.5 },
            type: { type: "string", enum: ["income", "expense"] },
            date: { type: "string", format: "date", example: "2025-03-15" },
            category_id: { type: "string", format: "uuid", nullable: true },
            account: { type: "string", nullable: true, example: "Visa" },
          },
        },
        Error: {
          type: "object",
          properties: { error: { type: "string" } },
        },
        TransactionListResponse: {
          type: "object",
          properties: {
            data: { type: "array", items: { $ref: "#/components/schemas/Transaction" } },
            count: { type: "integer" },
          },
        },
        CategoryListResponse: {
          type: "object",
          properties: {
            data: { type: "array", items: { $ref: "#/components/schemas/CategoryItem" } },
            count: { type: "integer" },
          },
        },
        BudgetCategory: {
          type: "object",
          properties: {
            category_id:    { type: "string", format: "uuid" },
            name_en:        { type: "string", example: "Food & Dining" },
            name_he:        { type: "string", example: "אוכל ומסעדות" },
            color:          { type: "string", example: "#FF6B6B" },
            emoji:          { type: "string", example: "🍔" },
            monthly_budget: { type: "number", example: 2000, description: "Saved budget for the month (0 if not set)" },
            avg_3m:         { type: "number", example: 1850.5, description: "Average monthly expense over last 3 months" },
            avg_6m:         { type: "number", example: 1920.0, description: "Average monthly expense over last 6 months" },
            actual:         { type: "number", example: 1423.5, description: "Actual spending this month" },
            remaining:      { type: "number", example: 576.5, description: "Budget minus actual (negative = over budget)" },
          },
        },
        BudgetIncome: {
          type: "object",
          properties: {
            month:              { type: "string", example: "2025-04" },
            forecasted_amount:  { type: "number", example: 15000, description: "Expected income for the month" },
            actual_income:      { type: "number", example: 14800, description: "Real income transactions this month" },
          },
        },
        BudgetResponse: {
          type: "object",
          properties: {
            month:      { type: "string", example: "2025-04" },
            income:     { $ref: "#/components/schemas/BudgetIncome" },
            categories: { type: "array", items: { $ref: "#/components/schemas/BudgetCategory" } },
            summary: {
              type: "object",
              properties: {
                total_budget: { type: "number", example: 12000 },
                total_actual: { type: "number", example: 9430.5 },
                remaining:    { type: "number", example: 2569.5 },
              },
            },
          },
        },
        BudgetCategoryInput: {
          type: "object",
          required: ["category_id", "monthly_amount"],
          properties: {
            category_id:    { type: "string", format: "uuid" },
            monthly_amount: { type: "number", minimum: 0, example: 2000 },
          },
        },
        BudgetPutInput: {
          type: "object",
          required: ["month", "categories"],
          properties: {
            month:      { type: "string", example: "2025-04", description: "YYYY-MM" },
            categories: { type: "array", items: { $ref: "#/components/schemas/BudgetCategoryInput" }, minItems: 1 },
          },
        },
        BudgetIncomePutInput: {
          type: "object",
          required: ["month", "forecasted_amount"],
          properties: {
            month:             { type: "string", example: "2025-04", description: "YYYY-MM" },
            forecasted_amount: { type: "number", minimum: 0, example: 15000 },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    paths: {
      "/transactions": {
        get: {
          summary: "List transactions",
          description: "Returns transactions for the authenticated user within the given date range.",
          operationId: "listTransactions",
          parameters: [
            { name: "from", in: "query", required: true, schema: { type: "string", format: "date" }, example: "2025-03-01", description: "Start date (inclusive), YYYY-MM-DD" },
            { name: "to", in: "query", required: true, schema: { type: "string", format: "date" }, example: "2025-03-31", description: "End date (inclusive), YYYY-MM-DD" },
            { name: "type", in: "query", required: false, schema: { type: "string", enum: ["income", "expense"] }, description: "Filter by transaction type" },
            { name: "limit", in: "query", required: false, schema: { type: "integer", default: 100, minimum: 1, maximum: 500 }, description: "Max results (default 100, max 500)" },
          ],
          responses: {
            "200": { description: "List of transactions", content: { "application/json": { schema: { $ref: "#/components/schemas/TransactionListResponse" } } } },
            "400": { description: "Invalid query parameters", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "401": { description: "Missing or invalid API key", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
        post: {
          summary: "Create transaction",
          description: "Creates a new transaction for the authenticated user.",
          operationId: "createTransaction",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/TransactionInput" } } },
          },
          responses: {
            "201": { description: "Transaction created", content: { "application/json": { schema: { type: "object", properties: { id: { type: "string", format: "uuid" } } } } } },
            "400": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "401": { description: "Missing or invalid API key", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/transactions/{id}": {
        patch: {
          summary: "Update transaction",
          description: "Partially updates a transaction. Only provided fields are changed.",
          operationId: "updateTransaction",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/TransactionPatch" } } },
          },
          responses: {
            "200": { description: "Updated", content: { "application/json": { schema: { type: "object", properties: { id: { type: "string" } } } } } },
            "400": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "401": { description: "Missing or invalid API key", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "404": { description: "Transaction not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
        delete: {
          summary: "Delete transaction",
          operationId: "deleteTransaction",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            "200": { description: "Deleted", content: { "application/json": { schema: { type: "object", properties: { deleted: { type: "string" } } } } } },
            "401": { description: "Missing or invalid API key", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "404": { description: "Transaction not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/budgets": {
        get: {
          summary: "Get monthly budget",
          description: "Returns the full budget for a given month: income, per-category budgets vs actuals, 3mo/6mo averages, and summary totals.",
          operationId: "getBudget",
          parameters: [
            { name: "month", in: "query", required: false, schema: { type: "string", example: "2025-04" }, description: "Month in YYYY-MM format. Defaults to current month." },
          ],
          responses: {
            "200": { description: "Budget data", content: { "application/json": { schema: { $ref: "#/components/schemas/BudgetResponse" } } } },
            "400": { description: "Invalid month", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
        put: {
          summary: "Set category budgets",
          description: "Upserts monthly budget amounts for one or more categories. Existing values are overwritten.",
          operationId: "setBudgets",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/BudgetPutInput" } } },
          },
          responses: {
            "200": { description: "Budgets saved", content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean" }, updated: { type: "integer" } } } } } },
            "400": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/budgets/income": {
        get: {
          summary: "Get income for month",
          description: "Returns forecasted and actual income for a given month.",
          operationId: "getBudgetIncome",
          parameters: [
            { name: "month", in: "query", required: false, schema: { type: "string", example: "2025-04" }, description: "Month in YYYY-MM format. Defaults to current month." },
          ],
          responses: {
            "200": { description: "Income data", content: { "application/json": { schema: { $ref: "#/components/schemas/BudgetIncome" } } } },
            "400": { description: "Invalid month", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
        put: {
          summary: "Set forecasted income",
          description: "Sets the expected (forecasted) income for a given month.",
          operationId: "setForecastedIncome",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/BudgetIncomePutInput" } } },
          },
          responses: {
            "200": { description: "Income saved", content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean" } } } } } },
            "400": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/categories": {
        get: {
          summary: "List categories",
          description: "Returns all categories for the authenticated user.",
          operationId: "listCategories",
          responses: {
            "200": { description: "List of categories", content: { "application/json": { schema: { $ref: "#/components/schemas/CategoryListResponse" } } } },
            "401": { description: "Missing or invalid API key", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
    },
  };

  return NextResponse.json(spec, {
    headers: { "Access-Control-Allow-Origin": "*" },
  });
}
