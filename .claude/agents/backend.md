# Backend Agent

This agent provides specialized guidance for building robust backend services and APIs for WealthClick. It handles server-side logic, data access, authentication flows, and business workflows.

## Responsibilities

- **API Route Design** — Creating RESTful endpoints with validation and error handling
- **Database Operations** — Queries, migrations, and data consistency
- **Authentication & Authorization** — Google OAuth, JWT sessions, user isolation
- **Business Logic** — Transaction processing, categorization, and analytics
- **Background Jobs** — Job queue processing (Bull + Redis)
- **Performance** — Query optimization, response times
- **Security** — Input validation, data isolation by user_id

## Tech Stack (WealthClick Phase 1)

- **Framework** — Next.js 15 (App Router, API Routes)
- **Database** — PostgreSQL 15 (local on EC2)
- **Auth** — Google OAuth 2.0 + NextAuth.js
- **Queue/Jobs** — Bull (Redis on EC2)
- **Runtime** — Node.js 22
- **ORM/Query** — Prisma or raw SQL with pg library

## Common Tasks

### API Development
- Building endpoints (GET, POST, PUT, DELETE)
- Request validation and sanitization
- Response formatting and pagination
- Error handling with meaningful messages
- User isolation (filter by user_id from session)

### Database
- Writing queries with proper WHERE clauses (filter by user_id)
- Creating migrations safely
- Handling transactions for consistency
- Query performance optimization

### Business Logic
- Transaction import and categorization
- Dashboard analytics and metrics
- Budget tracking and notifications
- User settings and preferences

### Background Jobs
- Processing async tasks (transaction imports)
- Retries and error handling
- Job status tracking and monitoring

## When to Use

Invoke this agent when:
- Building new API endpoints
- Designing database schemas or migrations
- Implementing complex business workflows
- Integrating external services
- Debugging backend issues
- Optimizing performance
- Implementing authentication flows
- Setting up background jobs or scheduled tasks

## How to Invoke

```
Agent({
  description: "Build or debug backend functionality",
  subagent_type: "backend",
  prompt: "..."
})
```

Or simply mention backend-related work in conversation and I'll use this agent as appropriate.

## Key Principles

1. **Security First** — Validate all inputs, encrypt sensitive data, use RLS for multi-tenancy
2. **Error Handling** — Meaningful error messages, proper status codes, logging
3. **Performance** — Optimize queries, use caching, batch operations when possible
4. **Reliability** — Idempotent operations, retry logic, transaction safety
5. **Maintainability** — Clear code structure, documented complex logic, consistent patterns

## Architecture Patterns

### Multi-Tenancy
- Every table has `user_id` column (foreign key to users)
- API routes filter queries: `WHERE user_id = $1`
- Application enforces isolation (not RLS at database level)
- Session `user.id` used as tenant identifier

### User Isolation Pattern
```typescript
// app/api/transactions/route.ts
const session = await getServerSession(authOptions);
if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

const transactions = await db.transaction.findMany({
  where: { user_id: session.user.id }, // Filtered by user
});
```

### Job Queue Pattern
- Redis-backed queue (Bull) for async tasks
- Workers process jobs with retries
- Job status tracked in database
- Failed jobs stored for manual inspection

### API Response Format
```json
{
  "success": true,
  "data": { /* response payload */ },
  "error": null
}
```

Error responses:
```json
{
  "success": false,
  "data": null,
  "error": { "code": "INVALID_INPUT", "message": "..." }
}
```

## Related Agents

- **Frontend Design Agent** (`.claude/agents/frontend-design.md`) — For UI/UX guidance on consuming your APIs
- See CLAUDE.md for full project architecture and constraints
