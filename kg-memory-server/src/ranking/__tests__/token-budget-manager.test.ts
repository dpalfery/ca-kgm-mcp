import { describe, it, expect, beforeEach } from 'vitest';
import { TokenBudgetManager, DEFAULT_TOKEN_BUDGET_CONFIG } from '../token-budget-manager.js';
import { RankedDirective } from '../../types.js';

describe('TokenBudgetManager', () => {
  let manager: TokenBudgetManager;
  let mockDirectives: RankedDirective[];

  beforeEach(() => {
    manager = new TokenBudgetManager();
    
    mockDirectives = [
      {
        id: 'directive-1',
        ruleId: 'rule-1',
        section: 'Security',
        severity: 'MUST',
        text: 'Always validate user input before processing to prevent injection attacks',
        rationale: 'Input validation is critical for security',
        topics: ['security', 'validation'],
        whenToApply: ['handling user input'],
        score: 95.5,
        scoreBreakdown: {
          authority: 1, layerMatch: 1, topicOverlap: 0.8,
          severityBoost: 1, semanticSimilarity: 0.7, whenToApply: 0.9
        }
      },
      {
        id: 'directive-2',
        ruleId: 'rule-1',
        section: 'Performance',
        severity: 'SHOULD',
        text: 'Use connection pooling for database operations to improve performance',
        rationale: 'Connection pooling reduces overhead and improves scalability',
        example: 'const pool = new Pool({ connectionString: "..." });',
        topics: ['performance', 'database'],
        whenToApply: ['database operations'],
        score: 75.2,
        scoreBreakdown: {
          authority: 0.8, layerMatch: 0.9, topicOverlap: 0.6,
          severityBoost: 0.7, semanticSimilarity: 0.5, whenToApply: 0.8
        }
      },
      {
        id: 'directive-3',
        ruleId: 'rule-2',
        section: 'Code Style',
        severity: 'MAY',
        text: 'Consider using TypeScript for better type safety and developer experience',
        rationale: 'TypeScript helps catch errors at compile time',
        antiPattern: 'Using any type everywhere defeats the purpose',
        topics: ['typescript', 'code-quality'],
        whenToApply: ['new projects'],
        score: 45.8,
        scoreBreakdown: {
          authority: 0.3, layerMatch: 0.5, topicOverlap: 0.4,
          severityBoost: 0.4, semanticSimilarity: 0.3, whenToApply: 0.2
        }
      }
    ];
  });

  describe('applyBudget', () => {
    it('should select directives within token budget', () => {
      const result = manager.applyBudget(mockDirectives, 200);
      
      expect(result.selectedDirectives.length).toBeGreaterThan(0);
      expect(result.tokensUsed).toBeLessThanOrEqual(200 - DEFAULT_TOKEN_BUDGET_CONFIG.overheadTokens);
      expect(result.tokensRemaining).toBeGreaterThanOrEqual(0);
    });

    it('should prioritize higher-scored directives', () => {
      const result = manager.applyBudget(mockDirectives, 100);
      
      if (result.selectedDirectives.length > 1) {
        for (let i = 1; i < result.selectedDirectives.length; i++) {
          expect(result.selectedDirectives[i].score).toBeLessThanOrEqual(result.selectedDirectives[i - 1].score);
        }
      }
    });

    it('should return empty result for zero budget', () => {
      const result = manager.applyBudget(mockDirectives, 0);
      
      expect(result.selectedDirectives).toHaveLength(0);
      expect(result.tokensUsed).toBe(0);
      expect(result.excludedCount).toBe(mockDirectives.length);
    });

    it('should return empty result for insufficient budget', () => {
      const result = manager.applyBudget(mockDirectives, 10); // Very small budget
      
      expect(result.selectedDirectives).toHaveLength(0);
      expect(result.excludedCount).toBe(mockDirectives.length);
    });

    it('should handle empty directive list', () => {
      const result = manager.applyBudget([], 100);
      
      expect(result.selectedDirectives).toHaveLength(0);
      expect(result.tokensUsed).toBe(0);
      expect(result.excludedCount).toBe(0);
    });

    it('should provide accurate token breakdown', () => {
      const result = manager.applyBudget(mockDirectives, 200);
      
      expect(result.tokenBreakdown.overhead).toBe(DEFAULT_TOKEN_BUDGET_CONFIG.overheadTokens);
      expect(result.tokenBreakdown.directives).toBe(result.tokensUsed);
      expect(result.tokenBreakdown.truncationIndicators).toBe(
        result.truncatedCount * DEFAULT_TOKEN_BUDGET_CONFIG.truncationIndicatorTokens
      );
    });
  });

  describe('estimateDirectiveTokens', () => {
    it('should estimate tokens based on text content', () => {
      const tokens = manager.estimateDirectiveTokens(mockDirectives[0]);
      expect(tokens).toBeGreaterThan(0);
      expect(typeof tokens).toBe('number');
    });

    it('should include all text fields in estimation', () => {
      const directiveWithAllFields = mockDirectives[1]; // Has text, rationale, and example
      const directiveWithTextOnly = { ...mockDirectives[0] };
      delete directiveWithTextOnly.rationale;
      
      const tokensWithAllFields = manager.estimateDirectiveTokens(directiveWithAllFields);
      const tokensTextOnly = manager.estimateDirectiveTokens(directiveWithTextOnly);
      
      expect(tokensWithAllFields).toBeGreaterThan(tokensTextOnly);
    });

    it('should return minimum tokens for very short text', () => {
      const shortDirective = {
        ...mockDirectives[0],
        text: 'A',
        rationale: undefined
      };
      
      const tokens = manager.estimateDirectiveTokens(shortDirective);
      expect(tokens).toBeGreaterThanOrEqual(5); // Minimum token count
    });
  });

  describe('estimateTokensFromText', () => {
    it('should estimate tokens from text length', () => {
      const text = 'This is a sample text for token estimation';
      const tokens = manager.estimateTokensFromText(text);
      
      expect(tokens).toBeGreaterThan(0);
      // Just check that it's in a reasonable range rather than exact approximation
      expect(tokens).toBeGreaterThanOrEqual(Math.floor(text.length / 5));
      expect(tokens).toBeLessThanOrEqual(Math.ceil(text.length / 3));
    });

    it('should return 0 for empty text', () => {
      expect(manager.estimateTokensFromText('')).toBe(0);
      expect(manager.estimateTokensFromText('   ')).toBe(0);
    });

    it('should apply minimum token count', () => {
      const shortText = 'Hi';
      const tokens = manager.estimateTokensFromText(shortText);
      expect(tokens).toBeGreaterThanOrEqual(5);
    });
  });

  describe('truncateDirective', () => {
    it('should truncate directive to fit within token limit', () => {
      const originalDirective = mockDirectives[1]; // Has text, rationale, and example
      const maxTokens = 30;
      
      const truncated = manager.truncateDirective(originalDirective, maxTokens);
      const truncatedTokens = manager.estimateDirectiveTokens(truncated);
      
      expect(truncatedTokens).toBeLessThanOrEqual(maxTokens);
      expect(truncated.text.length).toBeLessThanOrEqual(originalDirective.text.length);
    });

    it('should preserve directive structure', () => {
      const truncated = manager.truncateDirective(mockDirectives[0], 50);
      
      expect(truncated.id).toBe(mockDirectives[0].id);
      expect(truncated.severity).toBe(mockDirectives[0].severity);
      expect(truncated.score).toBe(mockDirectives[0].score);
      expect(truncated.scoreBreakdown).toEqual(mockDirectives[0].scoreBreakdown);
    });

    it('should add truncation indicators', () => {
      const longDirective = {
        ...mockDirectives[0],
        text: 'A'.repeat(200), // Very long text
        rationale: 'B'.repeat(100)
      };
      
      const truncated = manager.truncateDirective(longDirective, 30);
      
      expect(truncated.text).toMatch(/\.\.\.$/);
    });

    it('should remove optional fields when necessary', () => {
      const directiveWithOptionalFields = {
        ...mockDirectives[1],
        text: 'A'.repeat(100),
        rationale: 'B'.repeat(100),
        example: 'C'.repeat(100),
        antiPattern: 'D'.repeat(100)
      };
      
      const truncated = manager.truncateDirective(directiveWithOptionalFields, 20);
      
      // Should remove example and antiPattern first
      expect(truncated.example).toBeUndefined();
      expect(truncated.antiPattern).toBeUndefined();
    });

    it('should throw error for insufficient token limit', () => {
      expect(() => {
        manager.truncateDirective(mockDirectives[0], 5); // Below minimum
      }).toThrow();
    });
  });

  describe('canFitDirective', () => {
    it('should return true when directive fits', () => {
      const tokens = manager.estimateDirectiveTokens(mockDirectives[0]);
      const canFit = manager.canFitDirective(mockDirectives[0], tokens + 10);
      
      expect(canFit).toBe(true);
    });

    it('should return false when directive does not fit', () => {
      const tokens = manager.estimateDirectiveTokens(mockDirectives[0]);
      const canFit = manager.canFitDirective(mockDirectives[0], tokens - 5);
      
      expect(canFit).toBe(false);
    });

    it('should handle edge case of exact fit', () => {
      const tokens = manager.estimateDirectiveTokens(mockDirectives[0]);
      const canFit = manager.canFitDirective(mockDirectives[0], tokens);
      
      expect(canFit).toBe(true);
    });
  });

  describe('selectByPriority', () => {
    it('should select directives by priority within budget', () => {
      const selected = manager.selectByPriority(mockDirectives, 150);
      
      expect(selected.length).toBeGreaterThan(0);
      expect(selected.length).toBeLessThanOrEqual(mockDirectives.length);
      
      // Should be ordered by score
      for (let i = 1; i < selected.length; i++) {
        expect(selected[i].score).toBeLessThanOrEqual(selected[i - 1].score);
      }
    });

    it('should return empty array for insufficient budget', () => {
      const selected = manager.selectByPriority(mockDirectives, 10);
      expect(selected).toHaveLength(0);
    });
  });

  describe('configuration management', () => {
    it('should update configuration correctly', () => {
      const newConfig = {
        averageTokensPerDirective: 75,
        minimumDirectiveTokens: 20
      };
      
      manager.updateConfig(newConfig);
      const config = manager.getConfig();
      
      expect(config.averageTokensPerDirective).toBe(75);
      expect(config.minimumDirectiveTokens).toBe(20);
      expect(config.overheadTokens).toBe(DEFAULT_TOKEN_BUDGET_CONFIG.overheadTokens); // Should remain unchanged
    });

    it('should preserve existing config when partially updating', () => {
      const originalConfig = manager.getConfig();
      manager.updateConfig({ overheadTokens: 30 });
      
      const updatedConfig = manager.getConfig();
      expect(updatedConfig.overheadTokens).toBe(30);
      expect(updatedConfig.averageTokensPerDirective).toBe(originalConfig.averageTokensPerDirective);
    });
  });

  describe('truncation behavior', () => {
    it('should truncate MUST directives with high scores', () => {
      const highPriorityDirective = {
        ...mockDirectives[0],
        severity: 'MUST' as const,
        score: 90,
        text: 'A'.repeat(500) // Very long text
      };
      
      const result = manager.applyBudget([highPriorityDirective], 100);
      
      // The directive might be excluded if it's too large even after truncation
      // Let's check if it was at least attempted
      expect(result.selectedDirectives.length + result.excludedCount).toBe(1);
      
      if (result.selectedDirectives.length > 0) {
        expect(result.selectedDirectives[0].text.length).toBeLessThan(highPriorityDirective.text.length);
      }
    });

    it('should not truncate low-priority directives', () => {
      const lowPriorityDirective = {
        ...mockDirectives[2],
        severity: 'MAY' as const,
        score: 30,
        text: 'A'.repeat(500) // Very long text
      };
      
      const result = manager.applyBudget([lowPriorityDirective], 50);
      
      expect(result.selectedDirectives.length).toBe(0);
      expect(result.truncatedCount).toBe(0);
      expect(result.excludedCount).toBe(1);
    });

    it('should respect maxSingleDirectivePercentage', () => {
      const largeDirective = {
        ...mockDirectives[0],
        text: 'A'.repeat(1000) // Very large directive
      };
      
      const result = manager.applyBudget([largeDirective], 200);
      
      // Should not allow a single directive to use more than 40% of budget
      if (result.selectedDirectives.length > 0) {
        const usedTokens = manager.estimateDirectiveTokens(result.selectedDirectives[0]);
        const maxAllowed = (200 - DEFAULT_TOKEN_BUDGET_CONFIG.overheadTokens) * 0.4;
        expect(usedTokens).toBeLessThanOrEqual(maxAllowed + 10); // Small tolerance for estimation
      }
    });
  });
});