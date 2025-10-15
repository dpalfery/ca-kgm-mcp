import { QueryCache, CacheOptions, CacheStats } from './query-cache.js';
import { RankedDirective, TaskContext } from '../types.js';

export interface QueryDirectivesResult {
  context_block: string;
  citations: any[];
  diagnostics: any;
}

export interface DetectContextResult {
  detectedLayer: string;
  topics: string[];
  keywords?: string[];
  confidence: number;
}

/**
 * Centralized cache manager for different query types
 */
export class CacheManager {
  private directivesCache: QueryCache<QueryDirectivesResult>;
  private contextCache: QueryCache<DetectContextResult>;
  private rankingCache: QueryCache<RankedDirective[]>;

  constructor(options: CacheOptions = {}) {
    // Different TTLs for different cache types
    this.directivesCache = new QueryCache<QueryDirectivesResult>({
      ...options,
      defaultTtl: options.defaultTtl ?? 10 * 60 * 1000, // 10 minutes for directive queries
    });

    this.contextCache = new QueryCache<DetectContextResult>({
      ...options,
      defaultTtl: options.defaultTtl ?? 30 * 60 * 1000, // 30 minutes for context detection
    });

    this.rankingCache = new QueryCache<RankedDirective[]>({
      ...options,
      defaultTtl: options.defaultTtl ?? 5 * 60 * 1000, // 5 minutes for ranking results
    });
  }

  /**
   * Cache directive query results
   */
  cacheDirectiveQuery(
    taskDescription: string,
    modeSlug: string | undefined,
    options: any,
    result: QueryDirectivesResult
  ): void {
    const params = {
      type: 'directives',
      taskDescription,
      modeSlug: modeSlug ?? 'default',
      options: options ?? {}
    };
    
    this.directivesCache.set(params, result);
  }

  /**
   * Get cached directive query results
   */
  getCachedDirectiveQuery(
    taskDescription: string,
    modeSlug: string | undefined,
    options: any
  ): QueryDirectivesResult | null {
    const params = {
      type: 'directives',
      taskDescription,
      modeSlug: modeSlug ?? 'default',
      options: options ?? {}
    };
    
    return this.directivesCache.get(params);
  }

  /**
   * Cache context detection results
   */
  cacheContextDetection(
    text: string,
    options: any,
    result: DetectContextResult
  ): void {
    const params = {
      type: 'context',
      text,
      options: options ?? {}
    };
    
    this.contextCache.set(params, result);
  }

  /**
   * Get cached context detection results
   */
  getCachedContextDetection(
    text: string,
    options: any
  ): DetectContextResult | null {
    const params = {
      type: 'context',
      text,
      options: options ?? {}
    };
    
    return this.contextCache.get(params);
  }

  /**
   * Cache ranking results
   */
  cacheRankingResult(
    context: TaskContext,
    candidates: any[],
    options: any,
    result: RankedDirective[]
  ): void {
    const params = {
      type: 'ranking',
      context,
      candidateCount: candidates.length,
      candidateIds: candidates.map(c => c.id).sort(),
      options: options ?? {}
    };
    
    this.rankingCache.set(params, result);
  }

  /**
   * Get cached ranking results
   */
  getCachedRankingResult(
    context: TaskContext,
    candidates: any[],
    options: any
  ): RankedDirective[] | null {
    const params = {
      type: 'ranking',
      context,
      candidateCount: candidates.length,
      candidateIds: candidates.map(c => c.id).sort(),
      options: options ?? {}
    };
    
    return this.rankingCache.get(params);
  }

  /**
   * Invalidate cache when rules are updated
   */
  invalidateOnRuleUpdate(ruleIds: string[]): void {
    // Invalidate directive queries that might be affected by rule changes
    this.directivesCache.invalidateByRuleIds(ruleIds);
    
    // Ranking results are also affected by rule changes
    this.rankingCache.invalidateByRuleIds(ruleIds);
    
    // Context detection is generally not affected by rule updates
    // so we don't invalidate the context cache
  }

  /**
   * Warm cache with common query patterns
   */
  async warmCache(patterns: {
    commonTasks?: string[];
    commonContexts?: string[];
    generateDirectives?: (task: string) => Promise<QueryDirectivesResult>;
    generateContext?: (text: string) => Promise<DetectContextResult>;
  }): Promise<void> {
    const promises: Promise<void>[] = [];

    // Warm directive cache
    if (patterns.commonTasks && patterns.generateDirectives) {
      const directivePatterns = patterns.commonTasks.map(task => ({
        params: {
          type: 'directives',
          taskDescription: task,
          modeSlug: 'default',
          options: {}
        },
        generator: () => patterns.generateDirectives!(task)
      }));
      
      promises.push(this.directivesCache.warm(directivePatterns));
    }

    // Warm context cache
    if (patterns.commonContexts && patterns.generateContext) {
      const contextPatterns = patterns.commonContexts.map(text => ({
        params: {
          type: 'context',
          text,
          options: {}
        },
        generator: () => patterns.generateContext!(text)
      }));
      
      promises.push(this.contextCache.warm(contextPatterns));
    }

    await Promise.allSettled(promises);
  }

  /**
   * Get comprehensive cache statistics
   */
  getStats(): {
    directives: CacheStats;
    context: CacheStats;
    ranking: CacheStats;
    overall: CacheStats;
  } {
    const directiveStats = this.directivesCache.getStats();
    const contextStats = this.contextCache.getStats();
    const rankingStats = this.rankingCache.getStats();

    const totalHits = directiveStats.hits + contextStats.hits + rankingStats.hits;
    const totalMisses = directiveStats.misses + contextStats.misses + rankingStats.misses;
    const totalRequests = totalHits + totalMisses;

    return {
      directives: directiveStats,
      context: contextStats,
      ranking: rankingStats,
      overall: {
        hits: totalHits,
        misses: totalMisses,
        size: directiveStats.size + contextStats.size + rankingStats.size,
        hitRate: totalRequests > 0 ? totalHits / totalRequests : 0
      }
    };
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    this.directivesCache.clear();
    this.contextCache.clear();
    this.rankingCache.clear();
  }

  /**
   * Destroy all caches and cleanup resources
   */
  destroy(): void {
    this.directivesCache.destroy();
    this.contextCache.destroy();
    this.rankingCache.destroy();
  }
}