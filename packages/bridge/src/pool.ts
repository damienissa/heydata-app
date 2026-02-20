import pg from "pg";
import { connectionError } from "./errors.js";

const { Pool } = pg;

/**
 * Connection configuration
 */
export interface PoolConfig {
  /** PostgreSQL connection string */
  connectionString?: string;
  /** Database host */
  host?: string;
  /** Database port */
  port?: number;
  /** Database name */
  database?: string;
  /** Database user */
  user?: string;
  /** Database password */
  password?: string;
  /** SSL configuration */
  ssl?: boolean | { rejectUnauthorized?: boolean };
  /** Maximum number of clients in the pool */
  max?: number;
  /** Idle timeout in milliseconds */
  idleTimeoutMillis?: number;
  /** Connection timeout in milliseconds */
  connectionTimeoutMillis?: number;
}

const DEFAULT_CONFIG: Partial<PoolConfig> = {
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

/**
 * Create a connection pool from configuration
 */
export function createPool(config: PoolConfig): pg.Pool {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  try {
    return new Pool(mergedConfig);
  } catch (error) {
    throw connectionError(
      `Failed to create connection pool: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error : undefined,
    );
  }
}

/**
 * Create a connection pool from environment variables
 *
 * Reads from:
 * - DATABASE_URL (connection string)
 * - PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD
 */
export function createPoolFromEnv(): pg.Pool {
  const connectionString = process.env["DATABASE_URL"];

  if (connectionString) {
    return createPool({ connectionString });
  }

  const host = process.env["PGHOST"];
  const port = process.env["PGPORT"] ? parseInt(process.env["PGPORT"], 10) : undefined;
  const database = process.env["PGDATABASE"];
  const user = process.env["PGUSER"];
  const password = process.env["PGPASSWORD"];

  if (!host && !database) {
    throw connectionError(
      "No database configuration found. Set DATABASE_URL or PG* environment variables.",
    );
  }

  return createPool({ host, port, database, user, password });
}

/**
 * Test the connection pool
 */
export async function testConnection(pool: pg.Pool): Promise<boolean> {
  try {
    const client = await pool.connect();
    try {
      await client.query("SELECT 1");
      return true;
    } finally {
      client.release();
    }
  } catch (error) {
    throw connectionError(
      `Connection test failed: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error : undefined,
    );
  }
}
