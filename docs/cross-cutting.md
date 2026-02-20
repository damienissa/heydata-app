# Hey Data — Cross-Cutting Concerns

These concerns span multiple packages and layers. They are not owned by any single package but must be addressed consistently across the system.

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

---

## Caching & Performance

Caching is applied at multiple layers to reduce latency and warehouse cost.

**Query-level caching (`@heydata/bridge`):**
- Repeated or near-identical SQL queries are cached with their result sets
- Cache keys are derived from the normalized SQL string
- TTL-based invalidation appropriate for the data freshness requirements

**Semantic layer lookups (`@heydata/core`):**
- The semantic layer schema (metrics, dimensions, synonyms) is loaded into memory at startup
- Lookups during intent resolution and SQL generation are served from this in-memory cache
- Invalidated on semantic layer updates

**Pre-computed aggregations:**
- Common aggregations (e.g., daily revenue for the trailing 90 days) can be pre-computed and materialized
- The SQL Generator can route to pre-computed tables when they satisfy the query, avoiding full scans

---

## Observability

Every step in the pipeline is logged and measured for debugging, cost tracking, and continuous improvement.

**Per-request trace:**
- User query text (with PII considerations)
- Resolved intent object
- Generated SQL
- Result set shape (row count, column names — not raw data)
- Visualization type selected
- Narrative text generated

**Performance metrics:**
- End-to-end latency per request
- Per-agent latency (Intent Resolver, SQL Generator, etc.)
- LLM token usage per agent call
- Warehouse query execution time and estimated cost
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

**Audit trail:**
- All queries are logged with user identity, timestamp, generated SQL, and result metadata
- Supports compliance requirements and debugging of historical results

**Access control:**
- The semantic layer enforces role-based access rules at query time
- Users cannot query metrics or data subsets they don't have access to, even via natural language
- Row-level security is applied in the generated SQL, not as a post-filter

---

## `@heydata/shared` — Shared Types & Utilities

The `shared` package provides the foundational types and utilities used across all other packages.

**Contents:**
- Common TypeScript types and interfaces (intent objects, validation results, visualization specs, result sets)
- Error types and error codes used across the pipeline
- Shared constants and configuration schemas
- Utility functions used by multiple packages

**Design principle:** `@heydata/shared` has no dependencies on other `@heydata/*` packages. All other packages may depend on it, but it never depends on them.
