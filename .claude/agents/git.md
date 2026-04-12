# Git & GitHub Actions Agent

This agent provides specialized guidance for writing efficient GitHub Actions workflows for WealthClick. It covers CI/CD pipelines, testing, and deployment automation with a focus on auto-deploying to EC2 via OIDC (no long-lived credentials).

## Core Responsibilities

- **Workflow Design** — Efficient job orchestration, parallelization, caching
- **CI/CD Pipelines** — Linting, testing, building, deploying
- **Performance Optimization** — Caching strategies, artifact management, job duration
- **Security** — Secret management, permissions, dependency scanning, OIDC
- **Testing Workflows** — Unit tests, E2E tests, coverage reporting
- **Deployment Workflows** — To Vercel, AWS, Railway, Supabase
- **Debugging** — Workflow troubleshooting, logs inspection, re-runs
- **Matrix Builds** — Multi-version testing (Node.js, databases)
- **Conditional Logic** — Run jobs based on file changes, branch, events

## GitHub Actions Fundamentals

### Workflow Structure
```yaml
name: Workflow Name                    # Display name

on:                                    # Trigger events
  push:
    branches: [main, develop]
  pull_request:
  schedule:                            # Cron schedule
    - cron: '0 0 * * *'

env:                                   # Shared environment variables
  NODE_VERSION: '22'

jobs:
  build:                               # Job name
    runs-on: ubuntu-latest             # Runner type
    timeout-minutes: 30                # Max duration
    
    permissions:
      contents: read
      pull-requests: write
    
    steps:
      - uses: actions/checkout@v4      # Check out code
      
      - name: Step name                # Human-readable name
        run: npm run build             # Run command
        env:
          SECRET_VAR: ${{ secrets.MY_SECRET }}
```

### Workflow Triggers
- `push` — Code pushed to branch
- `pull_request` — PR created/updated
- `schedule` — Cron schedule
- `workflow_dispatch` — Manual trigger
- `workflow_call` — Called from another workflow (reusable)
- `repository_dispatch` — Triggered via API

---

## WealthClick Deployment Flow (Phase 1)

**Trigger:** Push to `main` branch
**Destination:** EC2 instance in private subnet
**Credentials:** AWS OIDC (no secrets stored)

```
Push to main
  ↓
GitHub Actions workflow starts
  ↓
OIDC token obtained (no credentials)
  ↓
Lint & test (fail-fast)
  ↓
Build Docker image (optional)
  ↓
SSM SendCommand to EC2:
  - git pull (latest code)
  - npm ci (install)
  - npm run build (compile)
  - npm run db:migrate (apply migrations)
  - pm2 restart wealthclick (zero-downtime reload)
  ↓
Application running with new code
  ↓
ALB routes traffic to EC2 (HTTPS)
```

---

## WealthClick CI/CD Workflows

### 1. Lint & Format (On Every PR)

```yaml
name: Lint & Format

on:
  pull_request:
    paths:
      - 'apps/**'
      - 'packages/**'
      - '.github/workflows/**'

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'  # Cache node_modules
      
      - name: Install dependencies
        run: npm ci  # Deterministic install (vs npm install)
      
      - name: Run ESLint
        run: npm run lint
      
      - name: Run Prettier
        run: npm run format:check
      
      - name: Run TypeScript
        run: npm run type-check
```

**Optimizations:**
- ✅ `actions/setup-node@v4` with `cache: npm` — Saves 30s+ per run
- ✅ `npm ci` — Deterministic, respects lock file
- ✅ Only runs on relevant paths changed
- ✅ Parallel linting tasks (if split into separate jobs)

---

### 2. Test Suite (Unit + Integration)

```yaml
name: Tests

on:
  pull_request:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: wealthclick_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      
      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm run test:unit
      
      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgres://postgres:postgres@localhost:5432/wealthclick_test
          REDIS_URL: redis://localhost:6379
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
          fail_ci_if_error: false
```

**Optimizations:**
- ✅ Service containers (Postgres, Redis) for integration tests
- ✅ Health checks before tests run
- ✅ Coverage uploaded to Codecov
- ✅ Separate unit/integration for clarity

---

### 3. E2E Testing (Playwright)

```yaml
name: E2E Tests

on:
  pull_request:
  push:
    branches: [main]
  schedule:
    - cron: '0 0 * * *'  # Daily at midnight

jobs:
  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright browsers
        run: npm run e2e:install-browsers
      
      - name: Start dev server
        run: npm run dev &
        timeout-minutes: 5
      
      - name: Wait for server
        run: npx wait-on http://localhost:3000
      
      - name: Run E2E tests
        run: npm run e2e
        env:
          E2E_USERNAME: ${{ secrets.E2E_TEST_USER }}
          E2E_PASSWORD: ${{ secrets.E2E_TEST_PASSWORD }}
      
      - name: Upload Playwright report
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

**Optimizations:**
- ✅ Playwright browsers cached
- ✅ Dev server starts in background
- ✅ Waits for server before running tests
- ✅ Artifacts uploaded on failure for debugging
- ✅ Scheduled daily runs for continuous validation

---

### 4. Build & Deploy to EC2 (OIDC)

```yaml
name: Deploy to EC2

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  AWS_REGION: us-east-1
  EC2_INSTANCE_ID: i-xxxxxxxxxxxxx

permissions:
  contents: read
  id-token: write  # OIDC token

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: Assume AWS role (OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_TO_ASSUME }}
          aws-region: ${{ env.AWS_REGION }}
      
      - name: Deploy to EC2 via SSM
        run: |
          aws ssm send-command \
            --instance-ids ${{ env.EC2_INSTANCE_ID }} \
            --document-name "AWS-RunShellScript" \
            --timeout-seconds 600 \
            --parameters 'commands=[
              "cd /home/ubuntu/wealthclick",
              "git pull origin main",
              "npm ci",
              "npm run build",
              "npm run db:migrate",
              "pm2 restart wealthclick"
            ]'
```

**Key Points:**
- ✅ OIDC token (no long-lived AWS credentials)
- ✅ SSM SendCommand (EC2 in private subnet, no SSH)
- ✅ Zero-downtime via pm2 restart
- ✅ Automatic migrations on deploy

---

### 5. Security Scanning (Weekly + PR)

```yaml
name: Security Scan

on:
  push:
  pull_request:
  schedule:
    - cron: '0 0 * * 0'  # Weekly Sunday midnight

jobs:
  npm-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      
      - name: Run npm audit
        run: npm audit --audit-level=moderate
        continue-on-error: false
```

---

### 5. Database Migrations (On Deploy)

Database migrations run automatically during deployment:

```bash
# In deploy.yml: SSM SendCommand includes
npm run db:migrate
```

This runs pending migrations on the EC2 instance before restarting the app.

```typescript
// packages/db/migrations.ts
import { execSync } from 'child_process';

export async function runMigrations() {
  try {
    execSync('psql $DATABASE_URL -f migrations/001_init.sql', { stdio: 'inherit' });
    console.log('✅ Migrations completed');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}
```

---

## Performance Optimization Techniques

### 1. Caching

```yaml
- name: Setup Node.js with cache
  uses: actions/setup-node@v4
  with:
    node-version: '22'
    cache: 'npm'  # Auto caches node_modules
```

**Or manual caching:**
```yaml
- name: Cache node_modules
  uses: actions/cache@v3
  with:
    path: node_modules
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-
```

**Benefits:** 30-60s saved per job

---

### 2. Matrix Builds (Test Multiple Versions)

```yaml
strategy:
  matrix:
    node-version: ['20', '22']
    postgres-version: ['14', '15']

steps:
  - name: Setup Node.js ${{ matrix.node-version }}
    uses: actions/setup-node@v4
    with:
      node-version: ${{ matrix.node-version }}
```

**Result:** Runs job once per combination (4 parallel jobs)

---

### 3. Conditional Steps

```yaml
- name: Deploy to production
  if: github.ref == 'refs/heads/main' && success()
  run: npm run deploy:prod

- name: Comment on PR
  if: github.event_name == 'pull_request'
  uses: actions/github-script@v7
  with:
    script: |
      github.rest.issues.createComment({
        issue_number: context.issue.number,
        owner: context.repo.owner,
        repo: context.repo.repo,
        body: '✅ Build passed!'
      })
```

---

### 4. Artifacts for Debugging

```yaml
- name: Upload build artifacts
  if: failure()  # Only on failure
  uses: actions/upload-artifact@v3
  with:
    name: build-artifacts
    path: dist/
    retention-days: 7

- name: Download artifacts
  uses: actions/download-artifact@v3
  with:
    name: build-artifacts
    path: ./build/
```

---

## Secrets Management

### Store Secrets Safely
```yaml
- name: Use secrets
  run: echo ${{ secrets.API_KEY }}
  env:
    SECRET: ${{ secrets.SECRET_NAME }}
```

**Best Practices:**
- ✅ Store in GitHub Settings → Secrets
- ✅ Use environment-specific secrets
- ✅ Rotate secrets regularly
- ✅ Never log secrets
- ✅ Use OIDC for AWS/cloud provider (avoid long-lived tokens)

### OIDC Example (AWS)
```yaml
permissions:
  id-token: write
  contents: read

steps:
  - name: Assume AWS role
    uses: aws-actions/configure-aws-credentials@v4
    with:
      role-to-assume: arn:aws:iam::123456789:role/GitHubActionsRole
      aws-region: us-east-1
```

---

## Debugging Workflows

### Enable Debug Logging
```yaml
- name: Enable debug
  run: echo "::debug::This is a debug message"
```

**Or set repository secret:**
```
ACTIONS_STEP_DEBUG = true
```

### Inspect Workflow Context
```yaml
- name: Dump context
  run: |
    echo "Event: ${{ github.event_name }}"
    echo "Branch: ${{ github.ref }}"
    echo "SHA: ${{ github.sha }}"
    echo "Actor: ${{ github.actor }}"
```

### Re-run Failed Jobs
- GitHub UI: Click "Re-run failed jobs"
- Command: `gh run rerun <run-id>`

---

## WealthClick Recommended Workflows (Phase 1)

| Workflow | Trigger | Purpose | Est. Time |
|----------|---------|---------|-----------|
| **lint.yml** | PR | ESLint, Prettier, TypeScript | 2-3m |
| **test.yml** | PR + push | Unit + integration tests | 5-8m |
| **e2e.yml** | Daily + manual | Playwright E2E tests | 10-15m |
| **deploy.yml** | main push | Deploy to EC2 via OIDC | 3-5m |
| **security.yml** | Weekly + PR | npm audit, secret scan | 2-3m |

---

## Reusable Workflows

```yaml
# .github/workflows/reusable-test.yml
name: Reusable Test Workflow

on:
  workflow_call:
    inputs:
      node-version:
        required: false
        default: '22'
        type: string
    secrets:
      DATABASE_URL:
        required: true

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm test
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

**Usage in another workflow:**
```yaml
- uses: ./.github/workflows/reusable-test.yml
  secrets: inherit
```

---

## When to Use

Invoke this agent when:
- Designing new GitHub Actions workflows
- Optimizing slow workflows
- Debugging failing CI/CD jobs
- Setting up security scanning
- Deploying to Vercel, AWS, Railway
- Running tests in parallel
- Managing secrets and permissions
- Creating reusable workflows

## How to Invoke

```
Agent({
  description: "Write or optimize GitHub Actions workflows for wealthclick",
  subagent_type: "git",
  prompt: "..."
})
```

Or mention workflow needs:
```
"Create a workflow to run tests on every PR"
"Set up automated deployment to Vercel on main push"
"Write a workflow for running E2E tests daily"
"Optimize this slow workflow that takes 20 minutes"
"Create a security scanning workflow"
```

---

## Related Agents

- **Backend Agent** (`.claude/agents/backend.md`) — For test configuration
- **Database Agent** (`.claude/agents/database.md`) — For migration workflows
- **Webapp Testing Agent** (`.claude/agents/webapp-testing.md`) — For E2E test workflows
- **AWS Agent** (`.claude/agents/aws.md`) — For AWS deployment workflows
- **Documentation Agent** (`.claude/agents/documentation.md`) — For workflow documentation

## References

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [GitHub Actions Best Practices](https://docs.github.com/en/actions/guides)
- [Awesome GitHub Actions](https://github.com/sdras/awesome-actions)
- [Workflow Performance Tips](https://docs.github.com/en/actions/using-workflows/workflow-performance)
- [Security Hardening](https://docs.github.com/en/actions/security-guides)
