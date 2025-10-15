import { EventEmitter } from 'events';

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  tags?: Record<string, string>;
}

export interface QueryPerformanceData {
  queryId: string;
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

export interface PerformanceStats {
  totalQueries: number;
  averageLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  errorRate: number;
  throughput: number; // queries per second
  cacheHitRate: number;
}

export interface PerformanceThresholds {
  maxLatency: number;
  maxErrorRate: number;
  minThroughput: number;
  minCacheHitRate: number;
}

/**
 * Performance monitoring system for tracking query latency and system metrics
 */
export class PerformanceMonitor extends EventEmitter {
  private metrics: PerformanceMetric[] = [];
  private queryData: Map<string, QueryPerformanceData> = new Map();
  private recentQueries: QueryPerformanceData[] = [];
  private readonly maxMetricsHistory: number;
  private readonly maxQueryHistory: number;
  private thresholds: PerformanceThresholds;

  constructor(options: {
    maxMetricsHistory?: number;
    maxQueryHistory?: number;
    thresholds?: Partial<PerformanceThresholds>;
  } = {}) {
    super();
    
    this.maxMetricsHistory = options.maxMetricsHistory ?? 10000;
    this.maxQueryHistory = options.maxQueryHistory ?? 1000;
    this.thresholds = {
      maxLatency: 400, // 400ms
      maxErrorRate: 0.05, // 5%
      minThroughput: 10, // 10 queries/second
      minCacheHitRate: 0.7, // 70%
      ...options.thresholds
    };
  }

  /**
   * Start tracking a query operation
   */
  startQuery(operation: string, metadata?: Record<string, any>): string {
    const queryId = this.generateQueryId();
    const queryData: QueryPerformanceData = {
      queryId,
      operation,
      startTime: Date.now(),
      success: false,
      metadata
    };

    this.queryData.set(queryId, queryData);
    return queryId;
  }

  /**
   * End tracking a query operation
   */
  endQuery(queryId: string, success: boolean = true, error?: string): void {
    const queryData = this.queryData.get(queryId);
    if (!queryData) {
      console.warn(`Query ${queryId} not found in performance monitor`);
      return;
    }

    const endTime = Date.now();
    const duration = endTime - queryData.startTime;

    queryData.endTime = endTime;
    queryData.duration = duration;
    queryData.success = success;
    queryData.error = error;

    // Add to recent queries history
    this.recentQueries.push(queryData);
    if (this.recentQueries.length > this.maxQueryHistory) {
      this.recentQueries.shift();
    }

    // Remove from active queries
    this.queryData.delete(queryId);

    // Record metrics
    this.recordMetric('query_latency', duration, 'ms', {
      operation: queryData.operation,
      success: success.toString()
    });

    // Check thresholds and emit alerts
    this.checkThresholds(queryData);

    // Emit performance event
    this.emit('queryCompleted', queryData);
  }

  /**
   * Record a custom metric
   */
  recordMetric(name: string, value: number, unit: string, tags?: Record<string, string>): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: Date.now(),
      tags
    };

    this.metrics.push(metric);
    
    // Trim metrics history
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics.shift();
    }

    this.emit('metricRecorded', metric);
  }

  /**
   * Get performance statistics for a time window
   */
  getStats(windowMs: number = 60000): PerformanceStats {
    const cutoff = Date.now() - windowMs;
    const recentQueries = this.recentQueries.filter(q => 
      q.endTime && q.endTime >= cutoff
    );

    if (recentQueries.length === 0) {
      return {
        totalQueries: 0,
        averageLatency: 0,
        p50Latency: 0,
        p95Latency: 0,
        p99Latency: 0,
        errorRate: 0,
        throughput: 0,
        cacheHitRate: 0
      };
    }

    const latencies = recentQueries
      .map(q => q.duration!)
      .sort((a, b) => a - b);

    const successfulQueries = recentQueries.filter(q => q.success);
    const errorRate = (recentQueries.length - successfulQueries.length) / recentQueries.length;
    
    const totalLatency = latencies.reduce((sum, lat) => sum + lat, 0);
    const averageLatency = totalLatency / latencies.length;
    
    const throughput = recentQueries.length / (windowMs / 1000);

    // Calculate cache hit rate from recent metrics
    const cacheMetrics = this.metrics.filter(m => 
      m.name === 'cache_hit' && m.timestamp >= cutoff
    );
    const cacheHits = cacheMetrics.filter(m => m.tags?.result === 'hit').length;
    const totalCacheRequests = cacheMetrics.length;
    const cacheHitRate = totalCacheRequests > 0 ? cacheHits / totalCacheRequests : 0;

    return {
      totalQueries: recentQueries.length,
      averageLatency,
      p50Latency: this.percentile(latencies, 0.5),
      p95Latency: this.percentile(latencies, 0.95),
      p99Latency: this.percentile(latencies, 0.99),
      errorRate,
      throughput,
      cacheHitRate
    };
  }

  /**
   * Get detailed performance breakdown by operation
   */
  getOperationStats(windowMs: number = 60000): Record<string, PerformanceStats> {
    const cutoff = Date.now() - windowMs;
    const recentQueries = this.recentQueries.filter(q => 
      q.endTime && q.endTime >= cutoff
    );

    const operationGroups = this.groupBy(recentQueries, q => q.operation);
    const result: Record<string, PerformanceStats> = {};

    for (const [operation, queries] of Object.entries(operationGroups)) {
      const latencies = queries
        .map(q => q.duration!)
        .sort((a, b) => a - b);

      const successfulQueries = queries.filter(q => q.success);
      const errorRate = (queries.length - successfulQueries.length) / queries.length;
      
      const totalLatency = latencies.reduce((sum, lat) => sum + lat, 0);
      const averageLatency = totalLatency / latencies.length;
      
      const throughput = queries.length / (windowMs / 1000);

      result[operation] = {
        totalQueries: queries.length,
        averageLatency,
        p50Latency: this.percentile(latencies, 0.5),
        p95Latency: this.percentile(latencies, 0.95),
        p99Latency: this.percentile(latencies, 0.99),
        errorRate,
        throughput,
        cacheHitRate: 0 // Would need operation-specific cache metrics
      };
    }

    return result;
  }

  /**
   * Get bottleneck analysis
   */
  getBottleneckAnalysis(windowMs: number = 60000): {
    slowestOperations: Array<{ operation: string; averageLatency: number }>;
    highestErrorRates: Array<{ operation: string; errorRate: number }>;
    recommendations: string[];
  } {
    const operationStats = this.getOperationStats(windowMs);
    
    const slowestOperations = Object.entries(operationStats)
      .map(([operation, stats]) => ({ operation, averageLatency: stats.averageLatency }))
      .sort((a, b) => b.averageLatency - a.averageLatency)
      .slice(0, 5);

    const highestErrorRates = Object.entries(operationStats)
      .map(([operation, stats]) => ({ operation, errorRate: stats.errorRate }))
      .filter(item => item.errorRate > 0)
      .sort((a, b) => b.errorRate - a.errorRate)
      .slice(0, 5);

    const recommendations: string[] = [];
    const overallStats = this.getStats(windowMs);

    if (overallStats.averageLatency > this.thresholds.maxLatency) {
      recommendations.push(`Average latency (${overallStats.averageLatency.toFixed(1)}ms) exceeds threshold (${this.thresholds.maxLatency}ms)`);
    }

    if (overallStats.errorRate > this.thresholds.maxErrorRate) {
      recommendations.push(`Error rate (${(overallStats.errorRate * 100).toFixed(1)}%) exceeds threshold (${(this.thresholds.maxErrorRate * 100).toFixed(1)}%)`);
    }

    if (overallStats.cacheHitRate < this.thresholds.minCacheHitRate) {
      recommendations.push(`Cache hit rate (${(overallStats.cacheHitRate * 100).toFixed(1)}%) below threshold (${(this.thresholds.minCacheHitRate * 100).toFixed(1)}%)`);
    }

    if (slowestOperations.length > 0) {
      recommendations.push(`Consider optimizing: ${slowestOperations[0].operation} (${slowestOperations[0].averageLatency.toFixed(1)}ms avg)`);
    }

    return {
      slowestOperations,
      highestErrorRates,
      recommendations
    };
  }

  /**
   * Record cache hit/miss for cache hit rate calculation
   */
  recordCacheAccess(hit: boolean, cacheType: string): void {
    this.recordMetric('cache_hit', hit ? 1 : 0, 'boolean', {
      result: hit ? 'hit' : 'miss',
      cacheType
    });
  }

  /**
   * Get current active queries (for debugging)
   */
  getActiveQueries(): QueryPerformanceData[] {
    return Array.from(this.queryData.values());
  }

  /**
   * Get recent metrics
   */
  getRecentMetrics(count: number = 100): PerformanceMetric[] {
    return this.metrics.slice(-count);
  }

  /**
   * Clear all performance data
   */
  clear(): void {
    this.metrics = [];
    this.queryData.clear();
    this.recentQueries = [];
  }

  /**
   * Export performance data for analysis
   */
  exportData(): {
    metrics: PerformanceMetric[];
    queries: QueryPerformanceData[];
    stats: PerformanceStats;
  } {
    return {
      metrics: [...this.metrics],
      queries: [...this.recentQueries],
      stats: this.getStats()
    };
  }

  /**
   * Generate unique query ID
   */
  private generateQueryId(): string {
    return `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Calculate percentile from sorted array
   */
  private percentile(sortedArray: number[], p: number): number {
    if (sortedArray.length === 0) return 0;
    
    const index = Math.ceil(sortedArray.length * p) - 1;
    return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
  }

  /**
   * Group array by key function
   */
  private groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
    return array.reduce((groups, item) => {
      const key = keyFn(item);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
      return groups;
    }, {} as Record<string, T[]>);
  }

  /**
   * Check performance thresholds and emit alerts
   */
  private checkThresholds(queryData: QueryPerformanceData): void {
    if (queryData.duration! > this.thresholds.maxLatency) {
      this.emit('thresholdExceeded', {
        type: 'latency',
        threshold: this.thresholds.maxLatency,
        actual: queryData.duration,
        queryData
      });
    }

    if (!queryData.success) {
      const recentErrorRate = this.calculateRecentErrorRate();
      if (recentErrorRate > this.thresholds.maxErrorRate) {
        this.emit('thresholdExceeded', {
          type: 'errorRate',
          threshold: this.thresholds.maxErrorRate,
          actual: recentErrorRate,
          queryData
        });
      }
    }
  }

  /**
   * Calculate recent error rate
   */
  private calculateRecentErrorRate(): number {
    const recentWindow = 60000; // 1 minute
    const cutoff = Date.now() - recentWindow;
    const recentQueries = this.recentQueries.filter(q => 
      q.endTime && q.endTime >= cutoff
    );

    if (recentQueries.length === 0) return 0;

    const errors = recentQueries.filter(q => !q.success).length;
    return errors / recentQueries.length;
  }
}