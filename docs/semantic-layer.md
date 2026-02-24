# Hey Data — Semantic Layer

The semantic layer (`@heydata/semantic`) is the **most critical layer** in the system. It bridges the gap between human language and database schema by maintaining a centralized vocabulary of business concepts.

Rather than encoding business logic in SQL queries, dashboard configs, or LLM prompts, Hey Data centralizes it here — making the entire system consistent and maintainable.

The semantic layer is stored as a **Markdown document** (`semantic_md`) in the `semantic_layers` table. This document is auto-generated from the database schema and can be freely edited by the user to add domain knowledge, correct assumptions, or document business rules.

---

## What the Semantic Layer Contains

The Markdown document is divided into structured sections, each serving a specific purpose:

### Overview

A 1-2 sentence description of what the database represents — the product, company, or domain context. Helps AI agents orient themselves before processing any query.

### Tables

A description of each table: its purpose, primary key, and key columns (with types and foreign key relationships). This gives agents precise table/column references to build correct SQL.

### Metrics

Named calculations with SQL formulas that answer business questions.

- Define what a number means and how to compute it
- Attached to specific dimensions for breakdown
- Include default filters (e.g., exclude cancelled orders)
- Carry synonyms for fuzzy natural-language matching
- Include formatting hints (currency, percentage, number)

Example:

```markdown
### total_revenue
- **Formula**: `SUM(invoices.amount)`
- **Description**: Total invoice revenue, net of refunds
- **Synonyms**: revenue, sales, income
- **Format**: currency_usd
```

### Dimensions

Categorization axes used to slice and group metrics.

- Mapped to a specific `table.column` source
- Typed (string, number, date, boolean)
- Include synonyms for natural-language matching

Example:

```markdown
### signup_date
- **Source**: `users.created_at`
- **Type**: date
- **Description**: Date when the user registered
- **Synonyms**: registration date, joined date, created at
```

### Relationships

How tables relate to each other — joins, foreign keys, and cardinality. Allows the SQL Generator to build correct multi-table queries without hardcoding joins.

Example:

```markdown
## Relationships
- `users` → `subscriptions`: one-to-many via `subscriptions.user_id = users.id`
- `users` → `invoices`: one-to-many via `invoices.user_id = users.id`
```

### Domain Knowledge

A free-form section for business context that doesn't fit a schema. This is the most powerful part of the semantic layer — users can document:

- How key metrics are calculated (e.g., "revenue is always net of refunds and taxes")
- What "active user" means in this specific business context
- Data quality notes or known quirks
- Business calendar definitions
- Seasonal patterns or special date ranges to be aware of
- Table-specific filters that should always be applied

This section is injected directly into every AI agent request, functioning as a **persistent instruction set** for all queries.

---

## Full Document Structure

```markdown
# Semantic Layer

## Overview
This database powers [company]'s [product] analytics. It tracks [main entities].

## Tables

### users
**Purpose**: Registered user accounts
**Primary Key**: `id`
**Columns**:
- `id` (uuid, PK)
- `email` (text)
- `created_at` (timestamptz)
- `country` (text)
- `plan_type` (text)

### subscriptions
**Purpose**: User subscription records
**Primary Key**: `id`
**Columns**:
- `id` (uuid, PK)
- `user_id` (uuid, FK → `users.id`)
- `status` (text)
- `plan` (text)
- `created_at` (timestamptz)

## Metrics

### total_users
- **Formula**: `COUNT(DISTINCT users.id)`
- **Description**: Total number of registered users
- **Synonyms**: user count, number of users, how many users

### active_subscriptions
- **Formula**: `COUNT(subscriptions.id) WHERE subscriptions.status = 'active'`
- **Description**: Currently active subscriptions
- **Synonyms**: active subs, current subscriptions, subscribers

## Dimensions

### signup_date
- **Source**: `users.created_at`
- **Type**: date
- **Description**: Date when the user registered
- **Synonyms**: registration date, joined date, created at

### plan_type
- **Source**: `subscriptions.plan`
- **Type**: string
- **Description**: Subscription plan tier
- **Synonyms**: plan, tier, subscription type

### country
- **Source**: `users.country`
- **Type**: string
- **Description**: User's country
- **Synonyms**: region, geo, location

## Relationships
- `users` → `subscriptions`: one-to-many via `subscriptions.user_id = users.id`
- `users` → `invoices`: one-to-many via `invoices.user_id = users.id`
- `subscriptions` → `invoices`: one-to-many via `invoices.subscription_id = subscriptions.id`

## Domain Knowledge
<!-- Add business-specific context below. Examples:
- Revenue always excludes trial periods and test accounts (email contains '+test')
- "Active user" means logged in within the last 30 days
- Subscription plan names: 'free', 'starter', 'pro', 'enterprise'
- Data before 2023-01-01 is unreliable due to a migration
-->
```

---

## How Agents Use the Semantic Layer

The entire Markdown document is injected as a **Semantic Layer Reference** block into the system prompt of each relevant agent. Agents use it as they would a project brief or specification document — reading it in full to understand the data model before generating SQL or interpreting results.

| Agent | How it uses the semantic layer |
| --- | --- |
| Intent Resolver | Matches user language to metric/dimension names and synonyms via full-document context |
| SQL Generator | Reads table structures, metric formulas, and relationships to build correct SQL |
| SQL Validator | Cross-checks generated SQL against table/column definitions in the document |
| Data Analyzer | Uses metric/dimension context to interpret statistics and identify insights |
| Narrative Agent | References metric descriptions and display names in generated summaries |

---

## Loading Modes

### 1. From Database (Primary — Production)

For user-connected databases, the semantic layer is **auto-generated** and stored in Supabase.

- Stored as `semantic_md TEXT` in the `semantic_layers` table
- Loaded at query time and passed directly to agents as a string
- Each connection has its own independent semantic layer
- Users can review and edit the document from the Settings UI

**Flow:**

```text
User connects DB → Schema introspection → semantic-generator agent → Markdown text → Supabase storage → Agent context
```

### 2. From YAML Files (Development)

For local development and testing, a simplified semantic layer can be loaded from YAML files on disk (legacy support).

---

## Auto-Generation from Schema

When a user connects a new database, Hey Data automatically generates a semantic layer using the `semantic-generator` agent in `@heydata/core`.

### How It Works

1. **Schema introspection** — The bridge queries `information_schema` on the user's database to discover all tables, columns (name, data type, nullable), primary keys, unique constraints, and foreign key relationships.

2. **LLM analysis** — The `semantic-generator` agent receives the introspected schema and produces a structured Markdown document covering:
   - Table descriptions with column listings
   - Meaningful aggregate metrics with SQL formulas (COUNT, SUM, AVG, etc.)
   - Dimensions mapped to specific `table.column` sources
   - Relationships derived from foreign keys
   - Natural language synonyms for fuzzy matching
   - An empty `## Domain Knowledge` section for the user to fill in

3. **Storage** — The generated Markdown is stored in Supabase `semantic_layers.semantic_md`.

4. **User review** — The user can review, edit, and regenerate the document via the onboarding wizard or the Settings UI.

---

## Editing the Semantic Layer

The Settings UI provides a **split-view editor** for editing the semantic layer:

- **Left panel**: Raw Markdown editor (textarea, monospace font)
- **Right panel**: Rendered Markdown preview — live updates as you type
- **Save** button: Persists changes to `semantic_layers.semantic_md`
- **Regenerate** button: Re-runs the semantic generator from scratch (prompts for confirmation, as this will overwrite any manual edits)

Accessible at: `/connections/[id]/semantic`

### What to edit

- **Correct metric formulas** — if the auto-generated formula is wrong, fix the SQL
- **Add synonyms** — teach the system your team's vocabulary
- **Document relationships** — add joins the generator missed
- **Fill in Domain Knowledge** — this is the highest-value section; document business rules that context-free SQL cannot capture

---

## Registry Implementation

The `SemanticRegistry` class provides a simple store for the Markdown document with two loading paths:

```typescript
// Load from YAML files (development)
const registry = await loadRegistry(definitionsDir);

// Load from database (production)
const registry = createRegistry();
registry.loadFromMetadata({ semantic_md: semanticMarkdown });
```

Both paths produce the same result: a registry that exports `SemanticMetadata` for use by agents via `toSemanticMetadata()`.

```typescript
export type SemanticMetadata = {
  semanticMarkdown: string;
  rawSchemaDDL?: string;
};
```

---

## Key Design Decisions

- **Markdown over JSON** — Markdown is LLM-native, human-readable, and expressive enough to capture business context that no schema can represent
- **Single source of truth** — One document per connection; no separate metrics/dimensions/entities arrays to keep in sync
- **Domain knowledge as instructions** — The `## Domain Knowledge` section functions as a persistent system prompt addition for every query
- **User-editable** — Non-engineers (data analysts, product managers) can understand and edit Markdown; they cannot edit JSON schemas
- **Multi-tenant** — Each user's connection has its own semantic layer stored independently in Supabase
- **Versioning** — `raw_schema` snapshot preserved for comparison; regeneration always available
