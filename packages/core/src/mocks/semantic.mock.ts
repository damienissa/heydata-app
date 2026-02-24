import type { SemanticMetadata } from "@heydata/shared";

/**
 * Mock semantic metadata for testing the agent pipeline
 * Represents a typical e-commerce analytics setup
 */
export const mockSemanticMetadata: SemanticMetadata = {
  semanticMarkdown: `# Semantic Layer

## Overview
E-commerce analytics database tracking orders, customers, products, and sessions.

## Tables

### orders
**Purpose**: Completed customer orders | **Primary Key**: \`order_id\`
**Columns**: \`order_id\` (uuid PK), \`customer_id\` (uuid FK→customers), \`total_amount\` (numeric), \`order_date\` (date), \`status\` (text)

### customers
**Purpose**: Customer profiles and segmentation | **Primary Key**: \`customer_id\`
**Columns**: \`customer_id\` (uuid PK), \`region\` (text), \`segment\` (text), \`email\` (text), \`created_at\` (timestamptz)

### order_items
**Purpose**: Line items within each order | **Primary Key**: \`item_id\`
**Columns**: \`item_id\` (uuid PK), \`order_id\` (uuid FK→orders), \`product_id\` (uuid FK→products), \`quantity\` (integer), \`unit_price\` (numeric)

### products
**Purpose**: Product catalog | **Primary Key**: \`product_id\`
**Columns**: \`product_id\` (uuid PK), \`name\` (text), \`category\` (text), \`price\` (numeric)

### sessions
**Purpose**: Website sessions and traffic attribution | **Primary Key**: \`session_id\`
**Columns**: \`session_id\` (uuid PK), \`customer_id\` (uuid FK→customers), \`traffic_source\` (text), \`duration_seconds\` (integer), \`started_at\` (timestamptz)

## Metrics

### revenue
- **Formula**: \`SUM(orders.total_amount)\`
- **Description**: Total revenue from completed orders
- **Synonyms**: sales, income, total sales

### order_count
- **Formula**: \`COUNT(DISTINCT orders.order_id)\`
- **Description**: Number of completed orders
- **Synonyms**: orders, transactions, number of orders

### average_order_value
- **Formula**: \`SUM(orders.total_amount) / COUNT(DISTINCT orders.order_id)\`
- **Description**: Average value per order
- **Synonyms**: AOV, avg order, average transaction

### customer_count
- **Formula**: \`COUNT(DISTINCT orders.customer_id)\`
- **Description**: Number of unique customers who placed orders
- **Synonyms**: customers, unique buyers, buyers

### conversion_rate
- **Formula**: \`COUNT(DISTINCT orders.order_id) / COUNT(DISTINCT sessions.session_id) * 100\`
- **Description**: Percentage of sessions that resulted in a purchase
- **Synonyms**: cvr, purchase rate

## Dimensions

### date
- **Source**: \`orders.order_date\` | **Type**: date | **Synonyms**: day, order date, time

### product_category
- **Source**: \`products.category\` | **Type**: string | **Synonyms**: category, product type

### region
- **Source**: \`customers.region\` | **Type**: string | **Synonyms**: geography, location, area

### customer_segment
- **Source**: \`customers.segment\` | **Type**: string | **Synonyms**: segment, tier, customer type

### traffic_source
- **Source**: \`sessions.traffic_source\` | **Type**: string | **Synonyms**: channel, source, utm_source

## Relationships
- \`orders\` → \`customers\`: many-to-one via \`orders.customer_id = customers.customer_id\`
- \`order_items\` → \`orders\`: many-to-one via \`order_items.order_id = orders.order_id\`
- \`order_items\` → \`products\`: many-to-one via \`order_items.product_id = products.product_id\`
- \`sessions\` → \`customers\`: many-to-one via \`sessions.customer_id = customers.customer_id\`

## Domain Knowledge
<!-- Add business context, rules, or notes here -->
`,
  rawSchemaDDL: `orders(order_id uuid PK, customer_id uuid FK->customers.customer_id, total_amount numeric NOT NULL, order_date date NOT NULL, status text)
customers(customer_id uuid PK, region text, segment text, email text, created_at timestamptz)
order_items(item_id uuid PK, order_id uuid FK->orders.order_id, product_id uuid FK->products.product_id, quantity integer NOT NULL, unit_price numeric NOT NULL)
products(product_id uuid PK, name text NOT NULL, category text, price numeric)
sessions(session_id uuid PK, customer_id uuid FK->customers.customer_id, traffic_source text, duration_seconds integer, started_at timestamptz)`,
};
