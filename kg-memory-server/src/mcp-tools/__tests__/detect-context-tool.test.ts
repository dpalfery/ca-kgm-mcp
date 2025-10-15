import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DetectContextTool } from '../detect-context-tool.js';
import { DetectContextInput } from '../../types.js';
import { DefaultModelProviderManager } from '../../providers/model-provider-manager.js';

/**
 * Unit tests for DetectContextTool
 */
describe('DetectContextTool', () => {
  let tool: DetectContextTool;
  let mockModelProviderManager: DefaultModelProviderManager;

  beforeEach(() => {
    // Create mock
    mockModelProviderManager = {
      getPrimaryProvider: vi.fn(),
      getFallbackProviders: vi.fn(),
      detectContextWithFallback: vi.fn()
    } as any;

    tool = new DetectContextTool(mockModelProviderManager);
  });

  describe('Input Validation', () => {
    it('should reject empty text', async () => {
      const input: DetectContextInput = {
        text: ''
      };

      const result = await tool.execute(input);

      expect(result.detectedLayer).toBe('*');
      expect(result.confidence).toBeLessThan(0.5);
    });

    it('should reject non-string text', async () => {
      const input: DetectContextInput = {
        text: null as any
      };

      const result = await tool.execute(input);

      expect(result.detectedLayer).toBe('*');
      expect(result.confidence).toBeLessThan(0.5);
    });

    it('should reject text that is too long', async () => {
      const input: DetectContextInput = {
        text: 'a'.repeat(10001) // Exceeds 10,000 character limit
      };

      const result = await tool.execute(input);

      expect(result.detectedLayer).toBe('*');
      expect(result.confidence).toBeLessThan(0.5);
    });

    it('should accept valid text', async () => {
      const input: DetectContextInput = {
        text: 'Create a React component for user authentication'
      };

      const result = await tool.execute(input);

      expect(result).toBeDefined();
      expect(result.detectedLayer).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Context Detection', () => {
    it('should detect presentation layer from UI keywords', async () => {
      const input: DetectContextInput = {
        text: 'Create a React component with CSS styling and responsive design',
        options: { returnKeywords: true }
      };

      const result = await tool.execute(input);

      expect(result.detectedLayer).toBe('1-Presentation');
      expect(result.topics).toContain('ui');
      expect(result.keywords).toContain('react');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect application layer from API keywords', async () => {
      const input: DetectContextInput = {
        text: 'Implement REST API endpoints with middleware and business logic',
        options: { returnKeywords: true }
      };

      const result = await tool.execute(input);

      expect(result.detectedLayer).toBe('2-Application');
      expect(result.topics).toContain('api');
      expect(result.keywords).toContain('api');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect domain layer from business keywords', async () => {
      const input: DetectContextInput = {
        text: 'Define domain models and business rules for user validation',
        options: { returnKeywords: true }
      };

      const result = await tool.execute(input);

      expect(result.detectedLayer).toBe('3-Domain');
      expect(result.topics).toContain('validation');
      expect(result.keywords).toContain('domain');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect persistence layer from database keywords', async () => {
      const input: DetectContextInput = {
        text: 'Create database repository with SQL queries and ORM mapping',
        options: { returnKeywords: true }
      };

      const result = await tool.execute(input);

      expect(result.detectedLayer).toBe('4-Persistence');
      expect(result.topics).toContain('database');
      expect(result.keywords).toContain('database');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect infrastructure layer from deployment keywords', async () => {
      const input: DetectContextInput = {
        text: 'Deploy application to AWS with Docker containers and Kubernetes',
        options: { returnKeywords: true }
      };

      const result = await tool.execute(input);

      expect(result.detectedLayer).toBe('5-Infrastructure');
      expect(result.topics).toContain('deployment'); // Assuming deployment is mapped
      expect(result.keywords).toContain('docker');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should default to cross-layer for ambiguous text', async () => {
      const input: DetectContextInput = {
        text: 'Implement feature',
        options: { returnKeywords: true }
      };

      const result = await tool.execute(input);

      expect(result.detectedLayer).toBe('*');
      expect(result.confidence).toBeLessThan(0.8);
    });
  });

  describe('Topic Extraction', () => {
    it('should extract security topics', async () => {
      const input: DetectContextInput = {
        text: 'Implement JWT authentication with OAuth2 authorization',
        options: { returnKeywords: true }
      };

      const result = await tool.execute(input);

      expect(result.topics).toContain('security');
      expect(result.keywords).toContain('jwt');
    });

    it('should extract testing topics', async () => {
      const input: DetectContextInput = {
        text: 'Write unit tests and integration tests with Jest framework',
        options: { returnKeywords: true }
      };

      const result = await tool.execute(input);

      expect(result.topics).toContain('testing');
      expect(result.keywords).toContain('jest');
    });

    it('should extract performance topics', async () => {
      const input: DetectContextInput = {
        text: 'Optimize database queries for better performance and caching',
        options: { returnKeywords: true }
      };

      const result = await tool.execute(input);

      expect(result.topics).toContain('performance');
      expect(result.keywords).toContain('optimize');
    });

    it('should extract error handling topics', async () => {
      const input: DetectContextInput = {
        text: 'Handle exceptions and errors with proper try-catch blocks',
        options: { returnKeywords: true }
      };

      const result = await tool.execute(input);

      expect(result.topics).toContain('error-handling');
      expect(result.keywords).toContain('error');
    });

    it('should extract multiple topics from complex text', async () => {
      const input: DetectContextInput = {
        text: 'Create secure API with authentication, validation, and error handling',
        options: { returnKeywords: true }
      };

      const result = await tool.execute(input);

      expect(result.topics.length).toBeGreaterThan(1);
      expect(result.topics).toContain('security');
      expect(result.topics).toContain('api');
      expect(result.topics).toContain('validation');
    });
  });

  describe('Keyword Extraction', () => {
    it('should return keywords when requested', async () => {
      const input: DetectContextInput = {
        text: 'Create React component with TypeScript and Redux',
        options: { returnKeywords: true }
      };

      const result = await tool.execute(input);

      expect(result.keywords).toBeDefined();
      expect(result.keywords!.length).toBeGreaterThan(0);
      expect(result.keywords).toContain('react');
      expect(result.keywords).toContain('typescript');
    });

    it('should not return keywords when not requested', async () => {
      const input: DetectContextInput = {
        text: 'Create React component with TypeScript and Redux',
        options: { returnKeywords: false }
      };

      const result = await tool.execute(input);

      expect(result.keywords).toBeUndefined();
    });

    it('should filter out common words from keywords', async () => {
      const input: DetectContextInput = {
        text: 'The user can create and update their profile information',
        options: { returnKeywords: true }
      };

      const result = await tool.execute(input);

      expect(result.keywords).toBeDefined();
      expect(result.keywords).not.toContain('the');
      expect(result.keywords).not.toContain('and');
      expect(result.keywords).not.toContain('can');
    });

    it('should limit keyword count', async () => {
      const input: DetectContextInput = {
        text: 'Create comprehensive application with authentication authorization validation security testing performance monitoring logging debugging deployment configuration documentation maintenance',
        options: { returnKeywords: true }
      };

      const result = await tool.execute(input);

      expect(result.keywords).toBeDefined();
      expect(result.keywords!.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Batch Detection', () => {
    it('should process multiple texts', async () => {
      const texts = [
        'Create React component',
        'Design database schema',
        'Deploy to AWS'
      ];

      const results = await tool.batchDetect(texts, { returnKeywords: true });

      expect(results).toHaveLength(3);
      expect(results[0].detectedLayer).toBe('1-Presentation');
      expect(results[1].detectedLayer).toBe('4-Persistence');
      expect(results[2].detectedLayer).toBe('5-Infrastructure');
    });

    it('should handle errors in batch processing', async () => {
      const texts = [
        'Valid text',
        '', // Invalid empty text
        'Another valid text'
      ];

      const results = await tool.batchDetect(texts, { returnKeywords: true });

      expect(results).toHaveLength(3);
      expect(results[0].confidence).toBeGreaterThan(0);
      expect(results[1].confidence).toBeLessThan(0.5); // Error case
      expect(results[2].confidence).toBeGreaterThan(0);
    });

    it('should respect options in batch processing', async () => {
      const texts = ['Create API', 'Build UI'];

      const resultsWithKeywords = await tool.batchDetect(texts, { returnKeywords: true });
      const resultsWithoutKeywords = await tool.batchDetect(texts, { returnKeywords: false });

      expect(resultsWithKeywords[0].keywords).toBeDefined();
      expect(resultsWithoutKeywords[0].keywords).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle context detection engine errors', async () => {
      // Mock the context detection engine to throw an error
      const mockContextDetectionEngine = {
        detectContext: vi.fn().mockRejectedValue(new Error('Engine failed'))
      };

      // Replace the engine in the tool (this would require dependency injection in real implementation)
      (tool as any).contextDetectionEngine = mockContextDetectionEngine;

      const input: DetectContextInput = {
        text: 'Test text'
      };

      const result = await tool.execute(input);

      expect(result.detectedLayer).toBe('*');
      expect(result.confidence).toBe(0.1);
    });

    it('should provide meaningful fallback for various error types', async () => {
      const errorCases = [
        'Create API endpoint',
        'Design database',
        'Build UI component',
        'Deploy application'
      ];

      for (const text of errorCases) {
        const result = await tool.execute({ text });
        
        expect(result).toBeDefined();
        expect(result.detectedLayer).toBeDefined();
        expect(result.topics).toBeDefined();
        expect(result.confidence).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Test Detection', () => {
    it('should provide detailed diagnostics', async () => {
      const text = 'Create authentication service with JWT tokens';

      const result = await tool.testDetection(text);

      expect(result.result).toBeDefined();
      expect(result.diagnostics).toBeDefined();
      expect(result.diagnostics.detectionTime).toBeGreaterThan(0);
      expect(result.diagnostics.availableProviders).toBeDefined();
    });

    it('should handle test detection errors', async () => {
      const text = ''; // Invalid input

      const result = await tool.testDetection(text);

      expect(result.result).toBeDefined();
      expect(result.diagnostics.fallbackUsed).toBe(true);
      expect(result.result.confidence).toBeLessThan(0.5);
    });
  });

  describe('Configuration Management', () => {
    it('should allow adding layer keywords', () => {
      expect(() => {
        tool.addLayerKeywords('1-Presentation', ['vue', 'svelte']);
      }).not.toThrow();
    });

    it('should allow adding domain vocabulary', () => {
      expect(() => {
        tool.addDomainVocabulary('ecommerce', {
          keywords: ['cart', 'checkout', 'payment'],
          technologies: ['stripe', 'paypal'],
          synonyms: { 'cart': ['basket', 'shopping-cart'] }
        });
      }).not.toThrow();
    });

    it('should provide detection statistics', async () => {
      const stats = await tool.getDetectionStats();

      expect(stats).toBeDefined();
      expect(stats.availableProviders).toBeDefined();
      expect(stats.layerKeywordCount).toBeGreaterThanOrEqual(0);
      expect(stats.domainCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Tool Schema', () => {
    it('should provide valid MCP tool schema', () => {
      const schema = DetectContextTool.getToolSchema();

      expect(schema.name).toBe('detect_context');
      expect(schema.description).toContain('Detect architectural layer');
      expect(schema.inputSchema.type).toBe('object');
      expect(schema.inputSchema.properties.text).toBeDefined();
      expect(schema.inputSchema.required).toContain('text');
    });

    it('should define text length constraints', () => {
      const schema = DetectContextTool.getToolSchema();
      const textProperty = schema.inputSchema.properties.text;

      expect(textProperty.maxLength).toBe(10000);
    });

    it('should define options properties', () => {
      const schema = DetectContextTool.getToolSchema();
      const optionsProperty = schema.inputSchema.properties.options;

      expect(optionsProperty).toBeDefined();
      expect(optionsProperty.properties.returnKeywords).toBeDefined();
      expect(optionsProperty.properties.returnKeywords.type).toBe('boolean');
    });
  });
});