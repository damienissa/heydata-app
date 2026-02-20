# Hey Data — End-to-End Data Flow

This document traces a complete request through the Hey Data system, from user input to rendered output.

---

## Data Flow Diagram

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

## Step-by-Step Walkthrough

### Step 1 — User Input (`@heydata/web`)

The user types a natural language question. The web layer captures:
- The raw query text
- Session context (conversation history, current user, active filters)

The query is forwarded to `@heydata/core`.

#### Web ↔ Core entry points

| Entry point | Route | Purpose |
|------------|--------|---------|
| **Chat** | `POST /api/chat` | Assistant UI: streaming chat. Uses a **tool** `query_data` that calls the orchestrator so data questions run the full pipeline and render narrative + chart in the thread. |
| **Query API** | `POST /api/query` | Direct programmatic access: `useQuery()` → orchestrator → `OrchestratorResponse`. Used when the chat model calls the `query_data` tool. |

The chat is connected to data by having the model call the `query_data` tool for analytics questions; the tool runs `processQuery()` and returns the full response (narrative, visualization, results). The thread renders a custom `query_data` tool result as `QueryResult` (chart + narrative).

### Step 2 — Orchestration (`@heydata/core` — Orchestrator Agent)

The Orchestrator receives the user message and conversation history. It:
- Determines whether this is a new query, a follow-up, a clarification, or a correction
- Builds an execution plan specifying which agents to invoke and in what order
- Begins routing data through the pipeline

### Step 3 — Intent Resolution (`@heydata/core` — Intent Resolver Agent)

The Intent Resolver translates natural language into a structured intent object:
- **Query type:** trend
- **Metric:** `daily_revenue`
- **Time range:** current month + prior month
- **Comparison mode:** month-over-month (MoM)
- **Dimensions:** date

If the query is ambiguous, this agent generates a clarification question to send back to the user before proceeding.

### Step 4 — SQL Generation (`@heydata/core` — SQL Generator Agent)

Using the structured intent and the semantic layer schema, the SQL Generator produces a SQL query:
- Fetches the correct metric formula from the semantic layer
- Builds joins, aggregations, and date filters per the intent
- Adapts syntax to the target warehouse dialect

### Step 5 — SQL Validation (`@heydata/core` — SQL Validator Agent)

Before touching the warehouse, the SQL Validator checks:
- Syntax correctness for the target dialect
- Schema correctness (referenced tables and columns exist)
- Absence of dangerous patterns (full scans, cartesian joins)
- Estimated cost within acceptable limits
- Logical alignment with the intent object

**On failure:** Detailed feedback is sent back to the SQL Generator; the loop retries up to N times. If validation never passes, the error is surfaced to the user.

### Step 6 — Query Execution (`@heydata/bridge`)

The validated SQL is handed to the Execution Bridge:
- Applies final safety checks (read-only enforcement, row limits)
- Executes the query against the data warehouse
- Returns structured result sets (rows + column metadata)
- Handles timeouts and warehouse-level errors, feeding them back for self-correction

### Step 7 — Data Validation (`@heydata/core` — Data Validator Agent)

Even with valid SQL, the returned data might not match the user's intent. The Data Validator checks:
- Columns match expected metrics and dimensions
- Row count is reasonable (~30 rows for daily data over one month)
- No gaps in the time series or unexpected NULL concentrations
- Values are within plausible business ranges
- Data granularity matches what was requested

**On failure:** Diagnostic feedback routes back to the SQL Generator for a regeneration attempt.

### Step 8 — Data Analysis (`@heydata/core` — Data Analyzer Agent)

With validated data in hand, the Data Analyzer:
- Computes growth rates, averages, percentiles
- Detects trends, outliers, and anomalies
- Identifies the narrative "story" (e.g., "revenue up 12% overall, dip on Feb 14")
- Flags data quality issues if present

Outputs an enriched result set with insight annotations.

### Step 9 — Visualization Planning + Narrative (parallel)

Two agents run in parallel after the Data Analyzer:

**Viz Planner Agent:**
- Selects chart type (line chart for a time-series trend)
- Defines axes, series, colors, and formatting
- Outputs an abstract, renderer-agnostic visualization spec

**Narrative Agent:**
- Writes a concise natural language summary
- Highlights the key findings from the Data Analyzer
- Provides comparative context ("up 12% vs. last month")

### Step 10 — Rendering (`@heydata/renderer`)

The renderer receives the visualization spec and narrative text:
- Interprets the abstract spec into actual chart components
- Renders an interactive chart (tooltips, drill-down, zoom)
- Combines the chart with the narrative summary

### Step 11 — Display (`@heydata/web`)

The final output (interactive chart + narrative) is displayed in the user's canvas. The conversation history is updated so the next follow-up question has full context.

---

## Follow-up Queries

When the user sends a follow-up ("Now break that down by region"), the Orchestrator:
- Recognizes this as a refinement of the prior query
- Reuses the existing intent object, adding `region` as a new dimension
- Skips re-resolving intent from scratch where possible
- Runs the modified intent through SQL Generator → Validator → Bridge → the rest of the pipeline
