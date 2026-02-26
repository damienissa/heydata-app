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

---

## Phase 20 — Tiered Model Strategy

Use `claude-haiku-4-5-20251001` for lightweight structured agents and keep `claude-haiku-4-5-20251001` for complex reasoning agents. Reduces per-request latency ~40-50% on steps 1, 3, 4, and viz-planner.

- [x] Add `fastModel` field to `AgentContext` in `packages/core/src/types.ts`
- [x] Add `fastModel?: string` to `OrchestratorConfig` + `DEFAULT_CONFIG` in `packages/core/src/orchestrator.ts`
- [x] Pass `fastModel` through `createContext()` in orchestrator
- [x] `intent-resolver.ts` — switch to `context.fastModel` (Haiku)
- [x] `sql-validator.ts` — switch to `context.fastModel` (Haiku)
- [x] `data-validator.ts` — switch to `context.fastModel` (Haiku)
- [x] `viz-planner.ts` — switch to `context.fastModel` (Haiku)
- Keep `context.model` (Sonnet) in: `sql-generator.ts`, `data-analyzer.ts`, `narrative.ts`, `semantic-generator.ts`

---

## Phase 21 — Dynamic Slash Commands from Semantic Layer

Auto-generate `/commandName`-style chat shortcuts from the semantic layer, persist them in DB, surface them as a slash-command picker in the chat composer, and allow editing via the semantic layer settings page.

### 21a — DB Migration

- [x] `supabase/migrations/20260225100000_connection_commands.sql` — `connection_commands` table with `slash_command`, `description`, `prompt`, `sort_order`; RLS via connection ownership; unique constraint on `(connection_id, slash_command)`

### 21b — Supabase Types

- [x] `packages/supabase/src/types.ts` — add `connection_commands` Row/Insert/Update types

### 21c — Core: Command Generator Agent

- [x] `packages/core/src/agents/command-generator.ts` — LLM agent (fastModel: Haiku) that parses semantic markdown and returns 5–10 slash commands (Zod-validated JSON output)
- [x] Export `generateCommands`, `generateCommandsFromSemantic`, types from `packages/core/src/agents/index.ts` and `packages/core/src/index.ts`

### 21d — Semantic Generate Route

- [x] `packages/web/src/app/api/connections/[id]/semantic/generate/route.ts` — add `"commands"` progress step; call `generateCommandsFromSemantic` after saving; upsert commands; include `commands[]` in `complete` SSE payload (non-fatal failure)

### 21e — Commands API Route

- [x] `packages/web/src/app/api/connections/[id]/commands/route.ts` — `GET` (list ordered by sort_order) + `PUT` (full replace: delete + insert)

### 21f — Commands Settings UI

- [x] `packages/web/src/app/connections/[id]/semantic/page.tsx` — tab strip ("Semantic Layer" | "Commands"); Commands tab: editable list (slash_command, description, prompt), add/delete rows, save button; Regenerate also refreshes commands via SSE payload

### 21g — Slash Command Picker in Chat

- [x] `packages/web/src/hooks/use-commands.ts` — `useCommands(connectionId)` hook
- [x] `packages/web/src/components/assistant-ui/command-picker.tsx` — floating picker with keyboard nav (↑ ↓ Enter Tab Escape), filtered by query
- [x] `packages/web/src/components/assistant-ui/thread.tsx` — `Composer` detects `/` prefix via `onChange`, shows `CommandPicker`, on select calls `composerRuntime.setText(command.prompt)`

### 21h — Setup Page Progress

- [x] `packages/web/src/app/setup/page.tsx` — rewrite `handleGenerate` to read SSE stream from `semantic/generate` endpoint; show 5-step progress indicator (connecting → introspecting → generating → saving → commands) replacing the spinner button during generation

---

## Phase 22 — Codebase Audit & Documentation Refresh

### 22a — Audit Report

- [x] `docs/audit-report.md` — Comprehensive audit findings (code quality, security, testing, docs) with severity levels and exact file:line references

### 22b — Documentation Updates

- [x] `GETTING_STARTED.md` — Rewrite for Markdown semantic layer / onboarding wizard flow
- [x] `README.md` — Update package descriptions, env vars, remove YAML references
- [x] `docs/tech-stack.md` — Add supabase package, update semantic description, tiered models, chart count
- [x] `docs/architecture.md` — Update Layer 2/3 for Markdown semantic, add encryption, commands table
- [x] `docs/agents.md` — Update semantic generator output, add command generator agent
- [x] `docs/cross-cutting.md` — Add AES-256-GCM encryption documentation
- [x] `docs/data-flow.md` — Update semantic loading description, add slash commands to setup flow
- [x] `docs/open-questions.md` — Mark Q1-Q4 as resolved

### 22c — Structured Logging

- [x] `packages/core/src/logger.ts` — Logger interface and createLogger factory
- [x] Replace 89 console.log calls in core with structured logger
- [x] Remove PII-leaking debug output (row data, SQL in info level)

### 22d — API Validation & Error Standardization

- [x] `packages/web/src/lib/api-error.ts` — Standardized error response helper
- [x] `packages/web/src/lib/env.ts` — Environment variable validation with Zod
- [x] Add Zod schemas to query, chat, and session PATCH routes

### 22e — Frontend Error Boundaries

- [x] `packages/web/src/components/error-boundary.tsx` — Reusable error boundary
- [x] `packages/web/src/app/error.tsx` + `packages/web/src/app/global-error.tsx` — Next.js error pages
- [x] Wrap RendererRouter in QueryResult and ResultsCanvas with error boundaries

### 22f — Dependency Alignment & Dev Plan Update

- [x] Align vitest to `^3.0.5` across all packages
- [x] Align tsup to `^8.3.6` across all packages
- [x] Add `lint` script to `@heydata/web` package.json
- [x] Update `docs/development-plan.md` with Phase 22 items

---

## Phase 23 — Chat Session UX Improvements

### 23a — Fix Sidebar Ordering

- [x] `supabase/migrations/20260226100000_touch_session_on_message.sql` — DB trigger on `chat_messages` INSERT that updates parent `chat_sessions.updated_at`, so sidebar ordering reflects last activity

### 23b — Auto-Generate Session Titles

- [x] `packages/web/src/app/api/chat/route.ts` — Fire-and-forget Haiku call to generate a 3–6 word title from the first user message; updates session title in DB when current title is "New Chat"
- [x] `packages/web/src/hooks/use-sessions.ts` — Stabilize `refetch` with `useCallback`
- [x] `packages/web/src/app/page.tsx` — Delayed refetch (4s) after auto-creating a session to pick up the generated title in the sidebar

### 23c — Fix Duplicate Message Sends

- [x] `packages/web/src/app/api/chat/route.ts` — Change `stepCountIs(2)` → `stepCountIs(1)` to prevent the model from calling `query_data` twice across multi-step tool rounds
- [x] `packages/web/src/app/assistant.tsx` — Memoize `AssistantChatTransport` with `useMemo` to prevent re-creation on every render; add ref-based guard in `prepareSendMessagesRequest` to prevent concurrent sends

### 23d — Fix tool_use/tool_result on Page Reload

- [x] `packages/web/src/app/api/chat/route.ts` — Convert assistant-ui `tool-{name}` parts to AI SDK `tool-invocation` format in the sanitization step, so `convertToModelMessages` produces matching `tool_use` + `tool_result` blocks after a page reload

### 23e — Application-Level Sidebar Ordering

- [x] `packages/web/src/app/api/chat/route.ts` — Explicitly touch `chat_sessions.updated_at` after persisting a user message (works with or without the DB trigger migration)
- [x] `packages/web/src/hooks/use-sessions.ts` — Add 10-second polling interval (only when tab is visible) to keep sidebar ordering and titles in sync
- [x] `packages/web/src/app/assistant.tsx` — Fix `h-dvh` → `h-full` to prevent composer from being clipped below viewport

---

## Phase 24 — Chat URL Routing

Give each conversation its own URL (`/chat/[id]`). A blank new chat starts at `/chat`, and the URL updates to `/chat/{id}` after the first message auto-creates a session.

- [ ] `packages/web/src/app/chat/layout.tsx` — New client layout with Header, Sidebar, ChatProvider, and Assistant; reads session ID from URL via `usePathname()`; manages connections/sessions state; uses `window.history.replaceState()` for silent URL update on auto-create
- [ ] `packages/web/src/app/chat/page.tsx` — Minimal page for `/chat` route (returns null)
- [ ] `packages/web/src/app/chat/[id]/page.tsx` — Minimal page for `/chat/[id]` route (returns null)
- [ ] `packages/web/src/app/chat/assistant.tsx` — Moved from `app/assistant.tsx` (unchanged content)
- [ ] `packages/web/src/app/page.tsx` — Replace with server redirect to `/chat`
- [ ] Update `/` → `/chat` references in: middleware, login, setup, semantic settings pages
- [ ] Lazy session creation: "New Chat" navigates to `/chat` without creating a DB session; session is auto-created on first message

---

## Phase 25 — Landing Page

- [x] `packages/web/src/lib/supabase/middleware.ts` — Allow `/` as public route for unauthenticated users
- [x] `packages/web/src/app/page.tsx` — Hero section for unauthenticated users (product name + tagline + CTA to login); server-side auth check redirects authenticated users to `/chat`
- [x] `packages/web/src/components/layout/Header.tsx` — Sign out button (calls `supabase.auth.signOut()`, redirects to `/`)
