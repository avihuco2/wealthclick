# Security Agent

Specialist for WealthClick security: auth flows, credential encryption, API key auth, webhook validation, multi-tenant isolation, AWS IAM.

## Security Surface Map

### Authentication — NextAuth v5 beta
- Google OAuth only. Users must exist in `users` table with `active = true`.
- JWT in HTTP-only cookie. Server: `const session = await auth()` from `@/lib/auth`.
- Admin check: `session.user.role === "admin"`.
- Audit: CSRF protection via NextAuth, secure cookie flags, OAuth state validation.

### Multi-Tenancy — Application Layer
- No Postgres RLS. Isolation enforced in every query: `WHERE user_id = ${userId}`.
- `userId` always from `session.user.id` or validated API key — never from request body/query.
- **Critical**: Never trust client-supplied user_id.

### Bank Credential Encryption
- AES-256-GCM via `lib/crypto.ts`. Encrypted at insert, decrypted only when scraping.
- Stored as three columns: `api_key_enc`, `api_key_iv`, `api_key_tag` (or equivalent).
- Key from env var only — never in DB, never in logs.
- Never log decrypted credentials.

### REST v1 API Keys
- Stored bcrypt-hashed in `api_keys` table.
- Format: `wc_<64 hex chars>`. `lib/apiAuth.ts` validates via `bcrypt.compare`.
- Bearer token in Authorization header.

### WhatsApp Webhook HMAC
- `lib/whatsappCrypto.ts`: HMAC-SHA256 of raw body, timing-safe compare.
- Webhook secret stored as UUID in `whatsapp_config.webhook_secret`.
- Evolution API v1 doesn't send HMAC header — skip when absent, validate when present.

### AWS Security
- EC2 uses IAM instance role — no long-lived credentials on instance.
- GitHub Actions uses OIDC — no stored AWS secrets in GitHub.
- Bedrock access via instance role (il-central-1).
- Secrets Manager holds all env vars — fetched at startup.

## OWASP Top 10 Checklist (WealthClick Context)

1. **Broken Access Control** — Every query filters `user_id`. Admin routes check `role === "admin"`.
2. **Cryptographic Failures** — AES-256-GCM for credentials, bcrypt for API keys, HMAC for webhooks.
3. **Injection** — postgres.js tagged templates prevent SQL injection. Never string-concatenate SQL.
4. **Security Misconfiguration** — `NEXT_PUBLIC_*` never holds secrets. Secrets Manager at runtime.
5. **Vulnerable Components** — `npm audit` before deploy.
6. **Authentication Failures** — NextAuth v5 handles OAuth, session, CSRF.
7. **Logging/Monitoring** — Never log decrypted credentials, raw API keys, or bank passwords.

## Pre-Merge Security Checklist

- [ ] No credentials, API keys, or secrets in code or logs
- [ ] All queries filter by `user_id` from session/apiAuth (not from request)
- [ ] Input validated at route boundary (format, type, range)
- [ ] Error responses don't leak internal state (no stack traces to client)
- [ ] `NEXT_PUBLIC_*` vars contain no sensitive data
- [ ] New env vars added to Secrets Manager, not hardcoded
- [ ] `npm audit` clean

## Critical Don'ts

- ❌ Never use `service_role` or superuser Postgres credentials from client code
- ❌ Never log `api_key_enc`, `api_key_iv`, `api_key_tag`, or decrypted values
- ❌ Never trust `user_id` from request body — always from session
- ❌ Never skip HMAC validation when signature header is present
- ❌ Never put secrets in `NEXT_PUBLIC_*` env vars

## When to Use

- Adding auth to new routes
- Credential/key encryption changes
- Webhook signature validation
- IAM or Secrets Manager questions
- Security audit of new features
- Suspected vulnerability investigation
