# Hey Data — Architecture Document

## Vision

**Hey Data** replaces static, pre-built BI dashboards with a dynamic, conversational analytics system. Users ask questions in natural language and receive on-demand visualizations, tables, and insights — no predefined reports required.

---

## Core Principles

1. **Query-driven, not dashboard-driven** — Every analysis starts from a user question, not a pre-built view
2. **Semantic abstraction** — Business logic lives in a metadata layer, not in SQL or dashboard configs
3. **LLM as orchestrator** — The AI doesn't just translate language to SQL; it reasons about intent, selects metrics, and decides how to present results
4. **Separation of concerns** — Each layer is independent and replaceable
5. **Progressive trust** — The system shows its reasoning (generated SQL, metric definitions used) so users can verify and build confidence

---

## Monorepo Structure

```
heydata/
├── packages/
│   ├── core/          # LLM reasoning engine
│   ├── semantic/      # Semantic metadata layer & parser
│   ├── bridge/        # Execution bridge (query runner)
│   ├── renderer/      # Visualization renderer
│   ├── web/           # Frontend UI
│   └── shared/        # Shared types, utils, constants
├── configs/
├── docs/
└── README.md
```

---

## System Layers

### Layer 1: `@heydata/web` — User Interface (Conversation + Canvas)

**Role:** Capture user intent and render results.

- A chat-based input where users ask analytical questions
- A canvas/output area that renders dynamic visualizations, tables, and narrative summaries
- Supports follow-up questions and refinements ("now break that down by region", "make it a bar chart")
- Maintains conversation context across a session

**Key design decisions:**

- Should the UI be purely conversational, or hybrid (chat + dashboard-like pinning)?
- How much control does the user have over visualization type?
- Can users save/share generated views?

---

### Layer 2: `@heydata/semantic` — Semantic Metadata Layer

**Role:** Define the business vocabulary — the single source of truth for what metrics and dimensions mean.

This is the **most critical layer**. It bridges the gap between human language and database schema.

**Contains:**

- **Metrics:** Named calculations with formulas (e.g., `daily_revenue = SUM(orders.amount) GROUP BY date`)
- **Dimensions:** Categorization axes (e.g., `region`, `product_category`, `customer_segment`)
- **Entities & relationships:** How tables relate to each other (joins, foreign keys)
- **Synonyms & aliases:** Maps business language to technical names (e.g., "sales" → `revenue`, "last month" → date range logic)
- **Access rules:** Which users/roles can see which metrics or data subsets
- **Formatting rules:** Currency symbols, decimal places, date formats per metric

**Example definition (conceptual):**

```
metric: daily_revenue
  display_name: "Daily Revenue"
  description: "Total revenue per day, net of refunds"
  formula: SUM(orders.gross_amount) - SUM(refunds.amount)
  grain: daily
  dimensions: [date, region, product_category, channel]
  filters:
    default: "order_status = 'completed'"
  format: currency_usd
```

**Key design decisions:**

- Who maintains this layer? (Analytics engineers, business users, or AI-assisted?)
- How granular should definitions be?
- How do you handle conflicting definitions across teams?

---

### Layer 3: `@heydata/core` — LLM Reasoning Engine

**Role:** Interpret the user's question, plan the analytical approach, and generate executable outputs.

This is the "brain" of Hey Data. It performs multiple reasoning steps:

1. **Intent parsing** — What is the user actually asking? (trend, comparison, ranking, anomaly, etc.)
2. **Metric resolution** — Which metrics and dimensions from the semantic layer are needed?
3. **Query planning** — What data needs to be fetched? Single query or multiple? Any derived calculations?
4. **SQL generation** — Produce syntactically correct, optimized SQL for the target data warehouse
5. **Visualization planning** — What chart type best represents this data? What axes, legends, colors?
6. **Narrative generation** — Optional: summarize key insights in natural language alongside the chart

**Context provided to the LLM:**

- The full (or relevant subset of) semantic metadata layer
- Conversation history for follow-up context
- Database dialect and capabilities
- User role/permissions

**Key design decisions:**

- Single LLM call or multi-step chain (plan → generate → validate)?
- How to handle ambiguity? (Ask the user, or make a best guess and explain assumptions?)
- Should the LLM self-validate SQL before execution?
- How to manage prompt size when the semantic layer is large?

---

### Layer 4: `@heydata/bridge` — Execution Bridge

**Role:** Safely execute generated SQL against the data warehouse and return raw results.

This is a thin but critical middleware layer:

- **Receives** generated SQL from the LLM layer
- **Validates** the query (syntax check, guards against dangerous operations like DROP/DELETE, enforces row limits)
- **Executes** the query against the data warehouse
- **Returns** structured result sets (rows + column metadata)
- **Handles** errors gracefully (timeout, syntax errors, permissions) and feeds them back to the LLM for self-correction

**Security concerns:**

- SQL injection prevention (even though the LLM generates the SQL)
- Read-only access enforcement
- Query cost/resource limits (prevent runaway full-table scans)
- Row-level security and data masking

**Key design decisions:**

- Sync or async execution? (Some warehouse queries take minutes)
- Caching strategy for repeated or similar queries?
- Should results be stored temporarily for follow-up questions?

---

### Layer 5: Data Warehouse (External)

**Role:** Store and serve the raw analytical data.

- Hey Data is **warehouse-agnostic** by design — the semantic layer abstracts away dialect differences
- The LLM generates SQL appropriate for the specific warehouse dialect
- The execution bridge manages the connection

**Requirements:**

- Read-only service account with appropriate access
- Support for standard SQL analytical functions (window functions, CTEs, etc.)
- Reasonable query performance for interactive use cases

---

### Layer 6: `@heydata/renderer` — Visualization Renderer

**Role:** Turn raw data + visualization instructions into interactive charts, tables, and dashboards.

- The LLM outputs **visualization specifications** (not raw chart library code)
- A rendering engine interprets these specs and produces the actual visual
- Supports: line charts, bar charts, tables, scatter plots, heatmaps, KPI cards, etc.
- Interactive features: tooltips, drill-down, filtering, zoom

**Key design decisions:**

- LLM generates a spec (e.g., Vega-Lite JSON) vs. actual code (React/JS)?
- Pre-built chart component library vs. fully dynamic rendering?
- How much post-render interactivity without going back to the LLM?

---

## Data Flow (End to End)

```
User: "Hey Data, show daily revenue trend vs last month"
  │
  ▼
[@heydata/web] captures query + session context
  │
  ▼
[@heydata/core] receives: query + semantic metadata + conversation history
  │
  ├── Resolves: metric = daily_revenue, comparison = month-over-month
  ├── Generates: SQL query with date logic
  └── Plans: line chart, two series, date on x-axis
  │
  ▼
[@heydata/bridge] validates + runs SQL
  │
  ▼
[Data Warehouse] returns result set
  │
  ▼
[@heydata/core] receives results, generates visualization spec + narrative
  │
  ▼
[@heydata/renderer] renders interactive chart
  │
  ▼
[@heydata/web] displays chart + insight summary
  │
  ▼
User: "Now break that down by region" (follow-up)
```

---

## Cross-Cutting Concerns

### `@heydata/shared` — Shared Types & Utilities

- Common TypeScript types/interfaces across all packages
- Error types and codes
- Shared constants and configuration schemas

### Error Handling & Self-Correction

- If SQL fails, the error is fed back to `@heydata/core` to regenerate
- If results look anomalous (e.g., zero rows), the LLM should flag this to the user
- Maximum retry limit before surfacing the error

### Caching & Performance

- Cache frequent queries at the `@heydata/bridge` level
- Cache semantic layer lookups in `@heydata/core`
- Consider pre-computing common aggregations

### Observability

- Log every step: user query → resolved intent → generated SQL → results shape → visualization type
- Track query latency, LLM token usage, warehouse cost
- Feedback loop: users can flag incorrect results to improve the system

### Governance & Trust

- Always show generated SQL to power users (optional toggle)
- Show which metric definitions were used
- Audit trail of all queries and who ran them

---

## Open Questions for Next Steps

1. **Scope of v1** — Start with a single domain (e.g., revenue analytics) or go broad?
2. **User personas** — Who are the primary users? (Executives, analysts, product managers?)
3. **Conversation depth** — Simple Q&A, or full analytical sessions with drill-downs?
4. **Multi-tenant** — Single team or multiple teams with different semantic layers?
5. **Feedback loop** — How do incorrect results feed back into improving the semantic layer?
6. **Offline/async** — Should users be able to schedule recurring queries or alerts?
