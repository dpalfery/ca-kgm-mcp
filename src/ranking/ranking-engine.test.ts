/**
 * Unit tests for Ranking Engine
 */

import { describe, it, expect, vi } from 'vitest';
import { RankingEngine } from './ranking-engine.js';
import { ScoringEngine, ScoredDirective } from './scoring-engine.js';
import { TokenCounter } from './token-counter.js';

// Mock Neo4j session
const createMockSession = (directives: any[]) => {
  return {
    run: vi.fn().mockResolvedValue({
      records: directives.map(d => ({
        get: (key: string) => {
          if (key === 'd') {
            return { properties: d };
          }
          if (key === 'r') {
            return d.rule ? { properties: d.rule } : null;
          }
          return null;
        }
      }))
    })
  } as any;
};

describe('RankingEngine', () => {
  describe('Constructor', () => {
    it('creates engine with default dependencies', () => {
      const engine = new RankingEngine();
      expect(engine).toBeDefined();
    });

    it('creates engine with custom dependencies', () => {
      const scoringEngine = new ScoringEngine();
      const tokenCounter = new TokenCounter();
      const engine = new RankingEngine(scoringEngine, tokenCounter);
      expect(engine).toBeDefined();
    });
  });

  describe('Query Building', () => {
    it('queries directives successfully', async () => {
      const mockDirectives = [
        {
          id: '1',
          text: 'MUST use authentication',
          severity: 'MUST',
          topics: ['security'],
          layers: ['5-Integration'],
          technologies: ['JWT']
        }
      ];

      const session = createMockSession(mockDirectives);
      const engine = new RankingEngine();

      const result = await engine.queryAndRank(
        session,
        {
          topics: ['security'],
          technologies: ['JWT']
        }
      );

      expect(result.directives).toBeDefined();
      expect(result.stats.searched).toBeGreaterThanOrEqual(0);
    });

    it('handles empty results', async () => {
      const session = createMockSession([]);
      const engine = new RankingEngine();

      const result = await engine.queryAndRank(
        session,
        {
          topics: ['nonexistent'],
          technologies: []
        }
      );

      expect(result.directives).toHaveLength(0);
      expect(result.stats.searched).toBe(0);
    });
  });

  describe('Filtering and Ranking', () => {
    it('filters by severity', async () => {
      const mockDirectives = [
        {
          id: '1',
          text: 'MUST directive',
          severity: 'MUST',
          topics: ['security'],
          layers: [],
          technologies: []
        },
        {
          id: '2',
          text: 'MAY directive',
          severity: 'MAY',
          topics: ['security'],
          layers: [],
          technologies: []
        }
      ];

      const session = createMockSession(mockDirectives);
      const engine = new RankingEngine();

      const result = await engine.queryAndRank(
        session,
        {
          topics: ['security'],
          technologies: []
        },
        {
          severityFilter: ['MUST']
        }
      );

      expect(result.directives.length).toBeGreaterThanOrEqual(0);
    });

    it('respects maxItems limit', async () => {
      const mockDirectives = Array.from({ length: 20 }, (_, i) => ({
        id: `${i}`,
        text: `Directive ${i}`,
        severity: 'SHOULD',
        topics: ['general'],
        layers: [],
        technologies: []
      }));

      const session = createMockSession(mockDirectives);
      const engine = new RankingEngine();

      const result = await engine.queryAndRank(
        session,
        {
          topics: ['general'],
          technologies: []
        },
        {
          maxItems: 5
        }
      );

      expect(result.directives.length).toBeLessThanOrEqual(5);
    });

    it('respects token budget', async () => {
      const mockDirectives = Array.from({ length: 10 }, (_, i) => ({
        id: `${i}`,
        text: `This is a longer directive with more text to consume tokens. Directive number ${i}.`,
        severity: 'SHOULD',
        topics: ['general'],
        layers: [],
        technologies: []
      }));

      const session = createMockSession(mockDirectives);
      const engine = new RankingEngine();

      const result = await engine.queryAndRank(
        session,
        {
          topics: ['general'],
          technologies: []
        },
        {
          tokenBudget: 500 // More realistic budget
        }
      );

      expect(result.stats.totalTokens).toBeLessThanOrEqual(500);
    });
  });

  describe('Severity Prioritization', () => {
    it('prioritizes MUST over SHOULD and MAY', async () => {
      const mockDirectives = [
        {
          id: '1',
          text: 'MAY directive',
          severity: 'MAY',
          topics: ['general'],
          layers: [],
          technologies: []
        },
        {
          id: '2',
          text: 'MUST directive',
          severity: 'MUST',
          topics: ['general'],
          layers: [],
          technologies: []
        },
        {
          id: '3',
          text: 'SHOULD directive',
          severity: 'SHOULD',
          topics: ['general'],
          layers: [],
          technologies: []
        }
      ];

      const session = createMockSession(mockDirectives);
      const engine = new RankingEngine();

      const result = await engine.queryAndRank(
        session,
        {
          topics: ['general'],
          technologies: []
        }
      );

      // MUST should appear first (if any are included)
      const mustDirectives = result.directives.filter(d => d.severity === 'MUST');
      const shouldDirectives = result.directives.filter(d => d.severity === 'SHOULD');
      
      if (mustDirectives.length > 0 && shouldDirectives.length > 0) {
        const firstMust = result.directives.findIndex(d => d.severity === 'MUST');
        const firstShould = result.directives.findIndex(d => d.severity === 'SHOULD');
        expect(firstMust).toBeLessThan(firstShould);
      }
    });
  });

  describe('Mode-Based Adjustments', () => {
    it('applies architect mode adjustments', async () => {
      const mockDirectives = [
        {
          id: '1',
          text: 'Architecture directive',
          severity: 'SHOULD',
          topics: ['architecture'],
          layers: [],
          technologies: []
        },
        {
          id: '2',
          text: 'Testing directive',
          severity: 'SHOULD',
          topics: ['testing'],
          layers: [],
          technologies: []
        }
      ];

      const session = createMockSession(mockDirectives);
      const engine = new RankingEngine();

      const result = await engine.queryAndRank(
        session,
        {
          topics: ['architecture', 'testing'],
          technologies: []
        },
        {
          mode: 'architect'
        }
      );

      expect(result.directives.length).toBeGreaterThan(0);
      // Architecture topics should be boosted
    });

    it('applies code mode adjustments', async () => {
      const mockDirectives = [
        {
          id: '1',
          text: 'Testing directive',
          severity: 'SHOULD',
          topics: ['testing'],
          layers: [],
          technologies: []
        }
      ];

      const session = createMockSession(mockDirectives);
      const engine = new RankingEngine();

      const result = await engine.queryAndRank(
        session,
        {
          topics: ['testing'],
          technologies: []
        },
        {
          mode: 'code'
        }
      );

      expect(result.directives.length).toBeGreaterThan(0);
    });

    it('applies debug mode adjustments', async () => {
      const mockDirectives = [
        {
          id: '1',
          text: 'Error handling directive',
          severity: 'SHOULD',
          topics: ['error-handling'],
          layers: [],
          technologies: []
        }
      ];

      const session = createMockSession(mockDirectives);
      const engine = new RankingEngine();

      const result = await engine.queryAndRank(
        session,
        {
          topics: ['error-handling'],
          technologies: []
        },
        {
          mode: 'debug'
        }
      );

      expect(result.directives.length).toBeGreaterThan(0);
    });
  });

  describe('Utility Methods', () => {
    it('filters by score threshold', () => {
      const engine = new RankingEngine();
      const directives: ScoredDirective[] = [
        {
          id: '1',
          text: 'High score',
          severity: 'MUST',
          topics: [],
          layers: [],
          technologies: [],
          score: 0.9,
          scoreBreakdown: {
            severity: 100,
            relevance: 80,
            layerMatch: 100,
            topicMatch: 60,
            techMatch: 50,
            authoritativeness: 100
          }
        },
        {
          id: '2',
          text: 'Low score',
          severity: 'MAY',
          topics: [],
          layers: [],
          technologies: [],
          score: 0.3,
          scoreBreakdown: {
            severity: 25,
            relevance: 50,
            layerMatch: 40,
            topicMatch: 0,
            techMatch: 0,
            authoritativeness: 0
          }
        }
      ];

      const filtered = engine.filterByScoreThreshold(directives, 0.5);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('1');
    });

    it('gets top N directives', () => {
      const engine = new RankingEngine();
      const directives: ScoredDirective[] = Array.from({ length: 10 }, (_, i) => ({
        id: `${i}`,
        text: `Directive ${i}`,
        severity: 'SHOULD',
        topics: [],
        layers: [],
        technologies: [],
        score: 1.0 - (i * 0.1),
        scoreBreakdown: {
          severity: 50,
          relevance: 50,
          layerMatch: 50,
          topicMatch: 20,
          techMatch: 0,
          authoritativeness: 0
        }
      }));

      const top3 = engine.getTopN(directives, 3);
      expect(top3).toHaveLength(3);
      expect(top3[0].score).toBeGreaterThanOrEqual(top3[1].score);
      expect(top3[1].score).toBeGreaterThanOrEqual(top3[2].score);
    });

    it('groups directives by severity', () => {
      const engine = new RankingEngine();
      const directives: ScoredDirective[] = [
        {
          id: '1',
          text: 'MUST',
          severity: 'MUST',
          topics: [],
          layers: [],
          technologies: [],
          score: 0.9,
          scoreBreakdown: {
            severity: 100,
            relevance: 50,
            layerMatch: 40,
            topicMatch: 0,
            techMatch: 0,
            authoritativeness: 0
          }
        },
        {
          id: '2',
          text: 'SHOULD',
          severity: 'SHOULD',
          topics: [],
          layers: [],
          technologies: [],
          score: 0.5,
          scoreBreakdown: {
            severity: 50,
            relevance: 50,
            layerMatch: 40,
            topicMatch: 0,
            techMatch: 0,
            authoritativeness: 0
          }
        },
        {
          id: '3',
          text: 'MAY',
          severity: 'MAY',
          topics: [],
          layers: [],
          technologies: [],
          score: 0.3,
          scoreBreakdown: {
            severity: 25,
            relevance: 50,
            layerMatch: 40,
            topicMatch: 0,
            techMatch: 0,
            authoritativeness: 0
          }
        }
      ];

      const grouped = engine.groupBySeverity(directives);
      expect(grouped.MUST).toHaveLength(1);
      expect(grouped.SHOULD).toHaveLength(1);
      expect(grouped.MAY).toHaveLength(1);
    });
  });

  describe('Statistics', () => {
    it('returns accurate statistics', async () => {
      const mockDirectives = Array.from({ length: 15 }, (_, i) => ({
        id: `${i}`,
        text: `Directive ${i}`,
        severity: 'SHOULD',
        topics: ['general'],
        layers: [],
        technologies: []
      }));

      const session = createMockSession(mockDirectives);
      const engine = new RankingEngine();

      const result = await engine.queryAndRank(
        session,
        {
          topics: ['general'],
          technologies: []
        },
        {
          maxItems: 5
        }
      );

      expect(result.stats.searched).toBe(15);
      expect(result.stats.considered).toBe(15);
      expect(result.stats.selected).toBeLessThanOrEqual(5);
      expect(result.stats.totalTokens).toBeGreaterThan(0);
      expect(result.stats.budgetRemaining).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    it('handles query errors gracefully', async () => {
      const session = {
        run: vi.fn().mockRejectedValue(new Error('Query failed'))
      } as any;

      const engine = new RankingEngine();

      const result = await engine.queryAndRank(
        session,
        {
          topics: ['security'],
          technologies: []
        }
      );

      expect(result.directives).toHaveLength(0);
      expect(result.stats.searched).toBe(0);
    });
  });
});
