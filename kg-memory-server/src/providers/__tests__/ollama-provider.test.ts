import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { OllamaProvider } from '../ollama-provider.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('OllamaProvider', () => {
  let provider: OllamaProvider;
  const mockConfig = {
    baseUrl: 'http://localhost:11434',
    model: 'llama2:7b',
    timeout: 10000,
    maxTokens: 150,
    temperature: 0.1
  };

  beforeEach(() => {
    provider = new OllamaProvider(mockConfig);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with provided configuration', () => {
      expect(provider.name).toBe('ollama');
      expect(provider.type).toBe('local');
    });

    it('should use default values for optional parameters', () => {
      const minimalProvider = new OllamaProvider({ model: 'test-model' });
      expect(minimalProvider.name).toBe('ollama');
      expect(minimalProvider.type).toBe('local');
    });

    it('should throw error if model is missing', () => {
      expect(() => {
        new OllamaProvider({ model: '' });
      }).toThrow('Ollama model name is required');
    });

    it('should remove trailing slash from baseUrl', () => {
      const providerWithSlash = new OllamaProvider({
        model: 'test',
        baseUrl: 'http://localhost:11434/'
      });
      expect(providerWithSlash.name).toBe('ollama');
    });
  });

  describe('isAvailable', () => {
    it('should return true when Ollama is running and model exists', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [
            { name: 'llama2:7b', size: 3825819519 },
            { name: 'codellama:7b', size: 3825819519 }
          ]
        })
      });

      const isAvailable = await provider.isAvailable();
      expect(isAvailable).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/tags',
        expect.objectContaining({
          method: 'GET'
        })
      );
    });

    it('should return true when model name starts with configured model', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [
            { name: 'llama2:7b-chat-q4_0', size: 3825819519 }
          ]
        })
      });

      const isAvailable = await provider.isAvailable();
      expect(isAvailable).toBe(true);
    });

    it('should return false when Ollama is not running', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      const isAvailable = await provider.isAvailable();
      expect(isAvailable).toBe(false);
    });

    it('should return false when model is not available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [
            { name: 'different-model:7b', size: 3825819519 }
          ]
        })
      });

      const isAvailable = await provider.isAvailable();
      expect(isAvailable).toBe(false);
    });

    it('should return false when network error occurs', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const isAvailable = await provider.isAvailable();
      expect(isAvailable).toBe(false);
    });
  });

  describe('detectContext', () => {
    const mockValidResponse = {
      response: JSON.stringify({
        layer: '2-Application',
        topics: ['api', 'security'],
        keywords: ['endpoint', 'authentication'],
        technologies: ['Node.js', 'Express'],
        confidence: 0.8
      })
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
        'http://localhost:11434/api/generate',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: expect.stringContaining('llama2:7b')
        })
      );
    });

    it('should handle response with markdown code blocks', async () => {
      const responseWithMarkdown = {
        response: `Here's the analysis:

        \`\`\`json
        ${JSON.stringify({
          layer: '1-Presentation',
          topics: ['ui'],
          keywords: ['component'],
          technologies: ['React'],
          confidence: 0.9
        })}
        \`\`\`
        
        This is based on the UI keywords.`
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => responseWithMarkdown
      });

      const context = await provider.detectContext('Create React component');

      expect(context.layer).toBe('1-Presentation');
      expect(context.topics).toEqual(['ui']);
      expect(context.confidence).toBe(0.9);
    });

    it('should handle API error responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'Model not found'
      });

      await expect(provider.detectContext('test task')).rejects.toThrow(
        'Ollama context detection failed: Ollama API error: 404 Not Found - Model not found'
      );
    });

    it('should handle empty response content', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ response: null })
      });

      await expect(provider.detectContext('test task')).rejects.toThrow(
        'Ollama context detection failed: No response content from Ollama'
      );
    });

    it('should handle invalid JSON response with fallback parsing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          response: 'This is not valid JSON but contains docker and infrastructure keywords'
        })
      });

      const context = await provider.detectContext('test task');

      expect(context.layer).toBe('5-Infrastructure'); // Fallback should detect infrastructure keywords
      expect(context.confidence).toBe(0.3); // Low confidence for fallback
      expect(context.technologies).toContain('Docker');
    });

    it('should validate and normalize response data', async () => {
      const invalidResponse = {
        response: JSON.stringify({
          layer: 'invalid-layer',
          topics: 'not-an-array',
          keywords: ['valid', 123, 'keywords'], // Mixed types
          technologies: null,
          confidence: 2.0 // Out of range
        })
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

      expect(requestBody.model).toBe('llama2:7b');
      expect(requestBody.stream).toBe(false);
      expect(requestBody.prompt).toContain('Create a React component');
      expect(requestBody.options.num_predict).toBe(150);
      expect(requestBody.options.temperature).toBe(0.1);
      expect(requestBody.options.stop).toEqual(['\n\n', '```']);
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
            response: `Invalid JSON: ${testCase.text}`
          })
        });

        const context = await provider.detectContext('test');
        expect(context.layer).toBe(testCase.expectedLayer);
      }
    });
  });

  describe('generateEmbedding', () => {
    it('should successfully generate embeddings', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          embedding: mockEmbedding
        })
      });

      const embedding = await provider.generateEmbedding('test text');

      expect(embedding).toEqual(mockEmbedding);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/embeddings',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('llama2:7b')
        })
      );
    });

    it('should use embedding model if configured', async () => {
      const providerWithEmbeddingModel = new OllamaProvider({
        ...mockConfig,
        embeddingModel: 'nomic-embed-text'
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ embedding: [0.1, 0.2] })
      });

      await providerWithEmbeddingModel.generateEmbedding('test text');

      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);
      expect(requestBody.model).toBe('nomic-embed-text');
    });

    it('should handle embedding API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request'
      });

      await expect(provider.generateEmbedding('test text')).rejects.toThrow(
        'Ollama embedding generation failed'
      );
    });

    it('should return empty array for missing embedding data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({})
      });

      const embedding = await provider.generateEmbedding('test text');
      expect(embedding).toEqual([]);
    });
  });

  describe('getHealthInfo', () => {
    it('should return healthy status when provider is available', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            models: [{ name: 'llama2:7b', size: 3825819519 }]
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            models: [{
              name: 'llama2:7b',
              size: 3825819519,
              modified_at: '2024-01-01T00:00:00Z',
              digest: 'sha256:abc123'
            }]
          })
        });

      const healthInfo = await provider.getHealthInfo();

      expect(healthInfo.status).toBe('healthy');
      expect(healthInfo.latency).toBeGreaterThanOrEqual(0);
      expect(healthInfo.lastChecked).toBeInstanceOf(Date);
      expect(healthInfo.details).toMatchObject({
        model: 'llama2:7b',
        baseUrl: 'http://localhost:11434',
        timeout: 10000
      });
      expect(healthInfo.details?.modelInfo).toMatchObject({
        size: 3825819519,
        modified_at: '2024-01-01T00:00:00Z',
        digest: 'sha256:abc123'
      });
    });

    it('should return unavailable status when provider is not available', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const healthInfo = await provider.getHealthInfo();

      expect(healthInfo.status).toBe('unavailable');
      expect(healthInfo.latency).toBeGreaterThanOrEqual(0);
      expect(healthInfo.details).toHaveProperty('error');
    });

    it('should handle model info retrieval errors gracefully', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            models: [{ name: 'llama2:7b' }]
          })
        })
        .mockRejectedValueOnce(new Error('Model info error'));

      const healthInfo = await provider.getHealthInfo();

      expect(healthInfo.status).toBe('healthy');
      // When model info retrieval fails, it should still have an empty modelInfo object
      expect(healthInfo.details?.modelInfo).toEqual({});
    });
  });

  describe('getAvailableModels', () => {
    it('should return list of available models', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [
            { name: 'llama2:7b' },
            { name: 'codellama:7b' },
            { name: 'mistral:7b' }
          ]
        })
      });

      const models = await provider.getAvailableModels();

      expect(models).toEqual(['llama2:7b', 'codellama:7b', 'mistral:7b']);
    });

    it('should return empty array on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const models = await provider.getAvailableModels();
      expect(models).toEqual([]);
    });
  });

  describe('pullModel', () => {
    it('should successfully pull a model', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'success' })
      });

      const result = await provider.pullModel('new-model');

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/pull',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('new-model')
        })
      );
    });

    it('should use configured model if no model specified', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'success' })
      });

      const result = await provider.pullModel();

      expect(result).toBe(true);
      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);
      expect(requestBody.name).toBe('llama2:7b');
    });

    it('should return false on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Pull failed'));

      const result = await provider.pullModel('test-model');
      expect(result).toBe(false);
    });
  });

  describe('request timeout handling', () => {
    it('should abort request on timeout', async () => {
      const shortTimeoutProvider = new OllamaProvider({
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
      const customProvider = new OllamaProvider({
        model: 'test-model',
        baseUrl: 'http://custom-host:8080'
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ models: [{ name: 'test-model' }] })
      });

      await customProvider.isAvailable();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://custom-host:8080/api/tags',
        expect.any(Object)
      );
    });

    it('should use custom parameters', async () => {
      const customProvider = new OllamaProvider({
        model: 'custom-model',
        maxTokens: 300,
        temperature: 0.7
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          response: JSON.stringify({
            layer: '*',
            topics: [],
            keywords: [],
            technologies: [],
            confidence: 0.5
          })
        })
      });

      await customProvider.detectContext('test');

      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      expect(requestBody.model).toBe('custom-model');
      expect(requestBody.options.num_predict).toBe(300);
      expect(requestBody.options.temperature).toBe(0.7);
    });
  });

  describe('prompt structure', () => {
    it('should include optimized prompt for local models', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          response: JSON.stringify({
            layer: '*',
            topics: [],
            keywords: [],
            technologies: [],
            confidence: 0.5
          })
        })
      });

      await provider.detectContext('Create a React component');

      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);
      const prompt = requestBody.prompt;

      expect(prompt).toContain('JSON only');
      expect(prompt).toContain('1-Presentation');
      expect(prompt).toContain('2-Application');
      expect(prompt).toContain('Create a React component');
      expect(prompt).toContain('confidence');
    });
  });
});