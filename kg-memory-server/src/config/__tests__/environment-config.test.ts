import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EnvironmentConfigLoader, ENVIRONMENT_MAPPINGS } from '../environment-config.js';

describe('EnvironmentConfigLoader', () => {
  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    // Save original environment
    originalEnv = {};
    for (const envVar of Object.keys(ENVIRONMENT_MAPPINGS)) {
      originalEnv[envVar] = process.env[envVar];
    }
  });

  afterEach(() => {
    // Restore original environment
    for (const [envVar, originalValue] of Object.entries(originalEnv)) {
      if (originalValue !== undefined) {
        process.env[envVar] = originalValue;
      } else {
        delete process.env[envVar];
      }
    }
  });

  describe('loadFromEnvironment', () => {
    it('should load configuration from environment variables', () => {
      process.env.KG_MEMORY_LOG_LEVEL = 'debug';
      process.env.KG_MEMORY_DB_PATH = '/custom/path/db.sqlite';
      process.env.KG_MEMORY_CACHE_ENABLED = 'false';
      process.env.KG_MEMORY_TOKEN_BUDGET = '5000';

      const config = EnvironmentConfigLoader.loadFromEnvironment();

      expect(config.server?.logLevel).toBe('debug');
      expect(config.database?.path).toBe('/custom/path/db.sqlite');
      expect(config.cache?.enabled).toBe(false);
      expect(config.ranking?.tokenBudget).toBe(5000);
    });

    it('should use default values when environment variables are not set', () => {
      // Clear all environment variables
      for (const envVar of Object.keys(ENVIRONMENT_MAPPINGS)) {
        delete process.env[envVar];
      }

      const config = EnvironmentConfigLoader.loadFromEnvironment();

      expect(config.server?.logLevel).toBe('info');
      expect(config.database?.path).toBe('./kg-memory.db');
      expect(config.cache?.enabled).toBe(true);
    });

    it('should handle boolean environment variables', () => {
      process.env.KG_MEMORY_CACHE_ENABLED = 'true';
      process.env.KG_MEMORY_ENABLE_SEMANTIC_SEARCH = 'false';
      process.env.KG_MEMORY_DEBUG = '1';

      const config = EnvironmentConfigLoader.loadFromEnvironment();

      expect(config.cache?.enabled).toBe(true);
      expect(config.contextDetection?.enableSemanticSearch).toBe(false);
      expect(config.development?.enableDebugMode).toBe(true);
    });

    it('should handle number environment variables', () => {
      process.env.KG_MEMORY_PORT = '8080';
      process.env.KG_MEMORY_TOKEN_BUDGET = '3000';
      process.env.KG_MEMORY_CACHE_SIZE = '2000';

      const config = EnvironmentConfigLoader.loadFromEnvironment();

      expect(config.server?.port).toBe(8080);
      expect(config.ranking?.tokenBudget).toBe(3000);
      expect(config.cache?.maxSize).toBe(2000);
    });

    it('should handle nested configuration paths', () => {
      process.env.OPENAI_API_KEY = 'test-api-key';
      process.env.OPENAI_MODEL = 'gpt-4';
      process.env.ANTHROPIC_API_KEY = 'anthropic-key';

      const config = EnvironmentConfigLoader.loadFromEnvironment();

      expect(config.providers?.primary?.config?.apiKey).toBe('test-api-key');
      expect(config.providers?.primary?.config?.model).toBe('gpt-4');
      expect(config.providers?.fallbacks?.[0]?.config?.apiKey).toBe('anthropic-key');
    });

    it('should include platform-specific configuration', () => {
      const config = EnvironmentConfigLoader.loadFromEnvironment();

      expect(config.platform).toBeDefined();
      expect(config.platform?.pathSeparator).toBeDefined();
      expect(config.platform?.homeDirectory).toBeDefined();
      expect(config.platform?.configDirectory).toBeDefined();
    });

    it('should set platform-specific database path', () => {
      delete process.env.KG_MEMORY_DB_PATH;

      const config = EnvironmentConfigLoader.loadFromEnvironment();

      expect(config.database?.path).toBeDefined();
      expect(config.database?.path).not.toBe('./kg-memory.db');
      expect(config.database?.path).toContain('kg-memory');
    });
  });

  describe('validateRequiredEnvironment', () => {
    it('should return empty array when no required variables are missing', () => {
      const missing = EnvironmentConfigLoader.validateRequiredEnvironment();
      expect(missing).toEqual([]);
    });

    it('should return missing required variables', () => {
      // Modify mappings to make some variables required for testing
      const originalMapping = ENVIRONMENT_MAPPINGS['KG_MEMORY_LOG_LEVEL'];
      ENVIRONMENT_MAPPINGS['KG_MEMORY_LOG_LEVEL'] = { ...originalMapping, required: true };
      
      delete process.env.KG_MEMORY_LOG_LEVEL;

      try {
        const missing = EnvironmentConfigLoader.validateRequiredEnvironment();
        expect(missing).toContain('KG_MEMORY_LOG_LEVEL');
      } finally {
        // Restore original mapping
        ENVIRONMENT_MAPPINGS['KG_MEMORY_LOG_LEVEL'] = originalMapping;
      }
    });
  });

  describe('getEnvironmentDocumentation', () => {
    it('should return documentation for all environment variables', () => {
      const docs = EnvironmentConfigLoader.getEnvironmentDocumentation();

      expect(Object.keys(docs)).toHaveLength(Object.keys(ENVIRONMENT_MAPPINGS).length);
      expect(docs['KG_MEMORY_LOG_LEVEL']).toContain('server.logLevel');
      expect(docs['KG_MEMORY_LOG_LEVEL']).toContain('string');
      expect(docs['KG_MEMORY_LOG_LEVEL']).toContain('default: info');
    });

    it('should indicate required variables', () => {
      // Modify mappings to make a variable required for testing
      const originalMapping = ENVIRONMENT_MAPPINGS['KG_MEMORY_LOG_LEVEL'];
      ENVIRONMENT_MAPPINGS['KG_MEMORY_LOG_LEVEL'] = { ...originalMapping, required: true };

      try {
        const docs = EnvironmentConfigLoader.getEnvironmentDocumentation();
        expect(docs['KG_MEMORY_LOG_LEVEL']).toContain('(required)');
      } finally {
        // Restore original mapping
        ENVIRONMENT_MAPPINGS['KG_MEMORY_LOG_LEVEL'] = originalMapping;
      }
    });
  });

  describe('generateEnvironmentTemplate', () => {
    it('should generate environment template', () => {
      const template = EnvironmentConfigLoader.generateEnvironmentTemplate();

      expect(template).toContain('# KG Memory Server Configuration');
      expect(template).toContain('# KG_MEMORY_LOG_LEVEL=info');
      expect(template).toContain('# OPENAI_API_KEY=your_openai_api_key_here');
      expect(template).toContain('# ANTHROPIC_API_KEY=your_anthropic_api_key_here');
      expect(template).toContain('# OLLAMA_BASE_URL=http://localhost:11434');
    });

    it('should include all environment variables in template', () => {
      const template = EnvironmentConfigLoader.generateEnvironmentTemplate();

      for (const envVar of Object.keys(ENVIRONMENT_MAPPINGS)) {
        expect(template).toContain(envVar);
      }
    });
  });

  describe('error handling', () => {
    it('should throw error for invalid number values', () => {
      process.env.KG_MEMORY_PORT = 'not-a-number';

      expect(() => {
        EnvironmentConfigLoader.loadFromEnvironment();
      }).toThrow('Invalid number value: not-a-number');
    });

    it('should throw error for invalid JSON values', () => {
      // Add a JSON mapping for testing
      const originalMappings = { ...ENVIRONMENT_MAPPINGS };
      ENVIRONMENT_MAPPINGS['TEST_JSON'] = {
        path: 'test.json',
        type: 'json'
      };

      process.env.TEST_JSON = 'invalid-json';

      try {
        expect(() => {
          EnvironmentConfigLoader.loadFromEnvironment();
        }).toThrow('Invalid JSON value: invalid-json');
      } finally {
        // Restore original mappings
        Object.assign(ENVIRONMENT_MAPPINGS, originalMappings);
        delete process.env.TEST_JSON;
      }
    });
  });
});