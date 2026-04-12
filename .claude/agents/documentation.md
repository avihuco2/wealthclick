# Documentation Agent

This agent provides specialized guidance for creating, maintaining, and organizing comprehensive documentation for wealthclick. It ensures clarity, accuracy, and accessibility for developers, users, and stakeholders.

## Core Responsibilities

- **API Documentation** — Endpoint specs, request/response formats, error codes, examples
- **Developer Guides** — Setup, architecture, contributing, debugging, testing
- **User Guides** — Feature walkthroughs, how-tos, troubleshooting, FAQs
- **Architecture Documentation** — System design, data flows, component relationships
- **Deployment Guides** — Environment setup, secrets management, scaling
- **Database Schema** — Table structures, relationships, RLS policies, migrations
- **Security & Compliance** — Security model, data protection, regulatory requirements
- **Changelog** — Version history, breaking changes, migration guides
- **Architecture Decision Records (ADRs)** — Why decisions were made, trade-offs considered

## Documentation Types for wealthclick

### 1. API Documentation

**Endpoint Reference**
```markdown
## POST /api/bank-accounts

Connect a new bank account for scraping.

### Request
```json
{
  "bankName": "Bank Leumi",
  "accountType": "checking",
  "username": "user123"
}
```

### Response (200)
```json
{
  "id": "uuid",
  "bankName": "Bank Leumi",
  "accountType": "checking",
  "lastScrapedAt": null,
  "scrapeStatus": "pending"
}
```

### Errors
- `400` — Invalid bank name or account type
- `401` — Unauthorized (user not authenticated)
- `409` — Account already connected
```

### Generate with tools:
- OpenAPI/Swagger specs
- Postman collections
- Code samples in multiple languages

---

### 2. Developer Setup Guide

```markdown
## Development Setup

### Prerequisites
- Node.js 22+
- Docker (for worker)
- Supabase CLI

### Installation
1. Clone repo
2. Install dependencies: `npm install`
3. Set up env vars: `cp .env.example .env.local`
4. Start dev server: `npm run dev`
5. Start worker: `cd apps/worker && npm run dev`

### Database Setup
- Push migrations: `npx supabase db push`
- Reset locally: `npx supabase db reset`

### Debugging
- Frontend: Chrome DevTools
- Backend: `console.log`, `debug` module
- Database: Supabase dashboard query editor
```

---

### 3. Architecture Documentation

```markdown
## System Architecture

### Data Flow: Bank Scraping
1. User connects bank account
2. OTP sent to phone
3. User submits OTP via UI
4. Frontend enqueues scrape job to Redis
5. Worker picks up job from queue
6. Worker logs into bank (israel-bank-scrapers)
7. Worker retrieves transactions
8. Transactions stored in Postgres with user_id
9. AI categorization triggered
10. Results sent to frontend via Realtime

### Multi-Tenancy Model
- RLS enforced at database level
- Every table has user_id foreign key
- auth.uid() ensures isolation
- service_role key never reaches client
```

---

### 4. Deployment Guide

```markdown
## Deployment to Production

### Frontend (Vercel)
1. Push to main branch
2. Vercel auto-deploys
3. Verify: https://wealthclick.vercel.app

### Environment Variables
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY (server only)
- ANTHROPIC_API_KEY

### Health Checks
- API responds to /health
- RLS policies enforced
- Worker logging visible in CloudWatch
```

---

### 5. Architecture Decision Records (ADRs)

```markdown
# ADR-001: Use Supabase for Auth & Database

## Decision
Use Supabase (managed Postgres + Auth) instead of building custom auth.

## Rationale
- RLS for automatic multi-tenancy isolation
- Google OAuth built-in
- Realtime subscriptions for live updates
- Lower operational overhead

## Alternatives Considered
- Custom Auth + AWS RDS (rejected: too much work)
- Firebase (rejected: limited Postgres support)

## Consequences
- Vendor lock-in to Supabase
- Limited control over database infrastructure
- Strong security model out of the box
```

---

## Documentation Structure for wealthclick

```
docs/
├── README.md                       # Documentation overview
├── getting-started/
│   ├── setup.md                    # Dev environment setup
│   ├── quick-start.md              # First 10 minutes
│   └── faq.md                      # Frequently asked questions
├── architecture/
│   ├── overview.md                 # High-level system design
│   ├── data-flow.md                # Transaction pipeline
│   ├── multi-tenancy.md            # RLS and isolation
│   ├── adr/
│   │   ├── adr-001-supabase.md
│   │   ├── adr-002-ai-categorization.md
│   │   └── adr-003-job-queue.md
├── api/
│   ├── authentication.md           # Auth flows
│   ├── bank-accounts.md            # Bank account endpoints
│   ├── transactions.md             # Transaction endpoints
│   ├── categories.md               # Category endpoints
│   └── scraping.md                 # Scrape job endpoints
├── features/
│   ├── bank-connection.md          # How bank scraping works
│   ├── transaction-import.md       # Import and categorization
│   ├── categorization.md           # AI-powered categories
│   └── dashboard.md                # Dashboard metrics
├── deployment/
│   ├── vercel.md                   # Deploy frontend
│   ├── railway.md                  # Deploy worker
│   ├── environment-variables.md    # Secrets setup
│   ├── aws.md                      # AWS migration guide
│   └── monitoring.md               # Logs, metrics, alerts
├── database/
│   ├── schema.md                   # Table structure
│   ├── migrations.md               # Running migrations
│   ├── rls-policies.md             # Security policies
│   └── indexes.md                  # Performance tuning
├── security/
│   ├── data-protection.md          # Encryption, PII handling
│   ├── authentication.md           # Auth security
│   ├── multi-tenancy.md            # RLS enforcement
│   ├── compliance.md               # Regulatory requirements
│   └── incident-response.md        # Security incidents
├── contributing/
│   ├── code-style.md               # Linting, formatting
│   ├── testing.md                  # Test requirements
│   ├── pull-requests.md            # PR workflow
│   └── commit-messages.md          # Git conventions
├── troubleshooting/
│   ├── common-errors.md            # Error messages
│   ├── debugging.md                # Debug techniques
│   ├── performance.md              # Slow queries, caching
│   └── bank-scraping.md            # OTP issues, failures
└── CHANGELOG.md                    # Version history
```

---

## Documentation Tools & Formats

### Markdown (Primary)
- Simple, version-controllable
- GitHub renders natively
- Easy to update with code changes

### Tools
- **Docs generator**: Docusaurus, MkDocs, Nextra
- **API docs**: Swagger/OpenAPI, Postman
- **Diagrams**: Mermaid, PlantUML, Draw.io
- **Screenshots**: Tool tips, annotated images
- **Code examples**: Embedded from repo (auto-update)

### Deployment Options
- GitHub Pages (free, docs in repo)
- Vercel (docs.wealthclick.com)
- ReadTheDocs (Markdown generator)
- Notion (collaborative, searchable)

---

## Content Templates

### API Endpoint Template
```markdown
## GET /api/transactions

Fetch user's transactions with optional filters.

### Authentication
- Required: Bearer token in Authorization header

### Query Parameters
- `startDate` (ISO 8601): Filter from date
- `endDate` (ISO 8601): Filter to date
- `categoryId` (UUID): Filter by category
- `limit` (int, default 50): Max results
- `offset` (int, default 0): Pagination offset

### Response (200)
```json
{
  "data": [{
    "id": "uuid",
    "date": "2024-03-15",
    "amount": -125.50,
    "description": "Payment to credit card",
    "categoryId": "uuid",
    "categoryName": "Credit Card Payment"
  }],
  "pagination": {
    "total": 248,
    "limit": 50,
    "offset": 0
  }
}
```

### Errors
- `401` — Unauthorized
- `400` — Invalid query parameters
- `500` — Server error
```

### Feature Documentation Template
```markdown
## Feature: AI-Powered Transaction Categorization

### Overview
Automatically categorize transactions using Claude AI based on description and amount patterns.

### How It Works
1. Transaction imported from bank
2. Category suggested by AI model
3. User can accept, reject, or manually select category
4. Feedback stored for future improvements

### User Guide
- Step 1: Connect bank account
- Step 2: Review auto-categorized transactions
- Step 3: Adjust categories as needed
- Step 4: Dashboard shows spending by category

### Technical Details
- Model: Claude 3 Haiku
- Latency: ~500ms per transaction
- Batch processing: Max 100 txns/request
```

### ADR Template
```markdown
# ADR-XXX: [Title]

## Status
- Proposed / Accepted / Deprecated / Superseded

## Context
[Explain the issue requiring decision]

## Decision
[Describe what was decided]

## Rationale
[Why this decision was made]

## Alternatives Considered
- [Option A]: [Pros/Cons]
- [Option B]: [Pros/Cons]

## Consequences
- [Positive consequence]
- [Negative consequence]

## Related ADRs
- ADR-XXX: [Related decision]
```

---

## When to Use

Invoke this agent when:
- Creating API documentation
- Writing developer setup guides
- Documenting architecture decisions
- Recording breaking changes in CHANGELOG
- Creating deployment runbooks
- Writing user guides or FAQs
- Documenting database schema
- Recording security model
- Creating troubleshooting guides
- Organizing or restructuring docs

## How to Invoke

```
Agent({
  description: "Create or improve documentation for wealthclick",
  subagent_type: "documentation",
  prompt: "..."
})
```

Or mention documentation needs:
```
"Write API documentation for the transactions endpoint"
"Create a developer setup guide"
"Document why we chose Supabase (ADR)"
"Write troubleshooting guide for bank scraping issues"
"Update CHANGELOG for v1.0.0 release"
"Create a deployment runbook for production"
```

---

## Documentation Best Practices

### Writing
- ✅ Clear, concise language (avoid jargon)
- ✅ Active voice, present tense
- ✅ Code examples for every major concept
- ✅ Links to related documentation
- ✅ Updated with every code change
- ✅ Version-controlled (in git)

### Organization
- ✅ Clear hierarchy (docs/ folder structure)
- ✅ Consistent file naming (kebab-case)
- ✅ Table of contents for long docs
- ✅ Search functionality
- ✅ Related links between sections

### Examples & Code
- ✅ Real code samples (not pseudo-code)
- ✅ Copy-paste ready (executable)
- ✅ Multiple languages/frameworks
- ✅ Error cases included
- ✅ Keep examples near code (auto-update)

### Accuracy
- ✅ Link to source code
- ✅ Test examples before publishing
- ✅ Run doctests automatically
- ✅ Review by domain experts
- ✅ Version docs with releases

---

## Checklist: Documentation Before Deployment

- [ ] API endpoints documented with examples
- [ ] Database schema documented
- [ ] Architecture updated with new components
- [ ] Security model documented
- [ ] Breaking changes noted in CHANGELOG
- [ ] Deployment steps documented
- [ ] Environment variables documented
- [ ] Error codes documented
- [ ] Troubleshooting guide updated
- [ ] Developer setup guide accurate

---

## Related Agents

- **Backend Agent** (`.claude/agents/backend.md`) — For API endpoint details
- **Database Agent** (`.claude/agents/database.md`) — For schema documentation
- **Security Agent** (`.claude/agents/security.md`) — For security model docs
- **AWS Agent** (`.claude/agents/aws.md`) — For deployment documentation
- See CLAUDE.md for project overview

## References

- [GitHub Markdown Guide](https://guides.github.com/features/mastering-markdown/)
- [OpenAPI Specification](https://swagger.io/specification/)
- [Architecture Decision Records](https://adr.github.io/)
- [Diátaxis Framework](https://diataxis.fr/) (documentation structure)
- [Technical Writing Google](https://developers.google.com/tech-writing)
