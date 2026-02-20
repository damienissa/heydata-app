// Pool
export {
  createPool,
  createPoolFromEnv,
  testConnection,
  type PoolConfig,
} from "./pool.js";

// Guards
export {
  validateSql,
  injectLimit,
  wrapWithTimeout,
  applySqlGuards,
  type GuardConfig,
} from "./guards.js";

// Executor
export {
  executeQuery,
  createExecutor,
  type ExecutorConfig,
} from "./executor.js";

// Errors
export {
  connectionError,
  queryError,
  timeoutError,
  forbiddenOperationError,
} from "./errors.js";
