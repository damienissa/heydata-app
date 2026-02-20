import type { SemanticMetadata } from "@heydata/shared";

/**
 * Mock semantic metadata for testing the agent pipeline
 * Represents a typical e-commerce analytics setup
 */
export const mockSemanticMetadata: SemanticMetadata = {
  metrics: [
    {
      name: "revenue",
      displayName: "Revenue",
      description: "Total revenue from completed orders",
      formula: "SUM(orders.total_amount)",
      grain: "daily",
      dimensions: ["date", "product_category", "region", "customer_segment"],
      synonyms: ["sales", "income", "total sales"],
      formatting: {
        type: "currency",
        currencyCode: "USD",
        decimalPlaces: 2,
      },
    },
    {
      name: "order_count",
      displayName: "Order Count",
      description: "Number of completed orders",
      formula: "COUNT(DISTINCT orders.order_id)",
      grain: "daily",
      dimensions: ["date", "product_category", "region", "customer_segment"],
      synonyms: ["orders", "transactions", "number of orders"],
      formatting: {
        type: "number",
        decimalPlaces: 0,
      },
    },
    {
      name: "average_order_value",
      displayName: "Average Order Value",
      description: "Average value per order",
      formula: "SUM(orders.total_amount) / COUNT(DISTINCT orders.order_id)",
      grain: "daily",
      dimensions: ["date", "product_category", "region", "customer_segment"],
      synonyms: ["AOV", "avg order", "average transaction"],
      formatting: {
        type: "currency",
        currencyCode: "USD",
        decimalPlaces: 2,
      },
    },
    {
      name: "customer_count",
      displayName: "Unique Customers",
      description: "Number of unique customers who placed orders",
      formula: "COUNT(DISTINCT orders.customer_id)",
      grain: "daily",
      dimensions: ["date", "region", "customer_segment"],
      synonyms: ["customers", "unique buyers", "buyers"],
      formatting: {
        type: "number",
        decimalPlaces: 0,
      },
    },
    {
      name: "conversion_rate",
      displayName: "Conversion Rate",
      description: "Percentage of sessions that resulted in a purchase",
      formula: "COUNT(DISTINCT orders.order_id) / COUNT(DISTINCT sessions.session_id) * 100",
      grain: "daily",
      dimensions: ["date", "region", "traffic_source"],
      synonyms: ["cvr", "purchase rate"],
      formatting: {
        type: "percentage",
        decimalPlaces: 2,
      },
    },
  ],
  dimensions: [
    {
      name: "date",
      displayName: "Date",
      description: "Order date",
      table: "orders",
      column: "order_date",
      type: "date",
      synonyms: ["day", "order date", "time"],
    },
    {
      name: "product_category",
      displayName: "Product Category",
      description: "Main product category",
      table: "products",
      column: "category",
      type: "string",
      synonyms: ["category", "product type"],
    },
    {
      name: "region",
      displayName: "Region",
      description: "Customer geographic region",
      table: "customers",
      column: "region",
      type: "string",
      synonyms: ["geography", "location", "area"],
    },
    {
      name: "customer_segment",
      displayName: "Customer Segment",
      description: "Customer segmentation tier",
      table: "customers",
      column: "segment",
      type: "string",
      synonyms: ["segment", "tier", "customer type"],
    },
    {
      name: "traffic_source",
      displayName: "Traffic Source",
      description: "Marketing channel that drove the session",
      table: "sessions",
      column: "traffic_source",
      type: "string",
      synonyms: ["channel", "source", "utm_source"],
    },
  ],
  relationships: [
    {
      from: { table: "orders", column: "customer_id" },
      to: { table: "customers", column: "customer_id" },
      type: "one-to-many",
      joinType: "left",
    },
    {
      from: { table: "order_items", column: "order_id" },
      to: { table: "orders", column: "order_id" },
      type: "one-to-many",
      joinType: "inner",
    },
    {
      from: { table: "order_items", column: "product_id" },
      to: { table: "products", column: "product_id" },
      type: "one-to-many",
      joinType: "left",
    },
    {
      from: { table: "sessions", column: "customer_id" },
      to: { table: "customers", column: "customer_id" },
      type: "one-to-many",
      joinType: "left",
    },
  ],
  synonyms: {
    revenue: ["sales", "income", "earnings", "total sales"],
    orders: ["transactions", "purchases"],
    customers: ["buyers", "users", "clients"],
  },
};
