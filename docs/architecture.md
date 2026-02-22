# Hey Data — Architecture Overview

## Vision

**Hey Data** is a universal, conversational analytics platform. Users connect any PostgreSQL database, and the system auto-generates a semantic layer from the database schema. Users then ask questions in natural language and receive on-demand visualizations, tables, and insights — no predefined reports or dashboards required.

Hey Data is **multi-user** — each user signs up, connects their own databases, and gets isolated chat history and semantic configurations.

---

## Core Principles

1. **Query-driven, not dashboard-driven** — Every analysis starts from a user question, not a pre-built view
2. **Semantic abstraction** — Business logic lives in an auto-generated metadata layer, not in SQL or dashboard configs
3. **LLM as orchestrator** — The AI doesn't just translate language to SQL; it reasons about intent, selects metrics, and decides how to present results
4. **Database-agnostic** — Users connect their own database; the semantic layer and adapter pattern abstract away schema differences
5. **Separation of concerns** — Each layer is independent and replaceable
6. **Progressive trust** — The system shows its reasoning (generated SQL, metric definitions used) so users can verify and build confidence

---

## Monorepo Structure

```
heydata/
├── packages/
│   ├── core/          # LLM reasoning engine (agent pipeline)
│   ├── semantic/      # Semantic metadata layer & parser
│   ├── bridge/        # Execution bridge (database adapter + query runner)
│   ├── renderer/      # Visualization renderer
│   ├── web/           # Frontend UI (Next.js)
│   ├── supabase/      # Supabase client, auth helpers, DB types
│   └── shared/        # Shared types, utils, constants
├── configs/
├── docs/
├── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## System Layers

The system is organized into eight layers:

| Layer | Package | Role |
|---|---|---|
| 1 | `@heydata/web` | User Interface — auth, chat, onboarding, session management |
| 2 | `@heydata/supabase` | Auth & Metadata — Supabase Auth + metadata storage (connections, semantic layers, chat history) |
| 3 | `@heydata/semantic` | Semantic Metadata Layer — defines business vocabulary (auto-generated or file-based) |
| 4 | `@heydata/core` | AI Agent Orchestration Engine — multi-agent reasoning pipeline + semantic generator |
| 5 | `@heydata/bridge` | Execution Bridge — database adapter, pool management, schema introspection, SQL execution |
| 6 | *(external)* | User's Data Database — the user's own PostgreSQL database |
| 7 | `@heydata/renderer` | Visualization Renderer — turns specs into interactive visuals |
| 8 | `@heydata/shared` | Shared Types — common interfaces, error types, Zod schemas |

### Layer 1: `@heydata/web` — User Interface

**Role:** Authentication, user onboarding, chat interface, and result rendering.

- **Auth pages** — Login/signup via Supabase Auth (email/password, OAuth)
- **Onboarding wizard** — Connect database → introspect schema → auto-generate semantic layer → start chatting
- **Chat interface** — assistant-ui based conversational UI with streaming responses
- **Session management** — Sidebar with conversation history, connection switcher
- **Canvas** — Dynamic visualizations, tables, and narrative summaries
- Supports follow-up questions and refinements

### Layer 2: `@heydata/supabase` — Auth & Metadata Store

**Role:** User authentication and persistent metadata storage via Supabase (cloud-hosted).

**Authentication:**

- Supabase Auth for multi-user login/signup
- Email/password and OAuth providers
- Session management via cookies (SSR-compatible with `@supabase/ssr`)
- Protected routes via Next.js middleware

**Metadata tables (Supabase PostgreSQL):**

- `connections` — User's database connection configs (connection string, type, SSL, status)
- `semantic_layers` — Auto-generated semantic configs per connection (metrics, dimensions, entities as JSONB)
- `chat_sessions` — Conversation sessions per user per connection
- `chat_messages` — Individual messages with role, content, and tool results

**Multi-tenancy:**

- Row Level Security (RLS) policies on all tables
- Users can only access their own connections, sessions, and messages
- `semantic_layers` access is scoped via connection ownership

### Layer 3: `@heydata/semantic` — Semantic Metadata Layer

**Role:** Define the business vocabulary — the single source of truth for what metrics and dimensions mean.

See [`docs/semantic-layer.md`](./semantic-layer.md) for full details.

**Two loading modes:**

1. **From database (primary)** — Load from Supabase `semantic_layers` table via `loadFromMetadata()`. Used for user-connected databases with auto-generated semantic layers.
2. **From YAML files (development)** — Load from `definitions/` directory via `loadDefinitions()`. Used for local development and testing.

### Layer 4: `@heydata/core` — AI Agent Orchestration Engine

**Role:** Coordinate a pipeline of specialized AI agents, each responsible for a distinct reasoning step.

Uses a multi-agent architecture where each agent has a focused role, its own system prompt, and a well-defined input/output contract. See [`docs/agents.md`](./agents.md) for the full pipeline.

**Includes the `semantic-generator` agent** — an LLM agent that analyzes introspected database schema and auto-generates meaningful metrics, dimensions, and entity definitions.

### Layer 5: `@heydata/bridge` — Execution Bridge

**Role:** Database adapter, connection management, schema introspection, and safe SQL execution.

**Database Adapter pattern:**

```
DatabaseAdapter interface
├── connect(config) → AdapterPool
├── execute(pool, sql, params) → ResultSet
├── introspect(pool) → IntrospectedSchema
├── testConnection(pool) → boolean
└── dispose(pool) → void
```

- **PostgreSQL adapter** — Implements the adapter using `pg` driver (v1)
- **Pool manager** — Dynamic pool creation/caching/disposal by connection ID with idle timeout eviction
- **Schema introspection** — Queries `information_schema` to discover tables, columns, types, foreign keys, and relationships
- **SQL guards** — Keyword deny-list, row limits, statement timeouts, read-only enforcement
- Extensible for MySQL, SQLite, etc. via new adapter implementations

### Layer 6: User's Data Database (External)

**Role:** Store and serve the raw analytical data.

- Users connect their own PostgreSQL database via the onboarding wizard
- Connection strings are stored in Supabase `connections` table
- Hey Data uses a read-only connection pattern with SQL guards
- Schema is auto-introspected via `information_schema`

### Layer 7: `@heydata/renderer` — Visualization Renderer

**Role:** Turn raw data + visualization instructions into interactive charts, tables, and dashboards.

- The LLM outputs **visualization specifications** (not raw chart library code)
- Supports: line charts, bar charts, area charts, scatter plots, composed charts, KPI cards, data tables
- Built on Recharts + TanStack Table

### Layer 8: `@heydata/shared` — Shared Types

**Role:** Common TypeScript types and interfaces used across all packages.

- Intent objects, result sets, visualization specs, agent traces
- Connection config and introspected schema types
- Error types and codes (Zod-validated)
- `@heydata/shared` has no dependencies on other `@heydata/*` packages

---

## Connection Lifecycle

The flow for a new user connecting their database:

```
1. Sign Up / Login (Supabase Auth)
   │
   ▼
2. Onboarding: Add Connection
   ├── Enter connection string (or host/port/db/user/password)
   ├── Test connection → success/failure
   │
   ▼
3. Schema Introspection
   ├── Query information_schema (tables, columns, foreign keys)
   ├── Store raw schema snapshot in Supabase
   │
   ▼
4. Semantic Auto-Generation
   ├── LLM analyzes schema → generates metrics, dimensions, entities
   ├── User reviews generated semantic layer
   ├── Store in Supabase semantic_layers table
   │
   ▼
5. Chat
   ├── User asks questions in natural language
   ├── Orchestrator loads semantic from Supabase + creates executor from connection
   ├── Full agent pipeline runs (intent → SQL → execute → analyze → visualize)
   └── Messages saved to Supabase chat_messages
```

---

## Docker Deployment

Hey Data is containerized for easy deployment:

```yaml
# docker-compose.yml
services:
  app:
    build: .                    # Multi-stage Node.js build
    environment:
      NEXT_PUBLIC_SUPABASE_URL: ...
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ...
      SUPABASE_SERVICE_ROLE_KEY: ...
      ANTHROPIC_API_KEY: ...
    ports:
      - "3000:3000"
```

- **No database container needed** — Supabase is cloud-hosted
- **Single container** — The Next.js app serves both API and UI
- **Prerequisites** — Supabase project (free tier) + Anthropic API key

---

## Further Reading

- [`docs/agents.md`](./agents.md) — Multi-agent pipeline in depth (includes semantic-generator agent)
- [`docs/data-flow.md`](./data-flow.md) — End-to-end data flow walkthrough
- [`docs/semantic-layer.md`](./semantic-layer.md) — Semantic layer internals + auto-generation
- [`docs/cross-cutting.md`](./cross-cutting.md) — Auth, error handling, caching, observability, multi-tenancy
