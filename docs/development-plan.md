# Development Plan

Progress tracking for the heydata-app monorepo. Check off items as they are completed.

> **Ordering rationale:** UI-first, data layers last. Core is built against mocked bridge + semantic interfaces so the agent pipeline can be developed and tested independently before the real data connections are wired.

---

## Phase 1 — Monorepo Foundation

- [ ] Root `package.json` (workspace config + shared devDependencies: TypeScript, ESLint, Prettier, Vitest, tsup, Turborepo)
- [ ] `pnpm-workspace.yaml`
- [ ] `turbo.json` (pipelines: build, dev, test, lint, typecheck)
- [ ] `configs/tsconfig.base.json`
- [ ] `configs/eslint.base.js`
- [ ] `configs/prettier.config.js`
- [ ] `.gitignore`
- [ ] `.env.example` (ANTHROPIC_API_KEY, DATABASE_URL)

---

## Phase 2 — `@heydata/shared` — Shared Types

- [ ] `package.json` + `tsconfig.json`
- [ ] `src/types/intent.ts` — `IntentObject`
- [ ] `src/types/result.ts` — `ResultSet`
- [ ] `src/types/visualization.ts` — `VisualizationSpec`
- [ ] `src/types/agent.ts` — `AgentTrace`
- [ ] `src/types/errors.ts` — error types and codes
- [ ] `src/types/semantic.ts` — `MetricDefinition`, `DimensionDefinition`, `EntityRelationship`
- [ ] `src/index.ts` — barrel export
- [ ] `tsup.config.ts`
- [ ] Unit tests (Vitest — schema validation)

---

## Phase 3 — `@heydata/web` — UI ⬅ start here

### 3a. Scaffold

- [ ] `package.json` (next, react, react-dom, tailwindcss, @heydata/shared)
- [ ] `next.config.ts`
- [ ] `tsconfig.json` (extends `configs/tsconfig.base.json`)
- [ ] Tailwind CSS setup (`tailwind.config.ts`, `postcss.config.js`)
- [ ] `src/app/globals.css`
- [ ] `src/app/layout.tsx` (root layout, metadata, font)

### 3b. Shell Layout

- [ ] `src/components/layout/AppShell.tsx` (sidebar + main area two-column)
- [ ] `src/components/layout/Sidebar.tsx` (conversation list, new chat button)
- [ ] `src/components/layout/Header.tsx`

### 3c. Chat Interface

- [ ] `src/components/chat/ChatInput.tsx` (textarea, submit on Enter/button, disabled during loading)
- [ ] `src/components/chat/MessageBubble.tsx` (user vs. assistant variant)
- [ ] `src/components/chat/ConversationThread.tsx` (scrollable message list)
- [ ] `src/components/chat/TypingIndicator.tsx` (streaming in progress)
- [ ] `src/app/page.tsx` — home page wiring chat input + thread

### 3d. Results Canvas

- [ ] `src/components/canvas/ResultsCanvas.tsx` (host for chart + narrative)
- [ ] `src/components/canvas/ChartPlaceholder.tsx` (placeholder before renderer is wired)
- [ ] `src/components/canvas/NarrativeBlock.tsx` (assistant prose output)
- [ ] `src/components/canvas/LoadingSkeleton.tsx`

### 3e. Transparency Toggles

- [ ] `src/components/transparency/SqlViewer.tsx` (collapsible code block showing generated SQL)
- [ ] `src/components/transparency/MetricTooltip.tsx` (hover tooltip for metric definitions)

### 3f. Error States

- [ ] `src/components/feedback/ErrorBanner.tsx`
- [ ] `src/components/feedback/RetryButton.tsx`

### 3g. Conversation State

- [ ] `src/context/ConversationContext.tsx` (React Context + `useReducer` — message list, loading state, error)
- [ ] `src/hooks/useConversation.ts`

---

## Phase 4 — `@heydata/renderer` — Visualization

- [ ] `package.json` + `tsconfig.json` + `tsup.config.ts`
- [ ] `src/charts/LineChart.tsx`
- [ ] `src/charts/BarChart.tsx`
- [ ] `src/charts/AreaChart.tsx`
- [ ] `src/charts/ScatterChart.tsx`
- [ ] `src/charts/ComposedChart.tsx` (dual-axis)
- [ ] `src/components/KpiCard.tsx` (custom)
- [ ] `src/components/DataTable.tsx` (TanStack Table)
- [ ] `src/RendererRouter.tsx` — routes `VisualizationSpec.type` → correct component
- [ ] Wire into `ResultsCanvas` in web
- [ ] Unit tests (snapshot / render tests)

---

## Phase 5 — `@heydata/core` — AI Agent Pipeline

- [ ] `package.json` + `tsconfig.json` + `tsup.config.ts`
- [ ] `src/agents/intent-resolver.ts`
- [ ] `src/agents/sql-generator.ts`
- [ ] `src/agents/sql-validator.ts`
- [ ] `src/agents/data-validator.ts`
- [ ] `src/agents/data-analyzer.ts`
- [ ] `src/agents/viz-planner.ts`
- [ ] `src/agents/narrative.ts`
- [ ] `src/orchestrator.ts` — pipeline coordinator with retry loop
- [ ] `src/cache.ts` — query-level caching
- [ ] `src/mocks/` — mock bridge + semantic adapters for testing
- [ ] Unit tests per agent (mocked Anthropic SDK)
- [ ] Integration test (mocked bridge + semantic + SDK, full pipeline)

---

## Phase 6 — `@heydata/semantic` — Semantic Layer

- [ ] `package.json` + `tsconfig.json` + `tsup.config.ts`
- [ ] `src/schemas/` — Zod schemas for metric/dimension/entity YAML files
- [ ] `src/loader.ts` — `js-yaml` parser + Zod validation
- [ ] `src/registry.ts` — in-memory lookup by name/synonym
- [ ] `definitions/` — example YAML files (daily_revenue, etc.)
- [ ] Unit tests

---

## Phase 7 — `@heydata/bridge` — SQL Execution

- [ ] `package.json` + `tsconfig.json` + `tsup.config.ts`
- [ ] `src/pool.ts` — `pg.Pool` setup, connection config
- [ ] `src/guards.ts` — keyword blocklist, row limit injection, timeout enforcement
- [ ] `src/executor.ts` — `executeQuery(sql, params)` → `ResultSet`
- [ ] `src/errors.ts` — bridge-specific error types
- [ ] Unit tests (mocked `pg` client)

---

## Phase 8 — Integration & Wiring

- [ ] Wire `@heydata/web` API route → `@heydata/core` orchestrator
- [ ] Wire orchestrator → `@heydata/bridge` executor
- [ ] Wire orchestrator → `@heydata/semantic` registry
- [ ] Render `VisualizationSpec` from core response using `@heydata/renderer` in web canvas
- [ ] End-to-end smoke test (real Anthropic API + real Postgres)
- [ ] Playwright E2E: submit query → see chart rendered
