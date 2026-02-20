import { forbiddenOperationError } from "./errors.js";

/**
 * SQL keywords that are forbidden for security
 */
const FORBIDDEN_KEYWORDS = [
  "DROP",
  "DELETE",
  "TRUNCATE",
  "INSERT",
  "UPDATE",
  "ALTER",
  "CREATE",
  "GRANT",
  "REVOKE",
  "EXEC",
  "EXECUTE",
  "CALL",
  "INTO OUTFILE",
  "INTO DUMPFILE",
  "LOAD_FILE",
  "LOAD DATA",
  "COPY",
  "VACUUM",
  "ANALYZE",
  "REINDEX",
  "CLUSTER",
];

/**
 * Check SQL for forbidden operations
 */
export function validateSql(sql: string): void {
  const upperSql = sql.toUpperCase();

  for (const keyword of FORBIDDEN_KEYWORDS) {
    // Use word boundary to avoid false positives
    const regex = new RegExp(`\\b${keyword}\\b`, "i");
    if (regex.test(sql)) {
      throw forbiddenOperationError(keyword);
    }
  }

  // Check for multiple statements (potential SQL injection)
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (statements.length > 1) {
    throw forbiddenOperationError("Multiple statements");
  }

  // Must start with SELECT or WITH (for CTEs)
  const trimmed = sql.trim().toUpperCase();
  if (!trimmed.startsWith("SELECT") && !trimmed.startsWith("WITH")) {
    throw forbiddenOperationError("Only SELECT queries are allowed");
  }
}

/**
 * Inject a LIMIT clause if not present
 */
export function injectLimit(sql: string, maxRows: number): string {
  const upperSql = sql.toUpperCase();

  // Check if LIMIT already exists
  if (upperSql.includes("LIMIT")) {
    return sql;
  }

  // Remove trailing semicolon if present
  let cleanSql = sql.trim();
  if (cleanSql.endsWith(";")) {
    cleanSql = cleanSql.slice(0, -1);
  }

  return `${cleanSql} LIMIT ${maxRows}`;
}

/**
 * Wrap query with timeout (PostgreSQL-specific)
 */
export function wrapWithTimeout(sql: string, timeoutMs: number): string {
  // PostgreSQL uses statement_timeout in milliseconds
  return `SET LOCAL statement_timeout = '${timeoutMs}ms'; ${sql}`;
}

/**
 * Configuration for SQL guards
 */
export interface GuardConfig {
  /** Maximum rows to return */
  maxRows?: number;
  /** Query timeout in milliseconds */
  timeoutMs?: number;
  /** Whether to validate SQL for forbidden operations */
  validateOperations?: boolean;
}

const DEFAULT_CONFIG: Required<GuardConfig> = {
  maxRows: 10000,
  timeoutMs: 30000,
  validateOperations: true,
};

/**
 * Apply all guards to a SQL query
 */
export function applySqlGuards(
  sql: string,
  config: GuardConfig = {},
): { sql: string; needsTimeout: boolean } {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  // Validate for forbidden operations
  if (mergedConfig.validateOperations) {
    validateSql(sql);
  }

  // Inject LIMIT if needed
  let guardedSql = injectLimit(sql, mergedConfig.maxRows);

  return {
    sql: guardedSql,
    needsTimeout: mergedConfig.timeoutMs > 0,
  };
}
