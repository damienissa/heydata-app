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

### Layer 3: `@heydata/core` — AI Agent Orchestration Engine

**Role:** Coordinate a pipeline of specialized AI agents, each responsible for a distinct reasoning step.

Rather than a single monolithic LLM call, Hey Data uses a **multi-agent architecture** where each agent has a focused role, its own system prompt, and a well-defined input/output contract. An **Orchestrator** routes the flow between agents based on the task.

---

#### 3.0: `Orchestrator Agent`

**Role:** The conductor. Receives the user query and decides which agents to invoke, in what order, and how data flows between them.

- Analyzes user intent at a high level (new query, follow-up, clarification, correction)
- Builds an execution plan (which agents are needed for this request)
- Routes data between agents
- Handles retries and error recovery (e.g., if Validator rejects SQL, routes back to SQL Generator with feedback)
- Manages conversation state and context window across turns
- Decides when to ask the user for clarification vs. proceed with assumptions

**Input:** User message + conversation history
**Output:** Final assembled response (data + visualization + narrative) back to the UI

---

#### 3.1: `Intent Resolver Agent`

**Role:** Understand what the user is really asking.

- Classifies query type: trend, comparison, ranking, anomaly detection, drill-down, aggregation, etc.
- Resolves time references ("last month", "YTD", "since launch")
- Detects follow-up intent ("now break that down by…", "same but for Q3")
- Maps business language to semantic layer concepts using synonyms/aliases
- Identifies ambiguity and generates clarification questions when needed

**Input:** Raw user query + conversation history + semantic layer metadata
**Output:** Structured intent object (query type, metrics, dimensions, filters, time range, comparison mode)

---

#### 3.2: `SQL Generator Agent`

**Role:** Transform structured intent into executable SQL.

- Receives the resolved intent and translates it into SQL
- Uses semantic layer definitions to build correct joins, aggregations, and filters
- Adapts SQL dialect to the target data warehouse
- Handles complex patterns: window functions, CTEs, subqueries, date arithmetic
- Optimizes for performance (e.g., pushdown filters, avoid SELECT *)

**Input:** Structured intent object + semantic layer schema + warehouse dialect
**Output:** Raw SQL query string + query metadata (tables touched, estimated complexity)

---

#### 3.3: `SQL Validator Agent`

**Role:** Quality gate — catch errors before they hit the warehouse.

- Validates syntax correctness for the target dialect
- Checks semantic correctness against the schema (do referenced tables/columns exist?)
- Detects dangerous patterns (full table scans, cartesian joins, missing WHERE clauses on large tables)
- Estimates query cost/complexity and flags expensive queries
- Verifies the SQL actually answers the user's question (cross-checks against the intent)
- Returns pass/fail with detailed feedback for the SQL Generator to retry

**Input:** Generated SQL + semantic layer schema + intent object
**Output:** Validation result (pass/fail) + list of issues + suggested fixes

**Retry loop:** On failure → feedback sent back to SQL Generator Agent → regenerate → re-validate (max N retries)

---

#### 3.4: `Data Validator Agent`

**Role:** Quality gate after execution — verify the returned data actually answers the user's question.

This agent sits between query execution and analysis. Even if the SQL is syntactically valid and passes the SQL Validator, the results may not match what the user intended.

- **Schema check** — Do returned columns match expected metrics and dimensions from the intent?
- **Sanity check** — Are row counts reasonable? (e.g., asking for "daily revenue last month" should return ~30 rows, not 3 million)
- **Completeness check** — Are there missing dates, gaps in time series, or unexpected NULL concentrations?
- **Range check** — Are values within plausible business ranges? (e.g., negative revenue, dates in the future)
- **Grain check** — Is the data at the right granularity? (e.g., user asked for daily but got monthly aggregation)
- **Alignment check** — Cross-reference the result set against the original intent object to confirm the data answers the question
- Returns pass/fail with specific issues; on failure, can route back to SQL Generator with diagnostic feedback

**Input:** Raw result set + intent object + generated SQL + semantic layer metadata
**Output:** Validation result (pass/fail) + issue list + confidence score

**Retry loop:** On failure → diagnostic feedback sent back to SQL Generator Agent → regenerate → re-execute → re-validate (max N retries)

---

#### 3.5: `Data Analyzer Agent`

**Role:** Inspect raw query results and extract statistical insights.

- Activated after query execution returns data
- Detects patterns: trends, outliers, anomalies, significant changes
- Computes derived statistics: growth rates, averages, percentiles, variance
- Identifies the "story" in the data (e.g., "Revenue dropped 23% on March 12 — this correlates with…")
- Flags data quality issues (null values, unexpected zeros, duplicate rows)

**Input:** Raw result set + original intent + semantic metadata
**Output:** Enriched result set + insight annotations + data quality flags

---

#### 3.6: `Visualization Planner Agent`

**Role:** Decide how to best visually represent the data.

- Selects optimal chart type based on: data shape, query intent, number of dimensions, data volume
- Defines the visualization specification: axes, series, colors, legends, labels, formatting
- Handles special cases: dual-axis charts, small multiples, KPI cards for single values
- Considers user preferences and past choices
- Generates an abstract visualization spec (chart type + mappings), not library-specific code

**Input:** Enriched result set + intent object + insight annotations
**Output:** Visualization specification (abstract, renderer-agnostic)

---

#### 3.7: `Narrative Agent`

**Role:** Generate human-readable insight summaries alongside visualizations.

- Writes concise, natural language summaries of what the data shows
- Highlights key findings from the Data Analyzer (trends, anomalies, comparisons)
- Adapts tone to user persona (executive summary vs. analyst detail)
- Provides context: "This is 15% above the same period last year"
- Can explain assumptions made and metrics used

**Input:** Enriched result set + insight annotations + intent object
**Output:** Narrative text (summary + key callouts)

---

#### Agent Pipeline — Typical Flow

```
User Query
  │
  ▼
┌─────────────────────┐
│  Orchestrator Agent  │ ← manages the full pipeline
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Intent Resolver Agent│
└─────────┬───────────┘
          │ structured intent
          ▼
┌─────────────────────┐
│ SQL Generator Agent  │◄──────────┐ ◄─────────────┐
└─────────┬───────────┘           │                │
          │ raw SQL                │ retry           │ retry
          ▼                       │                │
┌─────────────────────┐           │                │
│ SQL Validator Agent  │───fail───►┘                │
└─────────┬───────────┘                            │
          │ pass                                   │
          ▼                                        │
   [@heydata/bridge]                               │
   executes SQL → returns data                     │
          │                                        │
          ▼                                        │
┌─────────────────────┐                            │
│ Data Validator Agent │───fail───────────────────►┘
└─────────┬───────────┘
          │ pass
          ▼
┌─────────────────────┐
│ Data Analyzer Agent  │
└─────────┬───────────┘
          │ enriched results + insights
          ├──────────────────┐
          ▼                  ▼
┌──────────────────┐ ┌────────────────┐
│ Viz Planner Agent│ │ Narrative Agent │
└────────┬─────────┘ └───────┬────────┘
         │ viz spec           │ summary text
         └────────┬───────────┘
                  ▼
          [@heydata/renderer]
          renders final output
```

#### Agent Design Principles

- **Single responsibility** — Each agent does one thing well
- **Stateless** — Agents receive all context they need per invocation; no hidden state
- **Typed contracts** — Strict input/output schemas between agents for reliability
- **Independently testable** — Each agent can be unit tested with mock inputs
- **Swappable** — Any agent can be replaced with a different LLM, a fine-tuned model, or even a rule-based system
- **Observable** — Each agent logs its inputs, outputs, latency, and token usage

#### Key Design Decisions

- **Parallel vs. sequential:** Can Viz Planner and Narrative Agent run in parallel after Data Analyzer?
- **Agent-per-model:** Should different agents use different LLM models (e.g., cheaper model for validation, stronger model for SQL generation)?
- **Caching at agent level:** Can we cache Intent Resolver outputs for similar queries?
- **Human-in-the-loop:** At which agent boundaries should the user be able to intervene? (e.g., confirm intent before SQL generation)

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
[@heydata/core — Orchestrator Agent] builds execution plan
  │
  ▼
[@heydata/core — Intent Resolver Agent]
  ├── Resolves: metric = daily_revenue, type = trend, comparison = MoM
  │
  ▼
[@heydata/core — SQL Generator Agent]
  ├── Generates: SQL with date logic for current vs. prior month
  │
  ▼
[@heydata/core — SQL Validator Agent]
  ├── Validates: syntax ✓, schema ✓, cost ✓ → PASS
  │
  ▼
[@heydata/bridge] executes SQL against warehouse
  │
  ▼
[Data Warehouse] returns result set
  │
  ▼
[@heydata/core — Data Validator Agent]
  ├── Checks: columns match intent ✓, ~30 rows ✓, no gaps ✓, values plausible ✓ → PASS
  │
  ▼
[@heydata/core — Data Analyzer Agent]
  ├── Detects: revenue up 12% overall, dip on Feb 14
  │
  ├──────────────────────────┐
  ▼                          ▼
[@heydata/core            [@heydata/core
 Viz Planner Agent]        Narrative Agent]
  ├── Spec: line chart,     ├── "Revenue is up 12% vs
  │   two series,           │    last month, with a
  │   date on x-axis        │    notable dip on Feb 14"
  │                          │
  └──────────┬───────────────┘
             ▼
[@heydata/renderer] renders interactive chart + summary
  │
  ▼
[@heydata/web] displays final output
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
