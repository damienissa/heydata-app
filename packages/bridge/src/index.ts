// Pool (legacy — kept for backward compat)
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

// Executor (legacy — kept for backward compat)
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

// Adapter interface
export {
  type DatabaseAdapter,
  type AdapterPool,
  type AdapterConnectionConfig,
} from "./adapter.js";

// Adapters
export { postgresqlAdapter } from "./adapters/postgresql.js";

// Pool manager
export { PoolManager, getPoolManager } from "./pool-manager.js";
