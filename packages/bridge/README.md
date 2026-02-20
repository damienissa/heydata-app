# @heydata/bridge — Execution Bridge

**Layer 4** in the Hey Data system.

---

## Role

Safely execute generated SQL against the data warehouse and return structured result sets. A thin but critical middleware layer between the AI agent pipeline and the external data warehouse.

---

## Responsibilities

- Receive validated SQL from `@heydata/core`
- Apply final safety checks before execution:
  - Guard against dangerous operations (DROP, DELETE, UPDATE, INSERT)
  - Enforce row result limits to prevent runaway queries
  - Validate read-only access
- Execute the query against the connected data warehouse
- Return structured result sets (rows + column metadata)
- Handle errors gracefully:
  - Timeouts
  - Syntax errors not caught earlier
  - Permission errors
  - Connection failures
- Feed error messages back to `@heydata/core` for self-correction
- Cache repeated or similar queries at the result-set level

---

## Security Concerns

- **SQL injection prevention** — Even though SQL is LLM-generated, validate against a blocklist of dangerous operations
- **Read-only enforcement** — Service account credentials are read-only; the bridge adds an additional software-level check
- **Query cost/resource limits** — Prevent full-table scans or excessively expensive queries from running
- **Row-level security** — Apply data masking rules where required before returning results
- **Credential management** — Warehouse connection credentials are never passed to or stored by other packages

---

## Key Design Decisions

- **Sync vs. async execution:** Some warehouse queries take minutes. Should the bridge block until complete, or return a job ID and stream results?
- **Caching strategy:** How are cache keys derived? How long are results cached? What invalidates the cache?
- **Result storage:** Should result sets be stored temporarily to support follow-up questions without re-executing the query?
- **Multi-warehouse:** Should the bridge support routing queries to different warehouses per tenant or data domain?

---

## Interfaces

**Inputs from `@heydata/core`:**
- Validated SQL string
- Target warehouse dialect identifier
- Query metadata (expected complexity, estimated cost)

**Outputs to `@heydata/core`:**
- Structured result set: `{ rows: Row[], columns: ColumnMetadata[] }`
- Execution metadata: actual row count, execution time, warehouse cost estimate
- Error payload on failure: error type, message, original SQL

**External dependency:**
- Data warehouse connection (read-only service account)
- Warehouse-specific driver/adapter per supported dialect
