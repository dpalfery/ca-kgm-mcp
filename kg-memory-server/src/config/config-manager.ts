import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import { KGMemoryConfig, DEFAULT_CONFIG, CONFIG_PROFILES, ConfigProfile } from './config-schema.js';
import { EnvironmentConfigLoader } from './environment-config.js';
import { ConfigValidator, ValidationResult } from './config-validator.js';
import { pathUtils } from '../platform/path-utils.js';
import { fileSystem } from '../platform/file-system-utils.js';

/**
 * Configuration source types
 */
export type ConfigSource = 'default' | 'file' | 'environment' | 'profile' | 'override';

/**
 * Configuration loading options
 */
export interface ConfigLoadOptions {
  configPath?: string;
  profile?: string;
  validateConfig?: boolean;
  createDefaultConfig?: boolean;
  overrides?: Partial<KGMemoryConfig>;
}

/**
 * Configuration manager for the KG Memory system
 */
export class ConfigManager {
  private config: KGMemoryConfig;
  private configPath: string;
  private loadedSources: ConfigSource[] = [];

  constructor(options: ConfigLoadOptions = {}) {
    this.configPath = options.configPath || this.getDefaultConfigPath();
    this.config = { ...DEFAULT_CONFIG };
  }

  /**
   * Load configuration from all sources
   */
  async loadConfiguration(options: ConfigLoadOptions = {}): Promise<KGMemoryConfig> {
    this.loadedSources = [];

    // 1. Start with default configuration
    this.config = { ...DEFAULT_CONFIG };
    this.loadedSources.push('default');

    // 2. Apply profile configuration if specified
    if (options.profile) {
      await this.applyProfile(options.profile);
    }

    // 3. Load from configuration file if exists
    await this.loadFromFile(options.configPath);

    // 4. Apply environment variables
    this.applyEnvironmentConfig();

    // 5. Apply overrides if provided
    if (options.overrides) {
      this.applyOverrides(options.overrides);
    }

    // 6. Validate configuration if requested
    if (options.validateConfig !== false) {
      const validation = this.validateConfiguration();
      if (!validation.isValid) {
        throw new Error(`Configuration validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
      }
    }

    // 7. Create default config file if requested and doesn't exist
    if (options.createDefaultConfig && !existsSync(this.configPath)) {
      await this.saveConfiguration();
    }

    return this.config;
  }

  /**
   * Get current configuration
   */
  getConfiguration(): KGMemoryConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  async updateConfiguration(updates: Partial<KGMemoryConfig>): Promise<void> {
    this.config = this.mergeConfigurations(this.config, updates);
    await this.saveConfiguration();
  }

  /**
   * Save configuration to file
   */
  async saveConfiguration(path?: string): Promise<void> {
    const targetPath = path || this.configPath;
    
    // Ensure directory exists
    await fileSystem.ensureDirectory(pathUtils.dirname(targetPath));
    
    // Save configuration
    const configJson = JSON.stringify(this.config, null, 2);
    await fileSystem.writeFile(targetPath, configJson);
  }

  /**
   * Load configuration from file
   */
  private async loadFromFile(configPath?: string): Promise<void> {
    const filePath = configPath || this.configPath;
    
    if (await fileSystem.exists(filePath)) {
      try {
        const configData = await fileSystem.readFile(filePath, 'utf8');
        const fileConfig = JSON.parse(configData as string);
        this.config = this.mergeConfigurations(this.config, fileConfig);
        this.loadedSources.push('file');
      } catch (error) {
        console.warn(`Failed to load configuration from ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Apply profile configuration
   */
  private async applyProfile(profileName: string): Promise<void> {
    const profile = CONFIG_PROFILES[profileName];
    if (!profile) {
      throw new Error(`Unknown configuration profile: ${profileName}`);
    }

    this.config = this.mergeConfigurations(this.config, profile.config);
    this.loadedSources.push('profile');
  }

  /**
   * Apply environment configuration
   */
  private applyEnvironmentConfig(): void {
    const envConfig = EnvironmentConfigLoader.loadFromEnvironment();
    this.config = this.mergeConfigurations(this.config, envConfig);
    this.loadedSources.push('environment');
  }

  /**
   * Apply configuration overrides
   */
  private applyOverrides(overrides: Partial<KGMemoryConfig>): void {
    this.config = this.mergeConfigurations(this.config, overrides);
    this.loadedSources.push('override');
  }

  /**
   * Validate current configuration
   */
  validateConfiguration(): ValidationResult {
    return ConfigValidator.validate(this.config);
  }

  /**
   * Get configuration sources that were loaded
   */
  getLoadedSources(): ConfigSource[] {
    return [...this.loadedSources];
  }

  /**
   * Get default configuration path
   */
  private getDefaultConfigPath(): string {
    const configDir = pathUtils.getConfigDirectory();
    return pathUtils.join(configDir, 'kg-memory', 'config.json');
  }

  /**
   * Deep merge two configuration objects
   */
  private mergeConfigurations(base: any, override: any): any {
    const result = { ...base };

    for (const key in override) {
      if (override[key] !== undefined) {
        if (typeof override[key] === 'object' && 
            override[key] !== null && 
            !Array.isArray(override[key]) &&
            typeof base[key] === 'object' && 
            base[key] !== null && 
            !Array.isArray(base[key])) {
          result[key] = this.mergeConfigurations(base[key], override[key]);
        } else {
          result[key] = override[key];
        }
      }
    }

    return result;
  }

  /**
   * Reset configuration to defaults
   */
  resetToDefaults(): void {
    this.config = { ...DEFAULT_CONFIG };
    this.loadedSources = ['default'];
  }

  /**
   * Get available configuration profiles
   */
  static getAvailableProfiles(): ConfigProfile[] {
    return Object.values(CONFIG_PROFILES);
  }

  /**
   * Create configuration manager with profile
   */
  static async createWithProfile(profileName: string, options: ConfigLoadOptions = {}): Promise<ConfigManager> {
    const manager = new ConfigManager(options);
    await manager.loadConfiguration({ ...options, profile: profileName });
    return manager;
  }

  /**
   * Create configuration manager for testing
   */
  static createForTesting(overrides: Partial<KGMemoryConfig> = {}): ConfigManager {
    const manager = new ConfigManager();
    manager.config = manager.mergeConfigurations(DEFAULT_CONFIG, {
      ...CONFIG_PROFILES.testing.config,
      ...overrides
    });
    manager.loadedSources = ['default', 'profile', 'override'];
    return manager;
  }

  /**
   * Generate configuration template
   */
  static generateConfigTemplate(): string {
    const template = {
      $schema: 'https://kg-memory-server.example.com/config-schema.json',
      ...DEFAULT_CONFIG
    };

    return JSON.stringify(template, null, 2);
  }

  /**
   * Export configuration for backup
   */
  exportConfiguration(): string {
    return JSON.stringify({
      config: this.config,
      sources: this.loadedSources,
      timestamp: new Date().toISOString()
    }, null, 2);
  }

  /**
   * Import configuration from backup
   */
  async importConfiguration(backupData: string): Promise<void> {
    try {
      const backup = JSON.parse(backupData);
      
      if (!backup.config) {
        throw new Error('Invalid backup format: missing config');
      }

      // Validate imported configuration
      const validation = ConfigValidator.validate(backup.config);
      if (!validation.isValid) {
        throw new Error(`Invalid configuration: ${validation.errors.map(e => e.message).join(', ')}`);
      }

      this.config = backup.config;
      this.loadedSources = backup.sources || ['override'];
      
      await this.saveConfiguration();
    } catch (error) {
      throw new Error(`Failed to import configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get configuration summary for debugging
   */
  getConfigurationSummary(): Record<string, any> {
    return {
      sources: this.loadedSources,
      configPath: this.configPath,
      server: {
        name: this.config.server.name,
        version: this.config.server.version,
        logLevel: this.config.server.logLevel
      },
      database: {
        path: this.config.database.path,
        enableWAL: this.config.database.enableWAL
      },
      providers: {
        primary: this.config.providers.primary?.provider || 'none',
        fallbacks: this.config.providers.fallbacks?.length || 0
      },
      cache: {
        enabled: this.config.cache.enabled,
        maxSize: this.config.cache.maxSize
      },
      development: {
        debugMode: this.config.development.enableDebugMode,
        testMode: this.config.development.enableTestMode
      }
    };
  }
}