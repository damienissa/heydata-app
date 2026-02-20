# Getting Started with HeyData

This guide walks you through setting up HeyData to query your own database using natural language.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        @heydata/web                             │
│  Next.js app with chat UI and visualization components          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       @heydata/core                             │
│  AI Agent Pipeline (Intent → SQL → Validation → Analysis)       │
└─────────────────────────────────────────────────────────────────┘
                    │                   │
                    ▼                   ▼
┌─────────────────────────┐   ┌─────────────────────────┐
│   @heydata/semantic     │   │    @heydata/bridge      │
│  YAML metric/dimension  │   │   PostgreSQL executor   │
│     definitions         │   │   with SQL guards       │
└─────────────────────────┘   └─────────────────────────┘
                                        │
                                        ▼
                              ┌─────────────────────┐
                              │  Your Database      │
                              │  (Supabase/Postgres)│
                              └─────────────────────┘
```

---

## Step 1: Environment Setup

### 1.1 Install Dependencies

```bash
pnpm install
```

### 1.2 Create Environment File

Create `packages/web/.env.local`:

```env
# Required: Anthropic API key for AI agents
ANTHROPIC_API_KEY=sk-ant-api03-...

# Required: Your Supabase/PostgreSQL connection
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres

# Alternative: Individual connection params
# PGHOST=db.[PROJECT].supabase.co
# PGPORT=5432
# PGDATABASE=postgres
# PGUSER=postgres
# PGPASSWORD=your-password
```

### 1.3 Get Your Supabase Connection String

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings** → **Database**
4. Copy the **Connection string** (URI format)
5. Replace `[YOUR-PASSWORD]` with your database password

---

## Step 2: Define Your Semantic Layer

The semantic layer tells the AI what metrics and dimensions exist in your database.

### 2.1 Directory Structure

```
packages/semantic/definitions/
├── metrics/           # Your business metrics
│   ├── revenue.yml
│   └── orders.yml
├── dimensions/        # Columns to group/filter by
│   ├── date.yml
│   └── region.yml
└── entities/          # Table relationships
    ├── orders.yml
    └── customers.yml
```

### 2.2 Create a Metric Definition

Create `packages/semantic/definitions/metrics/your_metric.yml`:

```yaml
# Name used in queries (must be unique)
name: monthly_revenue

# Human-readable name shown in UI
displayName: Monthly Revenue

# Description helps the AI understand when to use this metric
description: Total revenue from completed orders, aggregated monthly

# SQL formula - use actual table.column names from your database
formula: SUM(orders.total_amount)

# Time granularity (optional)
grain: monthly

# Which dimensions can this metric be broken down by?
dimensions:
  - date
  - product_category
  - region
  - customer_type

# Alternative names users might say (helps AI matching)
synonyms:
  - revenue
  - sales
  - income
  - total sales

# How to format the output
formatting:
  type: currency
  currencyCode: USD
  decimalPlaces: 2

# Optional metadata
owner: analytics-team
tags:
  - finance
  - core-kpi
```

### 2.3 Create a Dimension Definition

Create `packages/semantic/definitions/dimensions/your_dimension.yml`:

```yaml
name: product_category

displayName: Product Category

description: Main category of the product

# Actual table and column in your database
table: products
column: category_name

# Data type: string, number, date, boolean
type: string

# Alternative names
synonyms:
  - category
  - product type
  - item category

formatting:
  type: text

owner: analytics-team
tags:
  - products
```

### 2.4 Create Entity Relationships

Create `packages/semantic/definitions/entities/your_table.yml`:

```yaml
name: orders

# Actual table name in your database
table: orders

description: Customer orders

# Primary key column
primaryKey: id

# Relationships to other tables
relationships:
  - target: customers        # Target entity name
    foreignKey: customer_id  # Column in this table
    targetKey: id            # Column in target table
    type: one-to-many        # one-to-one, one-to-many, many-to-many
    joinType: left           # inner, left, right, full

  - target: products
    foreignKey: product_id
    targetKey: id
    type: one-to-many
    joinType: left

owner: analytics-team
```

### 2.5 Example: Supabase E-commerce Schema

If your Supabase has these tables:

```sql
-- orders table
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  total_amount DECIMAL,
  status TEXT,
  created_at TIMESTAMPTZ
);

-- customers table
CREATE TABLE customers (
  id UUID PRIMARY KEY,
  email TEXT,
  region TEXT,
  segment TEXT
);
```

Create these definitions:

**metrics/revenue.yml:**
```yaml
name: revenue
displayName: Revenue
description: Total revenue from orders
formula: SUM(orders.total_amount)
grain: daily
dimensions: [date, region, customer_segment]
synonyms: [sales, income]
formatting:
  type: currency
  currencyCode: USD
```

**dimensions/date.yml:**
```yaml
name: date
displayName: Date
description: Order creation date
table: orders
column: created_at
type: date
synonyms: [day, time, when]
```

**dimensions/region.yml:**
```yaml
name: region
displayName: Region
description: Customer region
table: customers
column: region
type: string
synonyms: [location, area, geography]
```

**entities/orders.yml:**
```yaml
name: orders
table: orders
primaryKey: id
relationships:
  - target: customers
    foreignKey: customer_id
    targetKey: id
    type: one-to-many
    joinType: left
```

---

## Step 3: Connect Your Database

### 3.1 Update the Orchestrator

Edit `packages/web/src/lib/orchestrator.ts`:

```typescript
import { createOrchestrator } from "@heydata/core";
import { loadRegistry } from "@heydata/semantic";
import { createPool, createExecutor } from "@heydata/bridge";
import { join } from "node:path";

// Load semantic layer from YAML files
const registry = await loadRegistry(
  join(process.cwd(), "../semantic/definitions")
);

// Create database connection pool
const pool = createPool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Required for Supabase
  max: 10,
});

// Create query executor with security guards
const executeQuery = createExecutor(pool, {
  maxRows: 10000,      // Limit results
  timeoutMs: 30000,    // 30 second timeout
  validateOperations: true, // Block DROP, DELETE, etc.
});

// Create orchestrator
const orchestrator = createOrchestrator({
  apiKey: process.env.ANTHROPIC_API_KEY ?? "",
  model: "claude-sonnet-4-20250514",
  dialect: "postgresql",
});

export async function processQuery(request: { question: string }) {
  return orchestrator.process({
    question: request.question,
    semanticMetadata: registry.toSemanticMetadata(),
    executeQuery,
  });
}
```

### 3.2 SSL Configuration for Supabase

Supabase requires SSL. Add this to your pool config:

```typescript
const pool = createPool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Accept Supabase's certificate
  },
});
```

---

## Step 4: Test Your Setup

### 4.1 Start the Development Server

```bash
pnpm dev
```

### 4.2 Test the API Endpoint

```bash
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What was our revenue last month?"}'
```

### 4.3 Check the Response

A successful response looks like:

```json
{
  "requestId": "req_123...",
  "intent": {
    "queryType": "trend",
    "metrics": ["revenue"],
    "dimensions": ["date"],
    "timeRange": { "start": "2024-01-01", "end": "2024-01-31" }
  },
  "sql": {
    "sql": "SELECT date_trunc('day', created_at) as date, SUM(total_amount) as revenue FROM orders WHERE created_at >= '2024-01-01' GROUP BY 1",
    "dialect": "postgresql"
  },
  "results": {
    "columns": [...],
    "rows": [...],
    "rowCount": 31
  },
  "visualization": {
    "chartType": "line",
    "xAxis": { "dataKey": "date" },
    "series": [{ "dataKey": "revenue" }]
  },
  "narrative": "Revenue showed steady growth over the past month..."
}
```

---

## Step 5: Run the Full App

### 5.1 Build All Packages

```bash
pnpm build
```

### 5.2 Start Production Server

```bash
pnpm start
```

### 5.3 Open the App

Go to http://localhost:3000 and try asking:

- "Show me revenue for the last 30 days"
- "What's our average order value by region?"
- "Compare this month's sales to last month"

---

## Troubleshooting

### "Metric not found" Error

The AI couldn't match your question to a defined metric. Check:
1. Metric name in YAML matches what the AI is looking for
2. Add more synonyms to help matching
3. Make the description clearer

### "Connection failed" Error

Database connection issues. Check:
1. `DATABASE_URL` is correct in `.env.local`
2. Supabase project is not paused
3. SSL is enabled in pool config
4. IP is allowed in Supabase (Settings → Database → Connection Pooling)

### "Query timeout" Error

Query is too slow. Consider:
1. Add indexes to your database
2. Reduce `maxRows` in executor config
3. Increase `timeoutMs` for complex queries

### SQL Validation Failed

The generated SQL has issues. Check:
1. Table/column names in YAML match actual database
2. Relationships are correctly defined
3. Formula syntax is valid PostgreSQL

---

## Next Steps

1. **Add more metrics**: Define all KPIs your team cares about
2. **Tune synonyms**: Add terms your users actually say
3. **Set up access rules**: Restrict metrics by user role
4. **Add formatting**: Configure currency, percentage, date formats
5. **Create dashboards**: Combine multiple queries into views

---

## Command Reference

```bash
# Development
pnpm dev              # Start dev server
pnpm build            # Build all packages
pnpm test             # Run all tests
pnpm typecheck        # Check TypeScript

# Individual packages
pnpm --filter @heydata/core test
pnpm --filter @heydata/semantic build
pnpm --filter @heydata/bridge typecheck
```
