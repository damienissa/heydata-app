# Hey Data — Semantic Layer

The semantic layer (`@heydata/semantic`) is the **most critical layer** in the system. It bridges the gap between human language and database schema by maintaining a centralized, versioned vocabulary of business concepts.

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

## Key Design Decisions

- **Who maintains this layer?** — Analytics engineers, business users, or AI-assisted authoring?
- **Granularity of definitions** — How specific should metric definitions be? (e.g., separate metrics for gross vs. net revenue, or one metric with a filter parameter?)
- **Conflicting definitions** — How do you handle cases where different teams define the same metric differently?
- **Versioning** — How do changes to metric definitions affect historical query results and cached data?
- **Multi-tenant** — Can different teams have different semantic layers, or is there a single shared layer?
