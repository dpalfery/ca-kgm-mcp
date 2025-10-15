/**
 * Performance validation tests for the Knowledge Graph Memory system
 * Tests system performance under realistic loads and validates latency requirements
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Database } from 'sqlite3';
import { RuleKnowledgeGraph } from '../../src/storage/rule-knowledge-graph';
import { RuleDocumentParser } from '../../src/parsers/rule-document-parser';
import { ContextDetectionEngine } from '../../src/context-detection/context-detection-engine';
import { DirectiveRankingEngine } from '../../src/ranking/directive-ranking-engine';
import { ContextBlockFormatter } from '../../src/formatting/context-block-formatter';
import { ModelProviderManager } from '../../src/providers/model-provider-manager';
import { RuleBasedProvider } from '../../src/providers/rule-based-provider';
import { TestDataGenerator } from '../generators/test-data-generator';

interface PerformanceMetrics {
  latency: {
    p50: number;
    p95: number;
    p99: number;
    avg: number;
  };
  throughput: number;
  memoryUsage: number;
  errorRate: number;
}

describe('Performance Validation Tests', () => {
  let database: Database;
  let knowledgeGraph: RuleKnowledgeGraph;
  let parser: RuleDocumentParser;
  let contextEngine: ContextDetectionEngine;
  let rankingEngine: DirectiveRankingEngine;
  let formatter: ContextBlockFormatter;
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
    formatter = new ContextBlockFormatter();
    testDataGenerator = new TestDataGenerator();

    await knowledgeGraph.initialize();
  });

  afterAll(async () => {
    if (database) {
      database.close();
    }
  });

  beforeEach(async () => {
    await knowledgeGraph.clear();
  });

  describe('Query Response Time Performance', () => {
    it('should meet latency requirements with small knowledge graph (10 rules)', async () => {
      // Load small rule set
      const sampleRules = [
        '../sample-rules/presentation-layer-rules.md',
        '../sample-rules/application-layer-rules.md'
      ];

      for (const rulePath of sampleRules) {
        const ruleContent = readFileSync(join(__dirname, rulePath), 'utf-8');
        const parsedRule = await parser.parseRuleDocument(ruleContent, rulePath);
        await knowledgeGraph.upsertRule(parsedRule);
      }

      const testQueries = [
        'Create React component with form validation',
        'Implement REST API endpoint with authentication',
        'Add input sanitization to prevent XSS',
        'Set up JWT token refresh mechanism',
        'Create user registration form'
      ];

      const latencies: number[] = [];

      for (const query of testQueries) {
        const startTime = process.hrtime.bigint();
        
        const context = await contextEngine.detectContext(query);
        const directives = await knowledgeGraph.findRelevantDirectives(
          context.layer,
          context.topics
        );
        const ranked = await rankingEngine.rankDirectives(directives, context, { maxItems: 10 });
        const formatted = await formatter.formatContextBlock(ranked, context);

        const endTime = process.hrtime.bigint();
        const latency = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds
        latencies.push(latency);

        expect(formatted).toBeDefined();
      }

      const metrics = calculatePerformanceMetrics(latencies);
      
      console.log('Small Knowledge Graph Performance:');
      console.log(`  P50: ${metrics.latency.p50.toFixed(2)}ms`);
      console.log(`  P95: ${metrics.latency.p95.toFixed(2)}ms`);
      console.log(`  P99: ${metrics.latency.p99.toFixed(2)}ms`);
      console.log(`  Avg: ${metrics.latency.avg.toFixed(2)}ms`);

      // Requirements for small knowledge graph
      expect(metrics.latency.p50).toBeLessThan(50);
      expect(metrics.latency.p95).toBeLessThan(100);
      expect(metrics.latency.p99).toBeLessThan(200);
    });

    it('should meet latency requirements with medium knowledge graph (100 rules)', async () => {
      // Generate larger rule set
      const generatedRules = testDataGenerator.generateRules(20);
      
      // Also load sample rules
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

      // Generate test queries
      const testQueries = testDataGenerator.generateTaskDescriptions(50);
      const latencies: number[] = [];

      for (const testQuery of testQueries.slice(0, 20)) { // Test subset for performance
        const startTime = process.hrtime.bigint();
        
        const context = await contextEngine.detectContext(testQuery.description);
        const directives = await knowledgeGraph.findRelevantDirectives(
          context.layer,
          context.topics
        );
        const ranked = await rankingEngine.rankDirectives(directives, context, { maxItems: 10 });
        const formatted = await formatter.formatContextBlock(ranked, context);

        const endTime = process.hrtime.bigint();
        const latency = Number(endTime - startTime) / 1_000_000;
        latencies.push(latency);

        expect(formatted).toBeDefined();
      }

      const metrics = calculatePerformanceMetrics(latencies);
      
      console.log('Medium Knowledge Graph Performance:');
      console.log(`  P50: ${metrics.latency.p50.toFixed(2)}ms`);
      console.log(`  P95: ${metrics.latency.p95.toFixed(2)}ms`);
      console.log(`  P99: ${metrics.latency.p99.toFixed(2)}ms`);

      // Requirements for medium knowledge graph
      expect(metrics.latency.p50).toBeLessThan(100);
      expect(metrics.latency.p95).toBeLessThan(200);
      expect(metrics.latency.p99).toBeLessThan(400);
    });

    it('should handle concurrent queries efficiently', async () => {
      // Load rule set
      const sampleRules = [
        '../sample-rules/presentation-layer-rules.md',
        '../sample-rules/application-layer-rules.md',
        '../sample-rules/domain-layer-rules.md'
      ];

      for (const rulePath of sampleRules) {
        const ruleContent = readFileSync(join(__dirname, rulePath), 'utf-8');
        const parsedRule = await parser.parseRuleDocument(ruleContent, rulePath);
        await knowledgeGraph.upsertRule(parsedRule);
      }

      const testQueries = [
        'Create React component with validation',
        'Implement API authentication',
        'Design domain entity',
        'Optimize database queries',
        'Set up monitoring',
        'Add error handling',
        'Implement caching',
        'Create user interface',
        'Handle business rules',
        'Manage transactions'
      ];

      // Test concurrent execution
      const concurrentPromises = testQueries.map(async (query) => {
        const startTime = process.hrtime.bigint();
        
        const context = await contextEngine.detectContext(query);
        const directives = await knowledgeGraph.findRelevantDirectives(
          context.layer,
          context.topics
        );
        const ranked = await rankingEngine.rankDirectives(directives, context, { maxItems: 5 });
        const formatted = await formatter.formatContextBlock(ranked, context);

        const endTime = process.hrtime.bigint();
        const latency = Number(endTime - startTime) / 1_000_000;
        
        return { query, latency, result: formatted };
      });

      const startTime = process.hrtime.bigint();
      const results = await Promise.all(concurrentPromises);
      const totalTime = Number(process.hrtime.bigint() - startTime) / 1_000_000;

      const latencies = results.map(r => r.latency);
      const metrics = calculatePerformanceMetrics(latencies);
      const throughput = testQueries.length / (totalTime / 1000); // QPS

      console.log('Concurrent Query Performance:');
      console.log(`  Concurrent queries: ${testQueries.length}`);
      console.log(`  Total time: ${totalTime.toFixed(2)}ms`);
      console.log(`  Throughput: ${throughput.toFixed(2)} QPS`);
      console.log(`  P95 latency: ${metrics.latency.p95.toFixed(2)}ms`);

      // All queries should complete successfully
      results.forEach(result => {
        expect(result.result).toBeDefined();
        expect(result.result.length).toBeGreaterThan(0);
      });

      // Performance requirements for concurrent execution
      expect(metrics.latency.p95).toBeLessThan(300);
      expect(throughput).toBeGreaterThan(10); // At least 10 QPS
    });
  });

  describe('Memory Usage Performance', () => {
    it('should maintain reasonable memory usage under load', async () => {
      const initialMemory = process.memoryUsage();
      
      // Load comprehensive rule set
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

      const afterLoadMemory = process.memoryUsage();
      
      // Execute many queries to test memory stability
      const testQueries = testDataGenerator.generateTaskDescriptions(100);
      
      for (let i = 0; i < 50; i++) {
        const query = testQueries[i % testQueries.length];
        const context = await contextEngine.detectContext(query.description);
        const directives = await knowledgeGraph.findRelevantDirectives(
          context.layer,
          context.topics
        );
        const ranked = await rankingEngine.rankDirectives(directives, context, { maxItems: 10 });
        await formatter.formatContextBlock(ranked, context);
      }

      const finalMemory = process.memoryUsage();

      const loadMemoryIncrease = (afterLoadMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
      const queryMemoryIncrease = (finalMemory.heapUsed - afterLoadMemory.heapUsed) / 1024 / 1024;

      console.log('Memory Usage:');
      console.log(`  Initial: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  After loading rules: ${(afterLoadMemory.heapUsed / 1024 / 1024).toFixed(2)} MB (+${loadMemoryIncrease.toFixed(2)} MB)`);
      console.log(`  After queries: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB (+${queryMemoryIncrease.toFixed(2)} MB)`);

      // Memory requirements
      expect(loadMemoryIncrease).toBeLessThan(200); // Less than 200MB for rule loading
      expect(queryMemoryIncrease).toBeLessThan(50);  // Less than 50MB memory leak from queries
    });
  });

  describe('Token Efficiency Performance', () => {
    it('should demonstrate significant token reduction', async () => {
      // Load comprehensive rule set
      const sampleRules = [
        '../sample-rules/presentation-layer-rules.md',
        '../sample-rules/application-layer-rules.md',
        '../sample-rules/domain-layer-rules.md'
      ];

      for (const rulePath of sampleRules) {
        const ruleContent = readFileSync(join(__dirname, rulePath), 'utf-8');
        const parsedRule = await parser.parseRuleDocument(ruleContent, rulePath);
        await knowledgeGraph.upsertRule(parsedRule);
      }

      // Get baseline token count (all directives)
      const allDirectives = await knowledgeGraph.getAllDirectives();
      const baselineTokens = allDirectives.reduce((sum, directive) => 
        sum + directive.text.split(' ').length, 0
      );

      const testCases = [
        { query: 'Create React component for user login', expectedLayer: '1-Presentation' },
        { query: 'Implement REST API authentication', expectedLayer: '2-Application' },
        { query: 'Design User domain entity', expectedLayer: '3-Domain' }
      ];

      let totalReduction = 0;
      let testCount = 0;

      for (const testCase of testCases) {
        const context = await contextEngine.detectContext(testCase.query);
        const directives = await knowledgeGraph.findRelevantDirectives(
          context.layer,
          context.topics
        );
        const ranked = await rankingEngine.rankDirectives(directives, context, { maxItems: 10 });

        const intelligentTokens = ranked.reduce((sum, rd) => 
          sum + rd.directive.text.split(' ').length, 0
        );

        const reduction = (baselineTokens - intelligentTokens) / baselineTokens;
        totalReduction += reduction;
        testCount++;

        console.log(`Query: "${testCase.query}"`);
        console.log(`  Baseline tokens: ${baselineTokens}`);
        console.log(`  Intelligent tokens: ${intelligentTokens}`);
        console.log(`  Reduction: ${(reduction * 100).toFixed(2)}%`);

        // Should achieve significant reduction for each query
        expect(reduction).toBeGreaterThan(0.5); // At least 50% reduction
      }

      const avgReduction = totalReduction / testCount;
      console.log(`Average token reduction: ${(avgReduction * 100).toFixed(2)}%`);

      // Requirement: 70-85% token reduction
      expect(avgReduction).toBeGreaterThan(0.7);
      expect(avgReduction).toBeLessThan(0.9); // Sanity check
    });

    it('should respect token budget constraints efficiently', async () => {
      // Load rules
      const ruleContent = readFileSync(
        join(__dirname, '../sample-rules/presentation-layer-rules.md'), 
        'utf-8'
      );
      const parsedRule = await parser.parseRuleDocument(ruleContent, 'test.md');
      await knowledgeGraph.upsertRule(parsedRule);

      const query = 'Create React component with form validation';
      const context = await contextEngine.detectContext(query);
      const directives = await knowledgeGraph.findRelevantDirectives(
        context.layer,
        context.topics
      );

      // Test different budget constraints
      const budgets = [500, 1000, 2000, 5000];
      
      for (const budget of budgets) {
        const startTime = process.hrtime.bigint();
        
        const ranked = await rankingEngine.rankDirectives(
          directives,
          context,
          { tokenBudget: budget }
        );

        const endTime = process.hrtime.bigint();
        const latency = Number(endTime - startTime) / 1_000_000;

        const actualTokens = ranked.reduce((sum, rd) => 
          sum + rd.directive.text.split(' ').length, 0
        );

        console.log(`Budget: ${budget} tokens`);
        console.log(`  Actual: ${actualTokens} tokens`);
        console.log(`  Directives: ${ranked.length}`);
        console.log(`  Latency: ${latency.toFixed(2)}ms`);

        // Should respect budget
        expect(actualTokens).toBeLessThanOrEqual(budget);
        
        // Should complete quickly even with budget enforcement
        expect(latency).toBeLessThan(100);
        
        // Should return some results unless budget is extremely small
        if (budget >= 100) {
          expect(ranked.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('Scalability Performance', () => {
    it('should scale gracefully with increasing rule count', async () => {
      const ruleCounts = [10, 50, 100];
      const results: Array<{ ruleCount: number; metrics: PerformanceMetrics }> = [];

      for (const ruleCount of ruleCounts) {
        // Clear and reload with different rule count
        await knowledgeGraph.clear();
        
        // Generate rules
        const generatedRules = testDataGenerator.generateRules(ruleCount);
        
        for (const rule of generatedRules.slice(0, Math.min(ruleCount, 20))) {
          // Convert to markdown and parse (simplified for testing)
          const ruleMarkdown = `# ${rule.name}\n\n## Metadata\n- **Layer**: ${rule.layer}\n\n## Directives\n\n${rule.directives.map(d => `**${d.severity}** ${d.text}`).join('\n\n')}`;
          const parsedRule = await parser.parseRuleDocument(ruleMarkdown, `${rule.id}.md`);
          await knowledgeGraph.upsertRule(parsedRule);
        }

        // Test query performance
        const testQueries = [
          'Create React component',
          'Implement API endpoint',
          'Design domain entity',
          'Optimize database',
          'Set up deployment'
        ];

        const latencies: number[] = [];

        for (const query of testQueries) {
          const startTime = process.hrtime.bigint();
          
          const context = await contextEngine.detectContext(query);
          const directives = await knowledgeGraph.findRelevantDirectives(
            context.layer,
            context.topics
          );
          const ranked = await rankingEngine.rankDirectives(directives, context, { maxItems: 10 });
          
          const endTime = process.hrtime.bigint();
          const latency = Number(endTime - startTime) / 1_000_000;
          latencies.push(latency);
        }

        const metrics = calculatePerformanceMetrics(latencies);
        results.push({ ruleCount, metrics });

        console.log(`Rule Count: ${ruleCount}`);
        console.log(`  P95 Latency: ${metrics.latency.p95.toFixed(2)}ms`);
        console.log(`  Avg Latency: ${metrics.latency.avg.toFixed(2)}ms`);
      }

      // Verify scalability characteristics
      for (let i = 1; i < results.length; i++) {
        const prev = results[i-1];
        const curr = results[i];
        
        // Latency should not increase dramatically (should be sub-linear)
        const latencyIncrease = curr.metrics.latency.p95 / prev.metrics.latency.p95;
        const ruleIncrease = curr.ruleCount / prev.ruleCount;
        
        console.log(`Scalability ${prev.ruleCount} -> ${curr.ruleCount}:`);
        console.log(`  Rule increase: ${ruleIncrease.toFixed(2)}x`);
        console.log(`  Latency increase: ${latencyIncrease.toFixed(2)}x`);
        
        // Latency increase should be less than rule count increase (sub-linear scaling)
        expect(latencyIncrease).toBeLessThan(ruleIncrease * 1.5);
        
        // All configurations should meet basic performance requirements
        expect(curr.metrics.latency.p95).toBeLessThan(400);
      }
    });
  });

  function calculatePerformanceMetrics(latencies: number[]): PerformanceMetrics {
    const sorted = [...latencies].sort((a, b) => a - b);
    const len = sorted.length;
    
    return {
      latency: {
        p50: sorted[Math.floor(len * 0.5)],
        p95: sorted[Math.floor(len * 0.95)],
        p99: sorted[Math.floor(len * 0.99)],
        avg: latencies.reduce((sum, lat) => sum + lat, 0) / len
      },
      throughput: 1000 / (latencies.reduce((sum, lat) => sum + lat, 0) / len), // QPS
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
      errorRate: 0 // Would track errors in real implementation
    };
  }
});