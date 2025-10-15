import { describe, it, expect, beforeEach } from 'vitest';
import { DirectiveRankingEngine } from '../directive-ranking-engine.js';
import { Directive, TaskContext, RankingOptions } from '../../types.js';

describe('DirectiveRankingEngine', () => {
  let engine: DirectiveRankingEngine;
  let mockDirectives: Directive[];
  let mockContext: TaskContext;

  beforeEach(() => {
    engine = new DirectiveRankingEngine();
    
    mockDirectives = [
      {
        id: 'directive-1',
        ruleId: 'rule-1',
        section: 'Security',
        severity: 'MUST',
        text: 'Always validate user input before processing',
        rationale: 'Prevents injection attacks',
        topics: ['security', 'validation'],
        whenToApply: ['handling user input', 'API endpoints']
      },
      {
        id: 'directive-2',
        ruleId: 'rule-1',
        section: 'Performance',
        severity: 'SHOULD',
        text: 'Use connection pooling for database operations',
        rationale: 'Improves performance and resource utilization',
        topics: ['performance', 'database'],
        whenToApply: ['database operations', 'high load scenarios']
      },
      {
        id: 'directive-3',
        ruleId: 'rule-2',
        section: 'Code Style',
        severity: 'MAY',
        text: 'Consider using TypeScript for better type safety',
        rationale: 'Reduces runtime errors',
        topics: ['typescript', 'code-quality'],
        whenToApply: ['new projects', 'refactoring']
      }
    ];

    mockContext = {
      layer: '2-Application',
      topics: ['security', 'api'],
      keywords: ['validate', 'input', 'user', 'endpoint'],
      technologies: ['express', 'nodejs'],
      confidence: 0.85
    };
  });

  describe('rankDirectives', () => {
    it('should rank directives by relevance', async () => {
      const ranked = await engine.rankDirectives(mockDirectives, mockContext);
      
      expect(ranked).toHaveLength(3);
      expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[1].score);
      expect(ranked[1].score).toBeGreaterThanOrEqual(ranked[2].score);
    });

    it('should include score breakdown for each directive', async () => {
      const ranked = await engine.rankDirectives(mockDirectives, mockContext);
      
      for (const directive of ranked) {
        expect(directive.scoreBreakdown).toBeDefined();
        expect(directive.scoreBreakdown.authority).toBeGreaterThanOrEqual(0);
        expect(directive.scoreBreakdown.layerMatch).toBeGreaterThanOrEqual(0);
        expect(directive.scoreBreakdown.topicOverlap).toBeGreaterThanOrEqual(0);
        expect(directive.scoreBreakdown.severityBoost).toBeGreaterThan(0);
        expect(directive.scoreBreakdown.semanticSimilarity).toBeGreaterThanOrEqual(0);
        expect(directive.scoreBreakdown.whenToApply).toBeGreaterThanOrEqual(0);
      }
    });

    it('should prioritize MUST directives over SHOULD and MAY', async () => {
      const ranked = await engine.rankDirectives(mockDirectives, mockContext);
      
      const mustDirective = ranked.find(d => d.severity === 'MUST');
      const shouldDirective = ranked.find(d => d.severity === 'SHOULD');
      const mayDirective = ranked.find(d => d.severity === 'MAY');
      
      expect(mustDirective).toBeDefined();
      expect(shouldDirective).toBeDefined();
      expect(mayDirective).toBeDefined();
      
      // MUST should generally score higher than SHOULD and MAY for similar relevance
      if (mustDirective && shouldDirective) {
        expect(mustDirective.scoreBreakdown.severityBoost).toBeGreaterThan(shouldDirective.scoreBreakdown.severityBoost);
      }
    });

    it('should handle empty candidate list', async () => {
      const ranked = await engine.rankDirectives([], mockContext);
      expect(ranked).toHaveLength(0);
    });

    it('should throw error for missing context', async () => {
      await expect(engine.rankDirectives(mockDirectives, null as any))
        .rejects.toThrow('Task context is required for ranking');
    });

    it('should apply maxItems limit', async () => {
      const options: RankingOptions = { maxItems: 2 };
      const ranked = await engine.rankDirectives(mockDirectives, mockContext, options);
      
      expect(ranked).toHaveLength(2);
    });

    it('should filter by score threshold', async () => {
      // Create engine with high score threshold
      const highThresholdEngine = new DirectiveRankingEngine(
        undefined,
        { maxCandidates: 1000, batchSize: 50, enableParallelScoring: true, scoreThreshold: 50 }
      );
      
      const ranked = await highThresholdEngine.rankDirectives(mockDirectives, mockContext);
      
      // All returned directives should meet the threshold
      for (const directive of ranked) {
        expect(directive.score).toBeGreaterThanOrEqual(50);
      }
    });
  });

  describe('calculateScore', () => {
    it('should calculate score for individual directive', async () => {
      const score = await engine.calculateScore(mockDirectives[0], mockContext);
      expect(typeof score).toBe('number');
      expect(score).toBeGreaterThanOrEqual(0);
    });

    it('should return 0 for null directive', async () => {
      const score = await engine.calculateScore(null as any, mockContext);
      expect(score).toBe(0);
    });

    it('should return 0 for null context', async () => {
      const score = await engine.calculateScore(mockDirectives[0], null as any);
      expect(score).toBe(0);
    });
  });

  describe('applyTokenBudget', () => {
    it('should respect token budget constraints', async () => {
      const ranked = await engine.rankDirectives(mockDirectives, mockContext);
      const budgetLimited = engine.applyTokenBudget(ranked, 100);
      
      expect(budgetLimited.length).toBeLessThanOrEqual(ranked.length);
    });

    it('should prioritize higher-scored directives within budget', async () => {
      const ranked = await engine.rankDirectives(mockDirectives, mockContext);
      const budgetLimited = engine.applyTokenBudget(ranked, 150);
      
      // Should include highest-scored directives first
      if (budgetLimited.length > 0 && ranked.length > budgetLimited.length) {
        expect(budgetLimited[0].id).toBe(ranked[0].id);
      }
    });

    it('should handle zero or negative budget', async () => {
      const ranked = await engine.rankDirectives(mockDirectives, mockContext);
      
      const zeroBudget = engine.applyTokenBudget(ranked, 0);
      expect(zeroBudget).toHaveLength(0);
      
      const negativeBudget = engine.applyTokenBudget(ranked, -10);
      expect(negativeBudget).toHaveLength(0); // Should return empty array for invalid budget
    });

    it('should truncate high-priority directives when necessary', async () => {
      // Create a MUST directive with long text
      const longDirective = {
        ...mockDirectives[0],
        severity: 'MUST' as const,
        text: 'A'.repeat(1000), // Very long text
        score: 100,
        scoreBreakdown: {
          authority: 1, layerMatch: 1, topicOverlap: 1,
          severityBoost: 1, semanticSimilarity: 1, whenToApply: 1
        }
      };
      
      const budgetLimited = engine.applyTokenBudget([longDirective], 50);
      
      if (budgetLimited.length > 0) {
        expect(budgetLimited[0].text.length).toBeLessThan(longDirective.text.length);
        expect(budgetLimited[0].text).toMatch(/\.\.\.$/); // Should end with ellipsis
      }
    });
  });

  describe('performance optimization', () => {
    it('should handle large candidate sets efficiently', async () => {
      // Create a large set of directives
      const largeCandidateSet: Directive[] = [];
      for (let i = 0; i < 1500; i++) {
        largeCandidateSet.push({
          ...mockDirectives[0],
          id: `directive-${i}`,
          text: `Directive ${i} text`
        });
      }
      
      const startTime = Date.now();
      const ranked = await engine.rankDirectives(largeCandidateSet, mockContext);
      const endTime = Date.now();
      
      expect(ranked.length).toBeLessThanOrEqual(1000); // Should apply performance limits
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within reasonable time
    });

    it('should prioritize MUST directives in performance limiting', async () => {
      const largeCandidateSet: Directive[] = [];
      
      // Add many MAY directives
      for (let i = 0; i < 800; i++) {
        largeCandidateSet.push({
          ...mockDirectives[2], // MAY directive
          id: `may-directive-${i}`
        });
      }
      
      // Add some MUST directives
      for (let i = 0; i < 300; i++) {
        largeCandidateSet.push({
          ...mockDirectives[0], // MUST directive
          id: `must-directive-${i}`
        });
      }
      
      const ranked = await engine.rankDirectives(largeCandidateSet, mockContext);
      
      // Should include MUST directives even with performance limiting
      const mustCount = ranked.filter(d => d.severity === 'MUST').length;
      expect(mustCount).toBeGreaterThan(0);
    });
  });

  describe('configuration management', () => {
    it('should update ranking configuration', () => {
      const newConfig = {
        weights: { authority: 15, layerMatch: 12 }
      };
      
      engine.updateConfig(newConfig);
      const config = engine.getConfig();
      
      expect(config.ranking.weights.authority).toBe(15);
      expect(config.ranking.weights.layerMatch).toBe(12);
    });

    it('should update performance configuration', () => {
      const newPerfConfig = {
        maxCandidates: 500,
        scoreThreshold: 0.5
      };
      
      engine.updatePerformanceConfig(newPerfConfig);
      const config = engine.getConfig();
      
      expect(config.performance.maxCandidates).toBe(500);
      expect(config.performance.scoreThreshold).toBe(0.5);
    });
  });

  describe('result validation', () => {
    it('should maintain score ordering consistency', async () => {
      const ranked = await engine.rankDirectives(mockDirectives, mockContext);
      
      for (let i = 1; i < ranked.length; i++) {
        expect(ranked[i].score).toBeLessThanOrEqual(ranked[i - 1].score);
      }
    });

    it('should ensure all scores are non-negative', async () => {
      const ranked = await engine.rankDirectives(mockDirectives, mockContext);
      
      for (const directive of ranked) {
        expect(directive.score).toBeGreaterThanOrEqual(0);
      }
    });
  });
});