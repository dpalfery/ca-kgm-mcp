import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DefaultModelProviderFactory } from '../model-provider-factory.js';
import { ModelProvider } from '../../interfaces/model-provider.js';
import { ModelProviderConfig } from '../../types.js';

// Mock providers for testing
class MockProvider implements ModelProvider {
  name = 'mock-provider';
  type = 'cloud' as const;
  
  constructor(private config: any) {}
  
  async isAvailable(): Promise<boolean> {
    return this.config.available !== false;
  }
  
  async detectContext(): Promise<any> {
    return {
      layer: '*',
      topics: [],
      keywords: [],
      technologies: [],
      confidence: 0.5
    };
  }
}

class UnavailableProvider implements ModelProvider {
  name = 'unavailable-provider';
  type = 'cloud' as const;
  
  constructor(private config: any) {}
  
  async isAvailable(): Promise<boolean> {
    return false;
  }
  
  async detectContext(): Promise<any> {
    return {
      layer: '*',
      topics: [],
      keywords: [],
      technologies: [],
      confidence: 0.5
    };
  }
}

describe('DefaultModelProviderFactory', () => {
  let factory: DefaultModelProviderFactory;

  beforeEach(() => {
    factory = new DefaultModelProviderFactory();
  });

  describe('constructor', () => {
    it('should register default providers', () => {
      const availableProviders = factory.getAvailableProviders();
      
      expect(availableProviders).toContain('rule-based');
      expect(availableProviders).toContain('openai');
      expect(availableProviders).toContain('anthropic');
      expect(availableProviders).toContain('openrouter');
      expect(availableProviders).toContain('openai-compatible');
      expect(availableProviders).toContain('ollama');
    });
  });

  describe('registerProvider', () => {
    it('should register a new provider type', () => {
      factory.registerProvider('mock', MockProvider);
      
      const availableProviders = factory.getAvailableProviders();
      expect(availableProviders).toContain('mock');
    });

    it('should allow overriding existing provider types', () => {
      const originalProviders = factory.getAvailableProviders();
      factory.registerProvider('openai', MockProvider);
      
      const newProviders = factory.getAvailableProviders();
      expect(newProviders).toEqual(originalProviders); // Same list, but openai is now MockProvider
    });
  });

  describe('registerProviders', () => {
    it('should register multiple providers at once', () => {
      factory.registerProviders({
        'mock1': MockProvider,
        'mock2': MockProvider
      });
      
      const availableProviders = factory.getAvailableProviders();
      expect(availableProviders).toContain('mock1');
      expect(availableProviders).toContain('mock2');
    });
  });

  describe('createProvider', () => {
    beforeEach(() => {
      factory.registerProvider('mock', MockProvider);
      factory.registerProvider('unavailable', UnavailableProvider);
    });

    it('should create a provider instance from valid configuration', async () => {
      const config: ModelProviderConfig = {
        type: 'cloud',
        provider: 'mock',
        config: { apiKey: 'test-key' }
      };

      const provider = await factory.createProvider(config);
      
      expect(provider).toBeInstanceOf(MockProvider);
      expect(provider.name).toBe('mock-provider');
      expect(provider.type).toBe('cloud');
    });

    it('should throw error for invalid configuration', async () => {
      const config = {
        type: 'invalid',
        provider: 'mock',
        config: {}
      } as any;

      await expect(factory.createProvider(config)).rejects.toThrow(
        'Invalid configuration for provider: mock'
      );
    });

    it('should throw error for unregistered provider', async () => {
      const config: ModelProviderConfig = {
        type: 'cloud',
        provider: 'nonexistent',
        config: {}
      };

      await expect(factory.createProvider(config)).rejects.toThrow(
        "Provider type 'nonexistent' is not registered"
      );
    });

    it('should throw error when provider is not available', async () => {
      const config: ModelProviderConfig = {
        type: 'cloud',
        provider: 'unavailable',
        config: {}
      };

      await expect(factory.createProvider(config)).rejects.toThrow(
        'Provider unavailable is not available'
      );
    });

    it('should include available providers in error message', async () => {
      const config: ModelProviderConfig = {
        type: 'cloud',
        provider: 'nonexistent',
        config: {}
      };

      try {
        await factory.createProvider(config);
      } catch (error) {
        expect(error.message).toContain('Available providers:');
        expect(error.message).toContain('rule-based');
        expect(error.message).toContain('openai');
      }
    });
  });

  describe('validateConfig', () => {
    it('should validate correct configuration', () => {
      const validConfigs = [
        {
          type: 'rule-based',
          provider: 'rule-based',
          config: {}
        },
        {
          type: 'cloud',
          provider: 'openai',
          config: { apiKey: 'test-key' }
        },
        {
          type: 'local',
          provider: 'ollama',
          config: { baseUrl: 'http://localhost:11434' }
        }
      ];

      validConfigs.forEach(config => {
        expect(factory.validateConfig(config as ModelProviderConfig)).toBe(true);
      });
    });

    it('should reject invalid configuration objects', () => {
      const invalidConfigs = [
        null,
        undefined,
        'string',
        123,
        {},
        { type: 'cloud' }, // Missing provider and config
        { provider: 'openai' }, // Missing type and config
        { config: {} }, // Missing type and provider
        {
          type: 'invalid-type',
          provider: 'openai',
          config: {}
        },
        {
          type: 'cloud',
          provider: 'nonexistent',
          config: {}
        }
      ];

      invalidConfigs.forEach(config => {
        expect(factory.validateConfig(config as any)).toBe(false);
      });
    });

    it('should validate provider-specific requirements', () => {
      // OpenAI requires apiKey
      expect(factory.validateConfig({
        type: 'cloud',
        provider: 'openai',
        config: { apiKey: 'test-key' }
      })).toBe(true);

      expect(factory.validateConfig({
        type: 'cloud',
        provider: 'openai',
        config: {} // Missing apiKey
      })).toBe(false);

      // Anthropic requires apiKey
      expect(factory.validateConfig({
        type: 'cloud',
        provider: 'anthropic',
        config: { apiKey: 'test-key' }
      })).toBe(true);

      expect(factory.validateConfig({
        type: 'cloud',
        provider: 'anthropic',
        config: {} // Missing apiKey
      })).toBe(false);

      // Ollama requires baseUrl
      expect(factory.validateConfig({
        type: 'local',
        provider: 'ollama',
        config: { baseUrl: 'http://localhost:11434' }
      })).toBe(true);

      expect(factory.validateConfig({
        type: 'local',
        provider: 'ollama',
        config: {} // Missing baseUrl
      })).toBe(false);

      // Rule-based requires no specific config
      expect(factory.validateConfig({
        type: 'rule-based',
        provider: 'rule-based',
        config: {}
      })).toBe(true);
    });

    it('should validate type-provider consistency', () => {
      // Cloud provider with wrong type
      expect(factory.validateConfig({
        type: 'local',
        provider: 'openai',
        config: { apiKey: 'test-key' }
      })).toBe(false);

      // Local provider with wrong type
      expect(factory.validateConfig({
        type: 'cloud',
        provider: 'ollama',
        config: { baseUrl: 'http://localhost:11434' }
      })).toBe(false);
    });
  });

  describe('getAvailableProviders', () => {
    it('should return list of registered provider names', () => {
      const providers = factory.getAvailableProviders();
      
      expect(Array.isArray(providers)).toBe(true);
      expect(providers.length).toBeGreaterThan(0);
      expect(providers).toContain('rule-based');
      expect(providers).toContain('openai');
    });

    it('should include newly registered providers', () => {
      factory.registerProvider('custom', MockProvider);
      
      const providers = factory.getAvailableProviders();
      expect(providers).toContain('custom');
    });
  });

  describe('error handling', () => {
    it('should handle provider constructor errors', async () => {
      class ErrorProvider implements ModelProvider {
        name = 'error-provider';
        type = 'cloud' as const;
        
        constructor(config: any) {
          throw new Error('Constructor error');
        }
        
        async isAvailable(): Promise<boolean> {
          return true;
        }
        
        async detectContext(): Promise<any> {
          return { layer: '*', topics: [], keywords: [], technologies: [], confidence: 0.5 };
        }
      }

      factory.registerProvider('error', ErrorProvider);

      const config: ModelProviderConfig = {
        type: 'cloud',
        provider: 'error',
        config: {}
      };

      await expect(factory.createProvider(config)).rejects.toThrow(
        'Failed to create provider error: Constructor error'
      );
    });

    it('should handle provider availability check errors', async () => {
      class AvailabilityErrorProvider implements ModelProvider {
        name = 'availability-error-provider';
        type = 'cloud' as const;
        
        constructor(config: any) {}
        
        async isAvailable(): Promise<boolean> {
          throw new Error('Availability check error');
        }
        
        async detectContext(): Promise<any> {
          return { layer: '*', topics: [], keywords: [], technologies: [], confidence: 0.5 };
        }
      }

      factory.registerProvider('availability-error', AvailabilityErrorProvider);

      const config: ModelProviderConfig = {
        type: 'cloud',
        provider: 'availability-error',
        config: {}
      };

      await expect(factory.createProvider(config)).rejects.toThrow(
        'Failed to create provider availability-error: Availability check error'
      );
    });
  });

  describe('integration with real providers', () => {
    it('should create rule-based provider successfully', async () => {
      const config: ModelProviderConfig = {
        type: 'rule-based',
        provider: 'rule-based',
        config: {}
      };

      const provider = await factory.createProvider(config);
      
      expect(provider.name).toBe('rule-based-heuristic');
      expect(provider.type).toBe('rule-based');
      expect(await provider.isAvailable()).toBe(true);
    });

    // Note: These tests would require mocking fetch for cloud providers
    // or actual API keys, so we'll skip them in unit tests
    it.skip('should create OpenAI provider with valid config', async () => {
      const config: ModelProviderConfig = {
        type: 'cloud',
        provider: 'openai',
        config: { apiKey: 'test-key' }
      };

      const provider = await factory.createProvider(config);
      expect(provider.name).toBe('openai');
      expect(provider.type).toBe('cloud');
    });
  });

  describe('configuration validation edge cases', () => {
    it('should handle empty string values in config', () => {
      expect(factory.validateConfig({
        type: 'cloud',
        provider: 'openai',
        config: { apiKey: '' } // Empty string
      })).toBe(false);
    });

    it('should handle non-string values in config', () => {
      expect(factory.validateConfig({
        type: 'cloud',
        provider: 'openai',
        config: { apiKey: 123 } // Number instead of string
      })).toBe(false);
    });

    it('should handle missing config object', () => {
      expect(factory.validateConfig({
        type: 'cloud',
        provider: 'openai'
        // Missing config
      } as any)).toBe(false);
    });
  });
});