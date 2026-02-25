# HeyData — Codebase Audit Report

**Date:** 2026-02-25
**Scope:** Full monorepo audit — code quality, security, testing, documentation, dependencies

---

## Critical

### 1. No CI/CD Pipeline

No `.github/workflows/` directory exists. There are no automated checks (lint, typecheck, test, build) on push or PR. Regressions can ship undetected.

**Recommendation:** Add GitHub Actions workflow (Phase 23).

---

### 2. Excessive Console Logging in `@heydata/core` — 89 Calls

The production hot path logs SQL queries, user questions, and **row data samples** to stdout. This leaks sensitive data and degrades performance.

| File | Count |
|------|-------|
| `packages/core/src/orchestrator.ts` | 83 |
| `packages/core/src/agents/command-generator.ts` | 3 |
| `packages/core/src/agents/semantic-generator.ts` | 2 |
| `packages/core/src/agents/sql-generator.ts` | 1 |

**PII risk:** `orchestrator.ts` line ~234 serializes first 3 rows of query results to console.

**Fixed in:** Phase 22c — Structured Logging.

---

### 3. No React Error Boundaries

Zero `ErrorBoundary` components or Next.js `error.tsx` / `global-error.tsx` files exist. An unhandled JS error in any chart component, command picker, or chat thread crashes the entire React tree (white screen).

**Fixed in:** Phase 22e — React Error Boundaries.

---

### 4. Low Test Coverage

~11 test files for ~135 source files. Zero tests for:
- All 12 API routes
- All React hooks (`use-sessions`, `use-connections`, `use-commands`, `use-session-with-messages`)
- `process-query-for-connection.ts` (core integration point)
- `crypto.ts` (encryption/decryption)
- `command-generator.ts` and `semantic-generator.ts` agents
- Most chart components (only RendererRouter has snapshot tests)

**Recommendation:** Dedicated test expansion phase (Phase 24).

---

## High

### 5. Double Type Casts (`as unknown as`) — 10 Occurrences

| File | Line | Pattern |
|------|------|---------|
| `packages/web/src/app/api/query/route.ts` | 33 | Supabase client type mismatch |
| `packages/web/src/app/api/chat/route.ts` | 89 | Supabase client type mismatch |
| `packages/core/src/agents/sql-generator.ts` | 154 | Anthropic SDK usage response |
| `packages/web/src/components/assistant-ui/tool-fallback.tsx` | 299 | Component type cast |
| `packages/web/src/app/api/connections/[id]/semantic/generate/route.ts` | 136 | Schema cast |
| `packages/core/src/__tests__/orchestrator.test.ts` | 82, 142 | Mock Anthropic (test-only) |
| `packages/core/src/__tests__/setup.ts` | 48 | Mock Anthropic (test-only) |
| `packages/bridge/src/__tests__/executor.test.ts` | 29 | Mock pg.Pool (test-only) |

The Supabase client casts (`query/route.ts:33`, `chat/route.ts:89`) indicate a type mismatch between the SSR-created client and what `processQueryForConnection` expects. Requires upstream fix in `@heydata/supabase` types.

**Deferred:** Requires Supabase type regeneration.

---

### 6. SQL Timeout Wrapper — String Interpolation

`packages/bridge/src/guards.ts` line 84-87:

```typescript
export function wrapWithTimeout(sql: string, timeoutMs: number): string {
  return `SET LOCAL statement_timeout = '${timeoutMs}ms'; ${sql}`;
}
```

`timeoutMs` is interpolated directly into SQL. While typed as `number` and sourced from config (not user input), this pattern is fragile. Also creates a multi-statement query, which contradicts the guards' own multi-statement check — `wrapWithTimeout` is called **after** `applySqlGuards`, bypassing it.

**Risk:** Low (timeoutMs comes from config). **Recommendation:** Use parameterized query or validate timeoutMs is a positive integer.

---

### 7. Missing Zod Validation on API Routes — 9 of 12 Routes

| Route | Method | Has Zod? |
|-------|--------|----------|
| `/api/connections` | POST | Yes (`ConnectionConfigSchema`) |
| `/api/sessions` | POST | Yes (`CreateSessionSchema`) |
| `/api/connections/[id]/semantic` | PUT | Yes (`UpdateSemanticSchema`) |
| `/api/query` | POST | **No** — inline type assertions |
| `/api/chat` | POST | **No** — inline type assertions |
| `/api/sessions/[id]` | PATCH | **No** — manual typeof checks |
| `/api/connections/[id]` | PUT | **No** |
| `/api/connections/[id]/test` | POST | **No** |
| `/api/connections/[id]/introspect` | POST | **No** |
| `/api/connections/[id]/commands` | PUT | **No** — manual validation |
| `/api/connections/[id]/commands/generate` | POST | **No** |
| `/api/connections/[id]/semantic/generate` | POST | **No** |

**Fixed in:** Phase 22d — API Validation & Error Standardization.

---

### 8. Non-null Assertions on Environment Variables — 6 Occurrences

| File | Lines |
|------|-------|
| `packages/web/src/lib/supabase/server.ts` | 13-14 |
| `packages/web/src/lib/supabase/client.ts` | 11-12 |
| `packages/web/src/lib/supabase/middleware.ts` | 14-15 |

All use `process.env.NEXT_PUBLIC_SUPABASE_URL!` and `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!`. If vars are missing, the app produces cryptic downstream errors instead of clear startup failures.

**Fixed in:** Phase 22d — env validation module.

---

## Medium

### 9. Dependency Version Mismatches

| Package | vitest | tsup |
|---------|--------|------|
| root | `^2.1.0` | `^8.3.0` |
| @heydata/core | `^2.1.0` | `^8.3.0` |
| @heydata/bridge | `^2.1.0` | `^8.3.0` |
| @heydata/semantic | `^2.1.0` | `^8.3.0` |
| @heydata/shared | `^2.1.0` | `^8.3.0` |
| @heydata/renderer | **`^3.0.5`** | **`^8.3.6`** |
| @heydata/supabase | — | `^8.3.0` |

The vitest major version mismatch (2.x vs 3.x) can cause different test behaviors across packages.

**Fixed in:** Phase 22f — Dependency Alignment.

---

### 10. Inconsistent Error Response Format

API routes return errors in different shapes:

- `{ error: string }` — most routes
- `{ error: string, code: string, agent: string }` — query route (HeyDataError)
- `{ error: ZodError.flatten() }` — connections POST
- `{ ok: false, error: string }` — test route

No standardized error envelope across the API.

**Fixed in:** Phase 22d — Error Standardization.

---

### 11. Missing `lint` Script in `@heydata/web`

The root turbo config runs `lint` across all packages, but `packages/web/package.json` has no `lint` script. All other packages (core, bridge, shared, semantic) have `"lint": "eslint src/"`.

**Fixed in:** Phase 22f.

---

### 12. `as never` Casts in Supabase Operations — 14 Occurrences

Used as a workaround for Supabase generated types not matching insert/update shapes:

| File | Lines |
|------|-------|
| `packages/web/src/app/api/chat/route.ts` | 149, 215 |
| `packages/web/src/app/api/connections/route.ts` | 77 |
| `packages/web/src/app/api/connections/[id]/route.ts` | 70 |
| `packages/web/src/app/api/connections/[id]/test/route.ts` | 64, 72 |
| `packages/web/src/app/api/connections/[id]/semantic/route.ts` | 66 |
| `packages/web/src/app/api/connections/[id]/semantic/generate/route.ts` | 153, 167 |
| `packages/web/src/app/api/connections/[id]/commands/route.ts` | 106 |
| `packages/web/src/app/api/connections/[id]/commands/generate/route.ts` | 31, 69 |
| `packages/web/src/app/api/sessions/route.ts` | 65 |
| `packages/web/src/app/api/sessions/[id]/route.ts` | 84 |

**Root cause:** Generated Supabase types (`packages/supabase/src/types.ts`) don't align with the actual table schemas after migrations.

**Recommendation:** Regenerate Supabase types with `supabase gen types typescript`.

---

## Low

### 13. No Bundle Size Monitoring

No `@next/bundle-analyzer` or `size-limit` configuration. Large dependencies like `recharts` are imported without visibility into bundle impact.

---

### 14. ANTHROPIC_API_KEY Empty String Fallback

`packages/web/src/lib/process-query-for-connection.ts` line 123:

```typescript
apiKey: process.env.ANTHROPIC_API_KEY ?? "",
```

Empty string passes as truthy but fails at the Anthropic API with a confusing error.

**Fixed in:** Phase 22d — env validation module.

---

## Documentation Gaps

| File | Issue |
|------|-------|
| `GETTING_STARTED.md` | Still references YAML-based semantic definitions (pre-Phase 18) |
| `README.md` | References "YAML loader, registry" for semantic package |
| `docs/tech-stack.md` | Lists semantic as "TypeScript, Zod, YAML"; missing `@heydata/supabase` |
| `docs/architecture.md` | References `semantic_layers` storing JSONB |
| `docs/agents.md` | Missing Command Generator agent; semantic generator output shows JSONB |
| `docs/cross-cutting.md` | Missing AES-256-GCM encryption details (Phase 19) |
| `docs/data-flow.md` | Describes JSONB loading + synonym indexing |
| `docs/open-questions.md` | Questions resolved in Phases 10-21 still shown as open |

**Fixed in:** Phase 22b — Documentation Updates.
