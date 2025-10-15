import { describe, it, expect } from 'vitest';
import { ConfigValidator } from '../config-validator.js';
import { DEFAULT_CONFIG, KGMemoryConfig } from '../config-schema.js';

describe('ConfigValidator', () => {
  describe('validate', () => {
    it('should validate default configuration successfully', () => {
      const result = ConfigValidator.validate(DEFAULT_CONFIG);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect server configuration errors', () => {
      const config: KGMemoryConfig = {
        ...DEFAULT_CONFIG,
        server: {
          ...DEFAULT_CONFIG.server,
          name: '', // Invalid: empty name
          logLevel: 'invalid' as any, // Invalid: bad log level
          port: 70000 // Invalid: port out of range
        }
      };

      const result = ConfigValidator.validate(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.path === 'server.name')).toBe(true);
      expect(result.errors.some(e => e.path === 'server.logLevel')).toBe(true);
      expect(result.errors.some(e => e.path === 'server.port')).toBe(true);
    });

    it('should detect database configuration errors', () => {
      const config: KGMemoryConfig = {
        ...DEFAULT_CONFIG,
        database: {
          ...DEFAULT_CONFIG.database,
          path: '', // Invalid: empty path
          maxConnections: 0, // Invalid: zero connections
          busyTimeout: -1 // Invalid: negative timeout
        }
      };

      const result = ConfigValidator.validate(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.path === 'database.path')).toBe(true);
      expect(result.errors.some(e => e.path === 'database.maxConnections')).toBe(true);
      expect(result.errors.some(e => e.path === 'database.busyTimeout')).toBe(true);
    });

    it('should detect provider configuration errors', () => {
      const config: KGMemoryConfig = {
        ...DEFAULT_CONFIG,
        providers: {
          // Invalid: no primary or fallbacks
          settings: {
            healthCheckInterval: 500, // Invalid: too short
            maxRetries: -1, // Invalid: negative
            timeoutMs: 100, // Invalid: too short
            enableFallback: true
          }
        }
      };

      const result = ConfigValidator.validate(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.path === 'providers')).toBe(true);
      expect(result.errors.some(e => e.path === 'providers.settings.healthCheckInterval')).toBe(true);
      expect(result.errors.some(e => e.path === 'providers.settings.maxRetries')).toBe(true);
      expect(result.errors.some(e => e.path === 'providers.settings.timeoutMs')).toBe(true);
    });

    it('should validate provider configurations', () => {
      const config: KGMemoryConfig = {
        ...DEFAULT_CONFIG,
        providers: {
          primary: {
            type: 'invalid' as any, // Invalid type
            provider: '', // Invalid: empty provider
            config: null as any // Invalid: null config
          },
          fallbacks: [
            {
              type: 'cloud',
              provider: 'openai',
              config: {} // Valid but missing API key (should warn)
            }
          ],
          settings: DEFAULT_CONFIG.providers.settings
        }
      };

      const result = ConfigValidator.validate(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.path === 'providers.primary.type')).toBe(true);
      expect(result.errors.some(e => e.path === 'providers.primary.provider')).toBe(true);
      expect(result.errors.some(e => e.path === 'providers.primary.config')).toBe(true);
      expect(result.warnings.some(w => w.path === 'providers.fallbacks[0].config.apiKey')).toBe(true);
    });

    it('should detect context detection configuration errors', () => {
      const config: KGMemoryConfig = {
        ...DEFAULT_CONFIG,
        contextDetection: {
          ...DEFAULT_CONFIG.contextDetection,
          confidenceThreshold: 1.5, // Invalid: > 1
          maxKeywords: 0, // Invalid: zero
          layerKeywords: null as any, // Invalid: null
          topicKeywords: 'invalid' as any // Invalid: not object
        }
      };

      const result = ConfigValidator.validate(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.path === 'contextDetection.confidenceThreshold')).toBe(true);
      expect(result.errors.some(e => e.path === 'contextDetection.maxKeywords')).toBe(true);
      expect(result.errors.some(e => e.path === 'contextDetection.layerKeywords')).toBe(true);
      expect(result.errors.some(e => e.path === 'contextDetection.topicKeywords')).toBe(true);
    });

    it('should detect ranking configuration errors', () => {
      const config: KGMemoryConfig = {
        ...DEFAULT_CONFIG,
        ranking: {
          weights: {
            authority: -1, // Invalid: negative
            whenToApply: 8,
            layerMatch: 7,
            topicOverlap: 5,
            severityBoost: 4,
            semanticSimilarity: 3
          },
          severityMultipliers: {
            MUST: -1, // Invalid: negative
            SHOULD: 2.0,
            MAY: 1.0
          },
          maxDirectives: 0, // Invalid: zero
          tokenBudget: 50 // Invalid: too small
        }
      };

      const result = ConfigValidator.validate(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.path === 'ranking.weights.authority')).toBe(true);
      expect(result.errors.some(e => e.path === 'ranking.severityMultipliers.MUST')).toBe(true);
      expect(result.errors.some(e => e.path === 'ranking.maxDirectives')).toBe(true);
      expect(result.errors.some(e => e.path === 'ranking.tokenBudget')).toBe(true);
    });

    it('should detect cache configuration errors', () => {
      const config: KGMemoryConfig = {
        ...DEFAULT_CONFIG,
        cache: {
          ...DEFAULT_CONFIG.cache,
          maxSize: 0, // Invalid: zero
          ttlSeconds: 0, // Invalid: zero
          cleanupInterval: 500 // Invalid: too short
        }
      };

      const result = ConfigValidator.validate(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.path === 'cache.maxSize')).toBe(true);
      expect(result.errors.some(e => e.path === 'cache.ttlSeconds')).toBe(true);
      expect(result.errors.some(e => e.path === 'cache.cleanupInterval')).toBe(true);
    });

    it('should detect performance configuration errors', () => {
      const config: KGMemoryConfig = {
        ...DEFAULT_CONFIG,
        performance: {
          ...DEFAULT_CONFIG.performance,
          queryTimeoutMs: 50, // Invalid: too short
          maxConcurrentQueries: 0 // Invalid: zero
        }
      };

      const result = ConfigValidator.validate(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.path === 'performance.queryTimeoutMs')).toBe(true);
      expect(result.errors.some(e => e.path === 'performance.maxConcurrentQueries')).toBe(true);
    });

    it('should detect security configuration errors', () => {
      const config: KGMemoryConfig = {
        ...DEFAULT_CONFIG,
        security: {
          ...DEFAULT_CONFIG.security,
          allowedFileExtensions: 'invalid' as any, // Invalid: not array
          maxFileSize: 0 // Invalid: zero
        }
      };

      const result = ConfigValidator.validate(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.path === 'security.allowedFileExtensions')).toBe(true);
      expect(result.errors.some(e => e.path === 'security.maxFileSize')).toBe(true);
    });

    it('should generate security warnings', () => {
      const config: KGMemoryConfig = {
        ...DEFAULT_CONFIG,
        security: {
          ...DEFAULT_CONFIG.security,
          enablePathValidation: false,
          enableSandbox: false
        }
      };

      const result = ConfigValidator.validate(config);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w => w.path === 'security.enablePathValidation')).toBe(true);
      expect(result.warnings.some(w => w.path === 'security.enableSandbox')).toBe(true);
    });

    it('should warn about in-memory database', () => {
      const config: KGMemoryConfig = {
        ...DEFAULT_CONFIG,
        database: {
          ...DEFAULT_CONFIG.database,
          path: ':memory:'
        }
      };

      const result = ConfigValidator.validate(config);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w => w.path === 'database.path')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle missing optional fields', () => {
      const config: KGMemoryConfig = {
        ...DEFAULT_CONFIG,
        server: {
          ...DEFAULT_CONFIG.server,
          port: undefined,
          host: undefined
        }
      };

      const result = ConfigValidator.validate(config);
      expect(result.isValid).toBe(true);
    });

    it('should validate configuration with only fallback providers', () => {
      const config: KGMemoryConfig = {
        ...DEFAULT_CONFIG,
        providers: {
          fallbacks: [
            {
              type: 'rule-based',
              provider: 'rule-based',
              config: {}
            }
          ],
          settings: DEFAULT_CONFIG.providers.settings
        }
      };

      const result = ConfigValidator.validate(config);
      expect(result.isValid).toBe(true);
    });

    it('should validate configuration with only primary provider', () => {
      const config: KGMemoryConfig = {
        ...DEFAULT_CONFIG,
        providers: {
          primary: {
            type: 'rule-based',
            provider: 'rule-based',
            config: {}
          },
          settings: DEFAULT_CONFIG.providers.settings
        }
      };

      const result = ConfigValidator.validate(config);
      expect(result.isValid).toBe(true);
    });
  });
});