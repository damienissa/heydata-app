# Hey Data — Semantic Layer

The semantic layer (`@heydata/semantic`) is the **most critical layer** in the system. It bridges the gap between human language and database schema by maintaining a centralized vocabulary of business concepts.

Rather than encoding business logic in SQL queries, dashboard configs, or LLM prompts, Hey Data centralizes it here — making the entire system consistent and maintainable.

---

## What the Semantic Layer Contains

### Metrics

Named calculations with formulas and grain.

- Define what a number means and how to compute it
- Attached to specific dimensions they can be broken down by
- Include default filters (e.g., exclude cancelled orders)
- Carry formatting rules (currency, percentage, decimal places)

Example: `daily_revenue = SUM(orders.gross_amount) - SUM(refunds.amount)` grouped by day

### Dimensions

Categorization axes used to slice and group metrics.

Examples: `region`, `product_category`, `customer_segment`, `channel`, `date`

### Entities & Relationships

How tables relate to each other — joins, foreign keys, and cardinality.

- Allows the SQL Generator to build correct multi-table queries without hardcoding joins
- Defines primary keys, relationship types (one-to-many, many-to-many), and join conditions

### Synonyms & Aliases

Maps business language to technical names.

- "sales" → `revenue`
- "last month" → date range logic for the prior calendar month
- "customers" → `users` table (where `account_type = 'customer'`)

Used by the Intent Resolver Agent to map user language onto semantic concepts.

### Access Rules

Controls which users or roles can access which metrics or data subsets.

- Role-based access (e.g., executives see company-wide data; regional managers see their region only)
- Metric-level restrictions (e.g., only Finance can access cost metrics)
- Row-level security rules applied at query time

### Formatting Rules

Per-metric display configuration.

- Currency symbols and locale formatting (`$1,234.56` vs `€1.234,56`)
- Decimal precision
- Date display formats
- Percentage vs. absolute value display

---

## Example Metric Definition

```yaml
metric: daily_revenue
  display_name: "Daily Revenue"
  description: "Total revenue per day, net of refunds"
  formula: SUM(orders.gross_amount) - SUM(refunds.amount)
  grain: daily
  dimensions: [date, region, product_category, channel]
  filters:
    default: "order_status = 'completed'"
  format: currency_usd
```

---

## How Agents Use the Semantic Layer

| Agent | How it uses the semantic layer |
|---|---|
| Intent Resolver | Matches user language to metric/dimension names via synonyms |
| SQL Generator | Reads metric formulas, joins, and filters to build correct SQL |
| SQL Validator | Cross-checks generated SQL against the schema and metric definitions |
| Data Validator | Verifies returned columns match the metrics/dimensions from the intent |
| Data Analyzer | Uses metric metadata (e.g., grain, format) to contextualize statistics |
| Narrative Agent | References display names and descriptions in generated summaries |

---

## Loading Modes

The semantic layer supports two loading modes, depending on context:

### 1. From Database (Primary — Production)

For user-connected databases, the semantic layer is **auto-generated** and stored in Supabase.

- Semantic definitions (metrics, dimensions, entities) are stored as JSONB in the `semantic_layers` table
- Loaded at query time via `SemanticRegistry.loadFromMetadata()`
- Each connection has its own independent semantic layer
- Users can review and edit generated definitions via the UI

**Flow:**

```text
User connects DB → Schema introspection → semantic-generator agent → Supabase storage → Registry
```

### 2. From YAML Files (Development)

For local development and testing, the semantic layer is loaded from YAML files on disk.

- Definitions live in `packages/semantic/definitions/` (metrics, dimensions, entities subdirectories)
- Loaded at startup via `loadDefinitions()` + `SemanticRegistry.load()`
- Used when running `pnpm dev` with `DATABASE_URL` env var directly

**Flow:**

```text
YAML files on disk → loader.ts parses + validates → Registry
```

---

## Auto-Generation from Schema

When a user connects a new database, Hey Data automatically generates a semantic layer using the `semantic-generator` agent in `@heydata/core`.

### How It Works

1. **Schema introspection** — The bridge queries `information_schema` on the user's database to discover:
   - All tables and their columns (name, data type, nullable)
   - Primary keys and unique constraints
   - Foreign key relationships between tables

2. **LLM analysis** — The `semantic-generator` agent receives the introspected schema and:
   - Identifies entities and their relationships from foreign keys
   - Classifies columns as dimensions (categorical, temporal, geographic) or potential metric sources
   - Generates meaningful aggregate metrics with SQL formulas (COUNT, SUM, AVG, etc.)
   - Creates natural language synonyms for fuzzy matching
   - Sets appropriate formatting rules (number, currency, percentage, date)

3. **Storage** — The generated semantic layer is stored in Supabase `semantic_layers` table as JSONB:
   - `metrics` — Array of `MetricDefinition` objects
   - `dimensions` — Array of `DimensionDefinition` objects
   - `entities` — Array of entity objects with relationships
   - `raw_schema` — The original introspected schema snapshot

4. **User review** — The user can review, edit, and regenerate the semantic layer via the onboarding wizard or settings.

### Example: Auto-Generated from a SaaS Database

Given a database with tables `users`, `subscriptions`, `invoices`, `events`:

**Generated metrics:**

- `total_users` = `COUNT(users.id)` — Total registered users
- `active_subscriptions` = `COUNT(subscriptions.id) WHERE status = 'active'` — Active subscription count
- `total_revenue` = `SUM(invoices.amount)` — Total invoice revenue
- `event_count` = `COUNT(events.id)` — Total tracked events

**Generated dimensions:**

- `signup_date` (temporal) — from `users.created_at`
- `subscription_plan` (categorical) — from `subscriptions.plan_type`
- `country` (geographic) — from `users.country`
- `event_type` (categorical) — from `events.type`

**Generated entities:**

- `users` → `subscriptions` (one-to-many via `user_id`)
- `users` → `invoices` (one-to-many via `user_id`)
- `subscriptions` → `invoices` (one-to-many via `subscription_id`)

---

## Registry Implementation

The `SemanticRegistry` class provides in-memory lookup with two loading paths:

```typescript
// Load from YAML files (development)
const registry = await loadRegistry(definitionsDir);

// Load from database (production)
const registry = createRegistry();
registry.loadFromMetadata(semanticMetadata);
```

Both paths produce the same in-memory structure:

- **Metrics map** — name → `MetricDefinition` (with synonym index)
- **Dimensions map** — name → `DimensionDefinition` (with synonym index)
- **Relationships array** — `EntityRelationship[]` for JOIN resolution

The registry exports `SemanticMetadata` for use by agents via `toSemanticMetadata()`.

---

## Key Design Decisions

- **Who maintains this layer?** — Auto-generated by LLM from schema introspection, editable by users
- **Granularity of definitions** — The semantic-generator agent makes reasonable defaults; users can refine
- **Multi-tenant** — Each user's connection has its own semantic layer, stored independently in Supabase
- **Versioning** — Schema snapshots (`raw_schema`) are preserved for comparison; regeneration is always available
- **Backward compatibility** — YAML-based loading remains for local development
