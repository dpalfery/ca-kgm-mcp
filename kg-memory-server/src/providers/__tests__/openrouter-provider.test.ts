import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { OpenRouterProvider } from '../openrouter-provider.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('OpenRouterProvider', () => {
  let provider: OpenRouterProvider;
  const mockConfig = {
    apiKey: 'test-api-key',
    model: 'microsoft/wizardlm-2-8x22b',
    baseUrl: 'https://openrouter.ai/api/v1',
    timeout: 8000,
    siteName: 'Test App',
    siteUrl: 'https://test.example.com'
  };

  beforeEach(() => {
    provider = new OpenRouterProvider(mockConfig);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with provided configuration', () => {
      expect(provider.name).toBe('openrouter');
      expect(provider.type).toBe('cloud');
    });

    it('should use default values for optional parameters', () => {
      const minimalProvider = new OpenRouterProvider({ apiKey: 'test-key' });
      expect(minimalProvider.name).toBe('openrouter');
      expect(minimalProvider.type).toBe('cloud');
    });

    it('should throw error if API key is missing', () => {
      expect(() => {
        new OpenRouterProvider({ apiKey: '' });
      }).toThrow('OpenRouter API key is required');
    });
  });

  describe('isAvailable', () => {
    it('should return true when API is accessible', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] })
      });

      const isAvailable = await provider.isAvailable();
      expect(isAvailable).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/models',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key',
            'HTTP-Referer': 'https://test.example.com',
            'X-Title': 'Test App'
          })
        })
      );
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
      choices: [{
        message: {
          content: JSON.stringify({
            layer: '2-Application',
            topics: ['api', 'security'],
            keywords: ['endpoint', 'authentication'],
            technologies: ['Node.js', 'Express'],
            confidence: 0.8
          })
        }
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
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key',
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://test.example.com',
            'X-Title': 'Test App'
          }),
          body: expect.stringContaining('microsoft/wizardlm-2-8x22b')
        })
      );
    });

    it('should handle response with extra text around JSON', async () => {
      const responseWithExtraText = {
        choices: [{
          message: {
            content: `Here's my analysis:
            
            ${JSON.stringify({
              layer: '1-Presentation',
              topics: ['ui'],
              keywords: ['component'],
              technologies: ['React'],
              confidence: 0.9
            })}
            
            This analysis is based on the UI-related keywords in the task.`
          }
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
        statusText: 'Bad Request',
        text: async () => 'Invalid model specified'
      });

      await expect(provider.detectContext('test task')).rejects.toThrow(
        'OpenRouter context detection failed: OpenRouter API error: 400 Bad Request - Invalid model specified'
      );
    });

    it('should handle empty response content', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: null } }] })
      });

      await expect(provider.detectContext('test task')).rejects.toThrow(
        'OpenRouter context detection failed: No response content from OpenRouter'
      );
    });

    it('should handle invalid JSON response with fallback parsing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: 'This is not valid JSON but contains deploy and infrastructure keywords'
            }
          }]
        })
      });

      const context = await provider.detectContext('test task');

      expect(context.layer).toBe('5-Infrastructure'); // Fallback should detect infrastructure keywords
      expect(context.confidence).toBe(0.3); // Low confidence for fallback
    });

    it('should validate and normalize response data', async () => {
      const invalidResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              layer: 'invalid-layer',
              topics: 'not-an-array',
              keywords: ['valid', 123, 'keywords'], // Mixed types
              technologies: null,
              confidence: 1.5 // Out of range
            })
          }
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
      expect(context.confidence).toBe(1.0); // Should clamp to valid range
    });

    it('should include proper request structure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockValidResponse
      });

      await provider.detectContext('Create a React component');

      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      expect(requestBody.messages).toHaveLength(2);
      expect(requestBody.messages[0].role).toBe('system');
      expect(requestBody.messages[1].role).toBe('user');
      expect(requestBody.messages[1].content).toContain('Create a React component');
      expect(requestBody.model).toBe('microsoft/wizardlm-2-8x22b');
      expect(requestBody.max_tokens).toBe(150);
      expect(requestBody.temperature).toBe(0.1);
      expect(requestBody.response_format).toEqual({ type: 'json_object' });
    });

    it('should handle fallback parsing for various layer types', async () => {
      const testCases = [
        { text: 'frontend ui component', expectedLayer: '1-Presentation' },
        { text: 'api service endpoint', expectedLayer: '2-Application' },
        { text: 'business domain model', expectedLayer: '3-Domain' },
        { text: 'database repository persistence', expectedLayer: '4-Persistence' },
        { text: 'deploy infrastructure devops', expectedLayer: '5-Infrastructure' }
      ];

      for (const testCase of testCases) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{
              message: {
                content: `Invalid JSON: ${testCase.text}`
              }
            }]
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
        json: async () => ({ data: [] })
      });

      const healthInfo = await provider.getHealthInfo();

      expect(healthInfo.status).toBe('healthy');
      expect(healthInfo.latency).toBeGreaterThanOrEqual(0);
      expect(healthInfo.lastChecked).toBeInstanceOf(Date);
      expect(healthInfo.details).toMatchObject({
        model: 'microsoft/wizardlm-2-8x22b',
        baseUrl: 'https://openrouter.ai/api/v1',
        timeout: 8000
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
      const shortTimeoutProvider = new OpenRouterProvider({
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
      const customProvider = new OpenRouterProvider({
        apiKey: 'test-key',
        baseUrl: 'https://custom-openrouter.example.com/v1'
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] })
      });

      await customProvider.isAvailable();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://custom-openrouter.example.com/v1/models',
        expect.any(Object)
      );
    });

    it('should use custom model and parameters', async () => {
      const customProvider = new OpenRouterProvider({
        apiKey: 'test-key',
        model: 'anthropic/claude-3-opus',
        maxTokens: 200,
        temperature: 0.5
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                layer: '*',
                topics: [],
                keywords: [],
                technologies: [],
                confidence: 0.5
              })
            }
          }]
        })
      });

      await customProvider.detectContext('test');

      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      expect(requestBody.model).toBe('anthropic/claude-3-opus');
      expect(requestBody.max_tokens).toBe(200);
      expect(requestBody.temperature).toBe(0.5);
    });

    it('should use custom site information in headers', async () => {
      const customProvider = new OpenRouterProvider({
        apiKey: 'test-key',
        siteName: 'Custom App',
        siteUrl: 'https://custom.example.com'
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] })
      });

      await customProvider.isAvailable();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'HTTP-Referer': 'https://custom.example.com',
            'X-Title': 'Custom App'
          })
        })
      );
    });

    it('should use default site information when not provided', async () => {
      const defaultProvider = new OpenRouterProvider({
        apiKey: 'test-key'
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] })
      });

      await defaultProvider.isAvailable();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'HTTP-Referer': 'https://github.com/kg-memory-system',
            'X-Title': 'KG Memory System'
          })
        })
      );
    });
  });

  describe('prompt structure', () => {
    it('should include comprehensive prompt with examples', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                layer: '*',
                topics: [],
                keywords: [],
                technologies: [],
                confidence: 0.5
              })
            }
          }]
        })
      });

      await provider.detectContext('Create a React component');

      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);
      const prompt = requestBody.messages[1].content;

      expect(prompt).toContain('1-Presentation');
      expect(prompt).toContain('2-Application');
      expect(prompt).toContain('3-Domain');
      expect(prompt).toContain('4-Persistence');
      expect(prompt).toContain('5-Infrastructure');
      expect(prompt).toContain('confidence');
      expect(prompt).toContain('Create a React component');
      expect(prompt).toContain('Return only the JSON object');
    });
  });

  describe('error handling edge cases', () => {
    it('should handle malformed JSON in API response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: '{ "layer": "1-Presentation", "topics": [incomplete json'
            }
          }]
        })
      });

      const context = await provider.detectContext('test task');

      // Should fall back to heuristic parsing
      expect(context.layer).toBe('*');
      expect(context.confidence).toBe(0.3);
    });

    it('should handle network timeout gracefully', async () => {
      mockFetch.mockImplementationOnce(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), 50);
        });
      });

      await expect(provider.detectContext('test task')).rejects.toThrow(
        'OpenRouter context detection failed'
      );
    });

    it('should handle missing choices in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [] })
      });

      await expect(provider.detectContext('test task')).rejects.toThrow(
        'No response content from OpenRouter'
      );
    });
  });
});