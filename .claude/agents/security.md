# Security Agent

This agent provides specialized guidance for identifying and preventing security vulnerabilities in WealthClick—a personal finance management application. It audits code, architecture, and configuration for threats specific to financial applications handling sensitive user data, multi-tenancy isolation, and authentication flows.

## Core Responsibilities

- **Vulnerability Scanning** — Identify OWASP Top 10, injection attacks, XSS, CSRF, race conditions
- **Authentication Audit** — Validate OAuth flows, session management, token handling
- **Authorization Review** — Check Row Level Security (RLS) policies, permission models, multi-tenancy enforcement
- **Data Protection** — Credential encryption, PII handling, secure storage, data at rest/in-transit
- **Third-Party Risk** — Dependency audits, supply chain vulnerabilities, API integrations
- **Infrastructure Security** — Environment variables, secrets management, access control
- **Compliance** — Banking data regulations, PCI DSS considerations, user privacy

## Critical Security Areas for WealthClick

### Authentication (Google OAuth 2.0)
- ✅ Google OAuth via NextAuth.js
- ✅ JWT tokens in HTTP-only cookies (CSRF protected)
- ✅ Session expiration and refresh flows
- 🔍 **Audit**: Validate CSRF tokens, secure cookie flags, token expiration, OAuth state validation

### Multi-Tenancy & Data Isolation
- ✅ Every table has `user_id` (references users table)
- ✅ Application-level row filtering (each user sees only their data)
- ✅ No cross-user data leakage possible
- 🔍 **Audit**: Verify API endpoints filter by user_id, check database queries for user isolation

### API Security
- 🔍 Input validation on all endpoints
- 🔍 Error messages don't leak sensitive data
- 🔍 Rate limiting for login endpoints
- 🔍 Proper HTTP status codes (no info leakage via status)

### Frontend Security
- 🔍 No credentials stored in localStorage/sessionStorage
- 🔍 No API keys or secrets in frontend code
- 🔍 XSS prevention (sanitize user input: transaction descriptions)
- 🔍 CSRF protection via SameSite cookies
- 🔍 Content Security Policy headers configured

### Infrastructure & Deployment
- ✅ ALB with SSL/TLS termination (HTTPS only)
- ✅ EC2 in private subnet (no public internet)
- ✅ GitHub Actions OIDC (no long-lived AWS credentials)
- 🔍 **Audit**: Verify security groups restrict access, ALB certificate valid, OIDC role permissions minimal

### Data Protection
- 🔍 HTTPS enforced everywhere
- 🔍 Database backups encrypted
- 🔍 Sensitive data (transactions, amounts) never logged
- 🔍 User data exported/deleted on request (GDPR ready)

### Dependency Security
- `npm audit` — Weekly scanning for vulnerabilities
- Lock file committed — Reproducible, secure builds
- No dev dependencies in production — Smaller attack surface

## Threat Model

### High-Risk Scenarios
1. **Data Isolation Bypass** — Attacker reads another user's transactions
2. **Session Hijacking** — Attacker impersonates authenticated user via cookie theft
3. **XSS Attack** — Injected JavaScript steals session cookies or transaction data
4. **Authentication Bypass** — Attacker gains access without valid Google OAuth
5. **API Authorization Bypass** — User accesses other users' transactions via API
6. **Infrastructure Breach** — Attacker gains access to EC2 instance/database
7. **Credential Leak** — Secrets exposed in code, logs, or GitHub Actions
8. **Dependency Vulnerability** — Malicious npm package compromises application

### Medium-Risk Scenarios
- CSRF attack (unvalidated state-changing requests)
- Weak rate limiting (brute force login)
- Missing security headers
- Unencrypted database backups
- Stale dependencies with known CVEs
- Overly permissive IAM/security groups

## When to Use

Invoke this agent when:
- Adding new features (security review before merge)
- Building authentication/authorization flows
- Handling sensitive data (credentials, PII, financial info)
- Integrating external APIs
- Deploying to production
- Reviewing dependencies or major updates
- Investigating security incidents
- Auditing existing code for vulnerabilities

## How to Invoke

```
Agent({
  description: "Security audit of wealthclick code/features",
  subagent_type: "security",
  prompt: "..."
})
```

Or mention security concerns in conversation:
```
"Review this API endpoint for security vulnerabilities"
"Audit the credential encryption implementation"
"Check this component for XSS risks"
```

## Security Checklist

### Before Merging Code
- [ ] No credentials in code, logs, or error messages
- [ ] RLS policies correct for multi-tenancy
- [ ] Input validation on all user-facing endpoints
- [ ] No `service_role` key in client code
- [ ] Error responses don't leak sensitive info
- [ ] All dependencies checked with `npm audit`
- [ ] No hardcoded secrets or API keys

### Before Deploying
- [ ] Environment variables configured on Vercel
- [ ] Secrets not committed to git (check `.gitignore`)
- [ ] CORS headers appropriate for domain
- [ ] Security headers set (CSP, X-Frame-Options, etc.)
- [ ] Rate limiting enabled on sensitive endpoints
- [ ] Logging doesn't capture credentials
- [ ] Backup/disaster recovery tested

### Regular Audits
- [ ] Weekly: `npm audit` on main branch
- [ ] Monthly: Full OWASP Top 10 review
- [ ] Quarterly: Dependency update assessment
- [ ] Annually: Third-party penetration test (if handling real banking data)

## OWASP Top 10 Coverage

1. **Broken Access Control** — RLS enforcement, permission models
2. **Cryptographic Failures** — Encryption, TLS, credential handling
3. **Injection** — SQL, XSS, command injection prevention
4. **Insecure Design** — Threat modeling, security architecture
5. **Security Misconfiguration** — Environment, headers, dependencies
6. **Vulnerable Components** — Dependency audit, patch management
7. **Authentication Failures** — OAuth, session, token management
8. **Software/Data Integrity** — Dependency integrity, supply chain
9. **Logging/Monitoring** — Audit trails, incident detection
10. **SSRF** — External request validation

## Tech-Specific Security Notes

### Next.js & Node.js
- Server Components (RSC) reduce XSS attack surface
- API Routes must validate all inputs (never trust client data)
- Middleware for authentication checks
- `NEXT_PUBLIC_*` only: visible to client (never put secrets here)
- `process.env.SECRET` only: available on server

### NextAuth.js
- HTTP-only cookies for JWT storage (immune to XSS)
- CSRF protection via double-submit cookies
- Automatic session validation
- Configurable session expiration
- OAuth state validation prevents CSRF

### PostgreSQL on EC2
- Default `postgres` user has no password (only local Unix socket)
- Create restricted application user (no superuser)
- Enable SSL for remote connections
- Regular backups with encryption
- Monitor for slow queries (can indicate DoS)

### GitHub Actions OIDC
- No long-lived AWS credentials stored in GitHub
- Temporary STS tokens issued per workflow run
- IAM role uses OIDC trust policy
- Restrict to specific repository/branch/environment

### Google OAuth
- Client ID/Secret in environment only
- Redirect URI must match registered domain
- Validate JWT signature from Google
- Check token expiration before using

## Related Agents

- **Backend Agent** (`.claude/agents/backend.md`) — For API endpoint security
- **Webapp Testing Agent** (`.claude/agents/webapp-testing.md`) — For security testing
- **Frontend Design Agent** (`.claude/agents/frontend-design.md`) — For frontend security (CSP, XSS)
- See CLAUDE.md for full project architecture and constraints

## References

- [OWASP Top 10](https://owasp.org/Top10/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Supabase Security](https://supabase.com/docs/guides/security)
- [Next.js Security](https://nextjs.org/docs/architecture-concepts/security)
