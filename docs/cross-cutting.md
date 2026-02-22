# Hey Data — Cross-Cutting Concerns

These concerns span multiple packages and layers. They are not owned by any single package but must be addressed consistently across the system.

---

## Authentication & Multi-Tenancy

Hey Data is a multi-user application. Each user has isolated access to their own connections, semantic layers, and chat history.

**Authentication (Supabase Auth):**

- Email/password and OAuth providers (Google, GitHub, etc.)
- Sessions managed via `@supabase/ssr` with cookie-based tokens
- Next.js middleware (`packages/web/src/middleware.ts`) protects all routes except `/auth/*`
- Server-side Supabase client reads session from cookies in API routes
- Browser-side Supabase client for client components

**Multi-tenancy (Row Level Security):**

- All Supabase tables have RLS policies enabled
- `connections` — `user_id = auth.uid()` — users can only access their own connections
- `semantic_layers` — scoped via connection ownership (join through `connections.user_id`)
- `chat_sessions` — `user_id = auth.uid()` — users can only access their own sessions
- `chat_messages` — scoped via session ownership (join through `chat_sessions.user_id`)

**Route protection:**

- Unauthenticated users → redirected to `/auth/login`
- Authenticated users with no connections → redirected to `/setup`
- Authenticated users with connections → chat interface

---

## Connection Security

User database connections require careful security handling.

**Connection string storage:**

- Stored in Supabase `connections` table
- Encrypted at rest by Supabase PostgreSQL
- RLS ensures only the owning user can read their connection strings
- Service role key (server-side only) used for API route operations

**Read-only enforcement:**

- SQL guards in `@heydata/bridge` block all DDL/DML keywords (DROP, DELETE, INSERT, UPDATE, ALTER, CREATE, etc.)
- Only SELECT and WITH (CTEs) are allowed
- Statement timeout enforcement (30s default) prevents runaway queries
- Row limit injection ensures bounded result sets (10,000 max)

**Connection validation:**

- `testConnection()` verifies connectivity before saving
- `introspect()` uses `information_schema` (read-only system tables)
- Failed connections are marked with `status: 'error'` in Supabase

---

## Error Handling & Self-Correction

Hey Data is designed to recover from failures autonomously rather than surfacing raw errors to users.

**SQL errors:**

- If generated SQL fails execution, the error message is fed back to `@heydata/core` along with the original intent
- The SQL Generator Agent regenerates the query with the error as additional context
- A maximum retry limit prevents infinite loops; once exceeded, a user-facing error is shown

**Anomalous results:**

- If the Data Validator detects unexpected results (e.g., zero rows, wildly out-of-range values), the LLM flags this to the user with an explanation
- The system does not silently return bad data

**Retry strategy:**

- Each retry loop (SQL Validator → SQL Generator, Data Validator → SQL Generator) has a configurable maximum attempt count (N)
- Each retry includes accumulated feedback so subsequent attempts benefit from previous failures
- After max retries, the Orchestrator surfaces a diagnostic message to the user

**Connection errors:**

- Pool manager handles connection failures gracefully (pool disposal + re-creation)
- Stale pools are evicted after idle timeout
- Connection test failures are reported to the user via the UI with actionable guidance

---

## Caching & Performance

Caching is applied at multiple layers to reduce latency and database load.

**Query-level caching (`@heydata/core`):**

- Repeated or near-identical questions are cached with their full orchestrator response
- Cache keys derived from: question + sessionId + dialect
- TTL-based invalidation (5 minutes default)

**Semantic layer caching:**

- Semantic metadata loaded from Supabase is cached in-memory per connection
- Invalidated when the user regenerates or edits the semantic layer

**Pool management (`@heydata/bridge`):**

- Database connection pools are created lazily and cached by connection ID
- Idle pools are evicted after configurable timeout
- Prevents creating new pools on every request

---

## Observability

Every step in the pipeline is logged and measured for debugging, cost tracking, and continuous improvement.

**Per-request trace:**

- User query text
- Resolved intent object
- Generated SQL
- Result set shape (row count, column names — not raw data)
- Visualization type selected
- Narrative text generated

**Performance metrics:**

- End-to-end latency per request
- Per-agent latency (Intent Resolver, SQL Generator, etc.)
- LLM token usage per agent call
- Database query execution time
- Retry counts per request

**Feedback loop:**

- Users can flag incorrect or unexpected results
- Flagged results are logged with full trace for manual review
- Used to identify systematic failures in specific agents or semantic layer definitions

---

## Governance & Trust

Users should be able to verify the system's reasoning, not just accept its outputs.

**SQL transparency:**

- Power users can toggle visibility of the generated SQL for each query
- Allows verification that the query is correct before trusting the result

**Metric transparency:**

- The system can show which metric definitions were used (formula, filters, grain)
- Users can see the exact semantic layer entry behind any number

**Semantic layer review:**

- Auto-generated semantic layers are shown to users for review during onboarding
- Users can edit metrics, dimensions, and entities before they are used
- Regeneration is available at any time to re-analyze the schema

**Audit trail:**

- All queries are logged with user identity, timestamp, generated SQL, and result metadata
- Chat history is persisted in Supabase for full conversation replay
- Supports compliance requirements and debugging of historical results

---

## Docker Deployment

Hey Data is containerized for easy deployment.

**Architecture:**

- Single Docker container for the Next.js app (API + UI)
- Supabase is cloud-hosted (no database container needed)
- Multi-stage Dockerfile: Node 20 Alpine → turbo prune → standalone Next.js output

**docker-compose.yml:**

```yaml
services:
  app:
    build: .
    environment:
      NEXT_PUBLIC_SUPABASE_URL: ${NEXT_PUBLIC_SUPABASE_URL}
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}
      SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    ports:
      - "3000:3000"
```

**Prerequisites:**

- Supabase project (free tier at supabase.com)
- Anthropic API key
- SQL migrations applied to Supabase (from `packages/supabase/migrations/`)

---

## `@heydata/shared` — Shared Types & Utilities

The `shared` package provides the foundational types and utilities used across all other packages.

**Contents:**

- Common TypeScript types and interfaces (intent objects, validation results, visualization specs, result sets)
- Connection config and introspected schema types (`ConnectionConfig`, `IntrospectedSchema`, `IntrospectedTable`, `IntrospectedColumn`)
- Error types and error codes used across the pipeline
- Shared constants and configuration schemas
- Utility functions used by multiple packages

**Design principle:** `@heydata/shared` has no dependencies on other `@heydata/*` packages. All other packages may depend on it, but it never depends on them.
