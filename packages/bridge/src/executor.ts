import type pg from "pg";
import type { ResultSet, ColumnMetadata, Row } from "@heydata/shared";
import { queryError, timeoutError } from "./errors.js";
import { applySqlGuards, type GuardConfig } from "./guards.js";

/**
 * Executor configuration
 */
export interface ExecutorConfig extends GuardConfig {
  /** Whether to truncate results flag */
  markTruncated?: boolean;
}

const DEFAULT_EXECUTOR_CONFIG: Required<ExecutorConfig> = {
  maxRows: 10000,
  timeoutMs: 30000,
  validateOperations: true,
  markTruncated: true,
};

/**
 * Map PostgreSQL type OID to our type system
 */
function mapPgType(typeId: number): ColumnMetadata["type"] {
  // PostgreSQL type OIDs
  // https://github.com/brianc/node-pg-types/blob/master/lib/builtins.js
  const typeMap: Record<number, ColumnMetadata["type"]> = {
    // Boolean
    16: "boolean",
    // Integer types
    20: "number", // int8
    21: "number", // int2
    23: "number", // int4
    26: "number", // oid
    // Float types
    700: "number", // float4
    701: "number", // float8
    1700: "number", // numeric
    // String types
    18: "string", // char
    19: "string", // name
    25: "string", // text
    1042: "string", // bpchar
    1043: "string", // varchar
    // Date/time types
    1082: "date", // date
    1083: "date", // time
    1114: "date", // timestamp
    1184: "date", // timestamptz
    // JSON types
    114: "string", // json
    3802: "string", // jsonb
    // UUID
    2950: "string", // uuid
  };

  return typeMap[typeId] ?? "string";
}

/**
 * Convert pg.QueryResult to our ResultSet format
 */
function toResultSet(
  result: pg.QueryResult,
  executionTimeMs: number,
  maxRows: number,
  markTruncated: boolean,
): ResultSet {
  // Build column metadata
  const columns: ColumnMetadata[] = result.fields.map((field) => ({
    name: field.name,
    type: mapPgType(field.dataTypeID),
    displayName: field.name,
  }));

  // Convert rows
  const rows: Row[] = result.rows.map((row: Record<string, unknown>) => {
    const converted: Row = {};
    for (const col of columns) {
      const value = row[col.name];
      if (value === null || value === undefined) {
        converted[col.name] = null;
      } else if (typeof value === "boolean") {
        converted[col.name] = value;
      } else if (typeof value === "number") {
        converted[col.name] = value;
      } else if (value instanceof Date) {
        converted[col.name] = value.toISOString();
      } else {
        converted[col.name] = String(value);
      }
    }
    return converted;
  });

  const truncated = markTruncated && result.rowCount !== null && result.rowCount >= maxRows;

  return {
    columns,
    rows,
    rowCount: rows.length,
    truncated,
    executionTimeMs,
  };
}

/**
 * Execute a SQL query and return a ResultSet
 */
export async function executeQuery(
  pool: pg.Pool,
  sql: string,
  params?: unknown[],
  config?: ExecutorConfig,
): Promise<ResultSet> {
  const mergedConfig = { ...DEFAULT_EXECUTOR_CONFIG, ...config };

  // Apply SQL guards
  const { sql: guardedSql } = applySqlGuards(sql, mergedConfig);

  const startTime = Date.now();

  try {
    // Get a client from the pool
    const client = await pool.connect();

    try {
      // Set statement timeout
      if (mergedConfig.timeoutMs > 0) {
        await client.query(`SET LOCAL statement_timeout = '${mergedConfig.timeoutMs}ms'`);
      }

      // Execute the query
      const result = await client.query(guardedSql, params);

      const executionTimeMs = Date.now() - startTime;

      return toResultSet(
        result,
        executionTimeMs,
        mergedConfig.maxRows,
        mergedConfig.markTruncated,
      );
    } finally {
      client.release();
    }
  } catch (error) {
    // Check for timeout error
    if (
      error instanceof Error &&
      (error.message.includes("canceling statement due to statement timeout") ||
        error.message.includes("statement timeout"))
    ) {
      throw timeoutError(mergedConfig.timeoutMs);
    }

    throw queryError(
      `Query execution failed: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error : undefined,
    );
  }
}

/**
 * Create an executor function bound to a pool
 */
export function createExecutor(
  pool: pg.Pool,
  defaultConfig?: ExecutorConfig,
): (sql: string, params?: unknown[]) => Promise<ResultSet> {
  return (sql: string, params?: unknown[]) => executeQuery(pool, sql, params, defaultConfig);
}
