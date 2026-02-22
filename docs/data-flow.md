# Hey Data — End-to-End Data Flow

This document traces a complete request through the Hey Data system, from user signup to rendered output.

---

## Data Flow Diagram

```text
User: Signs up → Connects DB → "Show daily revenue trend vs last month"
  │
  ▼
[@heydata/web] auth check (Supabase session) + captures query
  │
  ▼
[@heydata/supabase] loads connection config + semantic layer for active connection
  │
  ▼
[@heydata/bridge] creates/reuses pool for user's DB via adapter pattern
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
[@heydata/bridge] executes SQL against user's database
  │
  ▼
[User's Database] returns result set
  │
  ▼
[@heydata/core — Data Validator Agent]
  ├── Checks: columns match intent ✓, ~30 rows ✓, no gaps ✓ → PASS
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
[@heydata/supabase] saves messages to chat_messages table
  │
  ▼
User: "Now break that down by region" (follow-up)
```

---

## Step-by-Step Walkthrough

### Step 0 — Authentication (`@heydata/supabase`)

Before any data interaction, the user must be authenticated:

- User signs up or logs in via Supabase Auth (email/password or OAuth)
- Next.js middleware verifies the Supabase session on every request
- Unauthenticated users are redirected to `/auth/login`
- The session provides `user_id` used for RLS-scoped queries

### Step 1 — Connection Selection (`@heydata/web`)

The user must have at least one database connection configured:

- **First-time users** are redirected to `/setup` (onboarding wizard)
- **Returning users** see their connections in the sidebar and can switch between them
- The active connection determines which database and semantic layer are used for queries

### Step 2 — User Input (`@heydata/web`)

The user types a natural language question. The web layer captures:

- The raw query text
- The active `connectionId`
- The current `sessionId` (or creates a new session)
- Session context (conversation history)

The query is forwarded to `@heydata/core` via `processQueryForConnection()`.

#### Web ↔ Core entry points

| Entry point | Route | Purpose |
|------------|--------|---------|
| **Chat** | `POST /api/chat` | Assistant UI: streaming chat. Uses a **tool** `query_data` that calls the orchestrator so data questions run the full pipeline and render narrative + chart in the thread. |

### Step 3 — Dynamic Loading (`@heydata/supabase` + `@heydata/bridge`)

Before the agent pipeline runs, the system loads resources for the active connection:

1. **Load connection** — Fetch connection config from Supabase `connections` table (verifying user ownership via RLS)
2. **Get or create pool** — The pool manager checks if a pool already exists for this connection ID. If not, it creates one using the `DatabaseAdapter`.
3. **Load semantic metadata** — Fetch metrics, dimensions, and entities from Supabase `semantic_layers` table for this connection
4. **Build registry** — `SemanticRegistry.loadFromMetadata()` creates an in-memory lookup with synonym indexing

### Step 4 — Orchestration (`@heydata/core` — Orchestrator Agent)

The Orchestrator receives the user message and conversation history. It:

- Determines whether this is a new query, a follow-up, a clarification, or a correction
- Builds an execution plan specifying which agents to invoke and in what order
- Begins routing data through the pipeline

### Step 5 — Intent Resolution (`@heydata/core` — Intent Resolver Agent)

The Intent Resolver translates natural language into a structured intent object:

- **Query type:** trend
- **Metric:** `daily_revenue`
- **Time range:** current month + prior month
- **Comparison mode:** month-over-month (MoM)
- **Dimensions:** date

If the query is ambiguous, this agent generates a clarification question to send back to the user before proceeding.

### Step 6 — SQL Generation (`@heydata/core` — SQL Generator Agent)

Using the structured intent and the semantic layer metadata (loaded from Supabase), the SQL Generator produces a SQL query:

- Fetches the correct metric formula from the semantic layer
- Builds joins, aggregations, and date filters per the intent
- Adapts syntax to the target warehouse dialect (PostgreSQL)

### Step 7 — SQL Validation (`@heydata/core` — SQL Validator Agent)

Before touching the user's database, the SQL Validator checks:

- Syntax correctness for the target dialect
- Schema correctness (referenced tables and columns exist)
- Absence of dangerous patterns (full scans, cartesian joins)
- Estimated cost within acceptable limits
- Logical alignment with the intent object

**On failure:** Detailed feedback is sent back to the SQL Generator; the loop retries up to N times.

### Step 8 — Query Execution (`@heydata/bridge`)

The validated SQL is handed to the Execution Bridge:

- Uses the adapter pool created for this connection
- Applies final safety checks (read-only enforcement, row limits, statement timeout)
- Executes the query against the user's database
- Returns structured result sets (rows + column metadata)
- Handles timeouts and database-level errors, feeding them back for self-correction

### Step 9 — Data Validation (`@heydata/core` — Data Validator Agent)

Even with valid SQL, the returned data might not match the user's intent. The Data Validator checks:

- Columns match expected metrics and dimensions
- Row count is reasonable (~30 rows for daily data over one month)
- No gaps in the time series or unexpected NULL concentrations
- Values are within plausible business ranges
- Data granularity matches what was requested

**On failure:** Diagnostic feedback routes back to the SQL Generator for a regeneration attempt.

### Step 10 — Data Analysis (`@heydata/core` — Data Analyzer Agent)

With validated data in hand, the Data Analyzer:

- Computes growth rates, averages, percentiles
- Detects trends, outliers, and anomalies
- Identifies the narrative "story" (e.g., "revenue up 12% overall, dip on Feb 14")
- Flags data quality issues if present

Outputs an enriched result set with insight annotations.

### Step 11 — Visualization Planning + Narrative (parallel)

Two agents run in parallel after the Data Analyzer:

**Viz Planner Agent:**

- Selects chart type (line chart for a time-series trend)
- Defines axes, series, colors, and formatting
- Outputs an abstract, renderer-agnostic visualization spec

**Narrative Agent:**

- Writes a concise natural language summary
- Highlights the key findings from the Data Analyzer
- Provides comparative context ("up 12% vs. last month")

### Step 12 — Rendering (`@heydata/renderer`)

The renderer receives the visualization spec and narrative text:

- Interprets the abstract spec into actual chart components (Recharts)
- Renders an interactive chart (tooltips, drill-down, zoom)
- Combines the chart with the narrative summary

### Step 13 — Display + Persistence (`@heydata/web` + `@heydata/supabase`)

The final output (interactive chart + narrative) is displayed in the chat thread. After display:

- **User message** is saved to `chat_messages` (role: "user")
- **Assistant response** is saved to `chat_messages` (role: "assistant", with tool_results containing query results + viz spec)
- **Session title** is auto-generated from the first message if not set
- The conversation history is updated so the next follow-up question has full context

---

## Follow-up Queries

When the user sends a follow-up ("Now break that down by region"), the system:

- Recognizes this as a refinement of the prior query
- Loads conversation history from `chat_messages` for the current session
- Reuses the existing intent object, adding `region` as a new dimension
- Skips re-resolving intent from scratch where possible
- Runs the modified intent through SQL Generator → Validator → Bridge → the rest of the pipeline

---

## Connection Setup Flow (Onboarding)

For a first-time user, before any chat can happen:

```text
1. User signs up (Supabase Auth)
   │
   ▼
2. Redirected to /setup (no connections exist)
   │
   ▼
3. Enter connection details
   ├── Connection string or host/port/db/user/password
   ├── Test connection → bridge.testConnection()
   │
   ▼
4. Auto-introspect schema
   ├── bridge.introspect() → queries information_schema
   ├── Returns: tables, columns, types, foreign keys
   ├── Stored as raw_schema in Supabase
   │
   ▼
5. Auto-generate semantic layer
   ├── semantic-generator agent analyzes raw_schema
   ├── Produces: metrics, dimensions, entities with formulas + synonyms
   ├── User reviews and can edit generated definitions
   ├── Stored in Supabase semantic_layers table
   │
   ▼
6. Redirect to chat
   └── Ready to ask questions against the connected database
```
