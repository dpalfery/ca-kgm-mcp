import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PerformanceMonitor } from '../performance-monitor.js';

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor({
      maxMetricsHistory: 100,
      maxQueryHistory: 50,
      thresholds: {
        maxLatency: 100,
        maxErrorRate: 0.1,
        minThroughput: 5,
        minCacheHitRate: 0.5
      }
    });
  });

  afterEach(() => {
    monitor.removeAllListeners();
  });

  describe('query tracking', () => {
    it('should track query latency', async () => {
      const queryId = monitor.startQuery('test_operation');
      
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 50));
      
      monitor.endQuery(queryId, true);
      
      const stats = monitor.getStats(60000);
      expect(stats.totalQueries).toBe(1);
      expect(stats.averageLatency).toBeGreaterThan(40);
      expect(stats.averageLatency).toBeLessThan(100);
    });

    it('should track multiple concurrent queries', async () => {
      const queries = [];
      
      // Start multiple queries
      for (let i = 0; i < 5; i++) {
        queries.push(monitor.startQuery(`operation_${i}`));
      }
      
      // Simulate different completion times
      await new Promise(resolve => setTimeout(resolve, 10));
      monitor.endQuery(queries[0], true);
      
      await new Promise(resolve => setTimeout(resolve, 20));
      monitor.endQuery(queries[1], true);
      monitor.endQuery(queries[2], false, 'Test error');
      
      await new Promise(resolve => setTimeout(resolve, 30));
      monitor.endQuery(queries[3], true);
      monitor.endQuery(queries[4], true);
      
      const stats = monitor.getStats(60000);
      expect(stats.totalQueries).toBe(5);
      expect(stats.errorRate).toBe(0.2); // 1 error out of 5
    });

    it('should calculate percentiles correctly', async () => {
      const latencies = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      
      // Create queries with known latencies
      for (const latency of latencies) {
        const queryId = monitor.startQuery('test_operation');
        
        // Mock the start time to control latency
        const queryData = (monitor as any).queryData.get(queryId);
        queryData.startTime = Date.now() - latency;
        
        monitor.endQuery(queryId, true);
      }
      
      const stats = monitor.getStats(60000);
      // Just check that percentiles are in reasonable ranges
      expect(stats.p50Latency).toBeGreaterThan(40);
      expect(stats.p50Latency).toBeLessThan(70);
      expect(stats.p95Latency).toBeGreaterThan(80);
      expect(stats.p99Latency).toBeGreaterThan(90);
    });
  });

  describe('metrics recording', () => {
    it('should record custom metrics', () => {
      monitor.recordMetric('custom_metric', 42, 'units', { tag: 'value' });
      
      const metrics = monitor.getRecentMetrics(10);
      expect(metrics).toHaveLength(1);
      expect(metrics[0].name).toBe('custom_metric');
      expect(metrics[0].value).toBe(42);
      expect(metrics[0].unit).toBe('units');
      expect(metrics[0].tags).toEqual({ tag: 'value' });
    });

    it('should track cache hit rate', () => {
      // Record cache hits and misses
      monitor.recordCacheAccess(true, 'test_cache');
      monitor.recordCacheAccess(true, 'test_cache');
      monitor.recordCacheAccess(false, 'test_cache');
      monitor.recordCacheAccess(true, 'test_cache');
      
      const metrics = monitor.getRecentMetrics(10);
      const cacheMetrics = metrics.filter(m => m.name === 'cache_hit');
      expect(cacheMetrics).toHaveLength(4);
      
      const hits = cacheMetrics.filter(m => m.value === 1).length;
      const total = cacheMetrics.length;
      expect(hits / total).toBe(0.75); // 3 hits out of 4
    });
  });

  describe('performance statistics', () => {
    it('should calculate throughput correctly', async () => {
      const startTime = Date.now();
      
      // Create 10 queries over a known time period
      for (let i = 0; i < 10; i++) {
        const queryId = monitor.startQuery('throughput_test');
        monitor.endQuery(queryId, true);
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      const elapsed = Date.now() - startTime;
      const stats = monitor.getStats(elapsed + 100);
      
      // Should be approximately 10 queries per elapsed time (allow for timing variance)
      const expectedThroughput = 10 / (elapsed / 1000);
      expect(stats.throughput).toBeGreaterThan(expectedThroughput * 0.5);
      expect(stats.throughput).toBeLessThan(expectedThroughput * 2);
    });

    it('should provide operation-specific stats', async () => {
      // Create queries for different operations
      const operations = ['query_directives', 'detect_context', 'upsert_markdown'];
      
      for (const operation of operations) {
        for (let i = 0; i < 3; i++) {
          const queryId = monitor.startQuery(operation);
          await new Promise(resolve => setTimeout(resolve, 10 + i * 5));
          monitor.endQuery(queryId, true);
        }
      }
      
      const operationStats = monitor.getOperationStats(60000);
      
      expect(Object.keys(operationStats)).toHaveLength(3);
      expect(operationStats['query_directives']).toBeDefined();
      expect(operationStats['detect_context']).toBeDefined();
      expect(operationStats['upsert_markdown']).toBeDefined();
      
      // Each operation should have 3 queries
      Object.values(operationStats).forEach(stats => {
        expect(stats.totalQueries).toBe(3);
      });
    });
  });

  describe('bottleneck analysis', () => {
    it('should identify slowest operations', async () => {
      // Create operations with different latencies
      const operations = [
        { name: 'fast_operation', latency: 10 },
        { name: 'slow_operation', latency: 100 },
        { name: 'medium_operation', latency: 50 }
      ];
      
      for (const op of operations) {
        const queryId = monitor.startQuery(op.name);
        
        // Mock latency
        const queryData = (monitor as any).queryData.get(queryId);
        queryData.startTime = Date.now() - op.latency;
        
        monitor.endQuery(queryId, true);
      }
      
      const analysis = monitor.getBottleneckAnalysis(60000);
      
      expect(analysis.slowestOperations[0].operation).toBe('slow_operation');
      expect(analysis.slowestOperations[0].averageLatency).toBeCloseTo(100, 5);
    });

    it('should provide performance recommendations', async () => {
      // Create a slow query that exceeds threshold
      const queryId = monitor.startQuery('slow_query');
      
      // Mock a query that exceeds the 100ms threshold
      const queryData = (monitor as any).queryData.get(queryId);
      queryData.startTime = Date.now() - 150;
      
      monitor.endQuery(queryId, true);
      
      const analysis = monitor.getBottleneckAnalysis(60000);
      
      expect(analysis.recommendations.length).toBeGreaterThan(0);
      expect(analysis.recommendations.some(r => r.includes('latency'))).toBe(true);
    });
  });

  describe('threshold monitoring', () => {
    it('should emit alerts when latency threshold is exceeded', () => {
      return new Promise<void>((resolve) => {
        monitor.on('thresholdExceeded', (alert) => {
          expect(alert.type).toBe('latency');
          expect(alert.threshold).toBe(100);
          expect(alert.actual).toBeGreaterThan(100);
          resolve();
        });
        
        const queryId = monitor.startQuery('slow_query');
        
        // Mock a query that exceeds threshold
        const queryData = (monitor as any).queryData.get(queryId);
        queryData.startTime = Date.now() - 150;
        
        monitor.endQuery(queryId, true);
      });
    });

    it('should emit alerts when error rate threshold is exceeded', () => {
      return new Promise<void>((resolve) => {
        let alertEmitted = false;
        
        monitor.on('thresholdExceeded', (alert) => {
          if (alert.type === 'errorRate' && !alertEmitted) {
            alertEmitted = true;
            expect(alert.threshold).toBe(0.1);
            expect(alert.actual).toBeGreaterThan(0.1);
            resolve();
          }
        });
        
        // Create enough errors to exceed 10% threshold
        for (let i = 0; i < 10; i++) {
          const queryId = monitor.startQuery('test_query');
          monitor.endQuery(queryId, i < 8); // 2 errors out of 10 = 20%
        }
      });
    });
  });

  describe('data management', () => {
    it('should limit metrics history', () => {
      // Record more metrics than the limit
      for (let i = 0; i < 150; i++) {
        monitor.recordMetric('test_metric', i, 'count');
      }
      
      const metrics = monitor.getRecentMetrics(200);
      expect(metrics.length).toBeLessThanOrEqual(100); // maxMetricsHistory
    });

    it('should export and clear data', () => {
      // Add some data
      const queryId = monitor.startQuery('test_query');
      monitor.endQuery(queryId, true);
      monitor.recordMetric('test_metric', 42, 'units');
      
      const exported = monitor.exportData();
      expect(exported.queries.length).toBe(1);
      expect(exported.metrics.length).toBeGreaterThan(0);
      expect(exported.stats).toBeDefined();
      
      monitor.clear();
      
      const afterClear = monitor.exportData();
      expect(afterClear.queries.length).toBe(0);
      expect(afterClear.metrics.length).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle non-existent query IDs gracefully', () => {
      expect(() => {
        monitor.endQuery('non-existent-id', true);
      }).not.toThrow();
    });

    it('should handle empty time windows', () => {
      const stats = monitor.getStats(60000);
      expect(stats.totalQueries).toBe(0);
      expect(stats.averageLatency).toBe(0);
      expect(stats.throughput).toBe(0);
    });

    it('should handle concurrent access safely', async () => {
      const promises = [];
      
      // Start many concurrent queries
      for (let i = 0; i < 50; i++) {
        promises.push((async () => {
          const queryId = monitor.startQuery(`concurrent_${i}`);
          await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
          monitor.endQuery(queryId, Math.random() > 0.1);
        })());
      }
      
      await Promise.all(promises);
      
      const stats = monitor.getStats(60000);
      expect(stats.totalQueries).toBe(50);
    });
  });
});