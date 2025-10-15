import { KGMemoryConfig } from './config-schema.js';

/**
 * Configuration validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Configuration validation error
 */
export interface ValidationError {
  path: string;
  message: string;
  value?: any;
}

/**
 * Configuration validation warning
 */
export interface ValidationWarning {
  path: string;
  message: string;
  value?: any;
}

/**
 * Configuration validator
 */
export class ConfigValidator {
  /**
   * Validate complete configuration
   */
  static validate(config: KGMemoryConfig): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate server configuration
    this.validateServer(config.server, errors, warnings);

    // Validate database configuration
    this.validateDatabase(config.database, errors, warnings);

    // Validate provider configuration
    this.validateProviders(config.providers, errors, warnings);

    // Validate context detection configuration
    this.validateContextDetection(config.contextDetection, errors, warnings);

    // Validate ranking configuration
    this.validateRanking(config.ranking, errors, warnings);

    // Validate cache configuration
    this.validateCache(config.cache, errors, warnings);

    // Validate performance configuration
    this.validatePerformance(config.performance, errors, warnings);

    // Validate security configuration
    this.validateSecurity(config.security, errors, warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate server configuration
   */
  private static validateServer(
    server: KGMemoryConfig['server'],
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (!server.name || typeof server.name !== 'string') {
      errors.push({
        path: 'server.name',
        message: 'Server name must be a non-empty string',
        value: server.name
      });
    }

    if (!server.version || typeof server.version !== 'string') {
      errors.push({
        path: 'server.version',
        message: 'Server version must be a non-empty string',
        value: server.version
      });
    }

    if (server.port !== undefined) {
      if (typeof server.port !== 'number' || server.port < 1 || server.port > 65535) {
        errors.push({
          path: 'server.port',
          message: 'Server port must be a number between 1 and 65535',
          value: server.port
        });
      }
    }

    if (!['debug', 'info', 'warn', 'error'].includes(server.logLevel)) {
      errors.push({
        path: 'server.logLevel',
        message: 'Log level must be one of: debug, info, warn, error',
        value: server.logLevel
      });
    }
  }

  /**
   * Validate database configuration
   */
  private static validateDatabase(
    database: KGMemoryConfig['database'],
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (!database.path || typeof database.path !== 'string') {
      errors.push({
        path: 'database.path',
        message: 'Database path must be a non-empty string',
        value: database.path
      });
    }

    if (typeof database.maxConnections !== 'number' || database.maxConnections < 1) {
      errors.push({
        path: 'database.maxConnections',
        message: 'Max connections must be a positive number',
        value: database.maxConnections
      });
    }

    if (typeof database.busyTimeout !== 'number' || database.busyTimeout < 0) {
      errors.push({
        path: 'database.busyTimeout',
        message: 'Busy timeout must be a non-negative number',
        value: database.busyTimeout
      });
    }

    // Warn about in-memory database in production
    if (database.path === ':memory:') {
      warnings.push({
        path: 'database.path',
        message: 'Using in-memory database - data will not persist',
        value: database.path
      });
    }
  }

  /**
   * Validate provider configuration
   */
  private static validateProviders(
    providers: KGMemoryConfig['providers'],
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // Must have at least primary or fallbacks
    if (!providers.primary && (!providers.fallbacks || providers.fallbacks.length === 0)) {
      errors.push({
        path: 'providers',
        message: 'Must have at least a primary provider or fallback providers'
      });
    }

    // Validate primary provider
    if (providers.primary) {
      this.validateProviderConfig(providers.primary, 'providers.primary', errors, warnings);
    }

    // Validate fallback providers
    if (providers.fallbacks && Array.isArray(providers.fallbacks)) {
      providers.fallbacks.forEach((provider, index) => {
        this.validateProviderConfig(provider, `providers.fallbacks[${index}]`, errors, warnings);
      });
    }

    // Validate settings
    const settings = providers.settings;
    if (typeof settings.healthCheckInterval !== 'number' || settings.healthCheckInterval < 1000) {
      errors.push({
        path: 'providers.settings.healthCheckInterval',
        message: 'Health check interval must be at least 1000ms',
        value: settings.healthCheckInterval
      });
    }

    if (typeof settings.maxRetries !== 'number' || settings.maxRetries < 0) {
      errors.push({
        path: 'providers.settings.maxRetries',
        message: 'Max retries must be a non-negative number',
        value: settings.maxRetries
      });
    }

    if (typeof settings.timeoutMs !== 'number' || settings.timeoutMs < 1000) {
      errors.push({
        path: 'providers.settings.timeoutMs',
        message: 'Timeout must be at least 1000ms',
        value: settings.timeoutMs
      });
    }
  }

  /**
   * Validate individual provider configuration
   */
  private static validateProviderConfig(
    provider: any,
    path: string,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (!provider.type || !['local', 'cloud', 'rule-based'].includes(provider.type)) {
      errors.push({
        path: `${path}.type`,
        message: 'Provider type must be one of: local, cloud, rule-based',
        value: provider.type
      });
    }

    if (!provider.provider || typeof provider.provider !== 'string') {
      errors.push({
        path: `${path}.provider`,
        message: 'Provider name must be a non-empty string',
        value: provider.provider
      });
    }

    if (!provider.config || typeof provider.config !== 'object') {
      errors.push({
        path: `${path}.config`,
        message: 'Provider config must be an object',
        value: provider.config
      });
    }

    // Validate cloud provider API keys
    if (provider.type === 'cloud' && provider.config) {
      if (!provider.config.apiKey) {
        warnings.push({
          path: `${path}.config.apiKey`,
          message: 'Cloud provider should have an API key configured'
        });
      }
    }
  }

  /**
   * Validate context detection configuration
   */
  private static validateContextDetection(
    contextDetection: KGMemoryConfig['contextDetection'],
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (typeof contextDetection.confidenceThreshold !== 'number' || 
        contextDetection.confidenceThreshold < 0 || 
        contextDetection.confidenceThreshold > 1) {
      errors.push({
        path: 'contextDetection.confidenceThreshold',
        message: 'Confidence threshold must be a number between 0 and 1',
        value: contextDetection.confidenceThreshold
      });
    }

    if (typeof contextDetection.maxKeywords !== 'number' || contextDetection.maxKeywords < 1) {
      errors.push({
        path: 'contextDetection.maxKeywords',
        message: 'Max keywords must be a positive number',
        value: contextDetection.maxKeywords
      });
    }

    // Validate layer keywords
    if (!contextDetection.layerKeywords || typeof contextDetection.layerKeywords !== 'object') {
      errors.push({
        path: 'contextDetection.layerKeywords',
        message: 'Layer keywords must be an object',
        value: contextDetection.layerKeywords
      });
    }

    // Validate topic keywords
    if (!contextDetection.topicKeywords || typeof contextDetection.topicKeywords !== 'object') {
      errors.push({
        path: 'contextDetection.topicKeywords',
        message: 'Topic keywords must be an object',
        value: contextDetection.topicKeywords
      });
    }
  }

  /**
   * Validate ranking configuration
   */
  private static validateRanking(
    ranking: KGMemoryConfig['ranking'],
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // Validate weights
    const weights = ranking.weights;
    for (const [key, value] of Object.entries(weights)) {
      if (typeof value !== 'number' || value < 0) {
        errors.push({
          path: `ranking.weights.${key}`,
          message: 'Weight must be a non-negative number',
          value
        });
      }
    }

    // Validate severity multipliers
    const multipliers = ranking.severityMultipliers;
    for (const [key, value] of Object.entries(multipliers)) {
      if (typeof value !== 'number' || value < 0) {
        errors.push({
          path: `ranking.severityMultipliers.${key}`,
          message: 'Severity multiplier must be a non-negative number',
          value
        });
      }
    }

    if (typeof ranking.maxDirectives !== 'number' || ranking.maxDirectives < 1) {
      errors.push({
        path: 'ranking.maxDirectives',
        message: 'Max directives must be a positive number',
        value: ranking.maxDirectives
      });
    }

    if (typeof ranking.tokenBudget !== 'number' || ranking.tokenBudget < 100) {
      errors.push({
        path: 'ranking.tokenBudget',
        message: 'Token budget must be at least 100',
        value: ranking.tokenBudget
      });
    }
  }

  /**
   * Validate cache configuration
   */
  private static validateCache(
    cache: KGMemoryConfig['cache'],
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (typeof cache.maxSize !== 'number' || cache.maxSize < 1) {
      errors.push({
        path: 'cache.maxSize',
        message: 'Cache max size must be a positive number',
        value: cache.maxSize
      });
    }

    if (typeof cache.ttlSeconds !== 'number' || cache.ttlSeconds < 1) {
      errors.push({
        path: 'cache.ttlSeconds',
        message: 'Cache TTL must be a positive number',
        value: cache.ttlSeconds
      });
    }

    if (typeof cache.cleanupInterval !== 'number' || cache.cleanupInterval < 1000) {
      errors.push({
        path: 'cache.cleanupInterval',
        message: 'Cache cleanup interval must be at least 1000ms',
        value: cache.cleanupInterval
      });
    }
  }

  /**
   * Validate performance configuration
   */
  private static validatePerformance(
    performance: KGMemoryConfig['performance'],
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (typeof performance.queryTimeoutMs !== 'number' || performance.queryTimeoutMs < 100) {
      errors.push({
        path: 'performance.queryTimeoutMs',
        message: 'Query timeout must be at least 100ms',
        value: performance.queryTimeoutMs
      });
    }

    if (typeof performance.maxConcurrentQueries !== 'number' || performance.maxConcurrentQueries < 1) {
      errors.push({
        path: 'performance.maxConcurrentQueries',
        message: 'Max concurrent queries must be a positive number',
        value: performance.maxConcurrentQueries
      });
    }
  }

  /**
   * Validate security configuration
   */
  private static validateSecurity(
    security: KGMemoryConfig['security'],
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (!Array.isArray(security.allowedFileExtensions)) {
      errors.push({
        path: 'security.allowedFileExtensions',
        message: 'Allowed file extensions must be an array',
        value: security.allowedFileExtensions
      });
    }

    if (typeof security.maxFileSize !== 'number' || security.maxFileSize < 1) {
      errors.push({
        path: 'security.maxFileSize',
        message: 'Max file size must be a positive number',
        value: security.maxFileSize
      });
    }

    // Warn about disabled security features
    if (!security.enablePathValidation) {
      warnings.push({
        path: 'security.enablePathValidation',
        message: 'Path validation is disabled - this may be a security risk'
      });
    }

    if (!security.enableSandbox) {
      warnings.push({
        path: 'security.enableSandbox',
        message: 'Sandbox is disabled - this may be a security risk'
      });
    }
  }
}