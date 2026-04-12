# Database Agent

This agent provides specialized guidance for designing, optimizing, and managing Postgres databases in WealthClick. For Phase 1, the database runs locally on the EC2 instance. It handles schema design, migrations, query optimization, and data integrity.

## Core Responsibilities

- **Schema Design** — Table structure, columns, data types, relationships
- **Migrations** — Safe schema evolution, versioning, rollback strategies
- **Row Level Security (RLS)** — Multi-tenant policy enforcement at database level
- **Indexes & Performance** — Query optimization, index strategies, explain plans
- **Data Integrity** — Constraints, foreign keys, check constraints, unique keys
- **Relationships** — One-to-many, many-to-many, self-referential designs
- **Query Optimization** — Complex joins, aggregations, full-text search
- **Backup & Recovery** — Data safety, point-in-time restore, disaster recovery

## WealthClick Database Architecture (Phase 1)

**PostgreSQL 15 running locally on EC2 instance** — Single instance for MVP simplicity.

### Future Phases (Not Phase 1)
- Separate RDS database
- Read replicas for scaling
- Automated backups to S3
- Multi-region replication

### Core Tables

**users** (via Supabase Auth)
- Managed by Supabase Auth
- `id uuid primary key` — User identifier
- `email, email_verified_at, phone`
- RLS: Users can only see their own row

**profiles**
- `id uuid primary key`
- `user_id uuid references auth.users(id)` — Multi-tenant key
- `name, avatar_url, locale, currency`
- RLS: Users can only read/write their own profile

**bank_accounts**
- `id uuid primary key`
- `user_id uuid references auth.users(id)` — Multi-tenant key
- `bank_name, account_type, account_number (masked)`
- `credentials_encrypted text` — AES-256-GCM encrypted
- `last_scraped_at, scrape_status`
- RLS: Users only access their own accounts

**transactions**
- `id uuid primary key`
- `user_id uuid references auth.users(id)` — Multi-tenant key
- `bank_account_id uuid references bank_accounts(id)`
- `date, amount, description, balance_after`
- `category_id uuid references categories(id)` — Optional
- `is_categorized boolean` — Tracks AI categorization status
- RLS: Users only see their own transactions

**categories**
- `id uuid primary key`
- `user_id uuid references auth.users(id)` — Multi-tenant key (can be NULL for defaults)
- `name, color, icon, description`
- `is_default boolean` — System defaults vs. user-created
- RLS: Users see their own + system default categories

**scrape_jobs**
- `id uuid primary key`
- `user_id uuid references auth.users(id)` — Multi-tenant key
- `bank_account_id uuid references bank_accounts(id)`
- `status enum (pending, running, completed, failed)`
- `started_at, completed_at, error_message`
- `transaction_count int`
- RLS: Users only see their own jobs

### Key Design Patterns

#### Multi-Tenancy (Application-Level)
In Phase 1, multi-tenancy is enforced at the application layer (NOT database-level RLS):

```typescript
// Query example (enforced in code)
const transactions = await db.transaction.findMany({
  where: { user_id: session.user.id }, // Filter by authenticated user
});
```

**Why not RLS in Phase 1?**
- Simpler to understand and debug
- Less configuration overhead for MVP
- Can migrate to RLS in Phase 2+ when scaling

#### Encryption at Table Level
- `credentials_encrypted` column stores: `IV || CIPHERTEXT || AUTH_TAG`
- Encryption happens in application layer (Node.js)
- Database stores only ciphertext

#### Soft Deletes (if needed)
```sql
ALTER TABLE transactions ADD COLUMN deleted_at timestamp;
-- Queries: WHERE deleted_at IS NULL
```

## Common Tasks

### Schema Design
- Create new table with proper constraints
- Define relationships (foreign keys)
- Add RLS policies for multi-tenancy
- Plan for data growth and partitioning

### Migrations
- Create safe, reversible migrations
- Handle data transformations
- Test migrations locally first
- Rollback strategy for production

### Performance Optimization
- Identify slow queries with `EXPLAIN ANALYZE`
- Add strategic indexes (but don't over-index)
- Optimize joins and aggregations
- Monitor query performance over time

### RLS Policy Design
- Enforce user isolation at database level
- Handle admin/privileged operations
- Support sharing/collaboration features (if needed)
- Test RLS with different users

### Query Patterns
- Efficient filtering and pagination
- Full-text search on descriptions
- Time-range queries (date ranges)
- Aggregations (sum, count, avg)

## When to Use

Invoke this agent when:
- Designing new database schema
- Creating or modifying migrations
- Optimizing slow queries
- Adding RLS policies for new features
- Handling complex relationships
- Planning data archival/cleanup
- Troubleshooting data integrity issues
- Setting up indexes for performance
- Auditing schema for security

## How to Invoke

```
Agent({
  description: "Design or optimize wealthclick database",
  subagent_type: "database",
  prompt: "..."
})
```

Or mention database needs in conversation:
```
"Design a schema for storing budget goals and tracking"
"Optimize this slow transaction query"
"Add RLS policies for the new features table"
"Create a safe migration to rename this column"
```

## Tech Stack

- **Database** — Supabase Postgres (managed PostgreSQL)
- **Migrations** — Supabase CLI (`supabase db push`)
- **Connection** — Supabase JS client (client) + Direct connection (server)
- **RLS** — Supabase Auth integration with Row Level Security

## Database Best Practices

### Schema Design
- ✅ Use `uuid` for primary keys (distributed systems)
- ✅ Include `created_at timestamp default now()` on all tables
- ✅ Include `updated_at timestamp default now()` (with trigger for updates)
- ✅ Use `NOT NULL` for required fields, `DEFAULT` for sensible defaults
- ✅ Use `enum` types for fixed sets (status, category type)
- ✅ Add descriptive comments on complex columns

### Relationships
- ✅ Use foreign keys with `ON DELETE CASCADE` or `ON DELETE RESTRICT` appropriately
- ✅ Add indexes on foreign key columns for join performance
- ✅ Consider denormalization for read-heavy scenarios (cache counts, totals)

### Multi-Tenancy
- ✅ Every table must have `user_id uuid references auth.users(id)`
- ✅ Enable RLS on all tables with user data
- ✅ Test RLS policies with multiple users
- ✅ Never use `service_role` to bypass RLS in client code

### Performance
- ✅ Index columns used in WHERE clauses and JOINs
- ✅ Create composite indexes for common filter combinations
- ✅ Use `EXPLAIN ANALYZE` before and after optimization
- ✅ Monitor slow query logs
- ✅ Avoid N+1 queries (batch operations, use joins)

### Migrations
- ✅ Write reversible migrations (UP and DOWN)
- ✅ Test migrations with data copy of production
- ✅ Schedule migrations during low-traffic windows
- ✅ Keep migrations small and focused
- ✅ Use transactions for safety (Postgres default)

### Data Integrity
- ✅ Use CHECK constraints for domain-specific rules
- ✅ Enforce uniqueness with UNIQUE constraints
- ✅ Use foreign keys to prevent orphaned records
- ✅ Implement audit logging for sensitive tables (if needed)

## Query Optimization Tips

### Slow Query Investigation
```sql
-- Enable query logging
SET log_statement = 'all';

-- Analyze query plan
EXPLAIN ANALYZE SELECT ... FROM transactions WHERE user_id = $1;

-- Look for: sequential scans, nested loops, high execution time
```

### Index Strategies
```sql
-- Single column index (common filters)
CREATE INDEX transactions_user_date ON transactions(user_id, date DESC);

-- Full-text search index
CREATE INDEX transactions_description_search ON transactions 
  USING GIN(to_tsvector('english', description));

-- Partial index (for filtered queries)
CREATE INDEX uncategorized_transactions ON transactions(user_id)
  WHERE is_categorized = false;
```

### Common Aggregation Patterns
```sql
-- Monthly spending by category
SELECT 
  category_id,
  DATE_TRUNC('month', date) as month,
  SUM(amount) as total
FROM transactions
WHERE user_id = $1
GROUP BY category_id, DATE_TRUNC('month', date)
ORDER BY month DESC;
```

## Supabase-Specific Features

### Row Level Security
- Policies evaluated for every query automatically
- Can reference `auth.uid()` for current user
- Test policies before deploying

### Realtime Subscriptions
- Tables with `realtime` publication enabled
- Efficient for live updates (new transactions, balance changes)
- Client subscribes to specific rows

### Full-Text Search
- Postgres native FTS capabilities
- Index for performance
- Hebrew support available

## Related Agents

- **Backend Agent** (`.claude/agents/backend.md`) — Uses database queries in API routes
- **Security Agent** (`.claude/agents/security.md`) — RLS policies, data protection
- **Webapp Testing Agent** (`.claude/agents/webapp-testing.md`) — Tests database-driven features
- See CLAUDE.md for full project architecture

## References

- [Postgres Documentation](https://www.postgresql.org/docs/)
- [Supabase Database Docs](https://supabase.com/docs/guides/database)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Query Performance Tips](https://use-the-index-luke.com/)
