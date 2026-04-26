# AWS Agent

Specialist for WealthClick AWS infrastructure: EC2, ALB, SSM, Secrets Manager, Bedrock, IAM/OIDC.

## Current Architecture

```
Internet → ALB (public subnet, il-central-1) → EC2 t3.micro (private subnet)
                                                  ├── Next.js 16 via PM2
                                                  ├── PostgreSQL (local)
                                                  └── Puppeteer + scraper (in-process)
```

| Component | Detail |
|-----------|--------|
| EC2 instance | `i-0f345bf0dc26ae184`, il-central-1, private subnet |
| ALB | Public subnet, SSL/TLS termination, forwards to EC2:3000 |
| Secrets Manager | All env vars fetched at app startup, injected into `process.env` |
| Bedrock | AI models (Claude, Nova, Llama, Mistral, Gemma) — accessed via EC2 instance role |
| GitHub Actions OIDC | No long-lived credentials in GitHub — OIDC token → assume role → SSM SendCommand |

## Deploy Flow

```
Push to main
  → GitHub Actions (OIDC assume role)
  → SSM SendCommand to i-0f345bf0dc26ae184
      → cd apps/web
      → git pull origin main
      → npm ci
      → node scripts/migrate.mjs
      → pm2 restart wealthclick
```

**Cannot SSM from local machine** — only GitHub Actions role has SSM access. Use EC2 Instance Connect for interactive debugging.

## Secrets Manager

All app secrets live in Secrets Manager. App fetches on startup — do NOT hardcode or put in GitHub secrets.

To add a new secret:
1. Add to Secrets Manager in il-central-1
2. Update the startup fetch logic (or ensure it reads all keys from the secret)

## IAM Roles

- **EC2 instance role** — grants: Bedrock InvokeModel, Secrets Manager GetSecretValue, SSM (for Session Manager)
- **GitHub Actions OIDC role** — grants: SSM SendCommand on the EC2 instance only. Trust: `token.actions.githubusercontent.com` for repo `avihuco2/wealthclick` on `refs/heads/main`

## Bedrock

- Region: `il-central-1` (same as EC2 — no cross-region latency)
- Models accessed via cross-region inference profiles (`us.*` prefix in model IDs where available)
- `AWS_REGION=il-central-1` in env — Bedrock SDK picks it up automatically
- No explicit credentials needed — EC2 instance role used automatically

## SSM Debugging

```bash
# From local machine — requires Instance Connect (not SSM, different IAM)
# From GitHub Actions workflow_dispatch:
aws ssm send-command \
  --instance-ids i-0f345bf0dc26ae184 \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=["pm2 logs wealthclick --lines 100"]'
```

## SCRAPER_DEBUG

Not stored in Secrets Manager. To temporarily enable verbose Puppeteer logs:
```bash
# Via SSM SendCommand
pm2 restart wealthclick --update-env -- SCRAPER_DEBUG=true
# Disable after debugging:
pm2 restart wealthclick --update-env -- SCRAPER_DEBUG=false
```

## When to Use

- IAM permission issues (Bedrock, SSM, Secrets Manager)
- Deployment troubleshooting (SSM commands, PM2)
- EC2 networking (security groups, ALB health check)
- Secrets Manager updates
- Bedrock model access / region issues
- GitHub Actions OIDC configuration
