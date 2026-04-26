# Backend Agent

Specialist for WealthClick server-side code: API routes, business logic, AI agent, bank scraping, REST v1, MCP server.

## Stack

- **Framework** — Next.js 16 App Router, Route Handlers (`app/api/`)
- **Database** — PostgreSQL local on EC2, accessed via `postgres.js` (no ORM). All queries are tagged template literals via `getDb()` from `lib/db.ts`.
- **Auth** — NextAuth v5 beta (`@/lib/auth`). Server: `const session = await auth()`. User must exist in `users` table with `active = true`.
- **AI** — AWS Bedrock (Claude, Nova, Llama, Mistral, Cohere, Gemma) + Google AI (`@google/genai`). Model routing via `lib/bedrockModels.ts`.
- **Bank scraping** — `israeli-bank-scrapers` v6, dynamic import in `lib/scraper.ts`, runs in-process on EC2. No Redis, no Bull, no Docker worker.
- **Scrape cron** — In-process `setTimeout` loop in `lib/scraperCron.ts`. Interval from DB settings.
- **WhatsApp** — Evolution API webhook → `lib/whatsappAgent.ts` → Bedrock/Google tool-use loop. History in `whatsapp_conversations` table.
- **Secrets** — AWS Secrets Manager, loaded at startup into `process.env`.
- **REST v1** — `app/api/v1/` authenticated via bcrypt-hashed API keys (`lib/apiAuth.ts`).
- **MCP** — `app/api/mcp/route.ts` (JSON-RPC, shares `agentTools.ts`).

## Key Patterns

### Auth check (session)
```typescript
const session = await auth();
if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const userId = session.user.id;
```

### Auth check (API key, v1)
```typescript
const userId = await authenticateApiKey(request);
if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
```

### DB query
```typescript
const sql = getDb();
const rows = await sql<MyType[]>`SELECT * FROM transactions WHERE user_id = ${userId}`;
```

### User isolation — ALWAYS filter by `user_id`. Never return cross-user data.

### Multi-tenant tables — every table has `user_id uuid references users(id)`. Application enforces isolation (no Postgres RLS).

## Key Files

| File | Purpose |
|------|---------|
| `lib/db.ts` | postgres.js singleton + shared DB types (`DbTransaction`, etc.) |
| `lib/transactions.ts` | Transaction queries |
| `lib/categories.ts` | Category queries + seeding |
| `lib/budgets.ts` | Budget queries |
| `lib/insights.ts` | Aggregation queries (spending, trends) |
| `lib/bankAccounts.ts` | Bank account CRUD + scrape job management |
| `lib/scraper.ts` | Scrape runner (Puppeteer, installment logic) |
| `lib/scraperCron.ts` | In-process cron loop |
| `lib/bedrock.ts` | Bedrock conversation + tool-use loop |
| `lib/googleAI.ts` | Google AI client (Gemini/Gemma) |
| `lib/agentTools.ts` | Shared tool implementations (get_transactions, list_accounts, etc.) |
| `lib/whatsappAgent.ts` | WhatsApp AI agent, history management |
| `lib/evolutionApi.ts` | Evolution API client (send WhatsApp messages) |
| `lib/apiAuth.ts` | API key authentication for v1 endpoints |
| `lib/settings.ts` | Settings DB helpers |
| `lib/crypto.ts` | AES-256-GCM encrypt/decrypt (bank credentials) |

## Migrations

Add file: `apps/web/migrations/NNN_description.sql`
Run: `node scripts/migrate.mjs` (also auto-runs on deploy via SSM)
Tracks applied migrations in `_migrations` table.

## Agent Tools

All agent tools in `lib/agentTools.ts` are shared by:
- Bedrock WhatsApp agent (`lib/bedrock.ts`)
- Google AI WhatsApp agent (`lib/googleAI.ts`)
- MCP server (`app/api/mcp/route.ts`)

Tools: `get_transactions`, `get_spending_summary`, `list_accounts`, `list_categories`, `create_transaction`, `update_transaction`, `delete_transaction`, `get_budget`, `set_category_budget`, `set_forecasted_income`.

## WhatsApp Bot Trigger

Bot only responds when message includes "boti" or "בוטי" (case-insensitive). Logic in `app/api/whatsapp/webhook/route.ts`.

## When to Use

- Building/modifying API routes
- Adding agent tools
- Scraper/installment logic
- Budget or insights queries
- WhatsApp agent behavior
- REST v1 or MCP changes
- Migration authoring
