import { KGMemoryConfig } from './config-schema.js';
import { platformDetector } from '../platform/platform-detector.js';
import { pathUtils } from '../platform/path-utils.js';

/**
 * Environment variable mappings for configuration
 */
export interface EnvironmentMapping {
  [key: string]: {
    path: string;
    type: 'string' | 'number' | 'boolean' | 'json';
    default?: any;
    required?: boolean;
  };
}

/**
 * Environment variable mappings
 */
export const ENVIRONMENT_MAPPINGS: EnvironmentMapping = {
  // Server configuration
  'KG_MEMORY_LOG_LEVEL': {
    path: 'server.logLevel',
    type: 'string',
    default: 'info'
  },
  'KG_MEMORY_PORT': {
    path: 'server.port',
    type: 'number'
  },
  'KG_MEMORY_HOST': {
    path: 'server.host',
    type: 'string'
  },

  // Database configuration
  'KG_MEMORY_DB_PATH': {
    path: 'database.path',
    type: 'string',
    default: './kg-memory.db'
  },
  'KG_MEMORY_DB_WAL': {
    path: 'database.enableWAL',
    type: 'boolean',
    default: true
  },

  // Provider configuration
  'KG_MEMORY_PROVIDER_TIMEOUT': {
    path: 'providers.settings.timeoutMs',
    type: 'number',
    default: 10000
  },
  'KG_MEMORY_PROVIDER_RETRIES': {
    path: 'providers.settings.maxRetries',
    type: 'number',
    default: 3
  },

  // OpenAI configuration
  'OPENAI_API_KEY': {
    path: 'providers.primary.config.apiKey',
    type: 'string'
  },
  'OPENAI_MODEL': {
    path: 'providers.primary.config.model',
    type: 'string',
    default: 'gpt-3.5-turbo'
  },
  'OPENAI_BASE_URL': {
    path: 'providers.primary.config.baseUrl',
    type: 'string'
  },

  // Anthropic configuration
  'ANTHROPIC_API_KEY': {
    path: 'providers.fallbacks.0.config.apiKey',
    type: 'string'
  },
  'ANTHROPIC_MODEL': {
    path: 'providers.fallbacks.0.config.model',
    type: 'string',
    default: 'claude-3-haiku-20240307'
  },

  // OpenRouter configuration
  'OPENROUTER_API_KEY': {
    path: 'providers.fallbacks.1.config.apiKey',
    type: 'string'
  },
  'OPENROUTER_MODEL': {
    path: 'providers.fallbacks.1.config.model',
    type: 'string',
    default: 'microsoft/wizardlm-2-8x22b'
  },

  // Ollama configuration
  'OLLAMA_BASE_URL': {
    path: 'providers.fallbacks.2.config.baseUrl',
    type: 'string',
    default: 'http://localhost:11434'
  },
  'OLLAMA_MODEL': {
    path: 'providers.fallbacks.2.config.model',
    type: 'string',
    default: 'llama2:7b'
  },

  // Context detection configuration
  'KG_MEMORY_CONFIDENCE_THRESHOLD': {
    path: 'contextDetection.confidenceThreshold',
    type: 'number',
    default: 0.6
  },
  'KG_MEMORY_ENABLE_SEMANTIC_SEARCH': {
    path: 'contextDetection.enableSemanticSearch',
    type: 'boolean',
    default: true
  },

  // Ranking configuration
  'KG_MEMORY_TOKEN_BUDGET': {
    path: 'ranking.tokenBudget',
    type: 'number',
    default: 4000
  },
  'KG_MEMORY_MAX_DIRECTIVES': {
    path: 'ranking.maxDirectives',
    type: 'number',
    default: 50
  },

  // Cache configuration
  'KG_MEMORY_CACHE_ENABLED': {
    path: 'cache.enabled',
    type: 'boolean',
    default: true
  },
  'KG_MEMORY_CACHE_SIZE': {
    path: 'cache.maxSize',
    type: 'number',
    default: 1000
  },
  'KG_MEMORY_CACHE_TTL': {
    path: 'cache.ttlSeconds',
    type: 'number',
    default: 3600
  },

  // Performance configuration
  'KG_MEMORY_QUERY_TIMEOUT': {
    path: 'performance.queryTimeoutMs',
    type: 'number',
    default: 5000
  },
  'KG_MEMORY_MAX_CONCURRENT_QUERIES': {
    path: 'performance.maxConcurrentQueries',
    type: 'number',
    default: 10
  },

  // Security configuration
  'KG_MEMORY_MAX_FILE_SIZE': {
    path: 'security.maxFileSize',
    type: 'number',
    default: 10485760 // 10MB
  },
  'KG_MEMORY_ENABLE_SANDBOX': {
    path: 'security.enableSandbox',
    type: 'boolean',
    default: true
  },

  // Development configuration
  'KG_MEMORY_DEBUG': {
    path: 'development.enableDebugMode',
    type: 'boolean',
    default: false
  },
  'KG_MEMORY_VERBOSE': {
    path: 'development.enableVerboseLogging',
    type: 'boolean',
    default: false
  },
  'KG_MEMORY_TEST_MODE': {
    path: 'development.enableTestMode',
    type: 'boolean',
    default: false
  }
};

/**
 * Environment configuration loader
 */
export class EnvironmentConfigLoader {
  /**
   * Load configuration from environment variables
   */
  static loadFromEnvironment(): Partial<KGMemoryConfig> {
    const config: any = {};

    for (const [envVar, mapping] of Object.entries(ENVIRONMENT_MAPPINGS)) {
      const value = process.env[envVar];
      
      if (value !== undefined) {
        const parsedValue = this.parseEnvironmentValue(value, mapping.type);
        this.setNestedProperty(config, mapping.path, parsedValue);
      } else if (mapping.default !== undefined) {
        this.setNestedProperty(config, mapping.path, mapping.default);
      }
    }

    // Add platform-specific configuration
    this.addPlatformConfiguration(config);

    return config;
  }

  /**
   * Validate required environment variables
   */
  static validateRequiredEnvironment(): string[] {
    const missing: string[] = [];

    for (const [envVar, mapping] of Object.entries(ENVIRONMENT_MAPPINGS)) {
      if (mapping.required && !process.env[envVar]) {
        missing.push(envVar);
      }
    }

    return missing;
  }

  /**
   * Get environment variable documentation
   */
  static getEnvironmentDocumentation(): Record<string, string> {
    const docs: Record<string, string> = {};

    for (const [envVar, mapping] of Object.entries(ENVIRONMENT_MAPPINGS)) {
      const required = mapping.required ? ' (required)' : '';
      const defaultValue = mapping.default !== undefined ? ` (default: ${mapping.default})` : '';
      docs[envVar] = `${mapping.path} - ${mapping.type}${required}${defaultValue}`;
    }

    return docs;
  }

  /**
   * Parse environment variable value based on type
   */
  private static parseEnvironmentValue(value: string, type: string): any {
    switch (type) {
      case 'string':
        return value;
      case 'number':
        const num = Number(value);
        if (isNaN(num)) {
          throw new Error(`Invalid number value: ${value}`);
        }
        return num;
      case 'boolean':
        return value.toLowerCase() === 'true' || value === '1';
      case 'json':
        try {
          return JSON.parse(value);
        } catch (error) {
          throw new Error(`Invalid JSON value: ${value}`);
        }
      default:
        return value;
    }
  }

  /**
   * Set nested property in object using dot notation
   */
  private static setNestedProperty(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      
      // Handle array indices
      if (/^\d+$/.test(key)) {
        const index = parseInt(key, 10);
        if (!Array.isArray(current)) {
          current = [];
        }
        if (!current[index]) {
          current[index] = {};
        }
        current = current[index];
      } else {
        if (!current[key]) {
          current[key] = {};
        }
        current = current[key];
      }
    }

    const lastKey = keys[keys.length - 1];
    current[lastKey] = value;
  }

  /**
   * Add platform-specific configuration
   */
  private static addPlatformConfiguration(config: any): void {
    const platformInfo = platformDetector.getPlatformInfo();
    
    if (!config.platform) {
      config.platform = {};
    }

    config.platform.pathSeparator = platformInfo.pathSeparator;
    config.platform.homeDirectory = platformInfo.homeDirectory;
    config.platform.configDirectory = pathUtils.getConfigDirectory();
    config.platform.dataDirectory = pathUtils.getDataDirectory();
    config.platform.cacheDirectory = pathUtils.getCacheDirectory();
    
    // Set platform-specific database path if not specified
    if (!config.database?.path || config.database.path === './kg-memory.db') {
      const dataDir = pathUtils.getDataDirectory();
      const dbPath = pathUtils.join(dataDir, 'kg-memory', 'kg-memory.db');
      
      if (!config.database) {
        config.database = {};
      }
      config.database.path = dbPath;
    }
  }

  /**
   * Generate environment file template
   */
  static generateEnvironmentTemplate(): string {
    const lines: string[] = [
      '# KG Memory Server Configuration',
      '# Copy this file to .env and customize as needed',
      '',
      '# Server Configuration',
      '# KG_MEMORY_LOG_LEVEL=info',
      '# KG_MEMORY_PORT=3000',
      '# KG_MEMORY_HOST=localhost',
      '',
      '# Database Configuration',
      '# KG_MEMORY_DB_PATH=./kg-memory.db',
      '# KG_MEMORY_DB_WAL=true',
      '',
      '# Model Provider Configuration',
      '# KG_MEMORY_PROVIDER_TIMEOUT=10000',
      '# KG_MEMORY_PROVIDER_RETRIES=3',
      '',
      '# OpenAI Configuration',
      '# OPENAI_API_KEY=your_openai_api_key_here',
      '# OPENAI_MODEL=gpt-3.5-turbo',
      '# OPENAI_BASE_URL=https://api.openai.com/v1',
      '',
      '# Anthropic Configuration',
      '# ANTHROPIC_API_KEY=your_anthropic_api_key_here',
      '# ANTHROPIC_MODEL=claude-3-haiku-20240307',
      '',
      '# OpenRouter Configuration',
      '# OPENROUTER_API_KEY=your_openrouter_api_key_here',
      '# OPENROUTER_MODEL=microsoft/wizardlm-2-8x22b',
      '',
      '# Ollama Configuration (for local models)',
      '# OLLAMA_BASE_URL=http://localhost:11434',
      '# OLLAMA_MODEL=llama2:7b',
      '',
      '# Context Detection Configuration',
      '# KG_MEMORY_CONFIDENCE_THRESHOLD=0.6',
      '# KG_MEMORY_ENABLE_SEMANTIC_SEARCH=true',
      '',
      '# Ranking Configuration',
      '# KG_MEMORY_TOKEN_BUDGET=4000',
      '# KG_MEMORY_MAX_DIRECTIVES=50',
      '',
      '# Cache Configuration',
      '# KG_MEMORY_CACHE_ENABLED=true',
      '# KG_MEMORY_CACHE_SIZE=1000',
      '# KG_MEMORY_CACHE_TTL=3600',
      '',
      '# Performance Configuration',
      '# KG_MEMORY_QUERY_TIMEOUT=5000',
      '# KG_MEMORY_MAX_CONCURRENT_QUERIES=10',
      '',
      '# Security Configuration',
      '# KG_MEMORY_MAX_FILE_SIZE=10485760',
      '# KG_MEMORY_ENABLE_SANDBOX=true',
      '',
      '# Development Configuration',
      '# KG_MEMORY_DEBUG=false',
      '# KG_MEMORY_VERBOSE=false',
      '# KG_MEMORY_TEST_MODE=false'
    ];

    return lines.join('\n');
  }
}