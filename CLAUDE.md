# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

---

## Project Overview

**WealthClick** — Personal finance management app for Israeli users. Scrapes bank and credit card transactions from Israeli financial institutions, categorizes them with AI, and presents them in a Hebrew/English dashboard with budgets, insights, and a WhatsApp bot.

**Design Philosophy:** Apple Glass UI — dark navy background, frosted glass cards, colored ambient glows, Geist + Heebo fonts.

---

## Architecture

Single Next.js app deployed on EC2, no separate worker process.

```
Browser
  └── Next.js 16 (App Router) on EC2 t3.micro (il-central-1)
        ├── PostgreSQL (local on EC2) via postgres.js
        ├── israeli-bank-scrapers (Puppeteer, dynamic import, runs in-process)
        ├── AWS Bedrock — Claude, Nova, Llama, Mistral, Cohere, Gemma
        ├── Google AI — Gemma 4/3 models via @google/genai
        ├── AWS Secrets Manager — runtime env vars
        └── Evolution API — WhatsApp bot integration
```

| Component | Technology |
|-----------|------------|
| Framework | Next.js 16 App Router, React 19 |
| Styling | Tailwind CSS v4 + shadcn/ui + Base UI |
| Auth | NextAuth v5 beta, Google OAuth only |
| Database | PostgreSQL (local EC2) via `postgres.js` (no ORM) |
| AI | AWS Bedrock (multi-model) + Google AI |
| Bank scraping | `israeli-bank-scrapers` v6, Puppeteer, dynamic import |
| WhatsApp | Evolution API + custom agent loop |
| Deployment | EC2 il-central-1 via PM2, GitHub Actions → SSM |
| Secrets | AWS Secrets Manager (loaded at startup) |
| i18n | Custom `lib/i18n.ts`, routes under `app/[locale]/` (en, he) |

---

## Project Structure

```
wealthclick/
├── CLAUDE.md
├── apps/
│   └── web/                          # The entire application
│       ├── app/
│       │   ├── [locale]/             # Localized pages (en, he)
│       │   │   ├── dashboard/        # Main dashboard
│       │   │   ├── transactions/     # Transaction CRUD + mobile cards
│       │   │   ├── budgets/          # Category budgets by month
│       │   │   ├── insights/         # Spending breakdown + trends
│       │   │   ├── bank-accounts/    # Connect/manage bank accounts
│       │   │   ├── settings/         # App settings
│       │   │   ├── admin/            # Admin-only user management
│       │   │   ├── login/
│       │   │   └── unauthorized/
│       │   └── api/
│       │       ├── auth/             # NextAuth handlers
│       │       ├── bank-accounts/    # Scrape trigger endpoints
│       │       ├── budgets/          # Budget CRUD
│       │       ├── transactions/     # Transaction API
│       │       ├── settings/         # Settings CRUD
│       │       ├── scrape-jobs/      # Job status polling
│       │       ├── whatsapp/         # Webhook + Evolution API
│       │       ├── admin/            # Admin-only endpoints (clear-data, etc.)
│       │       ├── mcp/              # MCP server endpoint
│       │       └── v1/               # REST API v1 (keys, transactions, categories, budgets, openapi, docs)
│       ├── components/
│       │   ├── NavBar.tsx
│       │   ├── BankAccountsClient.tsx
│       │   ├── LanguageSwitcher.tsx
│       │   └── ui/                   # shadcn/ui + Base UI components
│       ├── lib/
│       │   ├── auth.ts               # NextAuth config
│       │   ├── db.ts                 # postgres.js singleton + shared DB types
│       │   ├── transactions.ts       # Transaction queries
│       │   ├── categories.ts         # Category queries + seeding
│       │   ├── categoryRules.ts      # Auto-categorization rules
│       │   ├── budgets.ts            # Budget queries
│       │   ├── insights.ts           # Insights aggregation queries
│       │   ├── bankAccounts.ts       # Bank account CRUD + scrape job management
│       │   ├── scraper.ts            # Scrape runner (Puppeteer, installment logic)
│       │   ├── scraperCron.ts        # In-process cron (setTimeout loop, no Redis)
│       │   ├── scraperConfig.ts      # Scraper settings helpers
│       │   ├── bedrock.ts            # Bedrock conversation + tool-use loop
│       │   ├── bedrockModels.ts      # Model list (Bedrock + Google AI)
│       │   ├── googleAI.ts           # Google AI client
│       │   ├── whatsappAgent.ts      # WhatsApp AI agent, history management
│       │   ├── agentTools.ts         # Tool definitions for AI agent
│       │   ├── evolutionApi.ts       # Evolution API client
│       │   ├── whatsappCrypto.ts     # Webhook signature verification
│       │   ├── apiAuth.ts            # API key auth for v1 endpoints
│       │   ├── settings.ts           # Settings DB helpers
│       │   ├── crypto.ts             # AES-256-GCM encrypt/decrypt
│       │   ├── i18n.ts               # EN + HE dictionaries
│       │   └── utils.ts              # cn(), formatCurrency(), etc.
│       ├── migrations/               # SQL migration files (001–015)
│       ├── scripts/
│       │   └── migrate.mjs           # Migration runner (tracks applied in _migrations table)
│       └── public/
│           └── icon.svg
└── .github/
    └── workflows/
        └── deploy.yml                # GitHub Actions → SSM → EC2
```

---

## Database

**postgres.js** (no ORM). All queries are tagged template literals via `getDb()`.

### Key Tables

| Table | Purpose |
|-------|---------|
| `users` | Email + Google profile + `role` ("admin"/"user") + `active` flag |
| `categories` | Per-user, `name_en`, `name_he`, `color`, `emoji`, `icon` |
| `category_rules` | `description → category_id` mapping for auto-categorization |
| `transactions` | All transactions; `external_id` for dedup; installment fields |
| `bank_accounts` | Encrypted credentials, `company_id`, `status`, `scrape_enabled` |
| `scrape_history` | Per-account scrape runs with status + error |
| `category_budgets` | Monthly budget amounts per category |
| `budget_income` | Monthly income budget |
| `whatsapp_conversations` | Per-user conversation history (JSON) |
| `api_keys` | Hashed API keys for v1 REST access |
| `settings` | Per-key app settings (scrape interval, history months, model, etc.) |
| `_migrations` | Tracks applied migration filenames |

### Transactions — Installment Fields

Added in migrations 014 + 015:
- `installment_total INT` — total number of payments
- `installment_current INT` — this payment's position (1-based)
- `installment_group_id UUID` — links all payments in a series

Unique index: `(user_id, installment_group_id, installment_current) WHERE installment_group_id IS NOT NULL`

Scraper upserts real rows and inserts synthetic future rows with `DO NOTHING` — real rows replace synthetic as months progress.

### Migrations

Add a new migration file: `apps/web/migrations/NNN_description.sql`

Run: `node scripts/migrate.mjs` (also runs automatically on deploy)

---

## Auth

NextAuth v5 beta (`next-auth@^5.0.0-beta`). Google OAuth only.

- Users must exist in the `users` table with `active = true` to sign in
- JWT embeds `id` and `role` from DB on first login
- Admin check: `session.user.role === "admin"`
- Server: `const session = await auth()` (from `@/lib/auth`)
- Route protection: redirect to `/${locale}/login` if no session

---

## Hebrew / RTL Rules (Non-Negotiable)

- Root layout: `<html lang="he" dir="rtl">` (default locale)
- Tailwind: logical properties ONLY — `ms-`, `me-`, `ps-`, `pe-`, `text-start`, `border-e`
- **NEVER** use: `ml-`, `mr-`, `pl-`, `pr-`, `text-left`, `text-right`, `border-l`, `border-r`
- Currency: `new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' })`
- Dates: `new Intl.DateTimeFormat('he-IL')`
- All user-facing strings in both `en` and `he` inside `lib/i18n.ts`

---

## Bank Scraping

- Library: `israeli-bank-scrapers` v6 (Puppeteer + Chromium)
- Dynamic import inside `scraper.ts` — keeps Puppeteer out of Next.js client bundle
- Runs in-process on EC2 (no separate worker, no Redis/Bull)
- Cron: in-process `setTimeout` loop in `scraperCron.ts`, interval configurable via DB settings
- Installment detection: `txn.installments = { number, total }` — Max credit card parses "תשלום X מתוך Y" from comments
- Dedup for regular txns: `external_id` (base64url hash of identifier/date/desc/amount)
- Dedup for installments: partial unique index on `(user_id, installment_group_id, installment_current)`
- Group ID: deterministic UUID from SHA256 of `installment:companyId:accountNumber:description:amount:total`

---

## AI / WhatsApp Bot

- **Bedrock models**: Claude 4.x/3.x, Amazon Nova, Llama 3, Mistral, Cohere, Gemma 3
- **Google AI models**: Gemma 4/3 via `@google/genai`
- Model selection: stored in DB `settings` table, hot-switchable without restart
- WhatsApp: Evolution API webhook → `whatsappAgent.ts` → Bedrock tool-use loop
- Agent tools: defined in `agentTools.ts` (query transactions, budgets, etc.)
- History: stored per-user in `whatsapp_conversations` as JSON
- History safety: orphaned `tool_use` blocks trimmed from history end before each Bedrock call; incomplete assistant turns not saved after max_tokens cutoff

---

## REST API v1

Endpoints under `/api/v1/` authenticated via API keys (`api_keys` table, bcrypt-hashed).

| Endpoint | Resource |
|----------|---------|
| `GET /api/v1/transactions` | List transactions |
| `GET /api/v1/categories` | List categories |
| `GET /api/v1/budgets` | Budget data |
| `GET /api/v1/keys` | API key management |
| `GET /api/v1/openapi` | OpenAPI spec |
| `GET /api/v1/docs` | API docs UI |

MCP server: `/api/mcp/` (for Claude Desktop integration)

---

## Deployment

```
Push to main
  → GitHub Actions (deploy.yml)
  → OIDC assume AWS role
  → SSM SendCommand to EC2 i-0f345bf0dc26ae184 (il-central-1)
      → cd apps/web && git pull
      → npm ci
      → node scripts/migrate.mjs
      → pm2 restart wealthclick
```

EC2 serves Next.js directly via PM2. ALB (public subnet) → EC2 port 3000 (private subnet).

**Secrets:** AWS Secrets Manager. App fetches secrets at startup and injects into `process.env`.

**Cannot SSM from local machine.** Only GitHub Actions has SSM access. Use EC2 Instance Connect for interactive debugging if needed.

---

## Development Setup

```bash
cd apps/web
cp .env.example .env.local        # fill DATABASE_URL, auth vars, AWS keys
npm install
node scripts/migrate.mjs          # apply migrations
npm run dev
```

Access: http://localhost:3000

---

## Key Environment Variables

```bash
# Auth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
AUTH_SECRET=

# Database
DATABASE_URL=postgresql://...

# AWS
AWS_REGION=il-central-1
# Bedrock + Secrets Manager use EC2 instance role in prod; use local credentials locally

# Scraper (defaults; overridden by DB settings)
SCRAPE_INTERVAL_HOURS=6
SCRAPER_DEBUG=false               # set true temporarily for verbose Puppeteer logs

# WhatsApp
EVOLUTION_API_URL=
EVOLUTION_API_KEY=
EVOLUTION_INSTANCE=

# Google AI
GOOGLE_AI_API_KEY=
```

---

## Common Tasks

### Add a page

Create `app/[locale]/my-page/page.tsx`. Follow existing pattern: validate locale, auth check, fetch data server-side, pass to `'use client'` component.

### Add a migration

Create `apps/web/migrations/NNN_description.sql`. Runs automatically on next deploy; or `node scripts/migrate.mjs` locally.

### Add i18n strings

Add to both `en` and `he` objects in `lib/i18n.ts`. Access via `getDictionary(locale).section.key`.

### Add an API route

Create route under `app/api/`. Use `const session = await auth()` for session auth. Use `apiAuth()` from `lib/apiAuth.ts` for API key auth (v1 endpoints).

### Add an AI agent tool

Add tool definition to `lib/agentTools.ts` and implement handler in `lib/whatsappAgent.ts`.

---

## Admin Features

- Role: `users.role = "admin" | "user"`
- Admin-only pages: `/[locale]/admin/` (user management)
- Admin-only API: `/api/admin/` (clear-data, etc.)
- NavBar shows admin link only when `isAdmin={true}`

---

## Design System

**Apple Glass UI:**
- Background: dark navy (`oklch` ≈ 0.13 lightness)
- Cards: `bg-white/[0.06]` + `backdrop-blur` + subtle `border-white/[0.08]`
- Glows: large blurred circles in background, `oklch` colors, 10–18% opacity, 120–140px blur
- Fonts: Geist (Latin), Heebo (Hebrew)
- Accent colors: blue `#007AFF`, green `#34C759`, red `#FF3B30`, orange `#FF9500`
- Mobile: card view on `sm:hidden`, table on `hidden sm:block`; modals are bottom-sheet on mobile

---

## Git Workflow

- **main** — production branch, direct push deploys
- Commit types: `feat`, `fix`, `refactor`, `docs`, `chore`
