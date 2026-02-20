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

- [ ] `pnpm init` in `packages/shared` — `package.json` with name `@heydata/shared`
- [ ] `tsconfig.json` (extends `../../configs/tsconfig.base.json`)
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

- [ ] `pnpm dlx create-next-app@latest` — bootstraps Next.js with TypeScript, Tailwind, App Router
- [ ] `package.json` — rename to `@heydata/web`, add `@heydata/shared` dependency
- [ ] `tsconfig.json` — update to extend `../../configs/tsconfig.base.json`
- [ ] `src/app/globals.css` — Tailwind directives
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

```sh
mkdir -p packages/renderer/src/{charts,components}
cd packages/renderer && pnpm init
# Set name to @heydata/renderer in package.json
pnpm add recharts @tanstack/react-table
pnpm add -D react react-dom @types/react @types/react-dom tsup vitest
```

- [ ] `pnpm init` in `packages/renderer` — `package.json` with name `@heydata/renderer`
- [ ] `tsconfig.json` + `tsup.config.ts`
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

```sh
mkdir -p packages/core/src/{agents,mocks}
cd packages/core && pnpm init
# Set name to @heydata/core in package.json
pnpm add @anthropic-ai/sdk @heydata/shared
pnpm add -D tsup vitest
```

- [ ] `pnpm init` in `packages/core` — `package.json` with name `@heydata/core`
- [ ] `tsconfig.json` + `tsup.config.ts`
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

```sh
mkdir -p packages/semantic/src/schemas packages/semantic/definitions
cd packages/semantic && pnpm init
# Set name to @heydata/semantic in package.json
pnpm add zod js-yaml
pnpm add -D @types/js-yaml tsup vitest
```

- [ ] `pnpm init` in `packages/semantic` — `package.json` with name `@heydata/semantic`
- [ ] `tsconfig.json` + `tsup.config.ts`
- [ ] `src/schemas/` — Zod schemas for metric/dimension/entity YAML files
- [ ] `src/loader.ts` — `js-yaml` parser + Zod validation
- [ ] `src/registry.ts` — in-memory lookup by name/synonym
- [ ] `definitions/` — example YAML files (daily_revenue, etc.)
- [ ] Unit tests

---

## Phase 7 — `@heydata/bridge` — SQL Execution

```sh
mkdir -p packages/bridge/src
cd packages/bridge && pnpm init
# Set name to @heydata/bridge in package.json
pnpm add pg
pnpm add -D @types/pg tsup vitest
```

- [ ] `pnpm init` in `packages/bridge` — `package.json` with name `@heydata/bridge`
- [ ] `tsconfig.json` + `tsup.config.ts`
- [ ] `src/pool.ts` — `pg.Pool` setup, connection config
- [ ] `src/guards.ts` — SQL keyword deny-list, row limit injection, timeout enforcement
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
