# @heydata/core — AI Agent Orchestration Engine

**Layer 3** in the Hey Data system.

---

## Role

Coordinate a pipeline of specialized AI agents, each responsible for a distinct reasoning step in transforming a user question into a validated, analyzed, and presentable result.

Rather than a single monolithic LLM call, `@heydata/core` implements a **multi-agent architecture** where each agent has a focused role, its own system prompt, and a well-defined input/output contract.

---

## Responsibilities

- Receive user queries and conversation history from `@heydata/web`
- Run the Orchestrator Agent to plan and manage execution
- Invoke the Intent Resolver Agent to parse natural language into a structured intent object
- Invoke the SQL Generator Agent to translate intent into executable SQL
- Invoke the SQL Validator Agent to catch errors before execution
- Invoke the Data Validator Agent to verify query results match the user's intent
- Invoke the Data Analyzer Agent to extract statistical insights from results
- Invoke the Visualization Planner Agent to select and specify the optimal chart type
- Invoke the Narrative Agent to generate human-readable summaries
- Manage retry loops between agents (e.g., SQL Validator failures route back to SQL Generator)
- Manage conversation state and context across multi-turn sessions
- Cache semantic layer schema lookups for performance
- Return the assembled response (data + viz spec + narrative) to `@heydata/web`

---

## Agents

| Agent | Input | Output |
|---|---|---|
| Orchestrator | User message + history | Final assembled response |
| Intent Resolver | Raw query + history + semantic metadata | Structured intent object |
| SQL Generator | Intent object + schema + dialect | SQL string + query metadata |
| SQL Validator | SQL + schema + intent | Pass/fail + issue list + fixes |
| Data Validator | Result set + intent + SQL + metadata | Pass/fail + issue list + confidence score |
| Data Analyzer | Result set + intent + semantic metadata | Enriched result set + insight annotations |
| Viz Planner | Enriched results + intent + annotations | Abstract visualization spec |
| Narrative | Enriched results + annotations + intent | Narrative text |

For full agent specifications and the pipeline diagram, see [`docs/agents.md`](../../docs/agents.md).

---

## Key Design Decisions

- **Parallel vs. sequential:** Can Viz Planner and Narrative Agent run concurrently after Data Analyzer? (They have no dependency on each other.)
- **Agent-per-model:** Should different agents use different LLM models? (e.g., a cheaper model for SQL validation, a stronger model for SQL generation)
- **Caching at agent level:** Can Intent Resolver outputs be cached for semantically similar queries?
- **Human-in-the-loop:** At which agent boundaries should the user be able to review and confirm before the pipeline continues? (e.g., confirm resolved intent before SQL generation)

---

## Interfaces

**Inputs from `@heydata/web`:**
- User message (string)
- Conversation history (array of prior turns)
- Session context (user identity, active filters)

**Reads from `@heydata/semantic`:**
- Metric definitions (formula, grain, dimensions, filters, format)
- Dimension definitions
- Entity relationships (joins)
- Synonyms and aliases

**Calls `@heydata/bridge`:**
- Passes validated SQL for execution
- Receives structured result sets (rows + column metadata)

**Outputs to `@heydata/web`:**
- Visualization specification (abstract, renderer-agnostic)
- Narrative text
- Enriched result set
- Generated SQL (for transparency toggle)
- Metric definitions used (for transparency toggle)
