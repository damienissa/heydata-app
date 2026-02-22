import type { DatabaseAdapter, AdapterPool, AdapterConnectionConfig } from "./adapter.js";
import { postgresqlAdapter } from "./adapters/postgresql.js";
import { connectionError } from "./errors.js";

interface ManagedPool {
  pool: AdapterPool;
  adapter: DatabaseAdapter;
  lastUsedAt: number;
}

/**
 * Dynamic pool manager — creates, caches, and disposes adapter pools
 * keyed by connection ID.
 */
export class PoolManager {
  private pools = new Map<string, ManagedPool>();
  private adapters = new Map<string, DatabaseAdapter>();

  /** How long an idle pool stays alive before being disposed (default: 10 min) */
  private idleTimeoutMs: number;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(opts?: { idleTimeoutMs?: number }) {
    this.idleTimeoutMs = opts?.idleTimeoutMs ?? 10 * 60 * 1000;

    // Register built-in adapters
    this.registerAdapter(postgresqlAdapter);
  }

  /** Register a database adapter */
  registerAdapter(adapter: DatabaseAdapter): void {
    this.adapters.set(adapter.dbType, adapter);
  }

  /** Get the adapter for a given database type */
  getAdapter(dbType: string): DatabaseAdapter {
    const adapter = this.adapters.get(dbType);
    if (!adapter) {
      throw connectionError(`No adapter registered for database type: ${dbType}`);
    }
    return adapter;
  }

  /**
   * Get or create a pool for a given connection ID.
   * If a pool already exists for this ID, it is reused.
   */
  async getPool(
    connectionId: string,
    dbType: string,
    config: AdapterConnectionConfig,
  ): Promise<{ pool: AdapterPool; adapter: DatabaseAdapter }> {
    const existing = this.pools.get(connectionId);
    if (existing) {
      existing.lastUsedAt = Date.now();
      return { pool: existing.pool, adapter: existing.adapter };
    }

    const adapter = this.getAdapter(dbType);
    const pool = await adapter.connect(connectionId, config);

    this.pools.set(connectionId, {
      pool,
      adapter,
      lastUsedAt: Date.now(),
    });

    // Start cleanup timer if not already running
    if (!this.cleanupTimer) {
      this.cleanupTimer = setInterval(() => this.cleanupIdle(), 60_000);
      // Allow the process to exit even if the timer is running
      if (this.cleanupTimer.unref) {
        this.cleanupTimer.unref();
      }
    }

    return { pool, adapter };
  }

  /** Dispose a specific pool by connection ID */
  async disposePool(connectionId: string): Promise<void> {
    const managed = this.pools.get(connectionId);
    if (managed) {
      await managed.adapter.dispose(managed.pool);
      this.pools.delete(connectionId);
    }
  }

  /** Dispose all pools */
  async disposeAll(): Promise<void> {
    const disposals = Array.from(this.pools.entries()).map(([id, managed]) =>
      managed.adapter.dispose(managed.pool).then(() => this.pools.delete(id)),
    );
    await Promise.allSettled(disposals);
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /** Remove pools that have been idle longer than the threshold */
  private async cleanupIdle(): Promise<void> {
    const now = Date.now();
    for (const [id, managed] of this.pools.entries()) {
      if (now - managed.lastUsedAt > this.idleTimeoutMs) {
        await managed.adapter.dispose(managed.pool).catch(() => {});
        this.pools.delete(id);
      }
    }
    // Stop the timer if there are no more pools
    if (this.pools.size === 0 && this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /** Number of active pools */
  get size(): number {
    return this.pools.size;
  }
}

/** Singleton pool manager */
let _poolManager: PoolManager | null = null;

export function getPoolManager(): PoolManager {
  if (!_poolManager) {
    _poolManager = new PoolManager();
  }
  return _poolManager;
}
