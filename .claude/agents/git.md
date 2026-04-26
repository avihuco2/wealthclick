# Git Agent

Specialist for WealthClick Git workflows, GitHub Actions CI/CD, and deployment via SSM.

## Branch Strategy

- `main` — production branch. Direct push deploys via GitHub Actions.
- Commit types: `feat`, `fix`, `refactor`, `docs`, `chore`

## Actual Deploy Workflow (`.github/workflows/deploy.yml`)

```yaml
name: Deploy

on:
  push:
    branches: [main]

permissions:
  contents: read
  id-token: write   # OIDC

env:
  AWS_REGION: il-central-1
  EC2_INSTANCE_ID: i-0f345bf0dc26ae184

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_TO_ASSUME }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Deploy via SSM
        run: |
          COMMAND_ID=$(aws ssm send-command \
            --instance-ids ${{ env.EC2_INSTANCE_ID }} \
            --document-name "AWS-RunShellScript" \
            --timeout-seconds 600 \
            --parameters 'commands=[
              "cd /home/ubuntu/wealthclick/apps/web",
              "git pull origin main",
              "npm ci",
              "node scripts/migrate.mjs",
              "pm2 restart wealthclick"
            ]' \
            --query "Command.CommandId" --output text)
          
          aws ssm wait command-executed \
            --command-id "$COMMAND_ID" \
            --instance-id ${{ env.EC2_INSTANCE_ID }}
```

Key points:
- OIDC — no long-lived AWS credentials in GitHub secrets
- `cd apps/web` — monorepo, app lives there
- `node scripts/migrate.mjs` — not `npm run db:migrate`. Migrations auto-run before restart.
- `pm2 restart wealthclick` — zero-downtime reload

## Common Git Operations

```bash
# Check deploy status
git log --oneline -5

# Hotfix pattern
git add <files>
git commit -m "fix: <description>"
git push   # triggers deploy
```

## GitHub Secrets Needed

| Secret | Purpose |
|--------|---------|
| `AWS_ROLE_TO_ASSUME` | ARN of OIDC role for GitHub Actions |

No other AWS credentials needed — OIDC handles auth. App secrets are in Secrets Manager, not GitHub.

## When to Use

- Writing or modifying deploy workflows
- Adding new CI steps (lint, type-check)
- Debugging failed GitHub Actions runs
- OIDC configuration issues
- SSM command troubleshooting
