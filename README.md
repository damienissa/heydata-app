# Hey Data

**Universal, conversational analytics for any PostgreSQL database.**

Hey Data replaces static BI dashboards with a dynamic, AI-powered chat interface. Connect your database, and Hey Data auto-generates a semantic layer from your schema. Then ask questions in natural language and get instant visualizations, tables, and insights.

## Features

- **Any PostgreSQL database** — Connect your own DB; Hey Data introspects the schema automatically
- **Auto-generated semantic layer** — LLM analyzes your tables and generates metrics, dimensions, and entities
- **Natural language queries** — Ask "show daily revenue trend" instead of writing SQL
- **Multi-agent pipeline** — Intent resolution → SQL generation → validation → analysis → visualization
- **Interactive visualizations** — Line charts, bar charts, area charts, scatter plots, KPI cards, data tables
- **Multi-user** — Supabase Auth for login/signup; each user has isolated connections and chat history
- **Chat history** — Conversations are persisted and resumable
- **Docker-ready** — Single container deployment with cloud Supabase

## Architecture

```text
┌──────────────┐    ┌──────────────────┐    ┌──────────────┐
│  @heydata/web│───►│  @heydata/core   │───►│@heydata/bridge│
│  (Next.js)   │    │  (Agent Pipeline)│    │(DB Adapter)   │
└──────┬───────┘    └──────────────────┘    └───────┬───────┘
       │                                            │
       ▼                                            ▼
┌──────────────┐    ┌──────────────────┐    ┌──────────────┐
│@heydata/     │    │ @heydata/semantic│    │ User's       │
│  supabase    │    │ (Semantic Layer) │    │ PostgreSQL DB│
│(Auth+Storage)│    └──────────────────┘    └──────────────┘
└──────────────┘
```

See [docs/architecture.md](docs/architecture.md) for the full architecture overview.

## Prerequisites

- **Node.js 20+** and **pnpm 9+**
- **Supabase project** — Free tier at [supabase.com](https://supabase.com)
- **Anthropic API key** — From [console.anthropic.com](https://console.anthropic.com)
- **PostgreSQL database** — The database you want to analyze

## Quick Start (Docker)

```bash
# 1. Clone the repo
git clone https://github.com/your-org/heydata-app.git
cd heydata-app

# 2. Configure environment
cp .env.example .env
# Edit .env with your Supabase and Anthropic credentials

# 3. Apply Supabase migrations
# Run the SQL files in packages/supabase/migrations/ against your Supabase project

# 4. Start with Docker
docker compose up
```

Open [http://localhost:3000](http://localhost:3000) → Sign up → Connect your database → Start chatting.

## Development Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example packages/web/.env.local
# Edit packages/web/.env.local with your credentials

# 3. Apply Supabase migrations
# Run the SQL files in packages/supabase/migrations/ against your Supabase project

# 4. Build all packages
pnpm build

# 5. Start development server
pnpm dev
```

### Development with file-based semantic layer

For local development without Supabase, you can use the file-based semantic layer with a direct database connection:

```bash
# In packages/web/.env.local, set:
DATABASE_URL=postgresql://user:password@localhost:5432/your_db
ANTHROPIC_API_KEY=your_key
```

This uses YAML definitions from `packages/semantic/definitions/` instead of Supabase-stored semantic layers.

## Monorepo Packages

| Package | Description |
| --- | --- |
| `@heydata/web` | Next.js frontend — auth, chat, onboarding UI |
| `@heydata/core` | AI agent pipeline — orchestrator, intent resolver, SQL generator, etc. |
| `@heydata/semantic` | Semantic layer — YAML loader, registry, metadata |
| `@heydata/bridge` | Database adapter — connection pooling, SQL execution, schema introspection |
| `@heydata/renderer` | Visualization — Recharts charts, TanStack Table, KPI cards |
| `@heydata/supabase` | Supabase client — auth helpers, middleware, generated types |
| `@heydata/shared` | Shared types — intent, result sets, visualization specs, errors |

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-side only) |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for Claude |
| `DATABASE_URL` | Dev only | Direct PostgreSQL connection (bypasses Supabase connections) |

## Documentation

- [Architecture](docs/architecture.md) — System layers, connection lifecycle, deployment
- [Agent Pipeline](docs/agents.md) — Multi-agent pipeline with semantic generator
- [Data Flow](docs/data-flow.md) — End-to-end request walkthrough
- [Semantic Layer](docs/semantic-layer.md) — Auto-generation, YAML definitions, registry
- [Cross-Cutting](docs/cross-cutting.md) — Auth, multi-tenancy, caching, observability
- [Development Plan](docs/development-plan.md) — Phase-by-phase progress tracking

## License

Private — All rights reserved.
