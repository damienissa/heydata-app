# Development Plan

Progress tracking for the heydata-app monorepo. Check off items as they are completed.

> **Ordering rationale:** UI-first, data layers last. Core is built against mocked bridge + semantic interfaces so the agent pipeline can be developed and tested independently before the real data connections are wired.

---

## Phase 1 — Monorepo Foundation

```sh
# 1. Initialise root package.json
pnpm init

# 2. Install shared devDependencies at the workspace root
pnpm add -Dw turbo typescript eslint prettier vitest tsup @types/node

# 3. Scaffold turbo.json (pipelines: build, dev, test, lint, typecheck)
npx turbo init
```

- [x] `pnpm init` — root `package.json` with `"private": true`
- [x] `pnpm add -Dw` — shared devDependencies installed
- [x] `turbo.json` — pipelines configured (build, dev, test, lint, typecheck)
- [x] `pnpm-workspace.yaml` — workspace globs (`packages/*`)
- [x] `configs/tsconfig.base.json`
- [x] `configs/eslint.base.mjs` (ESLint 9 flat config)
- [x] `configs/prettier.config.js`
- [x] `.gitignore`
- [x] `.env.example` (ANTHROPIC_API_KEY, DATABASE_URL)

---

## Phase 2 — `@heydata/shared` — Shared Types

```sh
mkdir -p packages/shared/src/types
cd packages/shared && pnpm init
# Set name to @heydata/shared in package.json
pnpm add -D tsup vitest
```

- [x] `pnpm init` in `packages/shared` — `package.json` with name `@heydata/shared`
- [x] `tsconfig.json` (extends `../../configs/tsconfig.base.json`)
- [x] `src/types/intent.ts` — `IntentObject`
- [x] `src/types/result.ts` — `ResultSet`
- [x] `src/types/visualization.ts` — `VisualizationSpec`
- [x] `src/types/agent.ts` — `AgentTrace`
- [x] `src/types/errors.ts` — error types and codes
- [x] `src/types/semantic.ts` — `MetricDefinition`, `DimensionDefinition`, `EntityRelationship`
- [x] `src/index.ts` — barrel export
- [x] `tsup.config.ts`
- [x] Unit tests (Vitest — schema validation)

---

## Phase 3 — `@heydata/web` — UI

### 3a. Scaffold

```sh
# Scaffold Next.js app with TypeScript, Tailwind, App Router, and src/ layout
pnpm dlx create-next-app@latest packages/web \
  --typescript --tailwind --app --src-dir \
  --no-eslint --import-alias "@/*"

# Inside packages/web:
# - Set name to @heydata/web in package.json
# - Update tsconfig.json to extend ../../configs/tsconfig.base.json
pnpm add @heydata/shared
```

- [x] `pnpm dlx create-next-app@latest` — bootstraps Next.js with TypeScript, Tailwind, App Router
- [x] `package.json` — rename to `@heydata/web`, add `@heydata/shared` dependency
- [x] `tsconfig.json` — update to extend `../../configs/tsconfig.base.json`
- [x] `src/app/globals.css` — Tailwind directives
- [x] `src/app/layout.tsx` (root layout, metadata, font)

### 3b. Shell Layout

- [x] `src/components/layout/AppShell.tsx` (sidebar + main area two-column)
- [x] `src/components/layout/Sidebar.tsx` (conversation list, new chat button)
- [x] `src/components/layout/Header.tsx`

### 3c. Chat Interface (using assistant-ui)

Using [assistant-ui](https://assistant-ui.com) for production-ready chat components:

- [x] `@assistant-ui/react` + `@assistant-ui/react-ai-sdk` — chat UI components
- [x] `src/components/assistant-ui/thread.tsx` — full chat thread with welcome screen
- [x] `src/components/assistant-ui/markdown-text.tsx` — markdown rendering
- [x] `src/app/assistant.tsx` — runtime provider setup
- [x] `src/app/api/chat/route.ts` — Anthropic Claude API endpoint
- [x] `src/app/page.tsx` — home page with sidebar + chat

---

## Phase 4 — `@heydata/renderer` — Visualization

```sh
mkdir -p packages/renderer/src/{charts,components}
cd packages/renderer && pnpm init
# Set name to @heydata/renderer in package.json
pnpm add recharts @tanstack/react-table
pnpm add -D react react-dom @types/react @types/react-dom tsup vitest
```

- [x] `pnpm init` in `packages/renderer` — `package.json` with name `@heydata/renderer`
- [x] `tsconfig.json` + `tsup.config.ts`
- [x] `src/charts/LineChart.tsx`
- [x] `src/charts/BarChart.tsx`
- [x] `src/charts/AreaChart.tsx`
- [x] `src/charts/ScatterChart.tsx`
- [x] `src/charts/ComposedChart.tsx` (dual-axis)
- [x] `src/components/KpiCard.tsx` (custom)
- [x] `src/components/DataTable.tsx` (TanStack Table)
- [x] `src/RendererRouter.tsx` — routes `VisualizationSpec.type` → correct component
- [x] Wire into `ResultsCanvas` in web
- [x] Unit tests (snapshot / render tests)

---

## Phase 4b — Chart Type Expansion

Extends `@heydata/renderer` from 7 to 16 chart types with full viz-planner AI support.

- [x] Extend `ChartTypeSchema` with 9 new types: pie, donut, funnel, radar, treemap, waterfall, histogram, gauge, heatmap
- [x] Add `ChartConfigSchema` discriminated union to `VisualizationSpec` for chart-specific configuration
- [x] Implement Recharts-native charts: `PieDonutChart`, `FunnelChart`, `RadarChart`, `TreemapChart`
- [x] Implement custom charts: `WaterfallChart` (stacked bars), `HistogramChart` (auto-binning), `GaugeChart` (custom SVG), `HeatmapChart` (custom SVG grid)
- [x] Add `utils/color-scales.ts` for heatmap/treemap color interpolation
- [x] Update `RendererRouter` with all new chart type cases
- [x] Update viz-planner agent system prompt with new chart guidelines and `chartConfig` schema
- [x] Add RendererRouter tests for all 9 new chart types
- [x] Add schema validation tests for all `ChartConfig` types

---

## Phase 5 — `@heydata/core` — AI Agent Pipeline

```sh
mkdir -p packages/core/src/{agents,mocks}
cd packages/core && pnpm init
# Set name to @heydata/core in package.json
pnpm add @anthropic-ai/sdk @heydata/shared zod
pnpm add -D tsup vitest
```

- [x] `pnpm init` in `packages/core` — `package.json` with name `@heydata/core`
- [x] `tsconfig.json` + `tsup.config.ts` + `vitest.config.ts`
- [x] `src/types.ts` — `AgentContext`, `AgentResult`, trace helpers
- [x] `src/agents/intent-resolver.ts`
- [x] `src/agents/sql-generator.ts`
- [x] `src/agents/sql-validator.ts`
- [x] `src/agents/data-validator.ts`
- [x] `src/agents/data-analyzer.ts`
- [x] `src/agents/viz-planner.ts`
- [x] `src/agents/narrative.ts`
- [x] `src/orchestrator.ts` — pipeline coordinator with retry loop
- [x] `src/cache.ts` — query-level caching
- [x] `src/mocks/` — mock bridge + semantic adapters for testing
- [x] Unit tests per agent (mocked Anthropic SDK)
- [x] Integration test (mocked bridge + semantic + SDK, full pipeline)

---

## Phase 6 — `@heydata/semantic` — Semantic Layer

```sh
mkdir -p packages/semantic/src/schemas packages/semantic/definitions
cd packages/semantic && pnpm init
# Set name to @heydata/semantic in package.json
pnpm add zod js-yaml @heydata/shared
pnpm add -D @types/js-yaml tsup vitest
```

- [x] `pnpm init` in `packages/semantic` — `package.json` with name `@heydata/semantic`
- [x] `tsconfig.json` + `tsup.config.ts` + `vitest.config.ts`
- [x] `src/schemas/` — Zod schemas for metric/dimension/entity YAML files
- [x] `src/loader.ts` — `js-yaml` parser + Zod validation
- [x] `src/registry.ts` — in-memory lookup by name/synonym
- [x] `definitions/` — removed; semantic layer is loaded from `semantic_layers` table (DB) via `loadRegistryFromMetadata`. Tests use inline JSON or temp-dir YAML (no fixtures)
- [x] Unit tests
- [x] Semantic layer aligned with DB schema — entities (links, click_logs, app_installs, user_profiles, user_subscriptions, usage_tracking, crm_*, promocodes), dimensions (click_date, install_date, geo, UTM, plan_type, crm_stage, etc.), metrics (total_clicks, total_installs, matched_installs, total_links, active_users, crm_accounts_count, emails_sent, links_created, subscribers_count)

---

## Phase 7 — `@heydata/bridge` — SQL Execution

```sh
mkdir -p packages/bridge/src
cd packages/bridge && pnpm init
# Set name to @heydata/bridge in package.json
pnpm add pg @heydata/shared
pnpm add -D @types/pg tsup vitest
```

- [x] `pnpm init` in `packages/bridge` — `package.json` with name `@heydata/bridge`
- [x] `tsconfig.json` + `tsup.config.ts` + `vitest.config.ts`
- [x] `src/pool.ts` — `pg.Pool` setup, connection config from env
- [x] `src/guards.ts` — SQL keyword deny-list, row limit injection, timeout enforcement
- [x] `src/executor.ts` — `executeQuery(sql, params)` → `ResultSet`
- [x] `src/errors.ts` — bridge-specific error types
- [x] Unit tests (mocked `pg` client)

---

## Phase 8 — Integration & Wiring

- [x] Wire `@heydata/web` API route → `@heydata/core` orchestrator
- [x] Add `@heydata/core`, `@heydata/semantic`, `@heydata/bridge` to web dependencies
- [x] Create `/api/query` route that uses orchestrator with mock data
- [x] Create `useQuery` hook for client-side query execution
- [x] Create `QueryResult` component for displaying enriched results
- [x] Render `VisualizationSpec` from core response using `@heydata/renderer`
- [x] Connect chat to data: `/api/chat` uses `query_data` tool → `processQueryForConnection()` (requires connection); thread renders `QueryDataTool` (narrative + chart)
- [x] End-to-end smoke test (real Anthropic API + real Postgres)

---

## Phase 9 — Documentation: Architecture for Universal heydata

Update all docs to define the target architecture for universal, database-agnostic heydata with Supabase Auth + metadata storage.

- [x] `docs/architecture.md` — Add multi-user model, Supabase layer, database adapter pattern, connection lifecycle, Docker deployment
- [x] `docs/development-plan.md` — Add Phases 9-16 with checkboxes
- [x] `docs/data-flow.md` — Update flow with auth, connection selection, dynamic semantic loading, chat persistence
- [x] `docs/semantic-layer.md` — Add auto-generation from schema, DB storage, registry loading modes
- [x] `docs/agents.md` — Add `semantic-generator` agent
- [x] `docs/cross-cutting.md` — Add auth, multi-tenancy, connection security, Docker deployment
- [x] `README.md` — Update project description, prerequisites, quick start
- [x] `.env.example` — Add Supabase env vars

---

## Phase 10 — Supabase Integration: Auth + Metadata Storage

- [x] Supabase CLI init + SQL migrations: `connections`, `semantic_layers`, `chat_sessions`, `chat_messages` tables with RLS policies
- [x] New `@heydata/supabase` package — Supabase client, DB types
- [x] Auth pages: login, signup, OAuth callback
- [x] Next.js middleware for route protection
- [x] Server-side and browser-side Supabase client helpers (`@supabase/ssr`)
- [x] Add `@heydata/supabase` + `@supabase/ssr` + `@supabase/supabase-js` to web dependencies

---

## Phase 11 — Database Adapter + Connection Management

- [x] `DatabaseAdapter` interface in `@heydata/bridge`
- [x] PostgreSQL adapter (refactored from existing `pool.ts` + `executor.ts`)
- [x] Dynamic pool manager (create/cache/dispose pools by connection ID)
- [x] Schema introspection via `information_schema`
- [x] Connection types in `@heydata/shared` (`ConnectionConfig`, `IntrospectedSchema`, etc.)
- [x] Connection management API routes (CRUD + introspect + test)

---

## Phase 12 — Semantic Auto-Generation

- [x] New `semantic-generator` agent in `@heydata/core` — LLM analyzes introspected schema → generates metrics, dimensions, entities
- [x] Semantic generation API routes (generate, retrieve, update)
- [x] Extend `SemanticRegistry` with `loadFromMetadata()` method for DB-sourced semantic data

---

## Phase 13 — Dynamic Orchestration + Chat History

- [x] Rewire orchestrator: `processQueryForConnection(connectionId, question, sessionId)` — loads connection + semantic from Supabase dynamically
- [x] Chat history persistence: save/load sessions and messages via Supabase
- [x] Session API routes (list, create, get, delete)
- [x] Update web UI: real session list in sidebar, connection/session context in chat

---

## Phase 14 — Onboarding UI

- [x] Connection setup page: 4-step wizard (Connect → Introspect → Generate → Done)
- [x] Connection form, schema preview, semantic preview components
- [x] Connection switcher in header (from Phase 13)
- [x] Landing logic: no connections → `/setup`, has connections → chat

---

## Phase 15 — Docker Containerization

- [ ] Multi-stage `Dockerfile` (Node 20 Alpine + pnpm + turbo prune + standalone Next.js)
- [ ] `docker-compose.yml` (single app container, Supabase cloud-hosted)
- [ ] Update `.env.example` with all env vars

---

## Phase 16 — E2E Testing

- [ ] Playwright E2E: auth flow (login/signup)
- [ ] Playwright E2E: connection setup wizard
- [ ] Playwright E2E: submit query → see chart rendered
- [ ] Playwright E2E: chat history persistence

---

## Phase 17 — Agent Audit & Improvements

- [x] Parallelize Data Analyzer + Viz Planner (steps 6+7) with `Promise.allSettled` — saves 2–5s/request
- [x] Add `temperature: 0` to all structured-output agents (narrative uses 0.3)
- [x] Anthropic prompt caching on SQL generator semantic block (`cache_control: ephemeral`)
- [x] Intent resolver: inline JSON schema, few-shot example, clearer follow-up labels, general-question guidance
- [x] SQL generator: strip irrelevant intent fields from user message; add NULL/COALESCE, alias, and default time-range guidelines
- [x] SQL validator: add schema context, intent-mismatch examples, low-complexity LLM skip for simple queries
- [x] Data analyzer: thread original question, compact column stats format, max-5-insights limit, significance thresholds
- [x] Narrative: thread original question, truncation note guidance, bullet-vs-prose rule
- [x] Viz planner: replace spec dump with ordered decision tree (10-step priority logic)
- [x] Graceful degradation: analyzer/viz-planner failures return fallback values instead of crashing pipeline

---

## Phase 18 — Markdown Semantic Layer

Replace the rigid JSONB semantic layer with a human-readable Markdown document stored in `semantic_layers.semantic_md`. The document is auto-generated from schema introspection, freely editable by users to add domain knowledge, and injected as a persistent instruction set into every AI agent request.

### 18a — Documentation

- [x] `docs/semantic-layer.md` — Rewrite to describe Markdown format, document structure, editing flow, and updated registry/loading model
- [x] `docs/development-plan.md` — Add Phase 18

### 18b — Core Refactor (DB + Types + Backend)

- [x] New migration: drop `metrics JSONB`, `dimensions JSONB`, `entities JSONB`; add `semantic_md TEXT NOT NULL DEFAULT ''` to `semantic_layers`
- [x] `packages/supabase/src/types.ts` — Update `semantic_layers` DB type (remove JSONB fields, add `semantic_md: string`)
- [x] `packages/shared/src/types/semantic.ts` — Simplify `SemanticMetadata` to `{ semanticMarkdown: string; rawSchemaDDL?: string }`
- [x] `packages/semantic/src/registry.ts` + `loader.ts` — Simplify registry to store/return Markdown string; remove structured lookup maps
- [x] `packages/core/src/agents/semantic-generator.ts` — New Markdown-output prompt; remove JSON parsing, normalization, Zod validation
- [x] `packages/core/src/agents/intent-resolver.ts` — Inject `semanticMarkdown` as a context block (replaces structured metadata iteration)
- [x] `packages/core/src/agents/sql-generator.ts` — Inject `semanticMarkdown` as context block (keep `cache_control: ephemeral`)
- [x] `packages/core/src/agents/sql-validator.ts` — Inject `semanticMarkdown` as context block
- [x] `packages/web/src/lib/process-query-for-connection.ts` — Load `semantic_md`; build `SemanticMetadata` with `semanticMarkdown` field
- [x] `packages/web/src/app/api/connections/[id]/semantic/route.ts` — GET/PUT for `semantic_md`
- [x] `packages/web/src/app/api/connections/[id]/semantic/generate/route.ts` — Save Markdown output instead of JSONB payload
- [x] Update onboarding wizard semantic preview to render Markdown

### 18c — Settings UI

- [x] `packages/web/src/app/connections/[id]/semantic/page.tsx` — New split-view editor (textarea + rendered Markdown preview, Save + Regenerate actions)
- [x] Add "Semantic Layer" navigation link from connection header or settings area (book icon in Manage connections dialog)

---

## Phase 19 — Encryption at Rest for `connection_string`

Encrypt `connections.connection_string` with AES-256-GCM before writing to Supabase and decrypt on every server-side read. No schema changes — the existing `TEXT` column stores the versioned ciphertext `v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>`. Key managed via `CONNECTION_STRING_ENCRYPTION_KEY` env var (64 hex chars / 32 bytes).

- [x] `packages/web/src/lib/crypto.ts` — `encryptConnectionString`, `decryptConnectionString`, `CryptoDecryptionError`
- [x] `packages/web/src/app/api/connections/route.ts` — POST: encrypt before insert
- [x] `packages/web/src/app/api/connections/[id]/route.ts` — PUT: encrypt `connection_string` on update
- [x] `packages/web/src/app/api/connections/[id]/test/route.ts` — decrypt before pool creation
- [x] `packages/web/src/app/api/connections/[id]/introspect/route.ts` — decrypt before pool creation
- [x] `packages/web/src/app/api/connections/[id]/semantic/generate/route.ts` — decrypt before pool creation
- [x] `packages/web/src/lib/process-query-for-connection.ts` — decrypt before pool creation
- [x] `supabase/migrations/20260224010000_encrypt_connection_string.sql` — document encrypted column
- [x] `.env.example` — add `CONNECTION_STRING_ENCRYPTION_KEY`
