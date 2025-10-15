import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigManager } from '../../config/config-manager.js';
import { ModelProviderFactory } from '../../providers/model-provider-factory.js';
import { DefaultModelProviderManager } from '../../providers/model-provider-manager.js';
import { platformDetector } from '../platform-detector.js';
import { pathUtils } from '../path-utils.js';
import { fileSystem } from '../file-system-utils.js';

describe('Model Provider Cross-Platform Compatibility', () => {
  let configManager: ConfigManager;
  let testDir: string;

  beforeEach(async () => {
    testDir = pathUtils.join(process.cwd(), 'test-provider-compat');
    await fileSystem.ensureDirectory(testDir);
    
    configManager = new ConfigManager({
      configPath: pathUtils.join(testDir, 'config.json')
    });
  });

  afterEach(async () => {
    if (await fileSystem.exists(testDir)) {
      await fileSystem.deleteDirectory(testDir, true);
    }
  });

  describe('Rule-based Provider', () => {
    it('should work on all platforms without external dependencies', async () => {
      const config = await configManager.loadConfiguration({
        profile: 'minimal'
      });

      expect(config.providers.primary?.type).toBe('rule-based');
      
      const provider = ModelProviderFactory.createProvider(config.providers.primary!);
      expect(provider).toBeDefined();
      
      const isAvailable = await provider.isAvailable();
      expect(isAvailable).toBe(true);
      
      // Test context detection
      const context = await provider.detectContext('Create a React component for user authentication');
      expect(context).toBeDefined();
      expect(context.layer).toBeDefined();
      expect(context.topics).toBeDefined();
    });

    it('should provide consistent results across platforms', async () => {
      const config = await configManager.loadConfiguration({
        profile: 'minimal'
      });

      const provider = ModelProviderFactory.createProvider(config.providers.primary!);
      
      const testCases = [
        'Create a database migration for user table',
        'Implement JWT authentication middleware',
        'Add CSS styles for responsive design',
        'Write unit tests for user service',
        'Deploy application to production'
      ];

      for (const testCase of testCases) {
        const context = await provider.detectContext(testCase);
        expect(context.layer).toBeDefined();
        expect(context.topics).toBeDefined();
        expect(context.confidence).toBeGreaterThan(0);
      }
    });
  });

  describe('Local Provider (Ollama)', () => {
    it('should handle Ollama configuration on all platforms', async () => {
      const config = await configManager.loadConfiguration({
        overrides: {
          providers: {
            primary: {
              type: 'local',
              provider: 'ollama',
              config: {
                baseUrl: 'http://localhost:11434',
                model: 'llama2:7b',
                timeout: 5000
              }
            },
            settings: {
              healthCheckInterval: 30000,
              maxRetries: 3,
              timeoutMs: 10000,
              enableFallback: true
            }
          }
        }
      });

      const provider = ModelProviderFactory.createProvider(config.providers.primary!);
      expect(provider).toBeDefined();
      
      // Note: We don't test actual connectivity since Ollama may not be installed
      // But we verify the provider can be created and configured
      expect(provider.name).toBe('ollama');
      expect(provider.type).toBe('local');
    });

    it('should handle platform-specific Ollama URLs', async () => {
      const platformInfo = platformDetector.getPlatformInfo();
      let baseUrl = 'http://localhost:11434';
      
      // Platform-specific URL handling
      if (platformInfo.isWindows) {
        // Windows might use different localhost resolution
        baseUrl = 'http://127.0.0.1:11434';
      }

      const config = await configManager.loadConfiguration({
        overrides: {
          providers: {
            primary: {
              type: 'local',
              provider: 'ollama',
              config: {
                baseUrl,
                model: 'llama2:7b',
                timeout: 5000
              }
            },
            settings: {
              healthCheckInterval: 30000,
              maxRetries: 3,
              timeoutMs: 10000,
              enableFallback: true
            }
          }
        }
      });

      const provider = ModelProviderFactory.createProvider(config.providers.primary!);
      expect(provider).toBeDefined();
    });
  });

  describe('Cloud Providers', () => {
    it('should handle OpenAI configuration on all platforms', async () => {
      const config = await configManager.loadConfiguration({
        overrides: {
          providers: {
            primary: {
              type: 'cloud',
              provider: 'openai',
              config: {
                apiKey: 'test-api-key',
                model: 'gpt-3.5-turbo',
                timeout: 3000
              }
            },
            settings: {
              healthCheckInterval: 30000,
              maxRetries: 3,
              timeoutMs: 10000,
              enableFallback: true
            }
          }
        }
      });

      const provider = ModelProviderFactory.createProvider(config.providers.primary!);
      expect(provider).toBeDefined();
      expect(provider.name).toBe('openai');
      expect(provider.type).toBe('cloud');
    });

    it('should handle Anthropic configuration on all platforms', async () => {
      const config = await configManager.loadConfiguration({
        overrides: {
          providers: {
            primary: {
              type: 'cloud',
              provider: 'anthropic',
              config: {
                apiKey: 'test-api-key',
                model: 'claude-3-haiku-20240307',
                timeout: 3000
              }
            },
            settings: {
              healthCheckInterval: 30000,
              maxRetries: 3,
              timeoutMs: 10000,
              enableFallback: true
            }
          }
        }
      });

      const provider = ModelProviderFactory.createProvider(config.providers.primary!);
      expect(provider).toBeDefined();
      expect(provider.name).toBe('anthropic');
      expect(provider.type).toBe('cloud');
    });

    it('should handle OpenRouter configuration on all platforms', async () => {
      const config = await configManager.loadConfiguration({
        overrides: {
          providers: {
            primary: {
              type: 'cloud',
              provider: 'openrouter',
              config: {
                apiKey: 'test-api-key',
                model: 'microsoft/wizardlm-2-8x22b',
                timeout: 5000
              }
            },
            settings: {
              healthCheckInterval: 30000,
              maxRetries: 3,
              timeoutMs: 10000,
              enableFallback: true
            }
          }
        }
      });

      const provider = ModelProviderFactory.createProvider(config.providers.primary!);
      expect(provider).toBeDefined();
      expect(provider.name).toBe('openrouter');
      expect(provider.type).toBe('cloud');
    });

    it('should handle OpenAI-compatible APIs on all platforms', async () => {
      const config = await configManager.loadConfiguration({
        overrides: {
          providers: {
            primary: {
              type: 'cloud',
              provider: 'openai-compatible',
              config: {
                apiKey: 'test-api-key',
                baseUrl: 'https://api.custom-provider.com/v1',
                model: 'custom-model',
                timeout: 3000
              }
            },
            settings: {
              healthCheckInterval: 30000,
              maxRetries: 3,
              timeoutMs: 10000,
              enableFallback: true
            }
          }
        }
      });

      const provider = ModelProviderFactory.createProvider(config.providers.primary!);
      expect(provider).toBeDefined();
      expect(provider.name).toBe('openai-compatible');
      expect(provider.type).toBe('cloud');
    });
  });

  describe('Provider Manager', () => {
    it('should manage multiple providers on all platforms', async () => {
      const config = await configManager.loadConfiguration({
        profile: 'development'
      });

      const manager = new DefaultModelProviderManager(config.providers);
      expect(manager).toBeDefined();
      
      // Test provider availability checking
      const primaryAvailable = await manager.isPrimaryAvailable();
      expect(typeof primaryAvailable).toBe('boolean');
      
      const fallbacksAvailable = await manager.getFallbackProviders();
      expect(Array.isArray(fallbacksAvailable)).toBe(true);
    });

    it('should handle fallback chain correctly on all platforms', async () => {
      const config = await configManager.loadConfiguration({
        overrides: {
          providers: {
            primary: {
              type: 'cloud',
              provider: 'openai',
              config: {
                apiKey: 'invalid-key', // This will fail
                model: 'gpt-3.5-turbo',
                timeout: 1000
              }
            },
            fallbacks: [
              {
                type: 'rule-based',
                provider: 'rule-based',
                config: {}
              }
            ],
            settings: {
              healthCheckInterval: 30000,
              maxRetries: 1,
              timeoutMs: 2000,
              enableFallback: true
            }
          }
        }
      });

      const manager = new DefaultModelProviderManager(config.providers);
      
      // Should fall back to rule-based provider
      const provider = await manager.getAvailableProvider();
      expect(provider).toBeDefined();
      expect(provider.type).toBe('rule-based');
    });
  });

  describe('Environment Variable Handling', () => {
    it('should load API keys from environment on all platforms', async () => {
      const originalOpenAI = process.env.OPENAI_API_KEY;
      const originalAnthropic = process.env.ANTHROPIC_API_KEY;
      
      process.env.OPENAI_API_KEY = 'test-openai-key';
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';

      try {
        const config = await configManager.loadConfiguration({
          profile: 'development'
        });

        // Environment variables should be loaded into provider configs
        expect(config.providers.primary?.config?.apiKey).toBe('test-openai-key');
        
        if (config.providers.fallbacks && config.providers.fallbacks.length > 0) {
          const anthropicProvider = config.providers.fallbacks.find(p => p.provider === 'anthropic');
          if (anthropicProvider) {
            expect(anthropicProvider.config?.apiKey).toBe('test-anthropic-key');
          }
        }
      } finally {
        // Restore original environment
        if (originalOpenAI !== undefined) {
          process.env.OPENAI_API_KEY = originalOpenAI;
        } else {
          delete process.env.OPENAI_API_KEY;
        }
        
        if (originalAnthropic !== undefined) {
          process.env.ANTHROPIC_API_KEY = originalAnthropic;
        } else {
          delete process.env.ANTHROPIC_API_KEY;
        }
      }
    });

    it('should handle missing environment variables gracefully', async () => {
      // Ensure API keys are not set
      const originalKeys = {
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY
      };

      delete process.env.OPENAI_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.OPENROUTER_API_KEY;

      try {
        const config = await configManager.loadConfiguration({
          profile: 'development'
        });

        // Should still load configuration, but providers may not be available
        expect(config).toBeDefined();
        expect(config.providers).toBeDefined();
        
        // Should fall back to rule-based provider
        const manager = new DefaultModelProviderManager(config.providers);
        const provider = await manager.getAvailableProvider();
        expect(provider.type).toBe('rule-based');
      } finally {
        // Restore original environment
        for (const [key, value] of Object.entries(originalKeys)) {
          if (value !== undefined) {
            process.env[key] = value;
          }
        }
      }
    });
  });

  describe('Platform-Specific Configuration', () => {
    it('should use platform-appropriate configuration paths', async () => {
      const config = await configManager.loadConfiguration();
      const platformInfo = platformDetector.getPlatformInfo();
      
      expect(config.platform?.pathSeparator).toBe(platformInfo.pathSeparator);
      expect(config.platform?.homeDirectory).toBe(platformInfo.homeDirectory);
      
      // Verify database path uses platform-appropriate separators
      if (config.database.path !== ':memory:') {
        expect(config.database.path).toContain(platformInfo.pathSeparator);
      }
    });

    it('should handle Windows-specific provider configurations', async () => {
      const platformInfo = platformDetector.getPlatformInfo();
      
      if (platformInfo.isWindows) {
        const config = await configManager.loadConfiguration({
          overrides: {
            providers: {
              primary: {
                type: 'local',
                provider: 'ollama',
                config: {
                  baseUrl: 'http://127.0.0.1:11434', // Windows localhost
                  model: 'llama2:7b',
                  timeout: 5000
                }
              },
              settings: {
                healthCheckInterval: 30000,
                maxRetries: 3,
                timeoutMs: 10000,
                enableFallback: true
              }
            }
          }
        });

        const provider = ModelProviderFactory.createProvider(config.providers.primary!);
        expect(provider).toBeDefined();
      }
    });

    it('should handle Unix-specific provider configurations', async () => {
      const platformInfo = platformDetector.getPlatformInfo();
      
      if (platformInfo.isMacOS || platformInfo.isLinux) {
        const config = await configManager.loadConfiguration({
          overrides: {
            providers: {
              primary: {
                type: 'local',
                provider: 'ollama',
                config: {
                  baseUrl: 'http://localhost:11434', // Unix localhost
                  model: 'llama2:7b',
                  timeout: 5000
                }
              },
              settings: {
                healthCheckInterval: 30000,
                maxRetries: 3,
                timeoutMs: 10000,
                enableFallback: true
              }
            }
          }
        });

        const provider = ModelProviderFactory.createProvider(config.providers.primary!);
        expect(provider).toBeDefined();
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully on all platforms', async () => {
      const config = await configManager.loadConfiguration({
        overrides: {
          providers: {
            primary: {
              type: 'cloud',
              provider: 'openai',
              config: {
                apiKey: 'test-key',
                baseUrl: 'http://non-existent-server:9999',
                model: 'gpt-3.5-turbo',
                timeout: 1000
              }
            },
            fallbacks: [
              {
                type: 'rule-based',
                provider: 'rule-based',
                config: {}
              }
            ],
            settings: {
              healthCheckInterval: 30000,
              maxRetries: 1,
              timeoutMs: 2000,
              enableFallback: true
            }
          }
        }
      });

      const manager = new DefaultModelProviderManager(config.providers);
      
      // Should handle network error and fall back
      const provider = await manager.getAvailableProvider();
      expect(provider.type).toBe('rule-based');
    });

    it('should handle timeout errors consistently across platforms', async () => {
      const config = await configManager.loadConfiguration({
        overrides: {
          providers: {
            primary: {
              type: 'cloud',
              provider: 'openai',
              config: {
                apiKey: 'test-key',
                model: 'gpt-3.5-turbo',
                timeout: 1000 // Short timeout but valid
              }
            },
            fallbacks: [
              {
                type: 'rule-based',
                provider: 'rule-based',
                config: {}
              }
            ],
            settings: {
              healthCheckInterval: 30000,
              maxRetries: 1,
              timeoutMs: 1000,
              enableFallback: true
            }
          }
        }
      });

      const manager = new DefaultModelProviderManager(config.providers);
      
      // Should handle timeout and fall back
      const provider = await manager.getAvailableProvider();
      expect(provider.type).toBe('rule-based');
    });
  });
});