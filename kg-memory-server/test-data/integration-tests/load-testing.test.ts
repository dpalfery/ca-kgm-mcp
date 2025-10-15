/**
 * Load testing for the Knowledge Graph Memory system
 * Tests system behavior under various load conditions and stress scenarios
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Database } from 'sqlite3';
import { RuleKnowledgeGraph } from '../../src/storage/rule-knowledge-graph';
import { RuleDocumentParser } from '../../src/parsers/rule-document-parser';
import { ContextDetectionEngine } from '../../src/context-detection/context-detection-engine';
import { DirectiveRankingEngine } from '../../src/ranking/directive-ranking-engine';
import { ModelProviderManager } from '../../src/providers/model-provider-manager';
import { RuleBasedProvider } from '../../src/providers/rule-based-provider';
import { TestDataGenerator } from '../generators/test-data-generator';

interface LoadTestResult {
  scenario: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  throughput: number;
  errorRate: number;
  memoryUsage: {
    initial: number;
    peak: number;
    final: number;
  };
}

describe('Load Testing', () => {
  let database: Database;
  let knowledgeGraph: RuleKnowledgeGraph;
  let parser: RuleDocumentParser;
  let contextEngine: ContextDetectionEngine;
  let rankingEngine: DirectiveRankingEngine;
  let providerManager: ModelProviderManager;
  let testDataGenerator: TestDataGenerator;

  beforeAll(async () => {
    // Initialize components
    database = new Database(':memory:');
    knowledgeGraph = new RuleKnowledgeGraph(database);
    parser = new RuleDocumentParser();
    
    providerManager = new ModelProviderManager();
    providerManager.registerProvider('rule-based', new RuleBasedProvider());
    
    contextEngine = new ContextDetectionEngine(providerManager);
    rankingEngine = new DirectiveRankingEngine();
    testDataGenerator = new TestDataGenerator();

    await knowledgeGraph.initialize();

    // Load comprehensive rule set for testing
    const sampleRules = [
      '../sample-rules/presentation-layer-rules.md',
      '../sample-rules/application-layer-rules.md',
      '../sample-rules/domain-layer-rules.md',
      '../sample-rules/persistence-layer-rules.md',
      '../sample-rules/infrastructure-layer-rules.md'
    ];

    for (const rulePath of sampleRules) {
      const ruleContent = readFileSync(join(__dirname, rulePath), 'utf-8');
      const parsedRule = await parser.parseRuleDocument(ruleContent, rulePath);
      await knowledgeGraph.upsertRule(parsedRule);
    }
  });

  afterAll(async () => {
    if (database) {
      database.close();
    }
  });

  describe('Gradual Load Increase', () => {
    it('should handle gradual load increase gracefully', async () => {
      const phases = [
        { users: 5, duration: 10000, rampUp: 2000 },   // 5 users for 10s
        { users: 20, duration: 15000, rampUp: 3000 },  // 20 users for 15s
        { users: 50, duration: 20000, rampUp: 5000 },  // 50 users for 20s
      ];

      const testQueries = testDataGenerator.generateTaskDescriptions(100);
      const results: LoadTestResult[] = [];

      for (const phase of phases) {
        console.log(`\n🔄 Starting phase: ${phase.users} users for ${phase.duration}ms`);
        
        const result = await runLoadTestPhase(
          `Gradual Load - ${phase.users} users`,
          phase.users,
          phase.duration,
          testQueries.slice(0, 50),
          contextEngine,
          knowledgeGraph,
          rankingEngine
        );

        results.push(result);
        
        console.log(`   Throughput: ${result.throughput.toFixed(2)} QPS`);
        console.log(`   P95 Latency: ${result.p95Latency.toFixed(2)}ms`);
        console.log(`   Error Rate: ${(result.errorRate * 100).toFixed(2)}%`);

        // Validate performance requirements
        expect(result.errorRate).toBeLessThan(0.01); // < 1% error rate
        expect(result.p95Latency).toBeLessThan(500);  // < 500ms P95 latency
        expect(result.throughput).toBeGreaterThan(phase.users * 0.5); // Reasonable throughput
      }

      // Verify system scales reasonably
      for (let i = 1; i < results.length; i++) {
        const prev = results[i-1];
        const curr = results[i];
        
        // Throughput should increase with more users (up to a point)
        if (curr.throughput < prev.throughput * 0.8) {
          console.warn(`Throughput degradation detected: ${prev.throughput} -> ${curr.throughput}`);
        }
        
        // Latency should not increase dramatically
        expect(curr.p95Latency).toBeLessThan(prev.p95Latency * 2);
      }
    });
  });

  describe('Spike Testing', () => {
    it('should handle sudden load spikes', async () => {
      const testQueries = testDataGenerator.generateTaskDescriptions(50);
      
      // Baseline load
      console.log('\n📊 Establishing baseline...');
      const baseline = await runLoadTestPhase(
        'Baseline Load',
        5,
        10000,
        testQueries,
        contextEngine,
        knowledgeGraph,
        rankingEngine
      );

      // Sudden spike
      console.log('\n⚡ Executing load spike...');
      const spike = await runLoadTestPhase(
        'Load Spike',
        100,
        15000,
        testQueries,
        contextEngine,
        knowledgeGraph,
        rankingEngine
      );

      // Recovery
      console.log('\n🔄 Testing recovery...');
      const recovery = await runLoadTestPhase(
        'Recovery',
        5,
        10000,
        testQueries,
        contextEngine,
        knowledgeGraph,
        rankingEngine
      );

      console.log('\n📈 Spike Test Results:');
      console.log(`Baseline: ${baseline.throughput.toFixed(2)} QPS, ${baseline.p95Latency.toFixed(2)}ms P95`);
      console.log(`Spike: ${spike.throughput.toFixed(2)} QPS, ${spike.p95Latency.toFixed(2)}ms P95`);
      console.log(`Recovery: ${recovery.throughput.toFixed(2)} QPS, ${recovery.p95Latency.toFixed(2)}ms P95`);

      // Spike should handle increased load reasonably
      expect(spike.errorRate).toBeLessThan(0.05); // < 5% error rate during spike
      expect(spike.p95Latency).toBeLessThan(1000); // < 1s P95 during spike

      // System should recover to near baseline performance
      expect(recovery.throughput).toBeGreaterThan(baseline.throughput * 0.8);
      expect(recovery.p95Latency).toBeLessThan(baseline.p95Latency * 1.5);
    });
  });

  describe('Sustained Load Testing', () => {
    it('should maintain performance under sustained load', async () => {
      const testQueries = testDataGenerator.generateTaskDescriptions(200);
      
      console.log('\n⏱️  Running sustained load test (60 seconds)...');
      
      const sustainedResult = await runLoadTestPhase(
        'Sustained Load',
        30,
        60000, // 1 minute
        testQueries,
        contextEngine,
        knowledgeGraph,
        rankingEngine
      );

      console.log('\n📊 Sustained Load Results:');
      console.log(`   Total Requests: ${sustainedResult.totalRequests}`);
      console.log(`   Successful: ${sustainedResult.successfulRequests}`);
      console.log(`   Failed: ${sustainedResult.failedRequests}`);
      console.log(`   Throughput: ${sustainedResult.throughput.toFixed(2)} QPS`);
      console.log(`   Average Latency: ${sustainedResult.averageLatency.toFixed(2)}ms`);
      console.log(`   P95 Latency: ${sustainedResult.p95Latency.toFixed(2)}ms`);
      console.log(`   P99 Latency: ${sustainedResult.p99Latency.toFixed(2)}ms`);
      console.log(`   Error Rate: ${(sustainedResult.errorRate * 100).toFixed(2)}%`);
      console.log(`   Memory Usage: ${sustainedResult.memoryUsage.initial.toFixed(1)}MB -> ${sustainedResult.memoryUsage.peak.toFixed(1)}MB -> ${sustainedResult.memoryUsage.final.toFixed(1)}MB`);

      // Performance requirements for sustained load
      expect(sustainedResult.errorRate).toBeLessThan(0.01); // < 1% error rate
      expect(sustainedResult.p95Latency).toBeLessThan(400);  // < 400ms P95 latency
      expect(sustainedResult.throughput).toBeGreaterThan(20); // > 20 QPS

      // Memory should not grow excessively (no major leaks)
      const memoryGrowth = sustainedResult.memoryUsage.final - sustainedResult.memoryUsage.initial;
      expect(memoryGrowth).toBeLessThan(100); // < 100MB growth
    });
  });

  describe('Concurrent User Simulation', () => {
    it('should handle realistic concurrent user patterns', async () => {
      const userScenarios = [
        {
          name: 'Frontend Developer',
          queries: [
            'Create React component with form validation',
            'Add CSS styling for responsive design',
            'Implement user authentication UI',
            'Handle form submission errors'
          ]
        },
        {
          name: 'Backend Developer', 
          queries: [
            'Implement REST API endpoint',
            'Add JWT authentication middleware',
            'Create database migration',
            'Optimize query performance'
          ]
        },
        {
          name: 'DevOps Engineer',
          queries: [
            'Set up Kubernetes deployment',
            'Configure monitoring and alerts',
            'Implement CI/CD pipeline',
            'Add health checks'
          ]
        }
      ];

      const concurrentUsers = 15; // 5 users per scenario
      const testDuration = 30000; // 30 seconds

      console.log(`\n👥 Simulating ${concurrentUsers} concurrent users (${testDuration/1000}s)...`);

      const promises: Promise<any>[] = [];
      const results: any[] = [];
      const startTime = Date.now();

      // Start concurrent user simulations
      for (let i = 0; i < concurrentUsers; i++) {
        const scenario = userScenarios[i % userScenarios.length];
        
        const userPromise = simulateUser(
          `${scenario.name}-${i}`,
          scenario.queries,
          testDuration,
          contextEngine,
          knowledgeGraph,
          rankingEngine
        );
        
        promises.push(userPromise);
      }

      // Wait for all users to complete
      const userResults = await Promise.all(promises);
      const totalDuration = Date.now() - startTime;

      // Aggregate results
      const totalRequests = userResults.reduce((sum, result) => sum + result.requests, 0);
      const totalErrors = userResults.reduce((sum, result) => sum + result.errors, 0);
      const allLatencies = userResults.flatMap(result => result.latencies);

      const aggregatedResult = {
        totalRequests,
        successfulRequests: totalRequests - totalErrors,
        failedRequests: totalErrors,
        errorRate: totalErrors / totalRequests,
        throughput: totalRequests / (totalDuration / 1000),
        latencies: allLatencies
      };

      console.log('\n📊 Concurrent User Test Results:');
      console.log(`   Total Requests: ${aggregatedResult.totalRequests}`);
      console.log(`   Error Rate: ${(aggregatedResult.errorRate * 100).toFixed(2)}%`);
      console.log(`   Throughput: ${aggregatedResult.throughput.toFixed(2)} QPS`);
      
      if (allLatencies.length > 0) {
        const sortedLatencies = allLatencies.sort((a, b) => a - b);
        const p95 = sortedLatencies[Math.floor(sortedLatencies.length * 0.95)];
        const avg = allLatencies.reduce((sum, lat) => sum + lat, 0) / allLatencies.length;
        
        console.log(`   Average Latency: ${avg.toFixed(2)}ms`);
        console.log(`   P95 Latency: ${p95.toFixed(2)}ms`);
        
        expect(p95).toBeLessThan(500);
      }

      // Validate concurrent user performance
      expect(aggregatedResult.errorRate).toBeLessThan(0.02); // < 2% error rate
      expect(aggregatedResult.throughput).toBeGreaterThan(10); // > 10 QPS
    });
  });

  async function runLoadTestPhase(
    scenario: string,
    concurrentUsers: number,
    duration: number,
    testQueries: any[],
    contextEngine: ContextDetectionEngine,
    knowledgeGraph: RuleKnowledgeGraph,
    rankingEngine: DirectiveRankingEngine
  ): Promise<LoadTestResult> {
    
    const initialMemory = process.memoryUsage().heapUsed / 1024 / 1024;
    let peakMemory = initialMemory;
    
    const results: Array<{ success: boolean; latency: number }> = [];
    const startTime = Date.now();
    const endTime = startTime + duration;
    
    // Create worker promises
    const workers: Promise<void>[] = [];
    
    for (let i = 0; i < concurrentUsers; i++) {
      const worker = (async () => {
        let requestCount = 0;
        
        while (Date.now() < endTime) {
          const query = testQueries[requestCount % testQueries.length];
          const requestStart = Date.now();
          
          try {
            const context = await contextEngine.detectContext(query.description);
            const directives = await knowledgeGraph.findRelevantDirectives(
              context.layer,
              context.topics
            );
            const ranked = await rankingEngine.rankDirectives(
              directives,
              context,
              { maxItems: 10 }
            );
            
            const latency = Date.now() - requestStart;
            results.push({ success: true, latency });
            
            // Track peak memory
            const currentMemory = process.memoryUsage().heapUsed / 1024 / 1024;
            peakMemory = Math.max(peakMemory, currentMemory);
            
          } catch (error) {
            const latency = Date.now() - requestStart;
            results.push({ success: false, latency });
          }
          
          requestCount++;
          
          // Small delay to prevent overwhelming the system
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      })();
      
      workers.push(worker);
    }
    
    // Wait for all workers to complete
    await Promise.all(workers);
    
    const finalMemory = process.memoryUsage().heapUsed / 1024 / 1024;
    const actualDuration = Date.now() - startTime;
    
    // Calculate metrics
    const successfulRequests = results.filter(r => r.success).length;
    const failedRequests = results.length - successfulRequests;
    const latencies = results.map(r => r.latency).sort((a, b) => a - b);
    
    return {
      scenario,
      totalRequests: results.length,
      successfulRequests,
      failedRequests,
      averageLatency: latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length,
      p95Latency: latencies[Math.floor(latencies.length * 0.95)] || 0,
      p99Latency: latencies[Math.floor(latencies.length * 0.99)] || 0,
      throughput: results.length / (actualDuration / 1000),
      errorRate: failedRequests / results.length,
      memoryUsage: {
        initial: initialMemory,
        peak: peakMemory,
        final: finalMemory
      }
    };
  }

  async function simulateUser(
    userId: string,
    queries: string[],
    duration: number,
    contextEngine: ContextDetectionEngine,
    knowledgeGraph: RuleKnowledgeGraph,
    rankingEngine: DirectiveRankingEngine
  ): Promise<{ requests: number; errors: number; latencies: number[] }> {
    
    const startTime = Date.now();
    const endTime = startTime + duration;
    let requests = 0;
    let errors = 0;
    const latencies: number[] = [];
    
    while (Date.now() < endTime) {
      const query = queries[requests % queries.length];
      const requestStart = Date.now();
      
      try {
        const context = await contextEngine.detectContext(query);
        const directives = await knowledgeGraph.findRelevantDirectives(
          context.layer,
          context.topics
        );
        const ranked = await rankingEngine.rankDirectives(
          directives,
          context,
          { maxItems: 5 }
        );
        
        const latency = Date.now() - requestStart;
        latencies.push(latency);
        
      } catch (error) {
        errors++;
      }
      
      requests++;
      
      // Simulate realistic user behavior with pauses
      const pauseTime = Math.random() * 2000 + 500; // 0.5-2.5s pause
      await new Promise(resolve => setTimeout(resolve, pauseTime));
    }
    
    return { requests, errors, latencies };
  }
});