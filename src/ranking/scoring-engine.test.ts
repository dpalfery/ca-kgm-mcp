/**
 * Unit tests for Scoring Engine
 */

import { describe, it, expect } from 'vitest';
import { ScoringEngine, DirectiveForScoring, ScoringContext } from './scoring-engine.js';

describe('ScoringEngine', () => {
  describe('Constructor and Validation', () => {
    it('creates engine with default weights', () => {
      const engine = new ScoringEngine();
      expect(engine).toBeDefined();
    });

    it('creates engine with custom weights', () => {
      const engine = new ScoringEngine({
        severity: 0.40,
        relevance: 0.30,
        layerMatch: 0.10,
        topicMatch: 0.10,
        techMatch: 0.05,
        authoritativeness: 0.05
      });
      expect(engine).toBeDefined();
    });

    it('throws error if weights do not sum to 1.0', () => {
      expect(() => new ScoringEngine({
        severity: 0.50,
        relevance: 0.30,
        layerMatch: 0.10,
        topicMatch: 0.10,
        techMatch: 0.10,
        authoritativeness: 0.10
      })).toThrow('Scoring weights must sum to 1.0');
    });
  });

  describe('Severity Scoring', () => {
    it('scores MUST directives at 100', () => {
      const engine = new ScoringEngine();
      const directive: DirectiveForScoring = {
        id: '1',
        text: 'Test directive',
        severity: 'MUST',
        topics: [],
        layers: [],
        technologies: []
      };
      const context: ScoringContext = {
        topics: [],
        technologies: []
      };

      const scored = engine.scoreDirective(directive, context);
      expect(scored.scoreBreakdown.severity).toBe(100);
    });

    it('scores SHOULD directives at 50', () => {
      const engine = new ScoringEngine();
      const directive: DirectiveForScoring = {
        id: '1',
        text: 'Test directive',
        severity: 'SHOULD',
        topics: [],
        layers: [],
        technologies: []
      };
      const context: ScoringContext = {
        topics: [],
        technologies: []
      };

      const scored = engine.scoreDirective(directive, context);
      expect(scored.scoreBreakdown.severity).toBe(50);
    });

    it('scores MAY directives at 25', () => {
      const engine = new ScoringEngine();
      const directive: DirectiveForScoring = {
        id: '1',
        text: 'Test directive',
        severity: 'MAY',
        topics: [],
        layers: [],
        technologies: []
      };
      const context: ScoringContext = {
        topics: [],
        technologies: []
      };

      const scored = engine.scoreDirective(directive, context);
      expect(scored.scoreBreakdown.severity).toBe(25);
    });
  });

  describe('Relevance Scoring', () => {
    it('scores exact keyword match at 100', () => {
      const engine = new ScoringEngine();
      const directive: DirectiveForScoring = {
        id: '1',
        text: 'All API endpoints must require authentication',
        severity: 'MUST',
        topics: [],
        layers: [],
        technologies: []
      };
      const context: ScoringContext = {
        topics: [],
        technologies: [],
        keywords: ['authentication']
      };

      const scored = engine.scoreDirective(directive, context);
      expect(scored.scoreBreakdown.relevance).toBe(100);
    });

    it('scores word-level match at 60', () => {
      const engine = new ScoringEngine();
      const directive: DirectiveForScoring = {
        id: '1',
        text: 'Use authenticated requests',
        severity: 'MUST',
        topics: [],
        layers: [],
        technologies: []
      };
      const context: ScoringContext = {
        topics: [],
        technologies: [],
        keywords: ['auth']
      };

      const scored = engine.scoreDirective(directive, context);
      expect(scored.scoreBreakdown.relevance).toBeGreaterThanOrEqual(60);
    });

    it('returns default score when no keywords provided', () => {
      const engine = new ScoringEngine();
      const directive: DirectiveForScoring = {
        id: '1',
        text: 'Test directive',
        severity: 'MUST',
        topics: [],
        layers: [],
        technologies: []
      };
      const context: ScoringContext = {
        topics: [],
        technologies: []
      };

      const scored = engine.scoreDirective(directive, context);
      expect(scored.scoreBreakdown.relevance).toBe(50);
    });
  });

  describe('Layer Matching Scoring', () => {
    it('scores exact layer match at 100', () => {
      const engine = new ScoringEngine();
      const directive: DirectiveForScoring = {
        id: '1',
        text: 'Test directive',
        severity: 'MUST',
        topics: [],
        layers: ['3-Domain'],
        technologies: []
      };
      const context: ScoringContext = {
        detectedLayer: '3-Domain',
        topics: [],
        technologies: []
      };

      const scored = engine.scoreDirective(directive, context);
      expect(scored.scoreBreakdown.layerMatch).toBe(100);
    });

    it('scores adjacent layer at 50', () => {
      const engine = new ScoringEngine();
      const directive: DirectiveForScoring = {
        id: '1',
        text: 'Test directive',
        severity: 'MUST',
        topics: [],
        layers: ['2-Application'],
        technologies: []
      };
      const context: ScoringContext = {
        detectedLayer: '3-Domain',
        topics: [],
        technologies: []
      };

      const scored = engine.scoreDirective(directive, context);
      expect(scored.scoreBreakdown.layerMatch).toBe(50);
    });

    it('scores distant layer at 10', () => {
      const engine = new ScoringEngine();
      const directive: DirectiveForScoring = {
        id: '1',
        text: 'Test directive',
        severity: 'MUST',
        topics: [],
        layers: ['7-Infrastructure'],
        technologies: []
      };
      const context: ScoringContext = {
        detectedLayer: '3-Domain',
        topics: [],
        technologies: []
      };

      const scored = engine.scoreDirective(directive, context);
      expect(scored.scoreBreakdown.layerMatch).toBe(10);
    });

    it('scores wildcard layer at 40', () => {
      const engine = new ScoringEngine();
      const directive: DirectiveForScoring = {
        id: '1',
        text: 'Test directive',
        severity: 'MUST',
        topics: [],
        layers: ['*'],
        technologies: []
      };
      const context: ScoringContext = {
        detectedLayer: '3-Domain',
        topics: [],
        technologies: []
      };

      const scored = engine.scoreDirective(directive, context);
      expect(scored.scoreBreakdown.layerMatch).toBe(40);
    });

    it('returns default score when no layer detected', () => {
      const engine = new ScoringEngine();
      const directive: DirectiveForScoring = {
        id: '1',
        text: 'Test directive',
        severity: 'MUST',
        topics: [],
        layers: ['3-Domain'],
        technologies: []
      };
      const context: ScoringContext = {
        topics: [],
        technologies: []
      };

      const scored = engine.scoreDirective(directive, context);
      expect(scored.scoreBreakdown.layerMatch).toBe(40);
    });
  });

  describe('Topic Matching Scoring', () => {
    it('scores topic matches correctly', () => {
      const engine = new ScoringEngine();
      const directive: DirectiveForScoring = {
        id: '1',
        text: 'Test directive',
        severity: 'MUST',
        topics: ['security', 'api'],
        layers: [],
        technologies: []
      };
      const context: ScoringContext = {
        topics: ['security', 'api'],
        technologies: []
      };

      const scored = engine.scoreDirective(directive, context);
      expect(scored.scoreBreakdown.topicMatch).toBe(40); // 2 matches * 20
    });

    it('caps topic score at 100', () => {
      const engine = new ScoringEngine();
      const directive: DirectiveForScoring = {
        id: '1',
        text: 'Test directive',
        severity: 'MUST',
        topics: ['security', 'api', 'testing', 'performance', 'logging', 'documentation'],
        layers: [],
        technologies: []
      };
      const context: ScoringContext = {
        topics: ['security', 'api', 'testing', 'performance', 'logging', 'documentation'],
        technologies: []
      };

      const scored = engine.scoreDirective(directive, context);
      expect(scored.scoreBreakdown.topicMatch).toBe(100);
    });

    it('returns 0 when no topics match', () => {
      const engine = new ScoringEngine();
      const directive: DirectiveForScoring = {
        id: '1',
        text: 'Test directive',
        severity: 'MUST',
        topics: ['security'],
        layers: [],
        technologies: []
      };
      const context: ScoringContext = {
        topics: ['performance'],
        technologies: []
      };

      const scored = engine.scoreDirective(directive, context);
      expect(scored.scoreBreakdown.topicMatch).toBe(0);
    });
  });

  describe('Technology Matching Scoring', () => {
    it('scores technology matches correctly', () => {
      const engine = new ScoringEngine();
      const directive: DirectiveForScoring = {
        id: '1',
        text: 'Test directive',
        severity: 'MUST',
        topics: [],
        layers: [],
        technologies: ['TypeScript', 'Node.js']
      };
      const context: ScoringContext = {
        topics: [],
        technologies: ['TypeScript', 'Node.js']
      };

      const scored = engine.scoreDirective(directive, context);
      expect(scored.scoreBreakdown.techMatch).toBe(50); // 2 matches * 25
    });

    it('caps technology score at 100', () => {
      const engine = new ScoringEngine();
      const directive: DirectiveForScoring = {
        id: '1',
        text: 'Test directive',
        severity: 'MUST',
        topics: [],
        layers: [],
        technologies: ['TypeScript', 'Node.js', 'React', 'Neo4j', 'Docker']
      };
      const context: ScoringContext = {
        topics: [],
        technologies: ['TypeScript', 'Node.js', 'React', 'Neo4j', 'Docker']
      };

      const scored = engine.scoreDirective(directive, context);
      expect(scored.scoreBreakdown.techMatch).toBe(100);
    });
  });

  describe('Authoritativeness Scoring', () => {
    it('scores authoritative directives at 100', () => {
      const engine = new ScoringEngine();
      const directive: DirectiveForScoring = {
        id: '1',
        text: 'Test directive',
        severity: 'MUST',
        topics: [],
        layers: [],
        technologies: [],
        authoritative: true
      };
      const context: ScoringContext = {
        topics: [],
        technologies: []
      };

      const scored = engine.scoreDirective(directive, context);
      expect(scored.scoreBreakdown.authoritativeness).toBe(100);
    });

    it('scores non-authoritative directives at 0', () => {
      const engine = new ScoringEngine();
      const directive: DirectiveForScoring = {
        id: '1',
        text: 'Test directive',
        severity: 'MUST',
        topics: [],
        layers: [],
        technologies: []
      };
      const context: ScoringContext = {
        topics: [],
        technologies: []
      };

      const scored = engine.scoreDirective(directive, context);
      expect(scored.scoreBreakdown.authoritativeness).toBe(0);
    });
  });

  describe('Combined Scoring', () => {
    it('calculates normalized total score correctly', () => {
      const engine = new ScoringEngine();
      const directive: DirectiveForScoring = {
        id: '1',
        text: 'All API endpoints must require authentication using JWT',
        severity: 'MUST',
        topics: ['security', 'api'],
        layers: ['5-Integration'],
        technologies: ['JWT'],
        authoritative: true
      };
      const context: ScoringContext = {
        detectedLayer: '5-Integration',
        topics: ['security', 'api'],
        technologies: ['JWT'],
        keywords: ['authentication']
      };

      const scored = engine.scoreDirective(directive, context);
      
      expect(scored.score).toBeGreaterThan(0);
      expect(scored.score).toBeLessThanOrEqual(1.0);
      expect(scored.scoreBreakdown.severity).toBe(100);
      expect(scored.scoreBreakdown.layerMatch).toBe(100);
      expect(scored.scoreBreakdown.topicMatch).toBe(40);
      expect(scored.scoreBreakdown.techMatch).toBe(25);
      expect(scored.scoreBreakdown.authoritativeness).toBe(100);
    });
  });

  describe('Multiple Directive Scoring', () => {
    it('scores and sorts multiple directives', () => {
      const engine = new ScoringEngine();
      const directives: DirectiveForScoring[] = [
        {
          id: '1',
          text: 'Low priority directive',
          severity: 'MAY',
          topics: [],
          layers: [],
          technologies: []
        },
        {
          id: '2',
          text: 'High priority directive with authentication',
          severity: 'MUST',
          topics: ['security'],
          layers: ['5-Integration'],
          technologies: ['JWT'],
          authoritative: true
        },
        {
          id: '3',
          text: 'Medium priority directive',
          severity: 'SHOULD',
          topics: ['security'],
          layers: ['5-Integration'],
          technologies: []
        }
      ];
      const context: ScoringContext = {
        detectedLayer: '5-Integration',
        topics: ['security'],
        technologies: ['JWT'],
        keywords: ['authentication']
      };

      const scored = engine.scoreDirectives(directives, context);

      expect(scored).toHaveLength(3);
      expect(scored[0].id).toBe('2'); // Highest score
      expect(scored[2].id).toBe('1'); // Lowest score
      expect(scored[0].score).toBeGreaterThan(scored[1].score);
      expect(scored[1].score).toBeGreaterThan(scored[2].score);
    });
  });

  describe('Mode-Based Adjustments', () => {
    it('applies architect mode adjustments', () => {
      const engine = new ScoringEngine();
      const directives: DirectiveForScoring[] = [
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
      const context: ScoringContext = {
        topics: ['architecture', 'testing'],
        technologies: []
      };

      const scored = engine.scoreDirectives(directives, context);
      const adjusted = engine.applyModeAdjustments(scored, 'architect');

      // Architecture should be boosted in architect mode
      expect(adjusted[0].topics).toContain('architecture');
    });

    it('applies code mode adjustments', () => {
      const engine = new ScoringEngine();
      const directives: DirectiveForScoring[] = [
        {
          id: '1',
          text: 'Testing directive',
          severity: 'SHOULD',
          topics: ['testing'],
          layers: [],
          technologies: []
        },
        {
          id: '2',
          text: 'Architecture directive',
          severity: 'SHOULD',
          topics: ['architecture'],
          layers: [],
          technologies: []
        }
      ];
      const context: ScoringContext = {
        topics: ['testing', 'architecture'],
        technologies: []
      };

      const scored = engine.scoreDirectives(directives, context);
      const adjusted = engine.applyModeAdjustments(scored, 'code');

      // Testing should be boosted in code mode
      expect(adjusted[0].topics).toContain('testing');
    });

    it('applies debug mode adjustments', () => {
      const engine = new ScoringEngine();
      const directives: DirectiveForScoring[] = [
        {
          id: '1',
          text: 'Error handling directive',
          severity: 'SHOULD',
          topics: ['error-handling'],
          layers: [],
          technologies: []
        },
        {
          id: '2',
          text: 'Documentation directive',
          severity: 'SHOULD',
          topics: ['documentation'],
          layers: [],
          technologies: []
        }
      ];
      const context: ScoringContext = {
        topics: ['error-handling', 'documentation'],
        technologies: []
      };

      const scored = engine.scoreDirectives(directives, context);
      const adjusted = engine.applyModeAdjustments(scored, 'debug');

      // Error handling should be boosted in debug mode
      expect(adjusted[0].topics).toContain('error-handling');
    });

    it('does not modify scores when no mode specified', () => {
      const engine = new ScoringEngine();
      const directives: DirectiveForScoring[] = [
        {
          id: '1',
          text: 'Test directive',
          severity: 'SHOULD',
          topics: ['testing'],
          layers: [],
          technologies: []
        }
      ];
      const context: ScoringContext = {
        topics: ['testing'],
        technologies: []
      };

      const scored = engine.scoreDirectives(directives, context);
      const adjusted = engine.applyModeAdjustments(scored);

      expect(adjusted[0].score).toBe(scored[0].score);
    });

    it('caps adjusted scores at 1.0', () => {
      const engine = new ScoringEngine();
      const directives: DirectiveForScoring[] = [
        {
          id: '1',
          text: 'High score directive',
          severity: 'MUST',
          topics: ['architecture'],
          layers: ['3-Domain'],
          technologies: ['TypeScript'],
          authoritative: true
        }
      ];
      const context: ScoringContext = {
        detectedLayer: '3-Domain',
        topics: ['architecture'],
        technologies: ['TypeScript'],
        keywords: ['design']
      };

      const scored = engine.scoreDirectives(directives, context);
      const adjusted = engine.applyModeAdjustments(scored, 'architect');

      expect(adjusted[0].score).toBeLessThanOrEqual(1.0);
    });
  });
});
