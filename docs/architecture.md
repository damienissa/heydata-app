# Hey Data — Architecture Overview

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

The system is organized into six layers, each with a distinct responsibility:

| Layer | Package | Role |
|---|---|---|
| 1 | `@heydata/web` | User Interface — captures user intent and renders results |
| 2 | `@heydata/semantic` | Semantic Metadata Layer — defines business vocabulary |
| 3 | `@heydata/core` | AI Agent Orchestration Engine — multi-agent reasoning pipeline |
| 4 | `@heydata/bridge` | Execution Bridge — safely executes SQL against the warehouse |
| 5 | *(external)* | Data Warehouse — stores and serves raw analytical data |
| 6 | `@heydata/renderer` | Visualization Renderer — turns specs into interactive visuals |

### Layer 1: `@heydata/web` — User Interface

**Role:** Capture user intent and render results.

- Chat-based input for analytical questions
- Canvas/output area for dynamic visualizations, tables, and narrative summaries
- Supports follow-up questions and refinements
- Maintains conversation context across a session

### Layer 2: `@heydata/semantic` — Semantic Metadata Layer

**Role:** Define the business vocabulary — the single source of truth for what metrics and dimensions mean.

The most critical layer. Bridges the gap between human language and database schema. See [`docs/semantic-layer.md`](./semantic-layer.md) for full details.

### Layer 3: `@heydata/core` — AI Agent Orchestration Engine

**Role:** Coordinate a pipeline of specialized AI agents, each responsible for a distinct reasoning step.

Uses a multi-agent architecture where each agent has a focused role, its own system prompt, and a well-defined input/output contract. See [`docs/agents.md`](./agents.md) for the full pipeline.

### Layer 4: `@heydata/bridge` — Execution Bridge

**Role:** Safely execute generated SQL against the data warehouse and return raw results.

Thin but critical middleware. Validates, executes, and returns structured result sets with security guards in place.

### Layer 5: Data Warehouse (External)

**Role:** Store and serve the raw analytical data.

Hey Data is warehouse-agnostic by design — the semantic layer abstracts away dialect differences. Requires a read-only service account with support for standard SQL analytical functions.

### Layer 6: `@heydata/renderer` — Visualization Renderer

**Role:** Turn raw data + visualization instructions into interactive charts, tables, and dashboards.

The LLM outputs visualization specifications (not raw chart library code); the renderer interprets these specs and produces the actual visual.

---

## Further Reading

- [`docs/agents.md`](./agents.md) — Multi-agent pipeline in depth
- [`docs/data-flow.md`](./data-flow.md) — End-to-end data flow walkthrough
- [`docs/semantic-layer.md`](./semantic-layer.md) — Semantic layer internals
- [`docs/cross-cutting.md`](./cross-cutting.md) — Error handling, caching, observability, governance
- [`docs/open-questions.md`](./open-questions.md) — Open architectural decisions
