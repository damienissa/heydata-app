# @heydata/semantic — Semantic Metadata Layer

**Layer 2** in the Hey Data system.

---

## Role

Define the business vocabulary — the single source of truth for what metrics and dimensions mean across the entire Hey Data system.

This is the **most critical layer**. It bridges the gap between human language and database schema. All business logic — formulas, joins, synonyms, access rules — lives here, not scattered across SQL queries or dashboard configurations.

---

## Responsibilities

- Define and store metric definitions (name, formula, grain, dimensions, filters, format)
- Define dimension catalog (categorization axes used to slice metrics)
- Define entity relationships (how tables join to each other)
- Maintain synonym and alias mappings (business language → technical names)
- Enforce access rules (which roles can see which metrics or data subsets)
- Provide formatting rules per metric (currency, decimals, date formats)
- Expose a query interface for other packages to look up definitions by name or concept
- Parse and validate metric definition files

---

## Contents

### Metrics

Named calculations with formulas, grain, and associated dimensions.

```
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

### Dimensions

Categorization axes: `region`, `product_category`, `customer_segment`, `channel`, `date`

### Entities & Relationships

Table relationships (joins, foreign keys, cardinality) that allow the SQL Generator to build correct multi-table queries.

### Synonyms & Aliases

- "sales" → `revenue`
- "last month" → prior calendar month date range logic
- "customers" → `users` table filtered to `account_type = 'customer'`

### Access Rules

Role-based and metric-level access controls applied at query time.

### Formatting Rules

Per-metric display configuration: currency, decimal precision, date format, percentage vs. absolute.

---

## Key Design Decisions

- **Authorship:** Who maintains this layer — analytics engineers, business users, or AI-assisted tooling?
- **Granularity:** How specific should metric definitions be? (e.g., separate metrics for gross and net revenue, or one metric with a parameter?)
- **Conflicting definitions:** How to resolve cases where different teams define the same metric differently?
- **Versioning:** How do changes to definitions affect historical query results and cached data?
- **Multi-tenant:** Can different teams have isolated semantic layers, or is there a single shared layer?

---

## Interfaces

**Consumed by `@heydata/core`:**
- Metric lookup by name or synonym
- Dimension lookup
- Join/relationship graph for SQL construction
- Access rule evaluation for a given user/role

**Shared types via `@heydata/shared`:**
- `MetricDefinition`
- `DimensionDefinition`
- `EntityRelationship`
- `AccessRule`
- `FormattingRule`
