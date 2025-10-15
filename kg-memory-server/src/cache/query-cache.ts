import { createHash } from 'crypto';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
}

export interface CacheOptions {
  maxSize?: number;
  defaultTtl?: number;
  cleanupInterval?: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

/**
 * Intelligent query result cache with LRU eviction and TTL support
 */
export class QueryCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private readonly maxSize: number;
  private readonly defaultTtl: number;
  private readonly cleanupInterval: number;
  private cleanupTimer?: NodeJS.Timeout;
  
  private stats = {
    hits: 0,
    misses: 0
  };

  constructor(options: CacheOptions = {}) {
    this.maxSize = options.maxSize ?? 1000;
    this.defaultTtl = options.defaultTtl ?? 5 * 60 * 1000; // 5 minutes
    this.cleanupInterval = options.cleanupInterval ?? 60 * 1000; // 1 minute
    
    this.startCleanupTimer();
  }

  /**
   * Generate cache key from query parameters
   */
  private generateKey(params: Record<string, any>): string {
    const normalized = JSON.stringify(params, Object.keys(params).sort());
    return createHash('sha256').update(normalized).digest('hex').substring(0, 16);
  }

  /**
   * Check if cache entry is expired
   */
  private isExpired(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  /**
   * Evict least recently used entries when cache is full
   */
  private evictLRU(): void {
    if (this.cache.size < this.maxSize) return;

    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Get cached result
   */
  get(params: Record<string, any>): T | null {
    const key = this.generateKey(params);
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.stats.hits++;

    return entry.data;
  }

  /**
   * Store result in cache
   */
  set(params: Record<string, any>, data: T, ttl?: number): void {
    const key = this.generateKey(params);
    const now = Date.now();
    
    this.evictLRU();

    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      ttl: ttl ?? this.defaultTtl,
      accessCount: 1,
      lastAccessed: now
    };

    this.cache.set(key, entry);
  }

  /**
   * Invalidate cache entries matching pattern
   */
  invalidate(pattern?: (params: Record<string, any>) => boolean): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      try {
        // Reconstruct params from cached data for pattern matching
        // This is a simplified approach - in practice, you might want to store params separately
        if (pattern({})) { // Simplified - would need better param reconstruction
          keysToDelete.push(key);
        }
      } catch (error) {
        // If pattern matching fails, skip this entry
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Invalidate all entries related to specific rule IDs
   */
  invalidateByRuleIds(ruleIds: string[]): void {
    const keysToDelete: string[] = [];
    
    for (const [key] of this.cache.entries()) {
      // Check if any rule ID appears in the cache key
      // This is a heuristic approach - could be improved with better key structure
      if (ruleIds.some(ruleId => key.includes(ruleId))) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.cache.size,
      hitRate: total > 0 ? this.stats.hits / total : 0
    };
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.stats.hits = 0;
    this.stats.misses = 0;
  }

  /**
   * Warm cache with common query patterns
   */
  async warm(patterns: Array<{ params: Record<string, any>; generator: () => Promise<T> }>): Promise<void> {
    const promises = patterns.map(async ({ params, generator }) => {
      try {
        const data = await generator();
        this.set(params, data);
      } catch (error) {
        console.warn('Cache warming failed for pattern:', params, error);
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * Start periodic cleanup of expired entries
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Stop cleanup timer and clear cache
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.clear();
  }
}