import { HeyDataError } from "@heydata/shared";

/**
 * Create a connection failed error
 */
export function connectionError(message: string, cause?: Error): HeyDataError {
  return new HeyDataError("CONNECTION_FAILED", message, {
    agent: "bridge",
    cause,
  });
}

/**
 * Create a query execution error
 */
export function queryError(message: string, cause?: Error): HeyDataError {
  return new HeyDataError("QUERY_EXECUTION_FAILED", message, {
    agent: "bridge",
    cause,
  });
}

/**
 * Create a query timeout error
 */
export function timeoutError(timeoutMs: number): HeyDataError {
  return new HeyDataError(
    "QUERY_TIMEOUT",
    `Query exceeded timeout of ${timeoutMs}ms`,
    { agent: "bridge" },
  );
}

/**
 * Create a forbidden operation error
 */
export function forbiddenOperationError(operation: string): HeyDataError {
  return new HeyDataError(
    "SQL_FORBIDDEN_OPERATION",
    `Forbidden SQL operation: ${operation}`,
    { agent: "bridge" },
  );
}
