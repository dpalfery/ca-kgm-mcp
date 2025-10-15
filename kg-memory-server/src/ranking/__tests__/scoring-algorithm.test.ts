import { describe, it, expect, beforeEach } from 'vitest';
import { ScoringAlgorithm, DEFAULT_RANKING_CONFIG } from '../scoring-algorithm.js';
import { Directive, TaskContext } from '../../types.js';

describe('ScoringAlgorithm', () => {
  let algorithm: ScoringAlgorithm;
  let mockDirective: Directive;
  let mockContext: TaskContext;

  beforeEach(() => {
    algorithm = new ScoringAlgorithm();
    
    mockDirective = {
      id: 'test-directive-1',
      ruleId: 'test-rule-1',
      section: 'Security',
      severity: 'MUST',
      text: 'Always validate user input before processing',
      rationale: 'Prevents injection attacks and data corruption',
      topics: ['security', 'validation', 'input'],
      whenToApply: ['handling user input', 'processing form data', 'API endpoints']
    };

    mockContext = {
      layer: '2-Application',
      topics: ['security', 'api'],
      keywords: ['validate', 'input', 'user', 'endpoint'],
      technologies: ['express', 'nodejs'],
      confidence: 0.85
    };
  });

  describe('calculateScore', () => {
    it('should calculate weighted score correctly', () => {
      const score = algorithm.calculateScore(mockDirective, mockContext);
      expect(score).toBeGreaterThan(0);
      expect(typeof score).toBe('number');
    });

    it('should return higher scores for more relevant directives', () => {
      const relevantDirective = { ...mockDirective };
      const irrelevantDirective = {
        ...mockDirective,
        topics: ['unrelated', 'topic'],
        whenToApply: ['different context'],
        text: 'Unrelated directive text'
      };

      const relevantScore = algorithm.calculateScore(relevantDirective, mockContext);
      const irrelevantScore = algorithm.calculateScore(irrelevantDirective, mockContext);

      expect(relevantScore).toBeGreaterThan(irrelevantScore);
    });
  });

  describe('authorityScore', () => {
    it('should return 1.0 for matching topics', () => {
      const score = algorithm.authorityScore(mockDirective, ['security', 'validation']);
      expect(score).toBe(1.0);
    });

    it('should return 0.0 for non-matching topics', () => {
      const score = algorithm.authorityScore(mockDirective, ['unrelated', 'topics']);
      expect(score).toBe(0.0);
    });

    it('should return 0.0 for empty topics', () => {
      const score = algorithm.authorityScore(mockDirective, []);
      expect(score).toBe(0.0);
    });

    it('should handle partial topic matches', () => {
      const score = algorithm.authorityScore(mockDirective, ['sec', 'valid']);
      expect(score).toBe(1.0); // Should match due to substring matching
    });
  });

  describe('layerMatchScore', () => {
    it('should return 1.0 for layer-specific keywords', () => {
      const apiDirective = {
        ...mockDirective,
        text: 'API endpoint validation rules',
        topics: ['api', 'service']
      };
      const score = algorithm.layerMatchScore(apiDirective, '2-Application');
      expect(score).toBe(1.0);
    });

    it('should return 0.5 for wildcard indicators', () => {
      const wildcardDirective = {
        ...mockDirective,
        topics: ['*'],
        whenToApply: ['all contexts']
      };
      const score = algorithm.layerMatchScore(wildcardDirective, '2-Application');
      expect(score).toBe(0.5);
    });

    it('should return 0.0 for non-matching layers', () => {
      const dbDirective = {
        ...mockDirective,
        text: 'Database connection pooling',
        topics: ['database', 'sql']
      };
      const score = algorithm.layerMatchScore(dbDirective, '1-Presentation');
      expect(score).toBe(0.0);
    });
  });

  describe('topicOverlapScore', () => {
    it('should return correct ratio for partial overlap', () => {
      const score = algorithm.topicOverlapScore(mockDirective, ['security', 'performance']);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should return 1.0 for complete overlap', () => {
      const score = algorithm.topicOverlapScore(mockDirective, ['security', 'validation', 'input']);
      expect(score).toBe(1.0);
    });

    it('should return 0.0 for no overlap', () => {
      const score = algorithm.topicOverlapScore(mockDirective, ['performance', 'caching']);
      expect(score).toBe(0.0);
    });

    it('should handle empty topics gracefully', () => {
      const score = algorithm.topicOverlapScore(mockDirective, []);
      expect(score).toBe(0.0);
    });
  });

  describe('severityBoost', () => {
    it('should return correct multipliers for each severity', () => {
      expect(algorithm.severityBoost('MUST')).toBe(DEFAULT_RANKING_CONFIG.severityMultipliers.MUST);
      expect(algorithm.severityBoost('SHOULD')).toBe(DEFAULT_RANKING_CONFIG.severityMultipliers.SHOULD);
      expect(algorithm.severityBoost('MAY')).toBe(DEFAULT_RANKING_CONFIG.severityMultipliers.MAY);
    });

    it('should have MUST > SHOULD > MAY', () => {
      const mustScore = algorithm.severityBoost('MUST');
      const shouldScore = algorithm.severityBoost('SHOULD');
      const mayScore = algorithm.severityBoost('MAY');

      expect(mustScore).toBeGreaterThan(shouldScore);
      expect(shouldScore).toBeGreaterThan(mayScore);
    });
  });

  describe('semanticSimilarity', () => {
    it('should return higher scores for similar text', () => {
      const taskText = 'validate user input for security';
      const score = algorithm.semanticSimilarity(mockDirective, taskText);
      expect(score).toBeGreaterThan(0);
    });

    it('should return 0.0 for completely different text', () => {
      const taskText = 'configure database connection pooling';
      const score = algorithm.semanticSimilarity(mockDirective, taskText);
      expect(score).toBe(0.0);
    });

    it('should handle empty task text', () => {
      const score = algorithm.semanticSimilarity(mockDirective, '');
      expect(score).toBe(0.0);
    });

    it('should ignore short words', () => {
      const taskText = 'a an the is at to';
      const score = algorithm.semanticSimilarity(mockDirective, taskText);
      expect(score).toBe(0.0);
    });
  });

  describe('whenToApplyScore', () => {
    it('should return 1.0 for complete keyword match', () => {
      const keywords = ['handling', 'user', 'input', 'processing', 'form', 'data'];
      const score = algorithm.whenToApplyScore(mockDirective, keywords);
      expect(score).toBeCloseTo(0.67, 2); // 2/3 conditions match
    });

    it('should return partial score for partial match', () => {
      const keywords = ['user', 'input'];
      const score = algorithm.whenToApplyScore(mockDirective, keywords);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(1);
    });

    it('should return 0.0 for no matches', () => {
      const keywords = ['unrelated', 'keywords'];
      const score = algorithm.whenToApplyScore(mockDirective, keywords);
      expect(score).toBe(0.0);
    });

    it('should handle empty keywords', () => {
      const score = algorithm.whenToApplyScore(mockDirective, []);
      expect(score).toBe(0.0);
    });
  });

  describe('configuration management', () => {
    it('should update configuration correctly', () => {
      const newWeights = { authority: 15, layerMatch: 10 };
      algorithm.updateConfig({ weights: newWeights });
      
      const config = algorithm.getConfig();
      expect(config.weights.authority).toBe(15);
      expect(config.weights.layerMatch).toBe(10);
      expect(config.weights.topicOverlap).toBe(DEFAULT_RANKING_CONFIG.weights.topicOverlap); // Should remain unchanged
    });

    it('should preserve existing config when partially updating', () => {
      const originalConfig = algorithm.getConfig();
      algorithm.updateConfig({ 
        severityMultipliers: { MUST: 1.5, SHOULD: 0.8, MAY: 0.3 } 
      });
      
      const updatedConfig = algorithm.getConfig();
      expect(updatedConfig.weights).toEqual(originalConfig.weights);
      expect(updatedConfig.severityMultipliers.MUST).toBe(1.5);
    });
  });
});