# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

**WealthClick** — A modern, personal finance management application inspired by Apple's design language. Users authenticate with Google accounts and track their financial transactions with beautiful visualizations, smart categorization, and actionable insights.

**Design Philosophy:** Young, clean, modern (Apple-inspired), delightful micro-interactions, minimalist interface with maximum clarity.

---

## Phase 1 Architecture (Current)

**Goal:** MVP hobby project with minimal complexity. Auto-deploy on every push.

```
┌─────────────────────────────────────────────────────────┐
│ GitHub Repository                                       │
│ (Push triggers GitHub Actions)                         │
└──────────────────┬──────────────────────────────────────┘
                   │
                   │ OIDC Token
                   ▼
        ┌──────────────────────┐
        │  GitHub Actions      │
        │  (OIDC to AWS)       │
        └──────────┬───────────┘
                   │
                   │ Deploy via SSM/EC2
                   ▼
┌──────────────────────────────────────────────────────────┐
│ AWS VPC                                                  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Public Subnet                                           │
│  ┌────────────────────────────────┐                     │
│  │ Application Load Balancer      │                     │
│  │ (Your custom domain + cert)    │                     │
│  └────────────┬───────────────────┘                     │
│               │                                          │
│  Private Subnet                                          │
│  ┌────────────▼───────────────────┐                     │
│  │ EC2 Instance (t3.micro)        │                     │
│  │ ┌─────────────────────────────┐│                     │
│  │ │ Frontend (Next.js)          ││                     │
│  │ ├─────────────────────────────┤│                     │
│  │ │ Backend (Node.js API)       ││                     │
│  │ ├─────────────────────────────┤│                     │
│  │ │ Workers (Job processing)    ││                     │
│  │ ├─────────────────────────────┤│                     │
│  │ │ PostgreSQL Database         ││                     │
│  │ └─────────────────────────────┘│                     │
│  └────────────────────────────────┘                     │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Infrastructure

| Component | Technology | Details |
|-----------|-----------|---------|
| **CDN** | Route 53 + Custom Domain | Your registered domain + SSL certificate |
| **Load Balancer** | Application Load Balancer | Public subnet, SSL/TLS termination |
| **Compute** | EC2 t3.micro | Private subnet, single instance (can scale later) |
| **Database** | PostgreSQL (local on EC2) | Single-node, file-based backups |
| **Frontend** | Next.js 15 (App Router) | SSR/SSG rendering, served via Express.js |
| **Backend** | Node.js 22 + Express/Fastify | REST API, business logic |
| **Auth** | Google OAuth 2.0 | Via Passport.js or Clerk |
| **Jobs/Queues** | Bull (Redis) | Local Redis on EC2 |
| **CI/CD** | GitHub Actions + OIDC | Auto-deploy on push via SSM/EC2 Instance Connect |

---

## Development Setup

### Prerequisites

- Node.js 22+
- Docker (for local testing)
- Git

### Installation

```bash
# Clone repository
git clone https://github.com/avihuco2/wealthclick.git
cd wealthclick

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
```

### Environment Variables

```bash
# Authentication
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
NEXTAUTH_SECRET=random_secret_key

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/wealthclick

# Redis (for job queue)
REDIS_URL=redis://localhost:6379

# AWS (for GitHub Actions OIDC)
AWS_ROLE_TO_ASSUME=arn:aws:iam::ACCOUNT_ID:role/GitHubActionsRole
AWS_REGION=us-east-1

# Application
NODE_ENV=development
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### Local Development

```bash
# Start PostgreSQL (Docker)
docker run --name wealthclick-pg -e POSTGRES_PASSWORD=password -d -p 5432:5432 postgres:15

# Start Redis (Docker)
docker run --name wealthclick-redis -d -p 6379:6379 redis:7-alpine

# Run migrations
npm run db:migrate

# Start dev server (Next.js + API)
npm run dev

# In another terminal, start worker
npm run worker:dev
```

**Access:** http://localhost:3000

### Testing

```bash
# Unit tests
npm run test

# E2E tests (Playwright)
npm run e2e

# Linting & formatting
npm run lint
npm run format

# Type checking
npm run type-check
```

---

## Project Structure

```
wealthclick/
├── .github/
│   └── workflows/
│       ├── lint.yml              # ESLint + Prettier
│       ├── test.yml              # Unit + integration tests
│       ├── e2e.yml               # Playwright E2E tests
│       ├── build.yml             # Build Docker image
│       └── deploy.yml            # Deploy to EC2 via OIDC
│
├── apps/
│   ├── web/                      # Next.js frontend + API routes
│   │   ├── app/                  # App Router
│   │   │   ├── page.tsx          # Home page
│   │   │   ├── dashboard/        # Dashboard (protected)
│   │   │   ├── api/              # API routes
│   │   │   │   ├── auth/         # OAuth endpoints
│   │   │   │   ├── transactions/ # Transaction CRUD
│   │   │   │   ├── categories/   # Category CRUD
│   │   │   │   └── ...
│   │   │   └── layout.tsx        # Root layout (auth wrapper)
│   │   ├── components/           # React components
│   │   ├── lib/                  # Utilities, hooks
│   │   ├── public/               # Static assets
│   │   └── package.json
│   │
│   └── worker/                   # Background job processor
│       ├── jobs/                 # Job handlers
│       ├── src/
│       │   └── index.ts          # Worker entry point
│       └── package.json
│
├── packages/
│   ├── db/                       # Database utilities
│   │   ├── schema.ts             # Database schema types
│   │   ├── migrations/           # SQL migrations
│   │   └── migrations.ts         # Migration runner
│   │
│   └── types/                    # Shared TypeScript types
│
├── scripts/
│   └── deploy.sh                 # Deploy script (runs on EC2)
│
├── docker-compose.yml            # Local dev environment
├── Dockerfile                    # Multi-stage build for EC2
├── package.json                  # Monorepo root
└── CLAUDE.md                     # This file
```

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Frontend** | Next.js 15 + React 19 | SSR, App Router, API routes, edge functions |
| **Styling** | Tailwind CSS + shadcn/ui | Apple-inspired design system, accessibility |
| **State** | TanStack Query + Zustand | Server state, client state management |
| **Auth** | Google OAuth 2.0 + NextAuth | Simple, secure, no password management |
| **Backend** | Node.js 22 + Express | Simple, fast, JavaScript full-stack |
| **Database** | PostgreSQL 15 | Reliable, free, good for finance data |
| **Jobs** | Bull (Redis queue) | Simple background jobs, retry logic |
| **Testing** | Vitest + Playwright | Fast unit tests, realistic E2E tests |
| **Deployment** | GitHub Actions → EC2 | Simple, OIDC-based, no long-lived tokens |

---

## Design System (Apple-Inspired)

### Colors
- **Primary:** `#007AFF` (Apple blue)
- **Success:** `#34C759` (Apple green)
- **Warning:** `#FF9500` (Apple orange)
- **Danger:** `#FF3B30` (Apple red)
- **Background:** `#F5F5F7` (Neutral light)
- **Text:** `#1D1D1D` (Neutral dark)

### Typography
- **Font:** System font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto`)
- **Headlines:** SF Pro Display (or system default)
- **Body:** SF Pro Text (or system default)

### Components
- **Buttons:** Rounded corners (8px), subtle shadows, minimal borders
- **Cards:** Clean white/translucent backgrounds, soft shadows
- **Input:** Minimalist, focus state with blue accent
- **Spacing:** 8px grid system (8, 16, 24, 32, 40px)
- **Animations:** Subtle transitions (200-300ms), easing `ease-in-out`

### Examples
- Inspired by Apple's [Financial Health](https://support.apple.com/en-us/118308) in Wallet
- Inspired by Apple's [Money in Mail](https://www.apple.com/newsroom/pdfs/Apple-Personal-Finance-Setup-Guide.pdf) design

---

## Deployment: Phase 1

### Prerequisites

1. **AWS Account** with permissions to create ALB, EC2, IAM roles
2. **GitHub Repository** with OIDC provider configured
3. **Custom Domain** registered (e.g., wealthclick.com)
4. **SSL Certificate** created in AWS Certificate Manager (free)

### Step 1: AWS Setup (One-time)

```bash
# Create IAM role for GitHub Actions (OIDC)
# Trust policy: GitHub Actions OIDC provider

# Create VPC with public/private subnets
# - Public: ALB (0.0.0.0/0)
# - Private: EC2 (restricted)

# Create ALB in public subnet
# - Listener: 443 (HTTPS) → Target group port 3000
# - Listener: 80 (HTTP) → Redirect to HTTPS
# - Attach SSL certificate

# Create EC2 instance (t3.micro) in private subnet
# - Security group: Allow 3000 from ALB, 22 from GitHub Actions
# - IAM role: Allow SSM access for GitHub Actions deployment
# - AMI: Ubuntu 22.04
# - Install: Node.js 22, PostgreSQL, Redis, Docker

# Create security groups:
# - ALB-SG: Allow 80, 443 from 0.0.0.0/0
# - EC2-SG: Allow 3000 from ALB-SG, 22 from GitHub Actions
```

### Step 2: GitHub Actions OIDC

```yaml
# .github/workflows/deploy.yml

name: Deploy to EC2

on:
  push:
    branches: [main]

permissions:
  contents: read
  id-token: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Assume AWS role (OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_TO_ASSUME }}
          aws-region: us-east-1
      
      - name: Build Docker image
        run: docker build -t wealthclick:${{ github.sha }} .
      
      - name: Deploy to EC2
        run: |
          aws ssm send-command \
            --instance-ids i-xxxxx \
            --document-name "AWS-RunShellScript" \
            --parameters 'commands=[
              "cd /home/ubuntu/wealthclick",
              "git pull origin main",
              "npm ci",
              "npm run build",
              "npm run db:migrate",
              "pm2 restart wealthclick"
            ]'
```

### Step 3: EC2 Bootstrap Script

```bash
#!/bin/bash
# Run once on EC2 instance creation

# Install dependencies
sudo apt update && sudo apt upgrade -y
sudo apt install -y nodejs npm postgresql postgresql-contrib redis-server git curl

# Clone repository
git clone https://github.com/avihuco2/wealthclick.git /home/ubuntu/wealthclick
cd /home/ubuntu/wealthclick

# Install Node modules
npm install -g pm2
npm ci

# Initialize database
npm run db:migrate

# Start application with PM2
pm2 start npm --name "wealthclick" -- run start
pm2 save
pm2 startup
```

### Deployment Flow

```
1. Push to main branch
   ↓
2. GitHub Actions triggers deploy.yml
   ↓
3. OIDC token obtained (no long-lived credentials)
   ↓
4. Docker image built
   ↓
5. SSM SendCommand to EC2:
   - git pull (latest code)
   - npm ci (install)
   - npm run build (compile)
   - npm run db:migrate (schema updates)
   - pm2 restart (zero-downtime reload)
   ↓
6. Application running on EC2 (port 3000)
   ↓
7. ALB routes traffic to EC2
   ↓
8. Users access via custom domain (HTTPS)
```

---

## Security Model

### Authentication & Authorization
- **Google OAuth 2.0** — User identity via Google
- **NextAuth.js** — Session management, CSRF protection
- **JWT in HTTP-only cookies** — Secure token storage

### Data Protection
- **HTTPS everywhere** — TLS 1.3+ via ALB certificate
- **Row-Level Security (RLS)** — Each user sees only their own transactions
- **Encrypted credentials** — Bank/API credentials encrypted at rest (AES-256-GCM)
- **Environment variables** — Secrets never committed to git

### Multi-Tenancy
- Every table has `user_id` foreign key
- Database queries automatically filtered by `user_id`
- No data leakage between users (enforced at application layer)

### Compliance
- GDPR-ready: Users can export/delete their data
- No third-party tracking
- Minimal data collection

---

## Common Development Tasks

### Adding a New API Endpoint

```typescript
// app/api/transactions/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import db from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Fetch transaction (filtered by user_id automatically)
  const transaction = await db.transaction.findUnique({
    where: { id: params.id, user_id: session.user.id },
  });

  return NextResponse.json(transaction);
}
```

### Adding a New React Component

```typescript
// components/TransactionList.tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import Card from './Card';

export default function TransactionList() {
  const { data: transactions, isLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn: async () => {
      const res = await fetch('/api/transactions');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="space-y-2">
      {transactions?.map((tx) => (
        <Card key={tx.id} transaction={tx} />
      ))}
    </div>
  );
}
```

### Running a Single Test

```bash
# Unit test
npm run test -- TransactionList.test.ts

# E2E test
npm run e2e -- login.spec.ts

# Watch mode
npm run test -- --watch
```

### Debugging

```bash
# Enable Node.js debugging
node --inspect-brk dist/index.js

# Chrome DevTools: chrome://inspect
```

---

## Git Workflow

### Branch Strategy

- **main** — Production-ready code
- **develop** — Integration branch
- **feature/name** — Feature branches

### Commit Messages

```
<type>: <subject>

<body>

<footer>
```

**Types:** `feat`, `fix`, `refactor`, `test`, `docs`, `chore`

**Example:**
```
feat: add transaction categorization

- Implement AI-powered category suggestions
- Add manual category override UI
- Update transaction schema with category_id

Closes #42
```

### Pull Request Flow

1. Create feature branch from `develop`
2. Implement feature
3. Push and create PR
4. GitHub Actions runs: lint, test, e2e
5. Code review
6. Merge to `develop`
7. Merge `develop` → `main` for release

---

## Agents

### 🔒 Security Agent — `.claude/agents/security.md`
Identifies vulnerabilities—Google OAuth flows, data isolation, encryption, RLS policies, OWASP Top 10. Use before merging code handling sensitive data or authentication.

### 🗄️ Database Agent — `.claude/agents/database.md`
Designs Postgres schemas, migrations, RLS policies, query optimization. Use when creating tables or optimizing performance.

### ☁️ AWS Agent — `.claude/agents/aws.md`
Configures ALB, EC2, OIDC, auto-scaling (for future phases). Use when setting up infrastructure or planning Phase 2+ architecture.

### 📚 Documentation Agent — `.claude/agents/documentation.md`
Creates API docs, developer guides, ADRs, deployment runbooks. Use before releasing features.

### 🔧 Git & GitHub Actions Agent — `.claude/agents/git.md`
Writes GitHub Actions workflows, OIDC setup, auto-deployment scripts. Use when configuring CI/CD or automation.

### ⚙️ Backend Agent — `.claude/agents/backend.md`
Builds API routes, database queries, business logic. Use when implementing endpoints or backend features.

### 🎨 Frontend Design Agent — `.claude/agents/frontend-design.md`
Creates Apple-inspired interfaces—clean, modern, delightful. Use when building UI components or designing screens.

### 🧪 Webapp Testing Agent — `.claude/agents/webapp-testing.md`
Writes Playwright E2E tests, component testing, visual regression. Use when testing features or debugging UI issues.

---

## Deployment Checklist (Before Production)

- [ ] Google OAuth credentials configured
- [ ] SSL certificate installed on ALB
- [ ] Database backups automated
- [ ] Environment variables set on EC2
- [ ] GitHub Actions OIDC role created
- [ ] Security headers configured (CSP, X-Frame-Options)
- [ ] Error logging enabled
- [ ] Monitoring/alerting set up
- [ ] All tests passing
- [ ] Security agent approved code

---

## Deployment Approach

### Phase 1: Direct Node.js (Current)
- ✅ Applications run directly on EC2 via PM2
- ✅ No Docker overhead
- ✅ Fast deployment (3-5 minutes)
- ✅ Easy debugging and monitoring
- ✅ Simple SSM SendCommand approach

### Phase 2: Containers (When Ready to Scale)
- Migrate to Docker containers on EC2
- ECR (Elastic Container Registry) for image storage
- Multi-instance EC2 with load balancing
- Easier rollbacks and environment consistency

**Why Phase 1 skips containers:**
- MVP simplicity (fewer moving parts)
- Faster iteration and debugging
- Direct file access when needed
- Can migrate without changing core application code

**Migration to Phase 2 (Container):**
- Add Dockerfile (minimal changes to app)
- Configure ECR repository
- Update GitHub Actions to build/push images
- Switch EC2 deployment to pull/run Docker
- Everything else stays the same

---

## Next Steps (Phase 2+)

When MVP is stable:
- **Containerization** — Docker + ECR for multi-instance support
- **Auto-scaling** — Multiple EC2 instances behind ALB
- **Separate database** — AWS RDS PostgreSQL
- **CDN** — CloudFront for static assets
- **Real-time sync** — WebSockets or Server-Sent Events
- **Monitoring** — CloudWatch dashboards and alerts
- **Mobile app** — React Native client
- **Advanced analytics** — Spending trends, forecasting

---

## References

- [Next.js 15 Docs](https://nextjs.org)
- [Tailwind CSS](https://tailwindcss.com)
- [shadcn/ui](https://ui.shadcn.com)
- [NextAuth.js](https://next-auth.js.org)
- [PostgreSQL](https://www.postgresql.org/docs/)
- [Apple Design Guidelines](https://developer.apple.com/design/)
- [AWS ALB Documentation](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/)
- [GitHub Actions OIDC](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect)
