import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryDirectivesTool } from '../query-directives-tool.js';
import { QueryDirectivesInput, ErrorType } from '../../types.js';
import { DefaultModelProviderManager } from '../../providers/model-provider-manager.js';
import { RuleKnowledgeGraphImpl } from '../../storage/rule-knowledge-graph.js';

/**
 * Unit tests for QueryDirectivesTool
 */
describe('QueryDirectivesTool', () => {
  let tool: QueryDirectivesTool;
  let mockModelProviderManager: DefaultModelProviderManager;
  let mockKnowledgeGraph: RuleKnowledgeGraphImpl;

  beforeEach(() => {
    // Create mocks
    mockModelProviderManager = {
      getPrimaryProvider: vi.fn(),
      getFallbackProviders: vi.fn(),
      detectContextWithFallback: vi.fn()
    } as any;

    mockKnowledgeGraph = {
      queryDirectives: vi.fn(),
      getRules: vi.fn(),
      getRuleStats: vi.fn()
    } as any;

    tool = new QueryDirectivesTool(mockModelProviderManager, mockKnowledgeGraph);
  });

  describe('Input Validation', () => {
    it('should reject empty task description', async () => {
      const input: QueryDirectivesInput = {
        taskDescription: ''
      };

      const result = await tool.execute(input);

      expect(result.context_block).toContain('Fallback Mode');
      expect(result.diagnostics.fallbackUsed).toBe(true);
    });

    it('should reject invalid mode slug', async () => {
      const input: QueryDirectivesInput = {
        taskDescription: 'Valid task',
        modeSlug: 'invalid' as any
      };

      const result = await tool.execute(input);

      expect(result.context_block).toContain('Fallback Mode');
      expect(result.diagnostics.fallbackUsed).toBe(true);
    });

    it('should reject invalid maxItems', async () => {
      const input: QueryDirectivesInput = {
        taskDescription: 'Valid task',
        options: {
          maxItems: 0 // Invalid
        }
      };

      const result = await tool.execute(input);

      expect(result.context_block).toContain('Fallback Mode');
      expect(result.diagnostics.fallbackUsed).toBe(true);
    });

    it('should reject invalid token budget', async () => {
      const input: QueryDirectivesInput = {
        taskDescription: 'Valid task',
        options: {
          tokenBudget: 50 // Too small
        }
      };

      const result = await tool.execute(input);

      expect(result.context_block).toContain('Fallback Mode');
      expect(result.diagnostics.fallbackUsed).toBe(true);
    });

    it('should accept valid input', async () => {
      const input: QueryDirectivesInput = {
        taskDescription: 'Create API endpoint',
        modeSlug: 'code',
        options: {
          maxItems: 10,
          tokenBudget: 1000,
          includeBreadcrumbs: true
        }
      };

      // Mock successful context detection
      vi.mocked(mockModelProviderManager.detectContextWithFallback).mockResolvedValue({
        context: {
          layer: '2-Application',
          topics: ['api'],
          keywords: ['endpoint'],
          technologies: [],
          confidence: 0.8
        },
        providerUsed: 'test-provider',
        fallbackUsed: false
      });

      // Mock empty directives (will use fallback)
      vi.mocked(mockKnowledgeGraph.queryDirectives).mockResolvedValue([]);

      const result = await tool.execute(input);

      expect(result).toBeDefined();
      expect(result.context_block).toContain('Project Context');
    });
  });

  describe('Context Detection Integration', () => {
    it('should handle context detection success', async () => {
      const input: QueryDirectivesInput = {
        taskDescription: 'Create database repository'
      };

      vi.mocked(mockModelProviderManager.detectContextWithFallback).mockResolvedValue({
        context: {
          layer: '4-Persistence',
          topics: ['database', 'repository'],
          keywords: ['database', 'repository'],
          technologies: ['sql'],
          confidence: 0.9
        },
        providerUsed: 'test-provider',
        fallbackUsed: false
      });

      vi.mocked(mockKnowledgeGraph.queryDirectives).mockResolvedValue([]);

      const result = await tool.execute(input);

      expect(result.diagnostics.confidence).toBe(0.9);
      expect(result.diagnostics.modelProvider).toBe('test-provider');
      expect(result.diagnostics.fallbackUsed).toBe(false);
    });

    it('should handle context detection failure', async () => {
      const input: QueryDirectivesInput = {
        taskDescription: 'Create something'
      };

      vi.mocked(mockModelProviderManager.detectContextWithFallback).mockRejectedValue(
        new Error('Context detection failed')
      );

      const result = await tool.execute(input);

      expect(result.context_block).toContain('Fallback Mode');
      expect(result.diagnostics.fallbackUsed).toBe(true);
      expect(result.diagnostics.modelProvider).toBeUndefined();
    });
  });

  describe('Knowledge Graph Integration', () => {
    it('should query directives based on detected context', async () => {
      const input: QueryDirectivesInput = {
        taskDescription: 'Create API endpoint'
      };

      vi.mocked(mockModelProviderManager.detectContextWithFallback).mockResolvedValue({
        context: {
          layer: '2-Application',
          topics: ['api'],
          keywords: ['endpoint'],
          technologies: [],
          confidence: 0.8
        },
        providerUsed: 'test-provider',
        fallbackUsed: false
      });

      const mockDirectives = [
        {
          id: 'dir-1',
          ruleId: 'rule-1',
          section: 'API Design',
          severity: 'MUST' as const,
          text: 'Use RESTful conventions',
          topics: ['api'],
          whenToApply: ['creating endpoints'],
          score: 0,
          scoreBreakdown: {
            authority: 0,
            layerMatch: 0,
            topicOverlap: 0,
            severityBoost: 0,
            semanticSimilarity: 0,
            whenToApply: 0
          }
        }
      ];

      vi.mocked(mockKnowledgeGraph.queryDirectives).mockResolvedValue(mockDirectives);

      const result = await tool.execute(input);

      expect(mockKnowledgeGraph.queryDirectives).toHaveBeenCalledWith({
        layers: ['2-Application'],
        topics: ['api'],
        limit: 500
      });

      expect(result.diagnostics.totalDirectives).toBe(1);
    });

    it('should handle knowledge graph errors', async () => {
      const input: QueryDirectivesInput = {
        taskDescription: 'Create API endpoint'
      };

      vi.mocked(mockModelProviderManager.detectContextWithFallback).mockResolvedValue({
        context: {
          layer: '2-Application',
          topics: ['api'],
          keywords: ['endpoint'],
          technologies: [],
          confidence: 0.8
        },
        providerUsed: 'test-provider',
        fallbackUsed: false
      });

      vi.mocked(mockKnowledgeGraph.queryDirectives).mockRejectedValue(
        new Error('Database connection failed')
      );

      const result = await tool.execute(input);

      expect(result.context_block).toContain('Fallback Mode');
      expect(result.diagnostics.fallbackUsed).toBe(true);
    });
  });

  describe('Mode-Specific Behavior', () => {
    beforeEach(() => {
      vi.mocked(mockModelProviderManager.detectContextWithFallback).mockResolvedValue({
        context: {
          layer: '2-Application',
          topics: ['api'],
          keywords: ['service'],
          technologies: [],
          confidence: 0.8
        },
        providerUsed: 'test-provider',
        fallbackUsed: false
      });

      vi.mocked(mockKnowledgeGraph.queryDirectives).mockResolvedValue([]);
    });

    it('should adjust query for architect mode', async () => {
      const input: QueryDirectivesInput = {
        taskDescription: 'Design service architecture',
        modeSlug: 'architect'
      };

      await tool.execute(input);

      expect(mockKnowledgeGraph.queryDirectives).toHaveBeenCalledWith({
        layers: ['2-Application'],
        topics: ['api', 'architecture', 'design', 'patterns'],
        limit: 500
      });
    });

    it('should adjust query for debug mode', async () => {
      const input: QueryDirectivesInput = {
        taskDescription: 'Debug service issues',
        modeSlug: 'debug'
      };

      await tool.execute(input);

      expect(mockKnowledgeGraph.queryDirectives).toHaveBeenCalledWith({
        layers: ['2-Application'],
        topics: ['api', 'debugging', 'testing', 'error-handling', 'logging'],
        limit: 500
      });
    });

    it('should use default query for code mode', async () => {
      const input: QueryDirectivesInput = {
        taskDescription: 'Implement service logic',
        modeSlug: 'code'
      };

      await tool.execute(input);

      expect(mockKnowledgeGraph.queryDirectives).toHaveBeenCalledWith({
        layers: ['2-Application'],
        topics: ['api'],
        limit: 500
      });
    });
  });

  describe('Fallback Scenarios', () => {
    it('should provide security-focused fallback for API tasks', async () => {
      const input: QueryDirectivesInput = {
        taskDescription: 'Create API endpoint for user data'
      };

      // Force fallback by making everything fail
      vi.mocked(mockModelProviderManager.detectContextWithFallback).mockRejectedValue(
        new Error('All providers failed')
      );

      const result = await tool.execute(input);

      expect(result.context_block).toContain('Validate all user inputs');
      expect(result.context_block).toContain('authentication and authorization');
      expect(result.context_block).toContain('API endpoints');
    });

    it('should provide database-focused fallback for data tasks', async () => {
      const input: QueryDirectivesInput = {
        taskDescription: 'Implement database operations for user model'
      };

      vi.mocked(mockModelProviderManager.detectContextWithFallback).mockRejectedValue(
        new Error('All providers failed')
      );

      const result = await tool.execute(input);

      expect(result.context_block).toContain('parameterized queries');
      expect(result.context_block).toContain('transactions for multi-step');
      expect(result.context_block).toContain('database');
    });

    it('should provide UI-focused fallback for interface tasks', async () => {
      const input: QueryDirectivesInput = {
        taskDescription: 'Build user interface component'
      };

      vi.mocked(mockModelProviderManager.detectContextWithFallback).mockRejectedValue(
        new Error('All providers failed')
      );

      const result = await tool.execute(input);

      expect(result.context_block).toContain('accessibility compliance');
      expect(result.context_block).toContain('responsive design');
      expect(result.context_block).toContain('interface');
    });

    it('should provide general fallback for unknown tasks', async () => {
      const input: QueryDirectivesInput = {
        taskDescription: 'Do something complex'
      };

      vi.mocked(mockModelProviderManager.detectContextWithFallback).mockRejectedValue(
        new Error('All providers failed')
      );

      const result = await tool.execute(input);

      expect(result.context_block).toContain('Essential Guidelines');
      expect(result.context_block).toContain('unit tests');
      expect(result.context_block).toContain('code formatting');
    });
  });

  describe('Tool Schema', () => {
    it('should provide valid MCP tool schema', () => {
      const schema = QueryDirectivesTool.getToolSchema();

      expect(schema.name).toBe('query_directives');
      expect(schema.description).toContain('Query relevant project directives');
      expect(schema.inputSchema.type).toBe('object');
      expect(schema.inputSchema.properties.taskDescription).toBeDefined();
      expect(schema.inputSchema.required).toContain('taskDescription');
    });

    it('should define all expected input properties', () => {
      const schema = QueryDirectivesTool.getToolSchema();
      const properties = schema.inputSchema.properties;

      expect(properties.taskDescription).toBeDefined();
      expect(properties.modeSlug).toBeDefined();
      expect(properties.options).toBeDefined();

      // Check modeSlug enum values
      expect(properties.modeSlug.enum).toEqual(['architect', 'code', 'debug']);

      // Check options properties
      const optionsProps = properties.options.properties;
      expect(optionsProps.strictLayer).toBeDefined();
      expect(optionsProps.maxItems).toBeDefined();
      expect(optionsProps.tokenBudget).toBeDefined();
      expect(optionsProps.includeBreadcrumbs).toBeDefined();
    });
  });
});