/**
 * Unit tests for Token Counter
 */

import { describe, it, expect } from 'vitest';
import { TokenCounter } from './token-counter.js';

describe('TokenCounter', () => {
  describe('Token Estimation', () => {
    it('estimates tokens for simple text', () => {
      const counter = new TokenCounter();
      const text = 'This is a simple test';
      const tokens = counter.estimateTokens(text);
      
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(20); // Should be around 5-6 tokens
    });

    it('estimates tokens for empty string', () => {
      const counter = new TokenCounter();
      const tokens = counter.estimateTokens('');
      
      expect(tokens).toBe(0);
    });

    it('estimates tokens for longer text', () => {
      const counter = new TokenCounter();
      const text = 'All API endpoints must require authentication using JWT tokens. This ensures secure access to protected resources.';
      const tokens = counter.estimateTokens(text);
      
      expect(tokens).toBeGreaterThan(15);
      expect(tokens).toBeLessThan(50);
    });

    it('estimates tokens for text with special characters', () => {
      const counter = new TokenCounter();
      const text = '[MUST] Use @decorators for #validation & $authorization!';
      const tokens = counter.estimateTokens(text);
      
      expect(tokens).toBeGreaterThan(0);
    });

    it('estimates tokens for multiple strings', () => {
      const counter = new TokenCounter();
      const texts = [
        'First text',
        'Second text',
        'Third text'
      ];
      const estimates = counter.estimateTokensForMultiple(texts);
      
      expect(estimates).toHaveLength(3);
      expect(estimates[0].text).toBe('First text');
      expect(estimates[0].estimatedTokens).toBeGreaterThan(0);
    });
  });

  describe('Budget Filtering', () => {
    it('filters items to fit within budget', () => {
      const counter = new TokenCounter();
      const items = [
        { text: 'Short' },
        { text: 'A bit longer text' },
        { text: 'This is a much longer text that will use more tokens' }
      ];
      
      const result = counter.filterByBudget(items, 20);
      
      expect(result.itemsIncluded).toBeLessThanOrEqual(items.length);
      expect(result.totalTokens).toBeLessThanOrEqual(20);
      expect(result.budgetRemaining).toBeGreaterThanOrEqual(0);
    });

    it('includes all items if budget allows', () => {
      const counter = new TokenCounter();
      const items = [
        { text: 'Short' },
        { text: 'Also short' }
      ];
      
      const result = counter.filterByBudget(items, 1000);
      
      expect(result.itemsIncluded).toBe(2);
      expect(result.items).toHaveLength(2);
    });

    it('respects reserve tokens', () => {
      const counter = new TokenCounter();
      const items = [
        { text: 'Some text here' }
      ];
      
      const result = counter.filterByBudget(items, 20, {
        reserveTokens: 10
      });
      
      expect(result.totalTokens).toBeGreaterThanOrEqual(10); // Reserve is included
    });

    it('stops when budget would be exceeded', () => {
      const counter = new TokenCounter();
      const items = [
        { text: 'First item with some text' },
        { text: 'Second item with more text to push over budget' },
        { text: 'Third item that should not be included' }
      ];
      
      const result = counter.filterByBudget(items, 15);
      
      expect(result.itemsIncluded).toBeLessThan(items.length);
      expect(result.totalTokens).toBeLessThanOrEqual(15);
    });
  });

  describe('Format Overhead Calculation', () => {
    it('calculates overhead with header', () => {
      const counter = new TokenCounter();
      const overhead = counter.calculateFormatOverhead({
        includeHeader: true
      });
      
      expect(overhead).toBeGreaterThan(0);
    });

    it('calculates overhead with metadata', () => {
      const counter = new TokenCounter();
      const overhead = counter.calculateFormatOverhead({
        includeMetadata: true
      });
      
      expect(overhead).toBeGreaterThan(0);
    });

    it('calculates overhead with citations', () => {
      const counter = new TokenCounter();
      const overhead = counter.calculateFormatOverhead({
        includeCitations: true,
        numSections: 3
      });
      
      expect(overhead).toBeGreaterThan(0);
    });

    it('calculates overhead with all options', () => {
      const counter = new TokenCounter();
      const overhead = counter.calculateFormatOverhead({
        includeHeader: true,
        includeMetadata: true,
        includeCitations: true,
        numSections: 3
      });
      
      expect(overhead).toBeGreaterThan(100); // Should be substantial
    });
  });

  describe('Context Block Estimation', () => {
    it('estimates context block with directives', () => {
      const counter = new TokenCounter();
      const directives = [
        'All API endpoints must require authentication',
        'Use HTTPS for all connections',
        'Implement rate limiting'
      ];
      
      const estimate = counter.estimateContextBlock(directives, {
        includeHeader: true,
        includeMetadata: true,
        includeCitations: true
      });
      
      expect(estimate).toBeGreaterThan(0);
    });

    it('includes overhead in estimation', () => {
      const counter = new TokenCounter();
      const directives = ['Short'];
      
      const withOverhead = counter.estimateContextBlock(directives, {
        includeHeader: true,
        includeMetadata: true
      });
      
      const withoutOverhead = counter.estimateContextBlock(directives);
      
      expect(withOverhead).toBeGreaterThan(withoutOverhead);
    });
  });

  describe('Budget Allocation by Severity', () => {
    it('prioritizes MUST directives', () => {
      const counter = new TokenCounter();
      const items = [
        { text: 'MUST directive one', severity: 'MUST' as const },
        { text: 'SHOULD directive', severity: 'SHOULD' as const },
        { text: 'MUST directive two', severity: 'MUST' as const },
        { text: 'MAY directive', severity: 'MAY' as const }
      ];
      
      const result = counter.allocateBudgetBySeverity(items, 100);
      
      const mustItems = result.items.filter((i: any) => i.severity === 'MUST');
      expect(mustItems.length).toBeGreaterThan(0);
      
      // MUST items should come first
      const firstMustIndex = result.items.findIndex((i: any) => i.severity === 'MUST');
      const firstShouldIndex = result.items.findIndex((i: any) => i.severity === 'SHOULD');
      
      if (firstShouldIndex >= 0) {
        expect(firstMustIndex).toBeLessThan(firstShouldIndex);
      }
    });

    it('includes SHOULD after MUST', () => {
      const counter = new TokenCounter();
      const items = [
        { text: 'MUST one', severity: 'MUST' as const },
        { text: 'SHOULD one', severity: 'SHOULD' as const },
        { text: 'SHOULD two', severity: 'SHOULD' as const }
      ];
      
      const result = counter.allocateBudgetBySeverity(items, 100);
      
      const shouldItems = result.items.filter((i: any) => i.severity === 'SHOULD');
      expect(shouldItems.length).toBeGreaterThan(0);
    });

    it('includes MAY only if space remains', () => {
      const counter = new TokenCounter();
      const items = [
        { text: 'MUST directive', severity: 'MUST' as const },
        { text: 'MAY directive', severity: 'MAY' as const }
      ];
      
      const result = counter.allocateBudgetBySeverity(items, 100);
      
      // With generous budget, both should be included
      expect(result.itemsIncluded).toBe(2);
    });

    it('respects minimum MUST items requirement', () => {
      const counter = new TokenCounter();
      const items = [
        { text: 'MUST directive', severity: 'MUST' as const }
      ];
      
      const result = counter.allocateBudgetBySeverity(items, 10, {
        minMustItems: 1
      });
      
      expect(result.itemsIncluded).toBeGreaterThanOrEqual(1);
    });

    it('stops when budget is exceeded', () => {
      const counter = new TokenCounter();
      const items = [
        { text: 'MUST with some text here', severity: 'MUST' as const },
        { text: 'SHOULD with text', severity: 'SHOULD' as const },
        { text: 'Another SHOULD with more text to exceed budget', severity: 'SHOULD' as const },
        { text: 'MAY that should not fit', severity: 'MAY' as const }
      ];
      
      const result = counter.allocateBudgetBySeverity(items, 20);
      
      expect(result.totalTokens).toBeLessThanOrEqual(20);
      expect(result.itemsIncluded).toBeLessThan(items.length);
    });
  });

  describe('Token Statistics', () => {
    it('calculates statistics for multiple texts', () => {
      const counter = new TokenCounter();
      const texts = [
        'Short',
        'A bit longer text',
        'This is the longest text in the list'
      ];
      
      const stats = counter.getTokenStats(texts);
      
      expect(stats.total).toBeGreaterThan(0);
      expect(stats.average).toBeGreaterThan(0);
      expect(stats.min).toBeGreaterThan(0);
      expect(stats.max).toBeGreaterThan(stats.min);
      expect(stats.median).toBeGreaterThan(0);
    });

    it('handles empty array', () => {
      const counter = new TokenCounter();
      const stats = counter.getTokenStats([]);
      
      expect(stats.total).toBe(0);
      expect(stats.average).toBe(0);
      expect(stats.min).toBe(0);
      expect(stats.max).toBe(0);
      expect(stats.median).toBe(0);
    });

    it('calculates correct statistics', () => {
      const counter = new TokenCounter();
      const texts = ['a', 'bb', 'ccc', 'dddd', 'eeeee'];
      
      const stats = counter.getTokenStats(texts);
      
      expect(stats.min).toBeLessThanOrEqual(stats.max);
      expect(stats.average).toBeGreaterThanOrEqual(stats.min);
      expect(stats.average).toBeLessThanOrEqual(stats.max);
    });
  });

  describe('Edge Cases', () => {
    it('handles very long text', () => {
      const counter = new TokenCounter();
      const text = 'word '.repeat(1000); // Very long text
      const tokens = counter.estimateTokens(text);
      
      expect(tokens).toBeGreaterThan(100);
    });

    it('handles text with newlines', () => {
      const counter = new TokenCounter();
      const text = 'Line 1\nLine 2\nLine 3';
      const tokens = counter.estimateTokens(text);
      
      expect(tokens).toBeGreaterThan(0);
    });

    it('handles text with tabs and special whitespace', () => {
      const counter = new TokenCounter();
      const text = 'Tab\tseparated\ttext';
      const tokens = counter.estimateTokens(text);
      
      expect(tokens).toBeGreaterThan(0);
    });

    it('handles unicode characters', () => {
      const counter = new TokenCounter();
      const text = 'Hello 世界 🌍';
      const tokens = counter.estimateTokens(text);
      
      expect(tokens).toBeGreaterThan(0);
    });
  });
});
