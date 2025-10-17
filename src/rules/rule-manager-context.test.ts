/**
 * Integration Tests for Context Detection (Phase 2)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { RuleManager } from './rule-manager.js';
import { loadNeo4jConfig } from '../config/neo4j-config.js';

describe('Context Detection Integration Tests', () => {
  let ruleManager: RuleManager;

  beforeAll(async () => {
    // Skip if Neo4j credentials are not available
    try {
      const config = loadNeo4jConfig();
      ruleManager = new RuleManager(config);
      await ruleManager.initialize();
    } catch (error) {
      console.log('Skipping integration tests - Neo4j not configured');
    }
  });

  afterAll(async () => {
    if (ruleManager) {
      await ruleManager.close();
    }
  });

  describe('detectContext', () => {
    it('should detect frontend/UI context', async () => {
      if (!ruleManager) return;

      const result = await ruleManager.handleTool('memory.rules.detect_context', {
        text: 'Build a React component with form inputs and submit button',
        options: {
          returnKeywords: true,
          confidenceThreshold: 0.5
        }
      });

      expect(result.detectedLayer).toBe('1-Presentation');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.topics).toContain('state-management');
      expect(result.technologies).toContain('React');
      expect(result.keywords).toBeDefined();
      expect(Array.isArray(result.keywords)).toBe(true);
    });

    it('should detect API/Integration context', async () => {
      if (!ruleManager) return;

      const result = await ruleManager.handleTool('memory.rules.detect_context', {
        text: 'Create REST API endpoints with authentication using Express',
        options: {
          confidenceThreshold: 0.5
        }
      });

      expect(result.detectedLayer).toBe('5-Integration');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.topics.some((t: string) => ['api', 'security'].includes(t))).toBe(true);
      expect(result.technologies).toContain('Express');
    });

    it('should detect database/persistence context', async () => {
      if (!ruleManager) return;

      const result = await ruleManager.handleTool('memory.rules.detect_context', {
        text: 'Implement repository pattern with Prisma ORM for PostgreSQL database',
        options: {
          confidenceThreshold: 0.5
        }
      });

      expect(result.detectedLayer).toBe('4-Persistence');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.topics).toContain('database');
      expect(result.technologies.some((t: string) => ['Prisma', 'PostgreSQL'].includes(t))).toBe(true);
    });

    it('should detect deployment context', async () => {
      if (!ruleManager) return;

      const result = await ruleManager.handleTool('memory.rules.detect_context', {
        text: 'Set up Docker containerization and Kubernetes deployment pipeline',
        options: {
          confidenceThreshold: 0.5
        }
      });

      expect(result.detectedLayer).toBe('7-Deployment');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.topics).toContain('deployment');
      expect(result.technologies.some((t: string) => ['Docker', 'Kubernetes'].includes(t))).toBe(true);
    });

    it('should detect multiple topics', async () => {
      if (!ruleManager) return;

      const result = await ruleManager.handleTool('memory.rules.detect_context', {
        text: 'Build secure REST API with authentication, testing, and documentation',
        options: {
          confidenceThreshold: 0.3
        }
      });

      expect(result.topics.length).toBeGreaterThan(2);
      expect(result.topics).toContain('security');
      expect(result.topics).toContain('api');
    });

    it('should provide alternative contexts when confidence is borderline', async () => {
      if (!ruleManager) return;

      const result = await ruleManager.handleTool('memory.rules.detect_context', {
        text: 'service handler',
        options: {
          confidenceThreshold: 0.5
        }
      });

      expect(result.alternativeContexts).toBeDefined();
      expect(Array.isArray(result.alternativeContexts)).toBe(true);
    });

    it('should handle text with no clear context', async () => {
      if (!ruleManager) return;

      const result = await ruleManager.handleTool('memory.rules.detect_context', {
        text: 'do something',
        options: {
          confidenceThreshold: 0.5
        }
      });

      expect(result.detectedLayer).toBe('*');
      expect(result.confidence).toBeLessThan(0.5);
    });

    it('should complete detection in under 200ms', async () => {
      if (!ruleManager) return;

      const startTime = Date.now();
      
      await ruleManager.handleTool('memory.rules.detect_context', {
        text: 'Build React application with TypeScript, Express backend, PostgreSQL database, and Docker deployment',
        options: {
          returnKeywords: true,
          confidenceThreshold: 0.5
        }
      });

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(200);
    });
  });

  describe('queryDirectives with context detection', () => {
    it('should use detected context in directive query', async () => {
      if (!ruleManager) return;

      const result = await ruleManager.handleTool('memory.rules.query_directives', {
        taskDescription: 'Create REST API with authentication',
        options: {
          maxItems: 8,
          tokenBudget: 1000
        }
      });

      expect(result.context_block).toContain('Detected Context');
      expect(result.diagnostics.detectedLayer).toBeDefined();
      expect(result.diagnostics.topics).toBeDefined();
      expect(result.diagnostics.technologies).toBeDefined();
    });

    it('should include detected topics in context block', async () => {
      if (!ruleManager) return;

      const result = await ruleManager.handleTool('memory.rules.query_directives', {
        taskDescription: 'Implement secure authentication with JWT tokens and password encryption',
        options: {
          maxItems: 8
        }
      });

      expect(result.context_block).toContain('security');
      expect(result.diagnostics.topics).toContain('security');
    });

    it('should include detected technologies in context block', async () => {
      if (!ruleManager) return;

      const result = await ruleManager.handleTool('memory.rules.query_directives', {
        taskDescription: 'Build React frontend with TypeScript',
        options: {
          maxItems: 8
        }
      });

      const hasReactOrTypeScript = 
        result.context_block.includes('React') || 
        result.context_block.includes('TypeScript');
      
      expect(hasReactOrTypeScript).toBe(true);
      expect(result.diagnostics.technologies.length).toBeGreaterThan(0);
    });
  });
});
