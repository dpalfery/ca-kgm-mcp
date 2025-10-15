import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { OpenAICompatibleProvider } from '../openai-compatible-provider.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('OpenAICompatibleProvider', () => {
  let provider: OpenAICompatibleProvider;
  const mockConfig = {
    apiKey: 'test-api-key',
    model: 'custom-model',
    baseUrl: 'https://api.custom.com/v1',
    timeout: 5000,
    providerName: 'custom-provider',
    requiresAuth: true
  };

  beforeEach(() => {
    provider = new OpenAICompatibleProvider(mockConfig);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with provided configuration', () => {
      expect(provider.name).toBe('custom-provider');
      expect(provider.type).toBe('cloud');
    });

    it('should use default provider name when not specified', () => {
      const defaultProvider = new OpenAICompatibleProvider({
        model: 'test-model',
        baseUrl: 'https://api.test.com',
        requiresAuth: false
      });
      expect(defaultProvider.name).toBe('openai-compatible');
    });

    it('should remove trailing slash from baseUrl', () => {
      const providerWithSlash = new OpenAICompatibleProvider({
        model: 'test-model',
        baseUrl: 'https://api.test.com/v1/',
        requiresAuth: false
      });
      expect(providerWithSlash.name).toBe('openai-compatible');
    });

    it('should throw error if API key is required but missing', () => {
      expect(() => {
        new OpenAICompatibleProvider({
          model: 'test-model',
          baseUrl: 'https://api.test.com',
          requiresAuth: true
        });
      }).toThrow('API key is required for openai-compatible');
    });

    it('should not require API key when requiresAuth is false', () => {
      expect(() => {
        new OpenAICompatibleProvider({
          model: 'test-model',
          baseUrl: 'https://api.test.com',
          requiresAuth: false
        });
      }).not.toThrow();
    });

    it('should accept custom headers', () => {
      const providerWithHeaders = new OpenAICompatibleProvider({
        model: 'test-model',
        baseUrl: 'https://api.test.com',
        requiresAuth: false,
        headers: {
          'X-Custom-Header': 'custom-value'
        }
      });
      expect(providerWithHeaders.name).toBe('openai-compatible');
    });
  });

  describe('isAvailable', () => {
    it('should return true when models endpoint is accessible', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] })
      });

      const isAvailable = await provider.isAvailable();
      expect(isAvailable).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.custom.com/v1/models',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key'
          })
        })
      );
    });

    it('should return true when models endpoint returns 404 but chat completions work', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found'
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ choices: [] })
        });

      const isAvailable = await provider.isAvailable();
      expect(isAvailable).toBe(true);
    });

    it('should return true when chat completions returns rate limit', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Models endpoint error'))
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests'
        });

      const isAvailable = await provider.isAvailable();
      expect(isAvailable).toBe(true);
    });

    it('should return false when both endpoints fail', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Models endpoint error'))
        .mockRejectedValueOnce(new Error('Chat completions error'));

      const isAvailable = await provider.isAvailable();
      expect(isAvailable).toBe(false);
    });

    it('should not include auth header when requiresAuth is false', async () => {
      const noAuthProvider = new OpenAICompatibleProvider({
        model: 'test-model',
        baseUrl: 'https://api.test.com',
        requiresAuth: false
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] })
      });

      await noAuthProvider.isAvailable();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.not.objectContaining({
            'Authorization': expect.any(String)
          })
        })
      );
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
        'https://api.custom.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key',
            'Content-Type': 'application/json'
          }),
          body: expect.stringContaining('custom-model')
        })
      );
    });

    it('should handle response with extra text around JSON', async () => {
      const responseWithExtraText = {
        choices: [{
          message: {
            content: `Analysis complete:
            
            ${JSON.stringify({
              layer: '1-Presentation',
              topics: ['ui'],
              keywords: ['component'],
              technologies: ['React'],
              confidence: 0.9
            })}
            
            End of analysis.`
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
        text: async () => 'Invalid request format'
      });

      await expect(provider.detectContext('test task')).rejects.toThrow(
        'custom-provider context detection failed: custom-provider API error: 400 Bad Request - Invalid request format'
      );
    });

    it('should handle empty response content', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: null } }] })
      });

      await expect(provider.detectContext('test task')).rejects.toThrow(
        'custom-provider context detection failed: No response content from custom-provider'
      );
    });

    it('should handle invalid JSON response with fallback parsing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: 'This is not valid JSON but contains business and domain keywords'
            }
          }]
        })
      });

      const context = await provider.detectContext('test task');

      expect(context.layer).toBe('3-Domain'); // Fallback should detect domain keywords
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
              confidence: -1.0 // Out of range
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
      expect(context.confidence).toBe(0.0); // Should clamp to valid range
    });

    it('should include custom headers in requests', async () => {
      const providerWithHeaders = new OpenAICompatibleProvider({
        model: 'test-model',
        baseUrl: 'https://api.test.com',
        requiresAuth: false,
        headers: {
          'X-Custom-Header': 'custom-value',
          'X-Another-Header': 'another-value'
        }
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockValidResponse
      });

      await providerWithHeaders.detectContext('test');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Custom-Header': 'custom-value',
            'X-Another-Header': 'another-value'
          })
        })
      );
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
      expect(requestBody.model).toBe('custom-model');
      expect(requestBody.max_tokens).toBe(150);
      expect(requestBody.temperature).toBe(0.1);
    });
  });

  describe('generateEmbedding', () => {
    it('should successfully generate embeddings', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: mockEmbedding }]
        })
      });

      const embedding = await provider.generateEmbedding!('test text');

      expect(embedding).toEqual(mockEmbedding);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.custom.com/v1/embeddings',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('text-embedding-ada-002')
        })
      );
    });

    it('should use embedding model if model name contains "embedding"', async () => {
      const embeddingProvider = new OpenAICompatibleProvider({
        model: 'custom-embedding-model',
        baseUrl: 'https://api.test.com',
        requiresAuth: false
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ embedding: [0.1, 0.2] }] })
      });

      await embeddingProvider.generateEmbedding!('test text');

      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);
      expect(requestBody.model).toBe('custom-embedding-model');
    });

    it('should handle embedding API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request'
      });

      await expect(provider.generateEmbedding!('test text')).rejects.toThrow(
        'custom-provider embedding generation failed'
      );
    });

    it('should return empty array for missing embedding data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{}] })
      });

      const embedding = await provider.generateEmbedding!('test text');
      expect(embedding).toEqual([]);
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
        model: 'custom-model',
        baseUrl: 'https://api.custom.com/v1',
        timeout: 5000,
        requiresAuth: true
      });
    });

    it('should return unavailable status when provider is not available', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'));

      const healthInfo = await provider.getHealthInfo();

      expect(healthInfo.status).toBe('unavailable');
      expect(healthInfo.latency).toBeGreaterThanOrEqual(0);
      expect(healthInfo.details).toHaveProperty('error');
    });
  });

  describe('request timeout handling', () => {
    it('should abort request on timeout', async () => {
      const shortTimeoutProvider = new OpenAICompatibleProvider({
        ...mockConfig,
        timeout: 100
      });

      mockFetch.mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(resolve, 200))
      );

      await expect(shortTimeoutProvider.detectContext('test')).rejects.toThrow();
    });
  });

  describe('authentication handling', () => {
    it('should not include auth header when requiresAuth is false', async () => {
      const noAuthProvider = new OpenAICompatibleProvider({
        model: 'test-model',
        baseUrl: 'https://api.test.com',
        requiresAuth: false
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

      await noAuthProvider.detectContext('test');

      const callArgs = mockFetch.mock.calls[0];
      const headers = callArgs[1].headers;
      expect(headers).not.toHaveProperty('Authorization');
    });

    it('should include auth header when API key is provided', async () => {
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

      await provider.detectContext('test');

      const callArgs = mockFetch.mock.calls[0];
      const headers = callArgs[1].headers;
      expect(headers).toHaveProperty('Authorization', 'Bearer test-api-key');
    });
  });

  describe('fallback parsing', () => {
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

    it('should extract basic topics in fallback mode', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: 'Invalid JSON but contains security auth api rest graphql database sql test performance optimization'
            }
          }]
        })
      });

      const context = await provider.detectContext('test');

      expect(context.topics).toContain('security');
      expect(context.topics).toContain('api');
      expect(context.topics).toContain('database');
      expect(context.topics).toContain('testing');
      expect(context.topics).toContain('performance');
    });
  });

  describe('error handling edge cases', () => {
    it('should handle malformed JSON gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: '{ "layer": "1-Presentation", "topics": [incomplete'
            }
          }]
        })
      });

      const context = await provider.detectContext('test task');

      expect(context.layer).toBe('*');
      expect(context.confidence).toBe(0.3);
    });

    it('should handle missing choices array', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [] })
      });

      await expect(provider.detectContext('test task')).rejects.toThrow(
        'No response content from custom-provider'
      );
    });

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network connection failed'));

      await expect(provider.detectContext('test task')).rejects.toThrow(
        'custom-provider context detection failed'
      );
    });
  });

  describe('prompt structure', () => {
    it('should include comprehensive prompt', async () => {
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
});