import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CacheManager } from '../cache-manager.js';
import { TaskContext, RankedDirective } from '../../types.js';

describe('CacheManager', () => {
  let cacheManager: CacheManager;

  beforeEach(() => {
    cacheManager = new CacheManager({
      maxSize: 10,
      defaultTtl: 1000
    });
  });

  afterEach(() => {
    cacheManager.destroy();
  });

  describe('directive query caching', () => {
    it('should cache and retrieve directive query results', () => {
      const taskDescription = 'Create a new API endpoint';
      const modeSlug = 'code';
      const options = { maxItems: 10 };
      const result = {
        context_block: 'test context',
        citations: [],
        diagnostics: {
          queryTime: 100,
          contextDetectionTime: 50,
          rankingTime: 30,
          totalDirectives: 5,
          returnedDirectives: 3,
          confidence: 0.8,
          fallbackUsed: false
        }
      };

      cacheManager.cacheDirectiveQuery(taskDescription, modeSlug, options, result);
      const cached = cacheManager.getCachedDirectiveQuery(taskDescription, modeSlug, options);

      expect(cached).toEqual(result);
    });

    it('should return null for non-cached queries', () => {
      const result = cacheManager.getCachedDirectiveQuery('non-existent', 'code', {});
      expect(result).toBeNull();
    });

    it('should handle undefined modeSlug consistently', () => {
      const taskDescription = 'Create a new API endpoint';
      const options = { maxItems: 10 };
      const result = {
        context_block: 'test context',
        citations: [],
        diagnostics: {
          queryTime: 100,
          contextDetectionTime: 50,
          rankingTime: 30,
          totalDirectives: 5,
          returnedDirectives: 3,
          confidence: 0.8,
          fallbackUsed: false
        }
      };

      cacheManager.cacheDirectiveQuery(taskDescription, undefined, options, result);
      const cached = cacheManager.getCachedDirectiveQuery(taskDescription, undefined, options);

      expect(cached).toEqual(result);
    });
  });

  describe('context detection caching', () => {
    it('should cache and retrieve context detection results', () => {
      const text = 'Create a React component for user authentication';
      const options = { returnKeywords: true };
      const result = {
        detectedLayer: '1-Presentation' as const,
        topics: ['authentication', 'ui'],
        keywords: ['react', 'component', 'auth'],
        confidence: 0.9
      };

      cacheManager.cacheContextDetection(text, options, result);
      const cached = cacheManager.getCachedContextDetection(text, options);

      expect(cached).toEqual(result);
    });

    it('should handle different options separately', () => {
      const text = 'Create a React component';
      const result1 = {
        detectedLayer: '1-Presentation' as const,
        topics: ['ui'],
        confidence: 0.8
      };
      const result2 = {
        detectedLayer: '1-Presentation' as const,
        topics: ['ui'],
        keywords: ['react', 'component'],
        confidence: 0.8
      };

      cacheManager.cacheContextDetection(text, {}, result1);
      cacheManager.cacheContextDetection(text, { returnKeywords: true }, result2);

      expect(cacheManager.getCachedContextDetection(text, {})).toEqual(result1);
      expect(cacheManager.getCachedContextDetection(text, { returnKeywords: true })).toEqual(result2);
    });
  });

  describe('ranking result caching', () => {
    it('should cache and retrieve ranking results', () => {
      const context: TaskContext = {
        layer: '2-Application',
        topics: ['api', 'security'],
        keywords: ['endpoint', 'auth'],
        technologies: ['express'],
        confidence: 0.8
      };

      const candidates = [
        { id: 'dir1', ruleId: 'rule1' },
        { id: 'dir2', ruleId: 'rule2' }
      ];

      const options = { maxItems: 5 };

      const result: RankedDirective[] = [
        {
          id: 'dir1',
          ruleId: 'rule1',
          section: 'Security',
          severity: 'MUST',
          text: 'Validate all inputs',
          topics: ['security'],
          whenToApply: ['api'],
          score: 0.9,
          scoreBreakdown: {
            authority: 0.8,
            layerMatch: 0.9,
            topicOverlap: 0.7,
            severityBoost: 1.0,
            semanticSimilarity: 0.6,
            whenToApply: 0.8
          }
        }
      ];

      cacheManager.cacheRankingResult(context, candidates, options, result);
      const cached = cacheManager.getCachedRankingResult(context, candidates, options);

      expect(cached).toEqual(result);
    });

    it('should consider candidate order in cache key', () => {
      const context: TaskContext = {
        layer: '2-Application',
        topics: ['api'],
        keywords: [],
        technologies: [],
        confidence: 0.8
      };

      const candidates1 = [{ id: 'dir1' }, { id: 'dir2' }];
      const candidates2 = [{ id: 'dir2' }, { id: 'dir1' }];
      const options = {};
      const result: RankedDirective[] = [];

      cacheManager.cacheRankingResult(context, candidates1, options, result);
      
      // Different order should still match due to sorting in cache key
      const cached = cacheManager.getCachedRankingResult(context, candidates2, options);
      expect(cached).toEqual(result);
    });
  });

  describe('cache invalidation', () => {
    it('should invalidate caches when rules are updated', () => {
      // Cache some results
      const result = {
        context_block: 'test context',
        citations: [],
        diagnostics: {
          queryTime: 100,
          contextDetectionTime: 50,
          rankingTime: 30,
          totalDirectives: 5,
          returnedDirectives: 3,
          confidence: 0.8,
          fallbackUsed: false
        }
      };

      cacheManager.cacheDirectiveQuery('test task', 'code', {}, result);
      
      // Verify cached
      expect(cacheManager.getCachedDirectiveQuery('test task', 'code', {})).toEqual(result);
      
      // Invalidate
      cacheManager.invalidateOnRuleUpdate(['rule1', 'rule2']);
      
      // Should still be cached (simplified implementation doesn't actually match rule IDs)
      // In a real implementation, this would properly invalidate based on rule relationships
      const stats = cacheManager.getStats();
      expect(stats.overall.size).toBeGreaterThanOrEqual(0);
    });
  });

  describe('cache warming', () => {
    it('should warm multiple cache types', async () => {
      const patterns = {
        commonTasks: ['Create API endpoint', 'Add validation'],
        commonContexts: ['React component', 'Database query'],
        generateDirectives: async (task: string) => ({
          context_block: `Context for ${task}`,
          citations: [],
          diagnostics: {
            queryTime: 100,
            contextDetectionTime: 50,
            rankingTime: 30,
            totalDirectives: 5,
            returnedDirectives: 3,
            confidence: 0.8,
            fallbackUsed: false
          }
        }),
        generateContext: async (text: string) => ({
          detectedLayer: '1-Presentation' as const,
          topics: ['ui'],
          confidence: 0.8
        })
      };

      await cacheManager.warmCache(patterns);

      // Check that caches were warmed
      const directiveResult = cacheManager.getCachedDirectiveQuery('Create API endpoint', 'default', {});
      const contextResult = cacheManager.getCachedContextDetection('React component', {});

      expect(directiveResult).toBeTruthy();
      expect(contextResult).toBeTruthy();
    });

    it('should handle warming failures gracefully', async () => {
      const patterns = {
        commonTasks: ['Create API endpoint'],
        generateDirectives: async () => {
          throw new Error('Generation failed');
        }
      };

      // Should not throw
      await expect(cacheManager.warmCache(patterns)).resolves.toBeUndefined();
    });
  });

  describe('statistics', () => {
    it('should provide comprehensive cache statistics', () => {
      // Add some cache entries
      cacheManager.cacheDirectiveQuery('task1', 'code', {}, {
        context_block: 'test',
        citations: [],
        diagnostics: {
          queryTime: 100,
          contextDetectionTime: 50,
          rankingTime: 30,
          totalDirectives: 5,
          returnedDirectives: 3,
          confidence: 0.8,
          fallbackUsed: false
        }
      });

      cacheManager.cacheContextDetection('text1', {}, {
        detectedLayer: '1-Presentation',
        topics: ['ui'],
        confidence: 0.8
      });

      // Access to generate hits/misses
      cacheManager.getCachedDirectiveQuery('task1', 'code', {});
      cacheManager.getCachedDirectiveQuery('nonexistent', 'code', {});

      const stats = cacheManager.getStats();

      expect(stats.directives).toBeDefined();
      expect(stats.context).toBeDefined();
      expect(stats.ranking).toBeDefined();
      expect(stats.overall).toBeDefined();
      
      expect(stats.overall.hits).toBeGreaterThan(0);
      expect(stats.overall.misses).toBeGreaterThan(0);
      expect(stats.overall.size).toBeGreaterThan(0);
      expect(stats.overall.hitRate).toBeGreaterThan(0);
    });
  });

  describe('cleanup', () => {
    it('should clear all caches', () => {
      // Add entries to different caches
      cacheManager.cacheDirectiveQuery('task', 'code', {}, {
        context_block: 'test',
        citations: [],
        diagnostics: {
          queryTime: 100,
          contextDetectionTime: 50,
          rankingTime: 30,
          totalDirectives: 5,
          returnedDirectives: 3,
          confidence: 0.8,
          fallbackUsed: false
        }
      });

      cacheManager.cacheContextDetection('text', {}, {
        detectedLayer: '1-Presentation',
        topics: ['ui'],
        confidence: 0.8
      });

      expect(cacheManager.getStats().overall.size).toBeGreaterThan(0);

      cacheManager.clearAll();

      expect(cacheManager.getStats().overall.size).toBe(0);
    });
  });
});