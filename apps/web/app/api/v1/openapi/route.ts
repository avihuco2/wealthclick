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
        Error: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
        TransactionListResponse: {
          type: "object",
          properties: {
            data: {
              type: "array",
              items: { $ref: "#/components/schemas/Transaction" },
            },
            count: { type: "integer" },
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
            {
              name: "from",
              in: "query",
              required: true,
              schema: { type: "string", format: "date" },
              example: "2025-03-01",
              description: "Start date (inclusive), format YYYY-MM-DD",
            },
            {
              name: "to",
              in: "query",
              required: true,
              schema: { type: "string", format: "date" },
              example: "2025-03-31",
              description: "End date (inclusive), format YYYY-MM-DD",
            },
            {
              name: "type",
              in: "query",
              required: false,
              schema: { type: "string", enum: ["income", "expense"] },
              description: "Filter by transaction type",
            },
            {
              name: "limit",
              in: "query",
              required: false,
              schema: { type: "integer", default: 100, minimum: 1, maximum: 500 },
              description: "Maximum number of results (default 100, max 500)",
            },
          ],
          responses: {
            "200": {
              description: "List of transactions",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/TransactionListResponse" },
                },
              },
            },
            "400": {
              description: "Invalid query parameters",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/Error" } },
              },
            },
            "401": {
              description: "Missing or invalid API key",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/Error" } },
              },
            },
          },
        },
      },
    },
  };

  return NextResponse.json(spec, {
    headers: { "Access-Control-Allow-Origin": "*" },
  });
}
