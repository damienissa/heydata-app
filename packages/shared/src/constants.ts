import type { WarehouseDialect } from "./types/agent.js";

/** Maximum SQL generation → validation retry attempts */
export const MAX_SQL_RETRIES = 3;

/** Maximum data validation → SQL regeneration retry attempts */
export const MAX_DATA_VALIDATION_RETRIES = 2;

/** Default query timeout in milliseconds (30 seconds) */
export const DEFAULT_QUERY_TIMEOUT_MS = 30_000;

/** Default row limit injected if LIMIT is absent */
export const DEFAULT_ROW_LIMIT = 10_000;

/** Warehouse dialects supported by the bridge */
export const SUPPORTED_DIALECTS: readonly WarehouseDialect[] = [
  "postgresql",
  "bigquery",
  "snowflake",
  "redshift",
  "databricks",
] as const;
