import type { ResultSet, IntrospectedSchema } from "@heydata/shared";
import type { GuardConfig } from "./guards.js";

/**
 * Opaque pool handle — each adapter defines its own pool type.
 */
export type AdapterPool = {
  /** Unique identifier for this pool (usually connection ID) */
  id: string;
  /** The underlying connection pool (adapter-specific) */
  _pool: unknown;
};

/**
 * Configuration for creating an adapter pool.
 */
export interface AdapterConnectionConfig {
  connectionString: string;
  sslEnabled?: boolean;
  maxPoolSize?: number;
  idleTimeoutMs?: number;
  connectionTimeoutMs?: number;
}

/**
 * Database adapter interface.
 * Each supported database type implements this interface.
 */
export interface DatabaseAdapter {
  /** Human-readable adapter name (e.g. "PostgreSQL") */
  readonly name: string;

  /** Database type identifier */
  readonly dbType: string;

  /** Create a connection pool */
  connect(id: string, config: AdapterConnectionConfig): Promise<AdapterPool>;

  /** Execute a SQL query and return a ResultSet */
  execute(
    pool: AdapterPool,
    sql: string,
    params?: unknown[],
    guards?: GuardConfig,
  ): Promise<ResultSet>;

  /** Introspect the database schema */
  introspect(pool: AdapterPool): Promise<IntrospectedSchema>;

  /** Test if the connection is alive */
  testConnection(pool: AdapterPool): Promise<boolean>;

  /** Dispose a connection pool */
  dispose(pool: AdapterPool): Promise<void>;
}
