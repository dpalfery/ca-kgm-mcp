import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AnthropicProvider } from '../anthropic-provider.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('AnthropicProvider', () => {
  let provider: AnthropicProvider;
  const mockConfig = {
    apiKey: 'test-api-key',
    model: 'claude-3-haiku-20240307',
    baseUrl: 'https://api.anthropic.com/v1',
    timeout: 5000
  };

  beforeEach(() => {
    provider = new AnthropicProvider(mockConfig);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with provided configuration', () => {
      expect(provider.name).toBe('anthropic');
      expect(provider.type).toBe('cloud');
    });

    it('should use default values for optional parameters', () => {
      const minimalProvider = new AnthropicProvider({ apiKey: 'test-key' });
      expect(minimalProvider.name).toBe('anthropic');
      expect(minimalProvider.type).toBe('cloud');
    });

    it('should throw error if API key is missing', () => {
      expect(() => {
        new AnthropicProvider({ apiKey: '' });
      }).toThrow('Anthropic API key is required');
    });
  });

  describe('isAvailable', () => {
    it('should return true when API is accessible', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: [{ text: 'test' }] })
      });

      const isAvailable = await provider.isAvailable();
      expect(isAvailable).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'x-api-key': 'test-api-key',
            'anthropic-version': '2023-06-01'
          })
        })
      );
    });

    it('should return true when API returns rate limit (429)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests'
      });

      const isAvailable = await provider.isAvailable();
      expect(isAvailable).toBe(true); // Rate limit means API is available
    });

    it('should return false when API is not accessible', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      });

      const isAvailable = await provider.isAvailable();
      expect(isAvailable).toBe(false);
    });

    it('should return false when network error occurs', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const isAvailable = await provider.isAvailable();
      expect(isAvailable).toBe(false);
    });
  });

  describe('detectContext', () => {
    const mockValidResponse = {
      content: [{
        text: JSON.stringify({
          layer: '2-Application',
          topics: ['api', 'security'],
          keywords: ['endpoint', 'authentication'],
          technologies: ['Node.js', 'Express'],
          confidence: 0.8
        })
      }]
    };

    it('should successfully detect context with valid response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockValidResponse
      });

      const context = await provider.detectContext('Create REST API endpoint with authentication');

      expect(context.layer).toBe('2-Application');
      expect(context.topics).toEqual(['api', 'security']);
      expect(context.keywords).toEqual(['endpoint', 'authentication']);
      expect(context.technologies).toEqual(['Node.js', 'Express']);
      expect(context.confidence).toBe(0.8);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'x-api-key': 'test-api-key',
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01'
          }),
          body: expect.stringContaining('claude-3-haiku-20240307')
        })
      );
    });

    it('should handle JSON response with extra text', async () => {
      const responseWithExtraText = {
        content: [{
          text: `Here's the analysis:
          
          ${JSON.stringify({
            layer: '1-Presentation',
            topics: ['ui'],
            keywords: ['component'],
            technologies: ['React'],
            confidence: 0.9
          })}
          
          This analysis is based on the UI-related keywords.`
        }]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => responseWithExtraText
      });

      const context = await provider.detectContext('Create React component');

      expect(context.layer).toBe('1-Presentation');
      expect(context.topics).toEqual(['ui']);
      expect(context.confidence).toBe(0.9);
    });

    it('should handle API error responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request'
      });

      await expect(provider.detectContext('test task')).rejects.toThrow(
        'Anthropic context detection failed: Anthropic API error: 400 Bad Request'
      );
    });

    it('should handle empty response content', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: [{ text: null }] })
      });

      await expect(provider.detectContext('test task')).rejects.toThrow(
        'Anthropic context detection failed: No response content from Anthropic'
      );
    });

    it('should handle invalid JSON response with fallback parsing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{
            text: 'This is not valid JSON but contains database and sql keywords'
          }]
        })
      });

      const context = await provider.detectContext('test task');

      expect(context.layer).toBe('4-Persistence'); // Fallback should detect database keywords
      expect(context.confidence).toBe(0.3); // Low confidence for fallback
      expect(context.topics).toContain('database');
    });

    it('should validate and normalize response data', async () => {
      const invalidResponse = {
        content: [{
          text: JSON.stringify({
            layer: 'invalid-layer',
            topics: 'not-an-array',
            keywords: ['valid', 123, 'keywords'], // Mixed types
            technologies: null,
            confidence: -0.5 // Out of range
          })
        }]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => invalidResponse
      });

      const context = await provider.detectContext('test task');

      expect(context.layer).toBe('*'); // Invalid layer should default to wildcard
      expect(context.topics).toEqual([]); // Invalid topics should default to empty array
      expect(context.keywords).toEqual(['valid', 'keywords']); // Should filter out non-strings
      expect(context.technologies).toEqual([]); // Null should default to empty array
      expect(context.confidence).toBe(0.0); // Should clamp to valid range
    });

    it('should handle network timeout', async () => {
      mockFetch.mockImplementationOnce(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );

      await expect(provider.detectContext('test task')).rejects.toThrow(
        'Anthropic context detection failed'
      );
    });

    it('should include proper message structure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockValidResponse
      });

      await provider.detectContext('Create a React component');

      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      expect(requestBody.messages).toHaveLength(1);
      expect(requestBody.messages[0].role).toBe('user');
      expect(requestBody.messages[0].content).toContain('Create a React component');
      expect(requestBody.model).toBe('claude-3-haiku-20240307');
      expect(requestBody.max_tokens).toBe(150);
    });

    it('should handle fallback parsing for various layer types', async () => {
      const testCases = [
        { text: 'frontend ui component', expectedLayer: '1-Presentation' },
        { text: 'api service endpoint', expectedLayer: '2-Application' },
        { text: 'business entity model', expectedLayer: '3-Domain' },
        { text: 'database storage repository', expectedLayer: '4-Persistence' },
        { text: 'docker infrastructure deployment', expectedLayer: '5-Infrastructure' }
      ];

      for (const testCase of testCases) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            content: [{ text: `Invalid JSON: ${testCase.text}` }]
          })
        });

        const context = await provider.detectContext('test');
        expect(context.layer).toBe(testCase.expectedLayer);
      }
    });
  });

  describe('getHealthInfo', () => {
    it('should return healthy status when provider is available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: [{ text: 'test' }] })
      });

      const healthInfo = await provider.getHealthInfo();

      expect(healthInfo.status).toBe('healthy');
      expect(healthInfo.latency).toBeGreaterThanOrEqual(0);
      expect(healthInfo.lastChecked).toBeInstanceOf(Date);
      expect(healthInfo.details).toMatchObject({
        model: 'claude-3-haiku-20240307',
        baseUrl: 'https://api.anthropic.com/v1',
        timeout: 5000
      });
    });

    it('should return unavailable status when provider is not available', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const healthInfo = await provider.getHealthInfo();

      expect(healthInfo.status).toBe('unavailable');
      expect(healthInfo.latency).toBeGreaterThanOrEqual(0);
      expect(healthInfo.details).toHaveProperty('error');
    });
  });

  describe('request timeout handling', () => {
    it('should abort request on timeout', async () => {
      const shortTimeoutProvider = new AnthropicProvider({
        ...mockConfig,
        timeout: 100
      });

      mockFetch.mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(resolve, 200))
      );

      await expect(shortTimeoutProvider.detectContext('test')).rejects.toThrow();
    });
  });

  describe('custom configuration', () => {
    it('should use custom base URL', async () => {
      const customProvider = new AnthropicProvider({
        apiKey: 'test-key',
        baseUrl: 'https://custom-api.example.com/v1'
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: [{ text: 'test' }] })
      });

      await customProvider.isAvailable();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://custom-api.example.com/v1/messages',
        expect.any(Object)
      );
    });

    it('should use custom model and parameters', async () => {
      const customProvider = new AnthropicProvider({
        apiKey: 'test-key',
        model: 'claude-3-opus-20240229',
        maxTokens: 200
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{
            text: JSON.stringify({
              layer: '*',
              topics: [],
              keywords: [],
              technologies: [],
              confidence: 0.5
            })
          }]
        })
      });

      await customProvider.detectContext('test');

      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      expect(requestBody.model).toBe('claude-3-opus-20240229');
      expect(requestBody.max_tokens).toBe(200);
    });
  });

  describe('prompt structure', () => {
    it('should include comprehensive prompt with examples', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{
            text: JSON.stringify({
              layer: '*',
              topics: [],
              keywords: [],
              technologies: [],
              confidence: 0.5
            })
          }]
        })
      });

      await provider.detectContext('Create a React component');

      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);
      const prompt = requestBody.messages[0].content;

      expect(prompt).toContain('1-Presentation');
      expect(prompt).toContain('2-Application');
      expect(prompt).toContain('3-Domain');
      expect(prompt).toContain('4-Persistence');
      expect(prompt).toContain('5-Infrastructure');
      expect(prompt).toContain('confidence');
      expect(prompt).toContain('Create a React component');
    });
  });
});