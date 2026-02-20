# @heydata/shared — Shared Types & Utilities

Cross-cutting package used by all other `@heydata/*` packages.

---

## Role

Provide the common TypeScript types, interfaces, error definitions, constants, and utility functions that are used across multiple packages. Ensures consistency in how data flows between packages and prevents type duplication.

---

## Responsibilities

- Define common TypeScript types and interfaces shared across the pipeline:
  - `IntentObject` — output of the Intent Resolver Agent
  - `ValidationResult` — output of SQL Validator and Data Validator Agents
  - `InsightAnnotation` — output of the Data Analyzer Agent
  - `VisualizationSpec` — output of the Viz Planner Agent
  - `ResultSet` — structured query results from `@heydata/bridge`
  - `MetricDefinition`, `DimensionDefinition`, `EntityRelationship` — semantic layer types
  - `AgentTrace` — per-agent observability payload
- Define error types and error codes used across the pipeline
- Provide shared constants (retry limits, default timeouts, supported warehouse dialects)
- Provide shared configuration schemas
- Provide pure utility functions usable by multiple packages (date parsing, formatting helpers, etc.)

---

## Design Principle

`@heydata/shared` has **no dependencies on other `@heydata/*` packages**. Every other package may depend on `@heydata/shared`, but `@heydata/shared` never depends on them. This prevents circular dependencies and keeps the shared layer stable.

---

## Key Design Decisions

- **Type granularity:** How tightly typed should intermediate objects be? Strict types improve reliability and agent testability but require more maintenance as the schema evolves.
- **Versioning:** As the pipeline evolves, breaking changes to shared types affect all packages simultaneously. A versioning or deprecation strategy for types is needed.
- **Runtime validation:** Should shared types have runtime validation schemas (e.g., Zod) in addition to TypeScript types, to validate actual LLM outputs against the expected contract?

---

## Interfaces

**Depended on by:**

| Package | Types used |
|---|---|
| `@heydata/core` | `IntentObject`, `ValidationResult`, `InsightAnnotation`, `VisualizationSpec`, `AgentTrace` |
| `@heydata/semantic` | `MetricDefinition`, `DimensionDefinition`, `EntityRelationship`, `AccessRule`, `FormattingRule` |
| `@heydata/bridge` | `ResultSet`, error types |
| `@heydata/renderer` | `VisualizationSpec`, `ResultSet` |
| `@heydata/web` | `IntentObject` (for transparency display), error types |

**No dependencies on other `@heydata/*` packages.**
