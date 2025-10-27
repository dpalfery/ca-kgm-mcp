// src/parsing/rule-analyzer.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RuleAnalyzer } from './rule-analyzer';
import { LocalModelManager } from '../rules/local-model-manager';
import { LLMJsonResponse } from '../rules/llm-provider';

// Mock LocalModelManager
vi.mock('../rules/local-model-manager', () => ({
  LocalModelManager: vi.fn().mockImplementation(() => ({
    generateJson: vi.fn()
  }))
}));

describe('RuleAnalyzer', () => {
  let ruleAnalyzer: RuleAnalyzer;
  let mockLocalModelManager: LocalModelManager;
  let mockGenerateJson: vi.MockedFunction<(prompt: string, schema: any, options?: any) => Promise<LLMJsonResponse<any>>>;

  beforeEach(() => {
    // Create a fresh mock for each test
    mockGenerateJson = vi.fn();
    mockLocalModelManager = new LocalModelManager({} as any);
    (mockLocalModelManager as any).generateJson = mockGenerateJson;
    
    ruleAnalyzer = new RuleAnalyzer(mockLocalModelManager);
  });

  describe('analyzeAndSplit', () => {
    it('should return original content for short content', async () => {
      const shortContent = 'This is too short to analyze.';
      
      const result = await ruleAnalyzer.analyzeAndSplit(shortContent);
      
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe(shortContent);
      expect(result[0].metadata?.analyzed).toBe(false);
      expect(result[0].metadata?.reason).toContain('too short');
    });

    it('should return original content when split markers are present', async () => {
      const contentWithMarker = 'Some content\n<!-- split: false -->\nMore content';
      
      const result = await ruleAnalyzer.analyzeAndSplit(contentWithMarker);
      
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe(contentWithMarker);
      expect(result[0].metadata?.analyzed).toBe(false);
    });

    it('should not split when LLM analysis returns shouldSplit: false', async () => {
      const content = `
# Security Guidelines

This document contains important security guidelines for API development.

[MUST] Always validate input parameters
[SHOULD] Use HTTPS for all API communications
      `.trim();

      const mockResponse: LLMJsonResponse<any> = {
        success: true,
        data: {
          shouldSplit: false,
          concerns: [],
          confidence: 0.9,
          reasoning: 'Content is focused on a single cohesive topic'
        }
      };

      mockGenerateJson.mockResolvedValue(mockResponse);

      const result = await ruleAnalyzer.analyzeAndSplit(content);
      
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe(content);
      expect(result[0].metadata?.analyzed).toBe(true);
      expect(result[0].metadata?.splitDecision).toBe(false);
      expect(result[0].metadata?.confidence).toBe(0.9);
      expect(result[0].splitReason).toContain('no splitting needed');
    });

    it('should split content when LLM analysis returns shouldSplit: true with concerns', async () => {
      const content = `
# API Development Guidelines

## Security

All API endpoints must implement proper authentication and authorization. Input validation is required for all parameters.

## Performance

API responses should be optimized for speed. Implement caching where appropriate.

## Documentation

All endpoints must have comprehensive documentation.
      `.trim();

      const mockResponse: LLMJsonResponse<any> = {
        success: true,
        data: {
          shouldSplit: true,
          concerns: [
            {
              name: 'Security Guidelines',
              description: 'Security-related rules and requirements',
              suggestedSplitPoint: 100
            },
            {
              name: 'Performance Guidelines',
              description: 'Performance optimization rules',
              suggestedSplitPoint: 200
            }
          ],
          confidence: 0.85,
          reasoning: 'Content contains multiple distinct concerns that should be separated'
        }
      };

      mockGenerateJson.mockResolvedValue(mockResponse);

      const result = await ruleAnalyzer.analyzeAndSplit(content);
      
      expect(result).toHaveLength(3); // 2 splits + remaining content
      
      // Check first split
      expect(result[0].content).toContain('Security');
      expect(result[0].metadata?.concern).toBe('Security Guidelines');
      expect(result[0].splitReason).toContain('Security Guidelines');
      
      // Check second split
      expect(result[1].content).toContain('Performance');
      expect(result[1].metadata?.concern).toBe('Performance Guidelines');
      expect(result[1].splitReason).toContain('Performance Guidelines');
      
      // Check remaining content
      expect(result[2].content).toContain('Documentation');
      expect(result[2].metadata?.concern).toBe('Remaining content');
    });

    it('should handle LLM analysis failure gracefully', async () => {
      const content = `
# Some Content

This content should be analyzed but the LLM will fail.
      `.trim();

      const mockResponse: LLMJsonResponse<any> = {
        success: false,
        data: {} as any,
        error: 'LLM service unavailable'
      };

      mockGenerateJson.mockResolvedValue(mockResponse);

      const result = await ruleAnalyzer.analyzeAndSplit(content);
      
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe(content);
      expect(result[0].metadata?.analyzed).toBe(true);
      expect(result[0].metadata?.error).toContain('LLM service unavailable');
      expect(result[0].splitReason).toContain('Analysis failed');
    });

    it('should handle network errors gracefully', async () => {
      const content = `
# Some Content

This content should be analyzed but the network will fail.
      `.trim();

      mockGenerateJson.mockRejectedValue(new Error('Network error'));

      const result = await ruleAnalyzer.analyzeAndSplit(content);
      
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe(content);
      expect(result[0].metadata?.analyzed).toBe(true);
      expect(result[0].metadata?.error).toContain('Network error');
      expect(result[0].splitReason).toContain('Analysis failed');
    });

    it('should handle empty concerns array', async () => {
      const content = `
# Single Topic Content

This content is focused on a single topic.
      `.trim();

      const mockResponse: LLMJsonResponse<any> = {
        success: true,
        data: {
          shouldSplit: true,
          concerns: [], // Empty concerns array
          confidence: 0.5,
          reasoning: 'Uncertain about splitting'
        }
      };

      mockGenerateJson.mockResolvedValue(mockResponse);

      const result = await ruleAnalyzer.analyzeAndSplit(content);
      
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe(content);
      expect(result[0].metadata?.splitDecision).toBe(false);
      expect(result[0].splitReason).toContain('no splitting needed');
    });

    it('should handle concerns without split points', async () => {
      const content = `
# Mixed Content

This content has multiple concerns but no split points provided.
      `.trim();

      const mockResponse: LLMJsonResponse<any> = {
        success: true,
        data: {
          shouldSplit: true,
          concerns: [
            {
              name: 'First Concern',
              description: 'First concern without split point'
              // No suggestedSplitPoint
            },
            {
              name: 'Second Concern',
              description: 'Second concern without split point'
              // No suggestedSplitPoint
            }
          ],
          confidence: 0.8,
          reasoning: 'Multiple concerns identified'
        }
      };

      mockGenerateJson.mockResolvedValue(mockResponse);

      const result = await ruleAnalyzer.analyzeAndSplit(content);
      
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe(content);
      expect(result[0].metadata?.split).toBe(false);
      expect(result[0].metadata?.reason).toContain('No split points provided');
    });
  });
});