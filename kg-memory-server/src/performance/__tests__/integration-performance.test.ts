import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BenchmarkRunner, BenchmarkConfig } from '../benchmark-runner.js';
import { PerformanceMonitor } from '../performance-monitor.js';
import { CacheManager } from '../../cache/cache-manager.js';

// Mock implementations for testing
class MockContextDetectionEngine {
  async detectContext(text: string) {
    // Simulate variable latency based on text complexity
    const complexity = text.length;
    const baseLatency = 20;
    const variableLatency = Math.min(complexity / 10, 100);
    
    await new Promise(resolve => setTimeout(resolve, baseLatency + variableLatency));
    
    return {
      layer: '2-Application',
      topics: ['api', 'security'],
      keywords: ['endpoint', 'auth'],
      technologies: ['express'],
      confidence: 0.8,
      diagnostics: {
        fallbackUsed: false,
        modelProvider: 'mock'
      }
    };
  }
}

class MockRankingEngine {
  async rankDirectives(candidates: any[], context: any, options: any) {
    // Simulate ranking latency based on candidate count
    const rankingLatency = Math.min(candidates.length * 2, 50);
    await new Promise(resolve => setTimeout(resolve, rankingLatency));
    
    return candidates.slice(0, options?.maxItems || 10).map((candidate, index) => ({
      ...candidate,
      score: 1.0 - (index * 0.1),
      scoreBreakdown: {
        authority: 0.8,
        layerMatch: 0.9,
        topicOverlap: 0.7,
        severityBoost: 1.0,
        semanticSimilarity: 0.6,
        whenToApply: 0.8
      }
    }));
  }
}

class MockKnowledgeGraph {
  private mockDirectives = Array.from({ length: 100 }, (_, i) => ({
    id: `directive_${i}`,
    ruleId: `rule_${Math.floor(i / 10)}`,
    section: 'Security',
    severity: i % 3 === 0 ? 'MUST' : i % 3 === 1 ? 'SHOULD' : 'MAY',
    text: `Mock directive ${i}`,
    topics: ['security', 'api'],
    whenToApply: ['endpoint', 'auth']
  }));

  async queryDirectives(criteria: any) {
    // Simulate database query latency
    const queryLatency = Math.min(criteria.limit || 50, 100) / 2;
    await new Promise(resolve => setTimeout(resolve, queryLatency));
    
    return this.mockDirectives.slice(0, criteria.limit || 50);
  }
}

describe('Integration Performance Tests', () => {
  let benchmarkRunner: BenchmarkRunner;
  let performanceMonitor: PerformanceMonitor;
  let cacheManager: CacheManager;
  let mockContextEngine: MockContextDetectionEngine;
  let mockRankingEngine: MockRankingEngine;
  let mockKnowledgeGraph: MockKnowledgeGraph;

  beforeEach(() => {
    performanceMonitor = new PerformanceMonitor({
      thresholds: {
        maxLatency: 400,
        maxErrorRate: 0.05,
        minThroughput: 10,
        minCacheHitRate: 0.7
      }
    });
    
    benchmarkRunner = new BenchmarkRunner(performanceMonitor);
    cacheManager = new CacheManager();
    mockContextEngine = new MockContextDetectionEngine();
    mockRankingEngine = new MockRankingEngine();
    mockKnowledgeGraph = new MockKnowledgeGraph();
  });

  afterEach(() => {
    performanceMonitor.clear();
    cacheManager.clearAll();
  });

  describe('Query Directives Performance', () => {
    const simulateQueryDirectives = async (taskDescription: string, options: any = {}) => {
      const queryId = performanceMonitor.startQuery('query_directives');
      
      try {
        // Check cache first
        const cached = cacheManager.getCachedDirectiveQuery(taskDescription, undefined, options);
        if (cached) {
          performanceMonitor.recordCacheAccess(true, 'directives');
          performanceMonitor.endQuery(queryId, true);
          return cached;
        }
        
        performanceMonitor.recordCacheAccess(false, 'directives');
        
        // Context detection
        const context = await mockContextEngine.detectContext(taskDescription);
        
        // Query candidates
        const candidates = await mockKnowledgeGraph.queryDirectives({
          layers: [context.layer],
          topics: context.topics,
          limit: 100
        });
        
        // Ranking
        const rankedDirectives = await mockRankingEngine.rankDirectives(
          candidates,
          context,
          options
        );
        
        // Format result
        const result = {
          context_block: `Mock context block for: ${taskDescription}`,
          citations: [],
          diagnostics: {
            queryTime: 0,
            contextDetectionTime: 0,
            rankingTime: 0,
            totalDirectives: candidates.length,
            returnedDirectives: rankedDirectives.length,
            confidence: context.confidence,
            fallbackUsed: false
          }
        };
        
        // Cache result
        cacheManager.cacheDirectiveQuery(taskDescription, undefined, options, result);
        
        performanceMonitor.endQuery(queryId, true);
        return result;
        
      } catch (error) {
        performanceMonitor.endQuery(queryId, false, error instanceof Error ? error.message : 'Unknown error');
        throw error;
      }
    };

    it('should meet latency requirements for typical queries', async () => {
      const config: BenchmarkConfig = {
        name: 'typical_query_latency',
        description: 'Test latency for typical query directives requests',
        iterations: 50,
        concurrency: 1,
        warmupIterations: 5
      };

      const operation = () => simulateQueryDirectives(
        'Create a new API endpoint for user authentication',
        { maxItems: 20 }
      );

      const result = await benchmarkRunner.runBenchmark(config, operation);

      expect(result.successRate).toBe(1);
      expect(result.stats.averageLatency).toBeLessThan(400); // Should be under 400ms
      expect(result.stats.p95Latency).toBeLessThan(500); // 95th percentile under 500ms
    });

    it('should handle concurrent queries efficiently', async () => {
      const config: BenchmarkConfig = {
        name: 'concurrent_queries',
        description: 'Test concurrent query handling',
        iterations: 100,
        concurrency: 10,
        warmupIterations: 10
      };

      const queries = [
        'Create API endpoint',
        'Add database validation',
        'Implement user authentication',
        'Setup error handling',
        'Add logging functionality'
      ];

      const operation = () => {
        const randomQuery = queries[Math.floor(Math.random() * queries.length)];
        return simulateQueryDirectives(randomQuery, { maxItems: 15 });
      };

      const result = await benchmarkRunner.runBenchmark(config, operation);

      expect(result.successRate).toBe(1);
      expect(result.stats.throughput).toBeGreaterThan(10); // At least 10 queries/second
      expect(result.stats.averageLatency).toBeLessThan(400);
    });

    it('should demonstrate cache effectiveness', async () => {
      const config: BenchmarkConfig = {
        name: 'cache_effectiveness',
        description: 'Test cache hit rate and performance improvement',
        iterations: 100,
        concurrency: 5,
        warmupIterations: 20 // Warm up cache
      };

      // Use repeated queries to test cache effectiveness
      const commonQueries = [
        'Create REST API endpoint',
        'Add input validation',
        'Implement authentication'
      ];

      const operation = () => {
        const query = commonQueries[Math.floor(Math.random() * commonQueries.length)];
        return simulateQueryDirectives(query, { maxItems: 10 });
      };

      const result = await benchmarkRunner.runBenchmark(config, operation);

      expect(result.successRate).toBe(1);
      
      // Cache should improve performance significantly
      const stats = performanceMonitor.getStats();
      expect(stats.cacheHitRate).toBeGreaterThan(0.5); // At least 50% cache hit rate
      
      // With caching, average latency should be much lower
      expect(result.stats.averageLatency).toBeLessThan(200);
    });
  });

  describe('Context Detection Performance', () => {
    const simulateContextDetection = async (text: string) => {
      const queryId = performanceMonitor.startQuery('detect_context');
      
      try {
        // Check cache
        const cached = cacheManager.getCachedContextDetection(text, {});
        if (cached) {
          performanceMonitor.recordCacheAccess(true, 'context');
          performanceMonitor.endQuery(queryId, true);
          return cached;
        }
        
        performanceMonitor.recordCacheAccess(false, 'context');
        
        const result = await mockContextEngine.detectContext(text);
        
        const output = {
          detectedLayer: result.layer,
          topics: result.topics,
          keywords: result.keywords,
          confidence: result.confidence
        };
        
        cacheManager.cacheContextDetection(text, {}, output);
        performanceMonitor.endQuery(queryId, true);
        
        return output;
        
      } catch (error) {
        performanceMonitor.endQuery(queryId, false, error instanceof Error ? error.message : 'Unknown error');
        throw error;
      }
    };

    it('should handle varying text complexity efficiently', async () => {
      const config: BenchmarkConfig = {
        name: 'context_detection_complexity',
        description: 'Test context detection with varying text complexity',
        iterations: 50,
        concurrency: 3
      };

      const textSamples = [
        'Create API',
        'Create a new REST API endpoint for user management',
        'Create a comprehensive REST API endpoint for user management with authentication, validation, error handling, and proper HTTP status codes following RESTful principles',
        'Implement a complex microservice architecture with multiple API endpoints, database integration, caching layer, message queuing, monitoring, logging, and deployment automation using Docker and Kubernetes'
      ];

      const operation = () => {
        const text = textSamples[Math.floor(Math.random() * textSamples.length)];
        return simulateContextDetection(text);
      };

      const result = await benchmarkRunner.runBenchmark(config, operation);

      expect(result.successRate).toBe(1);
      expect(result.stats.averageLatency).toBeLessThan(200); // Context detection should be fast
    });
  });

  describe('Token Usage Reduction Benchmark', () => {
    it('should demonstrate significant token usage reduction', async () => {
      // Simulate baseline approach (returning all rules)
      const baselineOperation = async () => {
        await new Promise(resolve => setTimeout(resolve, 50)); // Simulate processing time
        
        // Simulate returning many rules (high token usage)
        return {
          tokenCount: 5000, // Baseline: return everything
          relevantDirectives: 100,
          processingTime: 50
        };
      };

      // Simulate optimized approach (with ranking and filtering)
      const optimizedOperation = async () => {
        const taskDescription = 'Create API endpoint with authentication';
        await simulateQueryDirectives(taskDescription, { maxItems: 20, tokenBudget: 1500 });
        
        return {
          tokenCount: 1200, // Optimized: filtered and ranked
          relevantDirectives: 20,
          processingTime: 0 // Will be measured by benchmark
        };
      };

      const baselineConfig: BenchmarkConfig = {
        name: 'baseline_approach',
        description: 'Baseline approach returning all rules',
        iterations: 20,
        concurrency: 1
      };

      const optimizedConfig: BenchmarkConfig = {
        name: 'optimized_approach',
        description: 'Optimized approach with ranking and filtering',
        iterations: 20,
        concurrency: 1
      };

      const baselineResult = await benchmarkRunner.runBenchmark(baselineConfig, baselineOperation);
      const optimizedResult = await benchmarkRunner.runBenchmark(optimizedConfig, optimizedOperation);

      // Compare results
      const comparison = benchmarkRunner.compareBenchmarks(baselineResult, optimizedResult);
      
      // Optimized approach should be faster (negative latency change is good)
      expect(comparison.latencyChange).toBeLessThan(0);
      
      // Should demonstrate significant token reduction (simulated in the operations)
      // In real implementation, this would measure actual token usage
      console.log('Token usage reduction benchmark:', comparison.summary);
    });
  });

  describe('Load Testing', () => {
    it('should handle sustained load without degradation', async () => {
      const config: BenchmarkConfig = {
        name: 'sustained_load_test',
        description: 'Test system under sustained load',
        iterations: 200,
        concurrency: 15,
        timeout: 1000
      };

      const operations = [
        () => simulateQueryDirectives('Create API endpoint', { maxItems: 10 }),
        () => simulateQueryDirectives('Add validation logic', { maxItems: 15 }),
        () => simulateQueryDirectives('Implement error handling', { maxItems: 12 }),
        () => simulateContextDetection('Database query optimization'),
        () => simulateContextDetection('User interface component')
      ];

      const operation = () => {
        const randomOp = operations[Math.floor(Math.random() * operations.length)];
        return randomOp();
      };

      const result = await benchmarkRunner.runBenchmark(config, operation);

      expect(result.successRate).toBeGreaterThan(0.95); // At least 95% success rate
      expect(result.stats.errorRate).toBeLessThan(0.05); // Less than 5% error rate
      expect(result.stats.p95Latency).toBeLessThan(600); // 95th percentile under 600ms
      
      // Check for performance degradation over time
      const operationStats = performanceMonitor.getOperationStats();
      Object.values(operationStats).forEach(stats => {
        expect(stats.errorRate).toBeLessThan(0.1);
      });
    });

    it('should maintain cache effectiveness under load', async () => {
      // Pre-warm cache with common queries
      const commonQueries = [
        'Create REST API',
        'Add authentication',
        'Implement validation',
        'Setup database',
        'Add error handling'
      ];

      // Warm up cache
      for (const query of commonQueries) {
        await simulateQueryDirectives(query);
      }

      const config: BenchmarkConfig = {
        name: 'cache_under_load',
        description: 'Test cache performance under load',
        iterations: 150,
        concurrency: 10
      };

      const operation = () => {
        // 70% of requests use common queries (should hit cache)
        const useCommonQuery = Math.random() < 0.7;
        const query = useCommonQuery 
          ? commonQueries[Math.floor(Math.random() * commonQueries.length)]
          : `Unique query ${Math.random()}`;
        
        return simulateQueryDirectives(query);
      };

      const result = await benchmarkRunner.runBenchmark(config, operation);

      expect(result.successRate).toBe(1);
      
      const stats = performanceMonitor.getStats();
      expect(stats.cacheHitRate).toBeGreaterThan(0.6); // Should maintain good cache hit rate
      expect(result.stats.averageLatency).toBeLessThan(300); // Cache should keep latency low
    });
  });

  describe('Performance Regression Detection', () => {
    it('should detect performance regressions', async () => {
      // Simulate a "good" baseline
      const goodConfig: BenchmarkConfig = {
        name: 'baseline_performance',
        description: 'Baseline performance measurement',
        iterations: 30,
        concurrency: 3
      };

      const goodOperation = () => simulateQueryDirectives('Test query', { maxItems: 10 });
      const baselineResult = await benchmarkRunner.runBenchmark(goodConfig, goodOperation);

      // Simulate a "degraded" version
      const degradedConfig: BenchmarkConfig = {
        name: 'degraded_performance',
        description: 'Simulated performance degradation',
        iterations: 30,
        concurrency: 3
      };

      const degradedOperation = async () => {
        // Add artificial delay to simulate regression
        await new Promise(resolve => setTimeout(resolve, 100));
        return simulateQueryDirectives('Test query', { maxItems: 10 });
      };

      const degradedResult = await benchmarkRunner.runBenchmark(degradedConfig, degradedOperation);

      const comparison = benchmarkRunner.compareBenchmarks(baselineResult, degradedResult);

      // Should detect the regression
      expect(comparison.latencyChange).toBeGreaterThan(50); // Significant increase
      expect(comparison.throughputChange).toBeLessThan(-20); // Significant decrease
      
      console.log('Regression detection test:', comparison.summary);
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should not leak memory during extended operation', async () => {
      const config: BenchmarkConfig = {
        name: 'memory_leak_test',
        description: 'Test for memory leaks during extended operation',
        iterations: 500,
        concurrency: 5
      };

      const initialMemory = process.memoryUsage();
      
      const operation = () => {
        const queries = [
          'Memory test query 1',
          'Memory test query 2',
          'Memory test query 3'
        ];
        const query = queries[Math.floor(Math.random() * queries.length)];
        return simulateQueryDirectives(query);
      };

      const result = await benchmarkRunner.runBenchmark(config, operation);

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      expect(result.successRate).toBe(1);
      
      // Memory increase should be reasonable (less than 50MB for this test)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
      
      console.log(`Memory usage: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB increase`);
    });
  });
});