import { ModelProviderConfig } from '../types.js';

/**
 * Complete application configuration schema
 */
export interface KGMemoryConfig {
  // Server configuration
  server: {
    name: string;
    version: string;
    port?: number;
    host?: string;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    enableMetrics: boolean;
  };

  // Database configuration
  database: {
    path: string;
    enableWAL: boolean;
    maxConnections: number;
    busyTimeout: number;
    pragmas: Record<string, string | number>;
  };

  // Model provider configuration
  providers: {
    primary?: ModelProviderConfig;
    fallbacks?: ModelProviderConfig[];
    settings: {
      healthCheckInterval: number;
      maxRetries: number;
      timeoutMs: number;
      enableFallback: boolean;
    };
  };

  // Context detection configuration
  contextDetection: {
    layerKeywords: Record<string, string[]>;
    topicKeywords: Record<string, string[]>;
    confidenceThreshold: number;
    enableSemanticSearch: boolean;
    maxKeywords: number;
  };

  // Ranking configuration
  ranking: {
    weights: {
      authority: number;
      whenToApply: number;
      layerMatch: number;
      topicOverlap: number;
      severityBoost: number;
      semanticSimilarity: number;
    };
    severityMultipliers: {
      MUST: number;
      SHOULD: number;
      MAY: number;
    };
    maxDirectives: number;
    tokenBudget: number;
  };

  // Cache configuration
  cache: {
    enabled: boolean;
    maxSize: number;
    ttlSeconds: number;
    enableQueryCache: boolean;
    enableEmbeddingCache: boolean;
    cleanupInterval: number;
  };

  // Performance configuration
  performance: {
    enableProfiling: boolean;
    enableBenchmarking: boolean;
    queryTimeoutMs: number;
    maxConcurrentQueries: number;
    enableMetrics: boolean;
  };

  // Platform-specific configuration
  platform: {
    pathSeparator?: string;
    homeDirectory?: string;
    configDirectory?: string;
    dataDirectory?: string;
    cacheDirectory?: string;
    tempDirectory?: string;
  };

  // Security configuration
  security: {
    enablePathValidation: boolean;
    allowedFileExtensions: string[];
    maxFileSize: number;
    enableSandbox: boolean;
  };

  // Development configuration
  development: {
    enableDebugMode: boolean;
    enableVerboseLogging: boolean;
    enableTestMode: boolean;
    mockProviders: boolean;
  };
}

/**
 * Environment-specific configuration profiles
 */
export interface ConfigProfile {
  name: string;
  description: string;
  config: Partial<KGMemoryConfig>;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: KGMemoryConfig = {
  server: {
    name: 'kg-memory-server',
    version: '1.0.0',
    logLevel: 'info',
    enableMetrics: true
  },

  database: {
    path: './kg-memory.db',
    enableWAL: true,
    maxConnections: 10,
    busyTimeout: 30000,
    pragmas: {
      journal_mode: 'WAL',
      synchronous: 'NORMAL',
      cache_size: -64000,
      foreign_keys: 1,
      temp_store: 'MEMORY'
    }
  },

  providers: {
    settings: {
      healthCheckInterval: 30000,
      maxRetries: 3,
      timeoutMs: 10000,
      enableFallback: true
    }
  },

  contextDetection: {
    layerKeywords: {
      '1-Presentation': ['UI', 'component', 'React', 'Vue', 'Angular', 'CSS', 'HTML', 'frontend', 'view', 'template'],
      '2-Application': ['service', 'controller', 'handler', 'middleware', 'API', 'endpoint', 'route', 'business logic'],
      '3-Domain': ['model', 'entity', 'aggregate', 'domain', 'business rule', 'validation', 'policy'],
      '4-Persistence': ['database', 'SQL', 'repository', 'ORM', 'query', 'migration', 'schema', 'storage'],
      '5-Infrastructure': ['config', 'deployment', 'Docker', 'Kubernetes', 'CI/CD', 'monitoring', 'logging']
    },
    topicKeywords: {
      security: ['auth', 'authentication', 'authorization', 'JWT', 'OAuth', 'security', 'encryption', 'hash'],
      testing: ['test', 'spec', 'mock', 'stub', 'unit test', 'integration test', 'e2e'],
      performance: ['performance', 'optimization', 'cache', 'benchmark', 'profiling', 'memory', 'CPU'],
      api: ['API', 'REST', 'GraphQL', 'endpoint', 'request', 'response', 'HTTP'],
      database: ['database', 'SQL', 'NoSQL', 'query', 'index', 'transaction', 'migration']
    },
    confidenceThreshold: 0.6,
    enableSemanticSearch: true,
    maxKeywords: 20
  },

  ranking: {
    weights: {
      authority: 10,
      whenToApply: 8,
      layerMatch: 7,
      topicOverlap: 5,
      severityBoost: 4,
      semanticSimilarity: 3
    },
    severityMultipliers: {
      MUST: 3.0,
      SHOULD: 2.0,
      MAY: 1.0
    },
    maxDirectives: 50,
    tokenBudget: 4000
  },

  cache: {
    enabled: true,
    maxSize: 1000,
    ttlSeconds: 3600,
    enableQueryCache: true,
    enableEmbeddingCache: true,
    cleanupInterval: 300000
  },

  performance: {
    enableProfiling: false,
    enableBenchmarking: false,
    queryTimeoutMs: 5000,
    maxConcurrentQueries: 10,
    enableMetrics: true
  },

  platform: {
    // Will be populated at runtime by platform detector
  },

  security: {
    enablePathValidation: true,
    allowedFileExtensions: ['.md', '.txt', '.json', '.yaml', '.yml'],
    maxFileSize: 10 * 1024 * 1024, // 10MB
    enableSandbox: true
  },

  development: {
    enableDebugMode: false,
    enableVerboseLogging: false,
    enableTestMode: false,
    mockProviders: false
  }
};

/**
 * Configuration profiles for different environments
 */
export const CONFIG_PROFILES: Record<string, ConfigProfile> = {
  production: {
    name: 'production',
    description: 'Production environment with optimized settings',
    config: {
      server: {
        logLevel: 'warn',
        enableMetrics: true
      },
      performance: {
        enableProfiling: false,
        enableBenchmarking: false,
        queryTimeoutMs: 3000,
        maxConcurrentQueries: 20
      },
      cache: {
        enabled: true,
        maxSize: 5000,
        ttlSeconds: 7200
      },
      development: {
        enableDebugMode: false,
        enableVerboseLogging: false,
        enableTestMode: false,
        mockProviders: false
      }
    }
  },

  development: {
    name: 'development',
    description: 'Development environment with debugging enabled',
    config: {
      server: {
        logLevel: 'debug',
        enableMetrics: true
      },
      performance: {
        enableProfiling: true,
        enableBenchmarking: true,
        queryTimeoutMs: 10000,
        maxConcurrentQueries: 5
      },
      cache: {
        enabled: true,
        maxSize: 500,
        ttlSeconds: 300
      },
      development: {
        enableDebugMode: true,
        enableVerboseLogging: true,
        enableTestMode: false,
        mockProviders: false
      }
    }
  },

  testing: {
    name: 'testing',
    description: 'Testing environment with mocked providers',
    config: {
      server: {
        logLevel: 'error',
        enableMetrics: false
      },
      database: {
        path: ':memory:',
        enableWAL: false
      },
      cache: {
        enabled: false,
        maxSize: 100,
        ttlSeconds: 60
      },
      development: {
        enableDebugMode: false,
        enableVerboseLogging: false,
        enableTestMode: true,
        mockProviders: true
      }
    }
  },

  minimal: {
    name: 'minimal',
    description: 'Minimal configuration with rule-based providers only',
    config: {
      providers: {
        primary: {
          type: 'rule-based',
          provider: 'rule-based',
          config: {}
        },
        fallbacks: [],
        settings: {
          healthCheckInterval: 60000,
          maxRetries: 1,
          timeoutMs: 5000,
          enableFallback: false
        }
      },
      contextDetection: {
        enableSemanticSearch: false
      },
      cache: {
        enabled: false
      },
      performance: {
        enableProfiling: false,
        enableBenchmarking: false,
        enableMetrics: false
      }
    }
  }
};