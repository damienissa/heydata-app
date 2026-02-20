import type { OrchestratorResponse } from "@heydata/shared";

/**
 * Cache entry with expiration
 */
interface CacheEntry {
  response: OrchestratorResponse;
  expiresAt: number;
}

/**
 * Cache key components
 */
interface CacheKeyComponents {
  question: string;
  sessionId?: string;
  dialect: string;
}

/**
 * Simple in-memory cache for query results
 */
export class QueryCache {
  private cache: Map<string, CacheEntry>;
  private ttlMs: number;
  private maxSize: number;

  constructor(options: { ttlMs?: number; maxSize?: number } = {}) {
    this.cache = new Map();
    this.ttlMs = options.ttlMs ?? 5 * 60 * 1000; // 5 minutes default
    this.maxSize = options.maxSize ?? 100;
  }

  /**
   * Generate a cache key from components
   */
  private generateKey(components: CacheKeyComponents): string {
    const normalized = {
      question: components.question.toLowerCase().trim(),
      sessionId: components.sessionId ?? "",
      dialect: components.dialect,
    };
    return JSON.stringify(normalized);
  }

  /**
   * Get a cached response if available and not expired
   */
  get(components: CacheKeyComponents): OrchestratorResponse | undefined {
    const key = this.generateKey(components);
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.response;
  }

  /**
   * Store a response in the cache
   */
  set(
    components: CacheKeyComponents,
    response: OrchestratorResponse,
  ): void {
    // Evict oldest entries if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    const key = this.generateKey(components);
    this.cache.set(key, {
      response,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  /**
   * Invalidate a specific cache entry
   */
  invalidate(components: CacheKeyComponents): boolean {
    const key = this.generateKey(components);
    return this.cache.delete(key);
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get current cache size
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Clean up expired entries
   */
  prune(): number {
    const now = Date.now();
    let pruned = 0;

    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        pruned++;
      }
    }

    return pruned;
  }
}

/**
 * Create a shared cache instance
 */
export function createQueryCache(options?: {
  ttlMs?: number;
  maxSize?: number;
}): QueryCache {
  return new QueryCache(options);
}
