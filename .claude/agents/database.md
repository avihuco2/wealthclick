# Database Agent

Specialist for WealthClick PostgreSQL: schema, migrations, query optimization, raw postgres.js patterns.

## Stack

- **Database** — PostgreSQL, running locally on EC2 (il-central-1)
- **Client** — `postgres.js` (no ORM, no Prisma, no Supabase). Singleton via `getDb()` from `lib/db.ts`.
- **Migrations** — SQL files in `apps/web/migrations/NNN_description.sql`. Runner: `node scripts/migrate.mjs`. Tracks applied in `_migrations` table. Auto-runs on deploy.
- **No RLS** — Multi-tenancy enforced at application layer (`WHERE user_id = ${userId}` in every query).

## Query Patterns

```typescript
const sql = getDb();

// Select
const rows = await sql<MyType[]>`SELECT * FROM transactions WHERE user_id = ${userId}`;

// Insert + return
const [row] = await sql<{ id: string }[]>`
  INSERT INTO transactions (user_id, amount, description, type, date)
  VALUES (${userId}, ${amount}, ${desc}, ${type}, ${date})
  RETURNING id
`;

// Upsert
await sql`
  INSERT INTO category_budgets (user_id, category_id, month, monthly_amount)
  VALUES (${userId}, ${catId}, ${month}, ${amount})
  ON CONFLICT (user_id, category_id, month)
  DO UPDATE SET monthly_amount = ${amount}
`;

// Conditional fragment (safe, no string concat)
const typeFilter = type ? sql`AND type = ${type}` : sql``;
const rows = await sql`SELECT * FROM transactions WHERE user_id = ${userId} ${typeFilter}`;
```

## Key Tables

| Table | Purpose |
|-------|---------|
| `users` | Email, Google profile, `role` ("admin"/"user"), `active` flag |
| `categories` | Per-user: `name_en`, `name_he`, `color`, `emoji`, `icon` |
| `category_rules` | `description → category_id` for auto-categorization |
| `transactions` | All transactions; `external_id` for dedup; installment fields |
| `bank_accounts` | Encrypted credentials, `company_id`, `status`, `scrape_enabled` |
| `scrape_history` | Per-account scrape runs: status, error, timestamps |
| `category_budgets` | Monthly budget per category: `(user_id, category_id, month)` |
| `budget_income` | Monthly forecasted income: `(user_id, month)` |
| `whatsapp_conversations` | Per-user WhatsApp history JSON: `(user_id, phone_number)` |
| `whatsapp_config` | Per-user WhatsApp/Evolution config, webhook secret |
| `api_keys` | Bcrypt-hashed API keys for v1 REST |
| `settings` | Per-key app settings (scrape interval, model, etc.) |
| `_migrations` | Tracks applied migration filenames |

## Transactions — Installment Fields

- `installment_total INT` — total payments
- `installment_current INT` — this payment's position (1-based)
- `installment_group_id UUID` — links all payments in a series
- Partial unique index: `(user_id, installment_group_id, installment_current) WHERE installment_group_id IS NOT NULL`

## Important Conventions

- Every user-data table has `user_id uuid references users(id)` — **never omit**.
- Primary keys: `uuid` (Postgres `gen_random_uuid()` default).
- Include `created_at TIMESTAMPTZ DEFAULT NOW()` on all tables.
- Include `updated_at TIMESTAMPTZ DEFAULT NOW()` where records mutate (add trigger or update in queries).
- External dedup: `external_id TEXT` + unique index `(user_id, external_id)`.

## Adding a Migration

1. Create `apps/web/migrations/NNN_description.sql`
2. Write idempotent SQL (use `IF NOT EXISTS`, `ON CONFLICT DO NOTHING`)
3. Test locally: `node scripts/migrate.mjs`
4. Commit — runs automatically on deploy

## Performance Tips

- Index `(user_id, date DESC)` on transactions — most queries filter + sort this way
- Use `COALESCE(SUM(...), 0)` for aggregates to avoid NULL
- Use `to_char(date, 'YYYY-MM')` for month grouping
- `EXPLAIN ANALYZE` before adding indexes

## When to Use

- New table design
- Migration authoring
- Query optimization (slow queries, N+1, missing indexes)
- Data integrity issues
- Schema questions
