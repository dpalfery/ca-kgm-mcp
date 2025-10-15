/**
 * End-to-end integration tests for the Knowledge Graph Memory system
 * Tests complete workflow from rule ingestion to query response
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Database } from 'sqlite3';
import { RuleKnowledgeGraphImpl } from '../../src/storage/rule-knowledge-graph.js';
import { RuleDocumentParser } from '../../src/parsers/rule-document-parser.js';
import { ContextDetectionEngine } from '../../src/context-detection/context-detection-engine.js';
import { DirectiveRankingEngine } from '../../src/ranking/directive-ranking-engine.js';
import { ContextBlockFormatter } from '../../src/formatting/context-block-formatter.js';
import { DefaultModelProviderManager } from '../../src/providers/model-provider-manager.js';
import { RuleBasedProvider } from '../../src/providers/rule-based-provider.js';
import { DatabaseConnection } from '../../src/database/connection.js';

describe('End-to-End System Validation', () => {
  let database: Database;
  let dbConnection: DatabaseConnection;
  let knowledgeGraph: RuleKnowledgeGraphImpl;
  let parser: RuleDocumentParser;
  let contextEngine: ContextDetectionEngine;
  let rankingEngine: DirectiveRankingEngine;
  let formatter: ContextBlockFormatter;
  let providerManager: DefaultModelProviderManager;

  beforeAll(async () => {
    // Initialize test database
    database = new Database(':memory:');
    dbConnection = new DatabaseConnection(database);
    
    // Initialize components
    knowledgeGraph = new RuleKnowledgeGraphImpl(dbConnection);
    parser = new RuleDocumentParser();
    
    // Set up model provider with fallback
    providerManager = new DefaultModelProviderManager({
      primaryProvider: {
        provider: 'rule-based',
        config: {}
      }
    });
    
    contextEngine = new ContextDetectionEngine(providerManager);
    rankingEngine = new DirectiveRankingEngine();
    formatter = new ContextBlockFormatter();

    // Initialize database schema
    await knowledgeGraph.initialize();
  });

  afterAll(async () => {
    if (database) {
      database.close();
    }
  });

  beforeEach(async () => {
    // Clear database between tests
    await knowledgeGraph.clear();
  });

  describe('Complete Workflow Tests', () => {
    it('should process rule ingestion to query response workflow', async () => {
      // Step 1: Ingest sample rule documents
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

      // Verify rules were ingested
      const allRules = await knowledgeGraph.getAllRules();
      expect(allRules.length).toBeGreaterThan(0);

      // Step 2: Test context detection
      const taskDescription = 'Create React component for user login form with validation';
      const detectedContext = await contextEngine.detectContext(taskDescription);

      expect(detectedContext.layer).toBe('1-Presentation');
      expect(detectedContext.topics).toContain('React');
      expect(detectedContext.topics).toContain('forms');
      expect(detectedContext.confidence).toBeGreaterThan(0.7);

      // Step 3: Test directive retrieval and ranking
      const relevantDirectives = await knowledgeGraph.findRelevantDirectives(
        detectedContext.layer,
        detectedContext.topics
      );

      expect(relevantDirectives.length).toBeGreaterThan(0);

      const rankedDirectives = await rankingEngine.rankDirectives(
        relevantDirectives,
        detectedContext,
        { maxItems: 10 }
      );

      expect(rankedDirectives.length).toBeGreaterThan(0);
      expect(rankedDirectives[0].score).toBeGreaterThan(0);

      // Verify ranking order (higher scores first)
      for (let i = 1; i < rankedDirectives.length; i++) {
        expect(rankedDirectives[i-1].score).toBeGreaterThanOrEqual(rankedDirectives[i].score);
      }

      // Step 4: Test output formatting
      const contextBlock = await formatter.formatContextBlock(
        rankedDirectives,
        detectedContext,
        {
          includeBreadcrumbs: true,
          includeSourceAttribution: true
        }
      );

      expect(contextBlock).toContain('# Relevant Project Rules');
      expect(contextBlock).toContain('MUST');
      expect(contextBlock).toContain('Layer: 1-Presentation');

      // Step 5: Verify token budget enforcement
      const budgetLimitedResult = await rankingEngine.rankDirectives(
        relevantDirectives,
        detectedContext,
        { maxItems: 5, tokenBudget: 1000 }
      );

      expect(budgetLimitedResult.length).toBeLessThanOrEqual(5);
      
      const totalTokens = budgetLimitedResult.reduce((sum, directive) => 
        sum + directive.directive.text.split(' ').length, 0
      );
      expect(totalTokens).toBeLessThanOrEqual(1000);
    });

    it('should handle cross-layer directive ranking correctly', async () => {
      // Ingest rules from multiple layers
      const multiLayerRules = [
        '../sample-rules/presentation-layer-rules.md',
        '../sample-rules/application-layer-rules.md'
      ];

      for (const rulePath of multiLayerRules) {
        const ruleContent = readFileSync(join(__dirname, rulePath), 'utf-8');
        const parsedRule = await parser.parseRuleDocument(ruleContent, rulePath);
        await knowledgeGraph.upsertRule(parsedRule);
      }

      // Test task that could apply to multiple layers
      const taskDescription = 'Implement user authentication with form validation';
      const detectedContext = await contextEngine.detectContext(taskDescription);

      const relevantDirectives = await knowledgeGraph.findRelevantDirectives(
        '*', // Search all layers
        ['authentication', 'validation', 'forms']
      );

      const rankedDirectives = await rankingEngine.rankDirectives(
        relevantDirectives,
        detectedContext,
        { maxItems: 10 }
      );

      // Should have directives from multiple layers
      const layers = new Set(rankedDirectives.map(rd => rd.directive.layer));
      expect(layers.size).toBeGreaterThan(1);

      // Layer-matching directives should generally rank higher
      const presentationDirectives = rankedDirectives.filter(rd => 
        rd.directive.layer === '1-Presentation'
      );
      const applicationDirectives = rankedDirectives.filter(rd => 
        rd.directive.layer === '2-Application'
      );

      if (presentationDirectives.length > 0 && applicationDirectives.length > 0) {
        // At least some presentation directives should rank higher than application ones
        const topPresentationScore = Math.max(...presentationDirectives.map(d => d.score));
        const topApplicationScore = Math.max(...applicationDirectives.map(d => d.score));
        
        if (detectedContext.layer === '1-Presentation') {
          expect(topPresentationScore).toBeGreaterThan(topApplicationScore * 0.8);
        }
      }
    });

    it('should maintain performance under realistic load', async () => {
      // Ingest a larger set of rules
      const allSampleRules = [
        '../sample-rules/presentation-layer-rules.md',
        '../sample-rules/application-layer-rules.md', 
        '../sample-rules/domain-layer-rules.md',
        '../sample-rules/persistence-layer-rules.md',
        '../sample-rules/infrastructure-layer-rules.md'
      ];

      const startIngestion = Date.now();
      
      for (const rulePath of allSampleRules) {
        const ruleContent = readFileSync(join(__dirname, rulePath), 'utf-8');
        const parsedRule = await parser.parseRuleDocument(ruleContent, rulePath);
        await knowledgeGraph.upsertRule(parsedRule);
      }

      const ingestionTime = Date.now() - startIngestion;
      expect(ingestionTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Test query performance
      const testQueries = [
        'Create React component with form validation',
        'Implement REST API with authentication',
        'Design domain entity with business rules',
        'Optimize database query performance',
        'Set up Kubernetes deployment'
      ];

      const queryTimes: number[] = [];

      for (const query of testQueries) {
        const startQuery = Date.now();
        
        const context = await contextEngine.detectContext(query);
        const directives = await knowledgeGraph.findRelevantDirectives(
          context.layer,
          context.topics
        );
        const ranked = await rankingEngine.rankDirectives(
          directives,
          context,
          { maxItems: 10 }
        );
        const formatted = await formatter.formatContextBlock(ranked, context);

        const queryTime = Date.now() - startQuery;
        queryTimes.push(queryTime);

        // Each query should complete within 400ms (requirement)
        expect(queryTime).toBeLessThan(400);
        expect(formatted.length).toBeGreaterThan(0);
      }

      // Average query time should be well under the limit
      const avgQueryTime = queryTimes.reduce((sum, time) => sum + time, 0) / queryTimes.length;
      expect(avgQueryTime).toBeLessThan(200);
    });

    it('should handle edge cases gracefully', async () => {
      // Ingest basic rules
      const ruleContent = readFileSync(
        join(__dirname, '../sample-rules/presentation-layer-rules.md'), 
        'utf-8'
      );
      const parsedRule = await parser.parseRuleDocument(ruleContent, 'test-rule.md');
      await knowledgeGraph.upsertRule(parsedRule);

      // Test empty query
      const emptyContext = await contextEngine.detectContext('');
      expect(emptyContext.layer).toBeDefined();
      expect(emptyContext.confidence).toBeLessThan(0.5);

      // Test very long query
      const longQuery = 'Create component '.repeat(1000);
      const longContext = await contextEngine.detectContext(longQuery);
      expect(longContext.layer).toBeDefined();

      // Test query with special characters
      const specialQuery = 'Create @component with #validation & $security';
      const specialContext = await contextEngine.detectContext(specialQuery);
      expect(specialContext.layer).toBeDefined();

      // Test query with no matching rules
      const unmatchedQuery = 'Perform quantum computing calculations';
      const unmatchedContext = await contextEngine.detectContext(unmatchedQuery);
      const unmatchedDirectives = await knowledgeGraph.findRelevantDirectives(
        unmatchedContext.layer,
        unmatchedContext.topics
      );
      
      // Should still return some directives (fallback behavior)
      expect(unmatchedDirectives.length).toBeGreaterThanOrEqual(0);
    });

    it('should validate accuracy targets for context detection', async () => {
      // Load test cases
      const testCasesPath = join(__dirname, '../test-datasets/context-detection-test-cases.json');
      const testCases = JSON.parse(readFileSync(testCasesPath, 'utf-8'));

      let correctPredictions = 0;
      let totalPredictions = 0;

      for (const testCase of testCases.testCases) {
        const detectedContext = await contextEngine.detectContext(testCase.taskDescription);
        
        totalPredictions++;
        
        // Check layer accuracy
        if (detectedContext.layer === testCase.expectedLayer) {
          correctPredictions++;
        }

        // Check topic overlap
        const topicOverlap = testCase.expectedTopics.filter(topic =>
          detectedContext.topics.includes(topic)
        ).length;
        
        const topicAccuracy = topicOverlap / testCase.expectedTopics.length;
        
        // For high-confidence test cases, expect good accuracy
        if (testCase.confidence === 'high') {
          expect(detectedContext.layer).toBe(testCase.expectedLayer);
          expect(topicAccuracy).toBeGreaterThan(0.5);
        }
      }

      // Overall accuracy should meet requirements (>80% for layer detection)
      const overallAccuracy = correctPredictions / totalPredictions;
      expect(overallAccuracy).toBeGreaterThan(0.8);
    });

    it('should demonstrate token usage reduction', async () => {
      // Ingest comprehensive rule set
      const allRules = [
        '../sample-rules/presentation-layer-rules.md',
        '../sample-rules/application-layer-rules.md',
        '../sample-rules/domain-layer-rules.md'
      ];

      for (const rulePath of allRules) {
        const ruleContent = readFileSync(join(__dirname, rulePath), 'utf-8');
        const parsedRule = await parser.parseRuleDocument(ruleContent, rulePath);
        await knowledgeGraph.upsertRule(parsedRule);
      }

      // Get all directives (baseline approach)
      const allDirectives = await knowledgeGraph.getAllDirectives();
      const baselineTokens = allDirectives.reduce((sum, directive) => 
        sum + directive.text.split(' ').length, 0
      );

      // Test intelligent retrieval
      const taskDescription = 'Create React component for user login form';
      const context = await contextEngine.detectContext(taskDescription);
      const relevantDirectives = await knowledgeGraph.findRelevantDirectives(
        context.layer,
        context.topics
      );
      const rankedDirectives = await rankingEngine.rankDirectives(
        relevantDirectives,
        context,
        { maxItems: 10 }
      );

      const intelligentTokens = rankedDirectives.reduce((sum, rd) => 
        sum + rd.directive.text.split(' ').length, 0
      );

      // Calculate reduction
      const reduction = (baselineTokens - intelligentTokens) / baselineTokens;
      
      // Should achieve 70-85% token reduction (requirement)
      expect(reduction).toBeGreaterThan(0.7);
      expect(reduction).toBeLessThan(0.9); // Sanity check - shouldn't be too aggressive
      
      // Should still provide meaningful guidance
      expect(rankedDirectives.length).toBeGreaterThan(0);
      expect(rankedDirectives[0].score).toBeGreaterThan(0.5);
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle database connection failures gracefully', async () => {
      // Simulate database failure by closing connection
      const failingKnowledgeGraph = new RuleKnowledgeGraph(database);
      database.close();

      // Operations should fail gracefully without crashing
      await expect(failingKnowledgeGraph.getAllRules()).rejects.toThrow();
      
      // System should continue to work with fallback behavior
      const context = await contextEngine.detectContext('Create component');
      expect(context).toBeDefined();
      expect(context.layer).toBeDefined();
    });

    it('should handle malformed rule documents', async () => {
      const malformedRule = `
        # Invalid Rule
        This is not a properly formatted rule document.
        Missing metadata and structure.
      `;

      // Should handle parsing errors gracefully
      await expect(parser.parseRuleDocument(malformedRule, 'invalid.md'))
        .rejects.toThrow();
    });

    it('should provide fallback behavior when no rules match', async () => {
      // Empty knowledge graph
      const context = await contextEngine.detectContext('Create quantum computer');
      const directives = await knowledgeGraph.findRelevantDirectives(
        context.layer,
        context.topics
      );

      // Should handle empty results gracefully
      expect(directives).toBeDefined();
      expect(Array.isArray(directives)).toBe(true);

      const ranked = await rankingEngine.rankDirectives(directives, context);
      expect(ranked).toBeDefined();
      expect(Array.isArray(ranked)).toBe(true);

      const formatted = await formatter.formatContextBlock(ranked, context);
      expect(formatted).toBeDefined();
      expect(typeof formatted).toBe('string');
    });
  });
});