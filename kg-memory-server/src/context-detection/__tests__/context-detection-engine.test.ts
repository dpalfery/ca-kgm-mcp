import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContextDetectionEngine } from '../context-detection-engine.js';
import { ModelProviderManager } from '../../interfaces/model-provider.js';
import { ModelProvider, TaskContext } from '../../types.js';

describe('ContextDetectionEngine', () => {
  let engine: ContextDetectionEngine;
  let mockProviderManager: ModelProviderManager;
  let mockProvider: ModelProvider;

  beforeEach(() => {
    mockProvider = {
      name: 'test-provider',
      type: 'cloud',
      isAvailable: vi.fn().mockResolvedValue(true),
      detectContext: vi.fn().mockResolvedValue({
        layer: '2-Application',
        topics: ['api', 'security'],
        keywords: ['rest', 'jwt'],
        technologies: ['express'],
        confidence: 0.8
      } as TaskContext)
    };

    mockProviderManager = {
      getPrimaryProvider: vi.fn().mockResolvedValue(mockProvider),
      getFallbackProviders: vi.fn().mockResolvedValue([]),
      detectContextWithFallback: vi.fn(),
      configureProvider: vi.fn(),
      removeProvider: vi.fn()
    } as any;

    engine = new ContextDetectionEngine(mockProviderManager);
  });

  describe('detectContext', () => {
    it('should use model provider when available', async () => {
      const result = await engine.detectContext('Create REST API with JWT authentication');
      
      expect(mockProviderManager.getPrimaryProvider).toHaveBeenCalled();
      expect(mockProvider.detectContext).toHaveBeenCalledWith('Create REST API with JWT authentication');
      expect(result.layer).toBe('2-Application');
      expect(result.topics).toContain('api');
      expect(result.diagnostics.modelProvider).toBe('test-provider');
      expect(result.diagnostics.fallbackUsed).toBe(false);
    });

    it('should fallback to rule-based detection when model provider fails', async () => {
      mockProvider.detectContext = vi.fn().mockRejectedValue(new Error('Provider failed'));
      
      const result = await engine.detectContext('Create React component with CSS styling');
      
      expect(result.layer).toBe('1-Presentation');
      expect(result.diagnostics.fallbackUsed).toBe(true);
      expect(result.diagnostics.modelProvider).toBeUndefined();
    });

    it('should fallback to rule-based detection when no provider available', async () => {
      mockProviderManager.getPrimaryProvider = vi.fn().mockRejectedValue(new Error('No primary provider'));
      mockProviderManager.getFallbackProviders = vi.fn().mockResolvedValue([]);
      
      const result = await engine.detectContext('Create database migration with PostgreSQL');
      
      expect(result.layer).toBe('4-Persistence');
      expect(result.topics).toContain('database');
      expect(result.diagnostics.fallbackUsed).toBe(true);
    });

    it('should include keywords when requested', async () => {
      const result = await engine.detectContext(
        'Create REST API with JWT authentication',
        { returnKeywords: true }
      );
      
      expect(result.keywords).toBeDefined();
      expect(result.keywords.length).toBeGreaterThan(0);
    });

    it('should not include keywords when not requested', async () => {
      mockProviderManager.getPrimaryProvider = vi.fn().mockRejectedValue(new Error('No primary provider'));
      mockProviderManager.getFallbackProviders = vi.fn().mockResolvedValue([]);
      
      const result = await engine.detectContext(
        'Create REST API with JWT authentication',
        { returnKeywords: false }
      );
      
      expect(result.keywords).toHaveLength(0);
    });

    it('should handle complete system failure gracefully', async () => {
      mockProviderManager.getPrimaryProvider = vi.fn().mockRejectedValue(new Error('System failure'));
      mockProviderManager.getFallbackProviders = vi.fn().mockRejectedValue(new Error('System failure'));
      
      const result = await engine.detectContext('Any text');
      
      expect(result.layer).toBe('*');
      expect(result.confidence).toBe(0.1);
      expect(result.diagnostics.fallbackUsed).toBe(true);
    });

    it('should measure detection time', async () => {
      const result = await engine.detectContext('Create REST API');
      
      expect(result.diagnostics.detectionTime).toBeGreaterThanOrEqual(0);
      expect(typeof result.diagnostics.detectionTime).toBe('number');
    });
  });

  describe('getAvailableProviders', () => {
    it('should return list of available providers', async () => {
      const providers = await engine.getAvailableProviders();
      
      expect(providers).toContain('test-provider');
      expect(mockProvider.isAvailable).toHaveBeenCalled();
    });

    it('should filter out unavailable providers', async () => {
      mockProvider.isAvailable = vi.fn().mockResolvedValue(false);
      
      const providers = await engine.getAvailableProviders();
      
      expect(providers).not.toContain('test-provider');
    });
  });

  describe('testContextDetection', () => {
    it('should test both rule-based and model-based detection', async () => {
      const result = await engine.testContextDetection('Create React component');
      
      expect(result.ruleBasedResult).toBeDefined();
      expect(result.ruleBasedResult.layer).toBe('1-Presentation');
      expect(result.modelResults).toHaveProperty('test-provider');
      expect(result.modelResults['test-provider']).toEqual({
        layer: '2-Application',
        topics: ['api', 'security'],
        keywords: ['rest', 'jwt'],
        technologies: ['express'],
        confidence: 0.8
      });
    });

    it('should handle provider errors in testing', async () => {
      // Test that the method handles cases where no providers are configured
      const emptyProviderManager = {
        getPrimaryProvider: vi.fn().mockRejectedValue(new Error('No primary provider')),
        getFallbackProviders: vi.fn().mockResolvedValue([]),
        detectContextWithFallback: vi.fn(),
        configureProvider: vi.fn(),
        removeProvider: vi.fn()
      } as any;
      
      const testEngine = new ContextDetectionEngine(emptyProviderManager);
      const result = await testEngine.testContextDetection('Create React component');
      
      // Should still return rule-based result even with no providers
      expect(result.ruleBasedResult).toBeDefined();
      expect(result.ruleBasedResult.layer).toBe('1-Presentation');
      expect(Object.keys(result.modelResults)).toHaveLength(0);
    });

    it('should handle unavailable providers in testing', async () => {
      mockProvider.isAvailable = vi.fn().mockResolvedValue(false);
      
      const result = await engine.testContextDetection('Create React component');
      
      expect(result.modelResults['test-provider']).toBeInstanceOf(Error);
      expect((result.modelResults['test-provider'] as Error).message).toBe('Provider not available');
    });
  });

  describe('addLayerKeywords', () => {
    it('should allow adding custom layer keywords', () => {
      engine.addLayerKeywords('1-Presentation', ['custom-ui']);
      
      // This should not throw an error
      expect(() => engine.addLayerKeywords('1-Presentation', ['custom-ui'])).not.toThrow();
    });

    it('should not add keywords to wildcard layer', () => {
      expect(() => engine.addLayerKeywords('*', ['test'])).not.toThrow();
    });
  });

  describe('addDomainVocabulary', () => {
    it('should allow adding custom domain vocabulary', () => {
      expect(() => engine.addDomainVocabulary('custom', {
        keywords: ['custom-keyword'],
        technologies: ['custom-tech'],
        synonyms: {}
      })).not.toThrow();
    });
  });

  describe('getDetectionStats', () => {
    it('should return detection statistics', async () => {
      const stats = await engine.getDetectionStats();
      
      expect(stats).toHaveProperty('availableProviders');
      expect(stats).toHaveProperty('layerKeywordCount');
      expect(stats).toHaveProperty('domainCount');
      expect(stats.availableProviders).toContain('test-provider');
      expect(stats.layerKeywordCount).toBeGreaterThan(0);
      expect(stats.domainCount).toBeGreaterThan(0);
    });
  });
});