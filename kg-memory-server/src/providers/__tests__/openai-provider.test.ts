import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { OpenAIProvider } from '../openai-provider.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;
  const mockConfig = {
    apiKey: 'test-api-key',
    model: 'gpt-3.5-turbo',
    baseUrl: 'https://api.openai.com/v1',
    timeout: 5000
  };

  beforeEach(() => {
    provider = new OpenAIProvider(mockConfig);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with provided configuration', () => {
      expect(provider.name).toBe('openai');
      expect(provider.type).toBe('cloud');
    });

    it('should use default values for optional parameters', () => {
      const minimalProvider = new OpenAIProvider({ apiKey: 'test-key' });
      expect(minimalProvider.name).toBe('openai');
      expect(minimalProvider.type).toBe('cloud');
    });

    it('should throw error if API key is missing', () => {
      expect(() => {
        new OpenAIProvider({ apiKey: '' });
      }).toThrow('OpenAI API key is required');
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
        'https://api.openai.com/v1/models',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key'
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
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key',
            'Content-Type': 'application/json'
          }),
          body: expect.stringContaining('gpt-3.5-turbo')
        })
      );
    });

    it('should handle API error responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests'
      });

      await expect(provider.detectContext('test task')).rejects.toThrow(
        'OpenAI context detection failed: OpenAI API error: 429 Too Many Requests'
      );
    });

    it('should handle empty response content', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: null } }] })
      });

      await expect(provider.detectContext('test task')).rejects.toThrow(
        'OpenAI context detection failed: No response content from OpenAI'
      );
    });

    it('should handle invalid JSON response with fallback parsing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: 'This is not valid JSON but contains ui and react keywords'
            }
          }]
        })
      });

      const context = await provider.detectContext('test task');

      expect(context.layer).toBe('1-Presentation'); // Fallback should detect UI keywords
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

    it('should handle network timeout', async () => {
      mockFetch.mockImplementationOnce(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );

      await expect(provider.detectContext('test task')).rejects.toThrow(
        'OpenAI context detection failed'
      );
    });

    it('should include proper prompt structure', async () => {
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
      expect(requestBody.response_format).toEqual({ type: 'json_object' });
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

      const embedding = await provider.generateEmbedding('test text');

      expect(embedding).toEqual(mockEmbedding);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/embeddings',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('text-embedding-ada-002')
        })
      );
    });

    it('should handle embedding API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request'
      });

      await expect(provider.generateEmbedding('test text')).rejects.toThrow(
        'OpenAI embedding generation failed'
      );
    });

    it('should return empty array for missing embedding data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{}] })
      });

      const embedding = await provider.generateEmbedding('test text');
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
        model: 'gpt-3.5-turbo',
        baseUrl: 'https://api.openai.com/v1',
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
      const shortTimeoutProvider = new OpenAIProvider({
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
      const customProvider = new OpenAIProvider({
        apiKey: 'test-key',
        baseUrl: 'https://custom-api.example.com/v1'
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] })
      });

      await customProvider.isAvailable();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://custom-api.example.com/v1/models',
        expect.any(Object)
      );
    });

    it('should use custom model and parameters', async () => {
      const customProvider = new OpenAIProvider({
        apiKey: 'test-key',
        model: 'gpt-4',
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

      expect(requestBody.model).toBe('gpt-4');
      expect(requestBody.max_tokens).toBe(200);
      expect(requestBody.temperature).toBe(0.5);
    });
  });
});