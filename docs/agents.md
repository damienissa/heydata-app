# Hey Data — Multi-Agent Pipeline

`@heydata/core` implements a multi-agent architecture where each agent has a single focused role, its own system prompt, and a strict input/output contract. An **Orchestrator** manages the full pipeline.

---

## Agent Overview

| # | Agent | Role |
|---|---|---|
| 0 | Orchestrator | Routes the pipeline; manages state, retries, and context |
| 1 | Intent Resolver | Parses user language into a structured intent object |
| 2 | SQL Generator | Translates structured intent into executable SQL |
| 3 | SQL Validator | Quality gate before execution — catches errors early |
| 4 | Data Validator | Quality gate after execution — verifies results match intent |
| 5 | Data Analyzer | Extracts statistical patterns and insights from results |
| 6 | Visualization Planner | Decides how to visually represent the data |
| 7 | Narrative | Writes human-readable summaries alongside visualizations |

---

## Agent Pipeline — Typical Flow

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

---

## Agent Specifications

### 3.0: Orchestrator Agent

**Role:** The conductor. Receives the user query and decides which agents to invoke, in what order, and how data flows between them.

**Responsibilities:**
- Analyzes user intent at a high level (new query, follow-up, clarification, correction)
- Builds an execution plan (which agents are needed for this request)
- Routes data between agents
- Handles retries and error recovery (e.g., if Validator rejects SQL, routes back to SQL Generator with feedback)
- Manages conversation state and context window across turns
- Decides when to ask the user for clarification vs. proceed with assumptions

**Input:** User message + conversation history
**Output:** Final assembled response (data + visualization + narrative) back to the UI

---

### 3.1: Intent Resolver Agent

**Role:** Understand what the user is really asking.

**Responsibilities:**
- Classifies query type: trend, comparison, ranking, anomaly detection, drill-down, aggregation, etc.
- Resolves time references ("last month", "YTD", "since launch")
- Detects follow-up intent ("now break that down by…", "same but for Q3")
- Maps business language to semantic layer concepts using synonyms/aliases
- Identifies ambiguity and generates clarification questions when needed

**Input:** Raw user query + conversation history + semantic layer metadata
**Output:** Structured intent object (query type, metrics, dimensions, filters, time range, comparison mode)

---

### 3.2: SQL Generator Agent

**Role:** Transform structured intent into executable SQL.

**Responsibilities:**
- Receives the resolved intent and translates it into SQL
- Uses semantic layer definitions to build correct joins, aggregations, and filters
- Adapts SQL dialect to the target data warehouse
- Handles complex patterns: window functions, CTEs, subqueries, date arithmetic
- Optimizes for performance (e.g., pushdown filters, avoid SELECT *)

**Input:** Structured intent object + semantic layer schema + warehouse dialect
**Output:** Raw SQL query string + query metadata (tables touched, estimated complexity)

---

### 3.3: SQL Validator Agent

**Role:** Quality gate — catch errors before they hit the warehouse.

**Responsibilities:**
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

### 3.4: Data Validator Agent

**Role:** Quality gate after execution — verify the returned data actually answers the user's question.

This agent sits between query execution and analysis. Even if the SQL is syntactically valid and passes the SQL Validator, the results may not match what the user intended.

**Responsibilities:**
- **Schema check** — Do returned columns match expected metrics and dimensions from the intent?
- **Sanity check** — Are row counts reasonable? (e.g., asking for "daily revenue last month" should return ~30 rows, not 3 million)
- **Completeness check** — Are there missing dates, gaps in time series, or unexpected NULL concentrations?
- **Range check** — Are values within plausible business ranges? (e.g., negative revenue, dates in the future)
- **Grain check** — Is the data at the right granularity? (e.g., user asked for daily but got monthly aggregation)
- **Alignment check** — Cross-reference the result set against the original intent object to confirm the data answers the question

**Input:** Raw result set + intent object + generated SQL + semantic layer metadata
**Output:** Validation result (pass/fail) + issue list + confidence score

**Retry loop:** On failure → diagnostic feedback sent back to SQL Generator Agent → regenerate → re-execute → re-validate (max N retries)

---

### 3.5: Data Analyzer Agent

**Role:** Inspect raw query results and extract statistical insights.

**Responsibilities:**
- Activated after query execution returns data
- Detects patterns: trends, outliers, anomalies, significant changes
- Computes derived statistics: growth rates, averages, percentiles, variance
- Identifies the "story" in the data (e.g., "Revenue dropped 23% on March 12 — this correlates with…")
- Flags data quality issues (null values, unexpected zeros, duplicate rows)

**Input:** Raw result set + original intent + semantic metadata
**Output:** Enriched result set + insight annotations + data quality flags

---

### 3.6: Visualization Planner Agent

**Role:** Decide how to best visually represent the data.

**Responsibilities:**
- Selects optimal chart type based on: data shape, query intent, number of dimensions, data volume
- Defines the visualization specification: axes, series, colors, legends, labels, formatting
- Handles special cases: dual-axis charts, small multiples, KPI cards for single values
- Considers user preferences and past choices
- Generates an abstract visualization spec (chart type + mappings), not library-specific code

**Input:** Enriched result set + intent object + insight annotations
**Output:** Visualization specification (abstract, renderer-agnostic)

---

### 3.7: Narrative Agent

**Role:** Generate human-readable insight summaries alongside visualizations.

**Responsibilities:**
- Writes concise, natural language summaries of what the data shows
- Highlights key findings from the Data Analyzer (trends, anomalies, comparisons)
- Adapts tone to user persona (executive summary vs. analyst detail)
- Provides context: "This is 15% above the same period last year"
- Can explain assumptions made and metrics used

**Input:** Enriched result set + insight annotations + intent object
**Output:** Narrative text (summary + key callouts)

---

## Agent Design Principles

- **Single responsibility** — Each agent does one thing well
- **Stateless** — Agents receive all context they need per invocation; no hidden state
- **Typed contracts** — Strict input/output schemas between agents for reliability
- **Independently testable** — Each agent can be unit tested with mock inputs
- **Swappable** — Any agent can be replaced with a different LLM, a fine-tuned model, or even a rule-based system
- **Observable** — Each agent logs its inputs, outputs, latency, and token usage

---

## Key Design Decisions

- **Parallel vs. sequential:** Can Viz Planner and Narrative Agent run in parallel after Data Analyzer?
- **Agent-per-model:** Should different agents use different LLM models (e.g., cheaper model for validation, stronger model for SQL generation)?
- **Caching at agent level:** Can we cache Intent Resolver outputs for similar queries?
- **Human-in-the-loop:** At which agent boundaries should the user be able to intervene? (e.g., confirm intent before SQL generation)
