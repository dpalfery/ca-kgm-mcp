import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DefaultModelProviderManager } from '../model-provider-manager.js';
import { ModelProvider, ModelProviderFactory } from '../../interfaces/model-provider.js';
import { ModelProviderConfig, TaskContext } from '../../types.js';

// Mock providers for testing
class MockProvider implements ModelProvider {
  constructor(
    public name: string,
    public type: 'local' | 'cloud' | 'rule-based',
    private available: boolean = true,
    private shouldThrow: boolean = false
  ) {}

  async isAvailable(): Promise<boolean> {
    if (this.shouldThrow) {
      throw new Error(`${this.name} availability check failed`);
    }
    return this.available;
  }

  async detectContext(text: string): Promise<TaskContext> {
    if (this.shouldThrow) {
      throw new Error(`${this.name} context detection failed`);
    }
    return {
      layer: '2-Application',
      topics: ['api'],
      keywords: ['test'],
      technologies: ['Node.js'],
      confidence: 0.8
    };
  }

  async getHealthInfo() {
    return {
      status: this.available ? 'healthy' : 'unavailable' as const,
      latency: 100,
      lastChecked: new Date(),
      details: { provider: this.name }
    };
  }
}

class MockFactory implements ModelProviderFactory {
  private providers = new Map<string, MockProvider>();

  registerProvider(name: string, provider: MockProvider) {
    this.providers.set(name, provider);
  }

  async createProvider(config: ModelProviderConfig): Promise<ModelProvider> {
    const provider = this.providers.get(config.provider);
    if (!provider) {
      throw new Error(`Provider ${config.provider} not found`);
    }
    return provider;
  }

  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  validateConfig(config: ModelProviderConfig): boolean {
    return this.providers.has(config.provider);
  }
}

describe('DefaultModelProviderManager', () => {
  let manager: DefaultModelProviderManager;
  let mockFactory: MockFactory;
  let primaryProvider: MockProvider;
  let fallbackProvider1: MockProvider;
  let fallbackProvider2: MockProvider;

  beforeEach(() => {
    mockFactory = new MockFactory();
    
    primaryProvider = new MockProvider('primary', 'cloud', true);
    fallbackProvider1 = new MockProvider('fallback1', 'local', true);
    fallbackProvider2 = new MockProvider('fallback2', 'rule-based', true);

    mockFactory.registerProvider('primary', primaryProvider);
    mockFactory.registerProvider('fallback1', fallbackProvider1);
    mockFactory.registerProvider('fallback2', fallbackProvider2);

    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      manager = new DefaultModelProviderManager({}, mockFactory);
      expect(manager).toBeDefined();
    });

    it('should initialize with custom configuration', () => {
      const config = {
        healthCheckInterval: 30000,
        maxRetries: 5,
        timeoutMs: 10000
      };

      manager = new DefaultModelProviderManager(config, mockFactory);
      expect(manager).toBeDefined();
    });

    it('should initialize providers from configuration', async () => {
      const config = {
        primaryProvider: {
          type: 'cloud' as const,
          provider: 'primary',
          config: {}
        },
        fallbackProviders: [
          {
            type: 'local' as const,
            provider: 'fallback1',
            config: {}
          }
        ]
      };

      manager = new DefaultModelProviderManager(config, mockFactory);
      
      // Allow async initialization to complete
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const primary = await manager.getPrimaryProvider();
      expect(primary.name).toBe('primary');
    });
  });

  describe('getPrimaryProvider', () => {
    beforeEach(async () => {
      manager = new DefaultModelProviderManager({
        primaryProvider: {
          type: 'cloud',
          provider: 'primary',
          config: {}
        }
      }, mockFactory);
      
      // Allow initialization to complete
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    it('should return primary provider when available', async () => {
      const provider = await manager.getPrimaryProvider();
      expect(provider.name).toBe('primary');
    });

    it('should throw error when no primary provider configured', async () => {
      const emptyManager = new DefaultModelProviderManager({}, mockFactory);
      
      await expect(emptyManager.getPrimaryProvider()).rejects.toThrow(
        'No primary provider configured'
      );
    });

    it('should throw error when primary provider is not available', async () => {
      primaryProvider = new MockProvider('primary', 'cloud', false);
      mockFactory.registerProvider('primary', primaryProvider);
      
      await expect(manager.getPrimaryProvider()).rejects.toThrow(
        'Primary provider is not available'
      );
    });
  });

  describe('getFallbackProviders', () => {
    beforeEach(async () => {
      manager = new DefaultModelProviderManager({
        fallbackProviders: [
          {
            type: 'local',
            provider: 'fallback1',
            config: {}
          },
          {
            type: 'rule-based',
            provider: 'fallback2',
            config: {}
          }
        ]
      }, mockFactory);
      
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    it('should return available fallback providers', async () => {
      const providers = await manager.getFallbackProviders();
      
      expect(providers).toHaveLength(2);
      expect(providers[0].name).toBe('fallback1');
      expect(providers[1].name).toBe('fallback2');
    });

    it('should filter out unavailable providers', async () => {
      fallbackProvider1 = new MockProvider('fallback1', 'local', false);
      mockFactory.registerProvider('fallback1', fallbackProvider1);
      
      const providers = await manager.getFallbackProviders();
      
      expect(providers).toHaveLength(1);
      expect(providers[0].name).toBe('fallback2');
    });

    it('should handle provider availability check errors', async () => {
      fallbackProvider1 = new MockProvider('fallback1', 'local', true, true);
      mockFactory.registerProvider('fallback1', fallbackProvider1);
      
      const providers = await manager.getFallbackProviders();
      
      expect(providers).toHaveLength(1);
      expect(providers[0].name).toBe('fallback2');
    });
  });

  describe('detectContextWithFallback', () => {
    beforeEach(async () => {
      manager = new DefaultModelProviderManager({
        primaryProvider: {
          type: 'cloud',
          provider: 'primary',
          config: {}
        },
        fallbackProviders: [
          {
            type: 'local',
            provider: 'fallback1',
            config: {}
          },
          {
            type: 'rule-based',
            provider: 'fallback2',
            config: {}
          }
        ]
      }, mockFactory);
      
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    it('should use primary provider when available', async () => {
      const result = await manager.detectContextWithFallback('test task');
      
      expect(result.context.layer).toBe('2-Application');
      expect(result.providerUsed).toBe('primary');
      expect(result.fallbackUsed).toBe(false);
    });

    it('should fallback to next provider when primary fails', async () => {
      primaryProvider = new MockProvider('primary', 'cloud', true, true);
      mockFactory.registerProvider('primary', primaryProvider);
      
      const result = await manager.detectContextWithFallback('test task');
      
      expect(result.context.layer).toBe('2-Application');
      expect(result.providerUsed).toBe('fallback1');
      expect(result.fallbackUsed).toBe(true);
    });

    it('should try all fallback providers in order', async () => {
      primaryProvider = new MockProvider('primary', 'cloud', true, true);
      fallbackProvider1 = new MockProvider('fallback1', 'local', true, true);
      mockFactory.registerProvider('primary', primaryProvider);
      mockFactory.registerProvider('fallback1', fallbackProvider1);
      
      const result = await manager.detectContextWithFallback('test task');
      
      expect(result.context.layer).toBe('2-Application');
      expect(result.providerUsed).toBe('fallback2');
      expect(result.fallbackUsed).toBe(true);
    });

    it('should throw error when all providers fail', async () => {
      primaryProvider = new MockProvider('primary', 'cloud', true, true);
      fallbackProvider1 = new MockProvider('fallback1', 'local', true, true);
      fallbackProvider2 = new MockProvider('fallback2', 'rule-based', true, true);
      mockFactory.registerProvider('primary', primaryProvider);
      mockFactory.registerProvider('fallback1', fallbackProvider1);
      mockFactory.registerProvider('fallback2', fallbackProvider2);
      
      await expect(manager.detectContextWithFallback('test task')).rejects.toThrow(
        'All providers failed'
      );
    });

    it('should handle timeout correctly', async () => {
      const slowProvider = new MockProvider('primary', 'cloud', true);
      slowProvider.detectContext = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 10000))
      );
      mockFactory.registerProvider('primary', slowProvider);
      
      const shortTimeoutManager = new DefaultModelProviderManager({
        primaryProvider: {
          type: 'cloud',
          provider: 'primary',
          config: {}
        },
        fallbackProviders: [
          {
            type: 'rule-based',
            provider: 'fallback2',
            config: {}
          }
        ],
        timeoutMs: 100
      }, mockFactory);
      
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const result = await shortTimeoutManager.detectContextWithFallback('test task');
      
      expect(result.providerUsed).toBe('fallback2');
      expect(result.fallbackUsed).toBe(true);
    });
  });

  describe('configureProvider', () => {
    beforeEach(() => {
      manager = new DefaultModelProviderManager({}, mockFactory);
    });

    it('should configure primary provider', async () => {
      await manager.configureProvider('primary', {
        type: 'cloud',
        provider: 'primary',
        config: {}
      });
      
      const provider = await manager.getPrimaryProvider();
      expect(provider.name).toBe('primary');
    });

    it('should configure fallback provider', async () => {
      await manager.configureProvider('fallback1', {
        type: 'local',
        provider: 'fallback1',
        config: {}
      });
      
      const providers = await manager.getFallbackProviders();
      expect(providers.some(p => p.name === 'fallback1')).toBe(true);
    });

    it('should update existing provider', async () => {
      await manager.configureProvider('primary', {
        type: 'cloud',
        provider: 'primary',
        config: {}
      });
      
      // Configure again with same name
      await manager.configureProvider('primary', {
        type: 'cloud',
        provider: 'primary',
        config: {}
      });
      
      const provider = await manager.getPrimaryProvider();
      expect(provider.name).toBe('primary');
    });

    it('should throw error for invalid provider configuration', async () => {
      mockFactory.registerProvider('invalid', new MockProvider('invalid', 'cloud', false));
      
      await expect(manager.configureProvider('invalid', {
        type: 'cloud',
        provider: 'nonexistent',
        config: {}
      })).rejects.toThrow('Failed to configure provider invalid');
    });
  });

  describe('removeProvider', () => {
    beforeEach(async () => {
      manager = new DefaultModelProviderManager({
        primaryProvider: {
          type: 'cloud',
          provider: 'primary',
          config: {}
        },
        fallbackProviders: [
          {
            type: 'local',
            provider: 'fallback1',
            config: {}
          }
        ]
      }, mockFactory);
      
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    it('should remove primary provider', async () => {
      await manager.removeProvider('primary');
      
      await expect(manager.getPrimaryProvider()).rejects.toThrow(
        'No primary provider configured'
      );
    });

    it('should remove fallback provider', async () => {
      await manager.removeProvider('fallback1');
      
      const providers = await manager.getFallbackProviders();
      expect(providers.some(p => p.name === 'fallback1')).toBe(false);
    });

    it('should handle removing non-existent provider', async () => {
      await expect(manager.removeProvider('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('health monitoring', () => {
    beforeEach(async () => {
      manager = new DefaultModelProviderManager({
        primaryProvider: {
          type: 'cloud',
          provider: 'primary',
          config: {}
        },
        fallbackProviders: [
          {
            type: 'local',
            provider: 'fallback1',
            config: {}
          }
        ],
        healthCheckInterval: 1000
      }, mockFactory);
      
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    it('should perform periodic health checks', async () => {
      const healthSpy = vi.spyOn(primaryProvider, 'isAvailable');
      
      // Advance time to trigger health check
      vi.advanceTimersByTime(1000);
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(healthSpy).toHaveBeenCalled();
    });

    it('should track provider health information', async () => {
      // Trigger health check
      vi.advanceTimersByTime(1000);
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const healthInfo = manager.getProviderHealth();
      expect(healthInfo.has('primary')).toBe(true);
      expect(healthInfo.get('primary')?.status).toBe('healthy');
    });

    it('should handle health check errors', async () => {
      primaryProvider = new MockProvider('primary', 'cloud', true, true);
      mockFactory.registerProvider('primary', primaryProvider);
      
      // Trigger health check
      vi.advanceTimersByTime(1000);
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const healthInfo = manager.getProviderHealth();
      expect(healthInfo.get('primary')?.status).toBe('unavailable');
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources on destroy', () => {
      manager = new DefaultModelProviderManager({
        healthCheckInterval: 1000
      }, mockFactory);
      
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      
      manager.destroy();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it('should handle destroy when no timer is active', () => {
      manager = new DefaultModelProviderManager({}, mockFactory);
      
      expect(() => manager.destroy()).not.toThrow();
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      manager = new DefaultModelProviderManager({}, mockFactory);
    });

    it('should handle provider initialization errors gracefully', async () => {
      const errorFactory = new MockFactory();
      errorFactory.createProvider = vi.fn().mockRejectedValue(new Error('Init failed'));
      
      const errorManager = new DefaultModelProviderManager({
        primaryProvider: {
          type: 'cloud',
          provider: 'primary',
          config: {}
        }
      }, errorFactory);
      
      // Should not throw during construction
      expect(errorManager).toBeDefined();
    });

    it('should handle concurrent provider operations', async () => {
      const promises = [
        manager.configureProvider('provider1', {
          type: 'cloud',
          provider: 'primary',
          config: {}
        }),
        manager.configureProvider('provider2', {
          type: 'local',
          provider: 'fallback1',
          config: {}
        }),
        manager.removeProvider('nonexistent')
      ];
      
      await expect(Promise.all(promises)).resolves.not.toThrow();
    });
  });

  describe('timeout handling', () => {
    it('should enforce timeout on provider operations', async () => {
      const slowProvider = new MockProvider('slow', 'cloud', true);
      slowProvider.detectContext = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 10000))
      );
      mockFactory.registerProvider('slow', slowProvider);
      
      const timeoutManager = new DefaultModelProviderManager({
        primaryProvider: {
          type: 'cloud',
          provider: 'slow',
          config: {}
        },
        timeoutMs: 100
      }, mockFactory);
      
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const startTime = Date.now();
      
      try {
        await timeoutManager.detectContextWithFallback('test');
      } catch (error) {
        const elapsed = Date.now() - startTime;
        expect(elapsed).toBeLessThan(200); // Should timeout quickly
      }
    });
  });
});