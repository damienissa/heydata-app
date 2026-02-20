import type { ResultSet, ColumnMetadata, Row } from "@heydata/shared";

/**
 * Mock bridge interface for testing
 */
export interface MockBridgeOptions {
  /** Simulated execution time in ms */
  executionTimeMs?: number;
  /** Whether to truncate results */
  truncate?: boolean;
  /** Custom result set to return */
  customResult?: ResultSet;
  /** Simulate an error */
  simulateError?: Error;
}

/**
 * Generate sample time series data
 */
function generateTimeSeriesData(
  startDate: Date,
  days: number,
  metrics: string[],
): Row[] {
  const rows: Row[] = [];
  const baseValues: Record<string, number> = {
    revenue: 50000,
    order_count: 150,
    average_order_value: 333,
    customer_count: 100,
  };

  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);

    const row: Row = {
      date: date.toISOString().split("T")[0] ?? "",
    };

    for (const metric of metrics) {
      const base = baseValues[metric] ?? 100;
      // Add some variance and a slight upward trend
      const variance = (Math.random() - 0.5) * base * 0.3;
      const trend = (i / days) * base * 0.1;
      const weekendDip = [0, 6].includes(date.getDay()) ? -base * 0.15 : 0;
      row[metric] = Math.round((base + variance + trend + weekendDip) * 100) / 100;
    }

    rows.push(row);
  }

  return rows;
}

/**
 * Generate sample categorical data
 */
function generateCategoricalData(
  dimensions: string[],
  metrics: string[],
): Row[] {
  const categoryValues: Record<string, string[]> = {
    product_category: ["Electronics", "Clothing", "Home & Garden", "Sports", "Books"],
    region: ["North America", "Europe", "Asia Pacific", "Latin America"],
    customer_segment: ["Premium", "Standard", "Basic"],
    traffic_source: ["Organic", "Paid Search", "Social", "Email", "Direct"],
  };

  const rows: Row[] = [];
  const primaryDimension = dimensions[0] ?? "product_category";
  const values = categoryValues[primaryDimension] ?? ["Category A", "Category B", "Category C"];

  for (const value of values) {
    const row: Row = {
      [primaryDimension]: value,
    };

    for (const metric of metrics) {
      row[metric] = Math.round(Math.random() * 100000) / 100;
    }

    rows.push(row);
  }

  return rows;
}

/**
 * Infer column metadata from SQL query
 */
function inferColumnsFromSql(sql: string): ColumnMetadata[] {
  const columns: ColumnMetadata[] = [];
  const upperSql = sql.toUpperCase();

  // Check for date column
  if (upperSql.includes("DATE") || upperSql.includes("ORDER_DATE")) {
    columns.push({
      name: "date",
      type: "date",
      displayName: "Date",
      semanticRole: "time",
    });
  }

  // Check for common metrics
  if (upperSql.includes("REVENUE") || upperSql.includes("TOTAL_AMOUNT")) {
    columns.push({
      name: "revenue",
      type: "number",
      displayName: "Revenue",
      semanticRole: "metric",
    });
  }

  if (upperSql.includes("COUNT") && upperSql.includes("ORDER")) {
    columns.push({
      name: "order_count",
      type: "number",
      displayName: "Order Count",
      semanticRole: "metric",
    });
  }

  // Check for dimensions
  if (upperSql.includes("CATEGORY")) {
    columns.push({
      name: "product_category",
      type: "string",
      displayName: "Product Category",
      semanticRole: "dimension",
    });
  }

  if (upperSql.includes("REGION")) {
    columns.push({
      name: "region",
      type: "string",
      displayName: "Region",
      semanticRole: "dimension",
    });
  }

  // Default columns if none detected
  if (columns.length === 0) {
    columns.push(
      { name: "date", type: "date", displayName: "Date", semanticRole: "time" },
      { name: "value", type: "number", displayName: "Value", semanticRole: "metric" },
    );
  }

  return columns;
}

/**
 * Mock bridge that simulates SQL execution
 */
export async function executeMockQuery(
  sql: string,
  options: MockBridgeOptions = {},
): Promise<ResultSet> {
  // Simulate execution time
  const executionTime = options.executionTimeMs ?? Math.random() * 100 + 50;
  await new Promise((resolve) => setTimeout(resolve, executionTime));

  // Simulate error if requested
  if (options.simulateError) {
    throw options.simulateError;
  }

  // Return custom result if provided
  if (options.customResult) {
    return options.customResult;
  }

  // Infer structure from SQL
  const columns = inferColumnsFromSql(sql);
  const hasDateColumn = columns.some((c) => c.type === "date");
  const metrics = columns.filter((c) => c.semanticRole === "metric").map((c) => c.name);
  const dimensions = columns.filter((c) => c.semanticRole === "dimension").map((c) => c.name);

  // Generate appropriate mock data
  let rows: Row[];
  if (hasDateColumn) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    rows = generateTimeSeriesData(startDate, 30, metrics);
  } else if (dimensions.length > 0) {
    rows = generateCategoricalData(dimensions, metrics);
  } else {
    rows = generateTimeSeriesData(new Date(), 7, metrics);
  }

  const truncated = options.truncate ?? false;
  const finalRows = truncated ? rows.slice(0, 100) : rows;

  return {
    columns,
    rows: finalRows,
    rowCount: finalRows.length,
    truncated,
    executionTimeMs: executionTime,
  };
}

/**
 * Create a mock bridge instance with configurable behavior
 */
export function createMockBridge(defaultOptions: MockBridgeOptions = {}) {
  return {
    execute: (sql: string, options?: MockBridgeOptions) =>
      executeMockQuery(sql, { ...defaultOptions, ...options }),
  };
}
