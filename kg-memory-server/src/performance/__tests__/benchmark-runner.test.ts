import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BenchmarkRunner, BenchmarkConfig } from '../benchmark-runner.js';
import { PerformanceMonitor } from '../performance-monitor.js';

describe('BenchmarkRunner', () => {
  let runner: BenchmarkRunner;
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
    runner = new BenchmarkRunner(monitor);
  });

  describe('single benchmark execution', () => {
    it('should run a simple benchmark', async () => {
      const config: BenchmarkConfig = {
        name: 'simple_test',
        description: 'A simple test benchmark',
        iterations: 10,
        concurrency: 1
      };

      let callCount = 0;
      const operation = async () => {
        callCount++;
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'result';
      };

      const result = await runner.runBenchmark(config, operation);

      expect(result.config).toEqual(config);
      expect(result.iterations).toBe(10);
      expect(result.successRate).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(result.stats.totalQueries).toBe(10);
      expect(result.stats.averageLatency).toBeGreaterThan(5);
      expect(callCount).toBe(10);
    });

    it('should handle concurrent execution', async () => {
      const config: BenchmarkConfig = {
        name: 'concurrent_test',
        description: 'Test concurrent execution',
        iterations: 20,
        concurrency: 5
      };

      const startTimes: number[] = [];
      const operation = async () => {
        startTimes.push(Date.now());
        await new Promise(resolve => setTimeout(resolve, 50));
        return 'result';
      };

      const result = await runner.runBenchmark(config, operation);

      expect(result.iterations).toBe(20);
      expect(result.successRate).toBe(1);
      expect(startTimes).toHaveLength(20);

      // Check that operations ran concurrently (some should start within a short time window)
      const sortedTimes = startTimes.sort();
      const maxConcurrentGap = 100; // ms
      let concurrentCount = 0;
      
      for (let i = 1; i < sortedTimes.length; i++) {
        if (sortedTimes[i] - sortedTimes[i-1] < maxConcurrentGap) {
          concurrentCount++;
        }
      }
      
      expect(concurrentCount).toBeGreaterThan(0);
    });

    it('should handle operation failures', async () => {
      const config: BenchmarkConfig = {
        name: 'failure_test',
        description: 'Test error handling',
        iterations: 10,
        concurrency: 1
      };

      let callCount = 0;
      const operation = async () => {
        callCount++;
        if (callCount % 3 === 0) {
          throw new Error(`Simulated error ${callCount}`);
        }
        return 'success';
      };

      const result = await runner.runBenchmark(config, operation);

      expect(result.iterations).toBe(10);
      expect(result.successRate).toBeCloseTo(0.7, 1); // 7 successes out of 10
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Simulated error');
    });

    it('should respect timeout configuration', async () => {
      const config: BenchmarkConfig = {
        name: 'timeout_test',
        description: 'Test timeout handling',
        iterations: 5,
        concurrency: 1,
        timeout: 50
      };

      const operation = async () => {
        await new Promise(resolve => setTimeout(resolve, 100)); // Longer than timeout
        return 'result';
      };

      const result = await runner.runBenchmark(config, operation);

      expect(result.successRate).toBe(0); // All should timeout
      expect(result.errors.some(e => e.includes('timeout'))).toBe(true);
    });

    it('should perform warmup iterations', async () => {
      const config: BenchmarkConfig = {
        name: 'warmup_test',
        description: 'Test warmup functionality',
        iterations: 5,
        concurrency: 1,
        warmupIterations: 3
      };

      let totalCalls = 0;
      const operation = async () => {
        totalCalls++;
        return 'result';
      };

      const result = await runner.runBenchmark(config, operation);

      // Should call operation for both warmup and actual iterations
      expect(totalCalls).toBe(8); // 3 warmup + 5 actual
      expect(result.iterations).toBe(5); // Only actual iterations counted in result
    });
  });

  describe('benchmark suite execution', () => {
    it('should run multiple benchmarks in a suite', async () => {
      const suite = {
        name: 'test_suite',
        benchmarks: [
          {
            name: 'fast_operation',
            description: 'Fast operation test',
            iterations: 5,
            concurrency: 1
          },
          {
            name: 'slow_operation',
            description: 'Slow operation test',
            iterations: 3,
            concurrency: 1
          }
        ]
      };

      const operations = {
        fast_operation: async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return 'fast';
        },
        slow_operation: async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return 'slow';
        }
      };

      const results = await runner.runSuite(suite, operations);

      expect(Object.keys(results)).toHaveLength(2);
      expect(results.fast_operation).toBeDefined();
      expect(results.slow_operation).toBeDefined();
      
      expect(results.fast_operation.iterations).toBe(5);
      expect(results.slow_operation.iterations).toBe(3);
      
      // Fast operation should have lower latency
      expect(results.fast_operation.stats.averageLatency)
        .toBeLessThan(results.slow_operation.stats.averageLatency);
    });

    it('should handle missing operations gracefully', async () => {
      const suite = {
        name: 'incomplete_suite',
        benchmarks: [
          {
            name: 'existing_operation',
            description: 'This operation exists',
            iterations: 3,
            concurrency: 1
          },
          {
            name: 'missing_operation',
            description: 'This operation does not exist',
            iterations: 3,
            concurrency: 1
          }
        ]
      };

      const operations = {
        existing_operation: async () => 'result'
      };

      const results = await runner.runSuite(suite, operations);

      expect(results.existing_operation).toBeDefined();
      expect(results.missing_operation).toBeUndefined();
    });
  });

  describe('benchmark comparison', () => {
    it('should compare benchmark results', async () => {
      const config: BenchmarkConfig = {
        name: 'comparison_test',
        description: 'Test for comparison',
        iterations: 10,
        concurrency: 1
      };

      // Run baseline benchmark
      const baselineOperation = async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
        return 'baseline';
      };
      const baseline = await runner.runBenchmark(config, baselineOperation);

      // Run improved benchmark
      const improvedOperation = async () => {
        await new Promise(resolve => setTimeout(resolve, 10)); // Faster
        return 'improved';
      };
      const improved = await runner.runBenchmark(config, improvedOperation);

      const comparison = runner.compareBenchmarks(baseline, improved);

      expect(comparison.latencyChange).toBeLessThan(0); // Should be negative (improvement)
      expect(comparison.throughputChange).toBeGreaterThan(0); // Should be positive (improvement)
      expect(comparison.summary).toContain('Latency:');
      expect(comparison.summary).toContain('Throughput:');
    });
  });

  describe('report generation', () => {
    it('should generate a comprehensive report', async () => {
      const suite = {
        name: 'report_test_suite',
        benchmarks: [
          {
            name: 'test_operation',
            description: 'Test operation for report',
            iterations: 5,
            concurrency: 1
          }
        ]
      };

      const operations = {
        test_operation: async () => {
          await new Promise(resolve => setTimeout(resolve, 15));
          return 'result';
        }
      };

      const results = await runner.runSuite(suite, operations);
      const report = runner.generateReport(results);

      expect(report).toContain('# Performance Benchmark Report');
      expect(report).toContain('## Summary');
      expect(report).toContain('## Detailed Results');
      expect(report).toContain('test_operation');
      expect(report).toContain('Test operation for report');
      expect(report).toContain('Success Rate:');
      expect(report).toContain('Average Latency:');
    });

    it('should include error information in reports', async () => {
      const config: BenchmarkConfig = {
        name: 'error_test',
        description: 'Test with errors',
        iterations: 5,
        concurrency: 1
      };

      let callCount = 0;
      const operation = async () => {
        callCount++;
        if (callCount === 3) {
          throw new Error('Test error for report');
        }
        return 'success';
      };

      const result = await runner.runBenchmark(config, operation);
      const report = runner.generateReport({ error_test: result });

      expect(report).toContain('**Errors:**');
      expect(report).toContain('Test error for report');
    });
  });

  describe('performance monitoring integration', () => {
    it('should integrate with performance monitor', async () => {
      const config: BenchmarkConfig = {
        name: 'monitor_integration_test',
        description: 'Test monitor integration',
        iterations: 5,
        concurrency: 1
      };

      const operation = async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
        return 'result';
      };

      await runner.runBenchmark(config, operation);

      const stats = monitor.getStats(60000);
      expect(stats.totalQueries).toBe(5);
      expect(stats.averageLatency).toBeGreaterThan(15);
    });

    it('should track cache performance in benchmarks', async () => {
      const config: BenchmarkConfig = {
        name: 'cache_benchmark',
        description: 'Test cache performance',
        iterations: 10,
        concurrency: 1
      };

      let cacheHits = 0;
      const operation = async () => {
        // Simulate cache behavior
        const isHit = Math.random() > 0.3; // 70% hit rate
        if (isHit) cacheHits++;
        
        monitor.recordCacheAccess(isHit, 'test_cache');
        
        // Simulate different latencies for hits vs misses
        const latency = isHit ? 5 : 25;
        await new Promise(resolve => setTimeout(resolve, latency));
        
        return isHit ? 'cache_hit' : 'cache_miss';
      };

      await runner.runBenchmark(config, operation);

      const stats = monitor.getStats(60000);
      expect(stats.totalQueries).toBe(10);
      
      // Should have recorded cache metrics
      const metrics = monitor.getRecentMetrics(20);
      const cacheMetrics = metrics.filter(m => m.name === 'cache_hit');
      expect(cacheMetrics.length).toBe(10);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle zero iterations', async () => {
      const config: BenchmarkConfig = {
        name: 'zero_iterations',
        description: 'Test zero iterations',
        iterations: 0,
        concurrency: 1
      };

      const operation = async () => 'result';
      const result = await runner.runBenchmark(config, operation);

      expect(result.iterations).toBe(0);
      expect(result.successRate).toBeNaN(); // 0/0 = NaN
      expect(result.stats.totalQueries).toBe(0);
    });

    it('should handle high concurrency', async () => {
      const config: BenchmarkConfig = {
        name: 'high_concurrency',
        description: 'Test high concurrency',
        iterations: 50,
        concurrency: 20
      };

      const operation = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'result';
      };

      const result = await runner.runBenchmark(config, operation);

      expect(result.iterations).toBe(50);
      expect(result.successRate).toBe(1);
    });

    it('should handle operations that throw synchronously', async () => {
      const config: BenchmarkConfig = {
        name: 'sync_error_test',
        description: 'Test synchronous errors',
        iterations: 3,
        concurrency: 1
      };

      const operation = async () => {
        throw new Error('Synchronous error');
      };

      const result = await runner.runBenchmark(config, operation);

      expect(result.successRate).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});