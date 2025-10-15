import { ModelProviderConfig } from '../types.js';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

/**
 * Configuration management for model providers
 */
export interface ProviderConfiguration {
  primary?: ModelProviderConfig;
  fallbacks?: ModelProviderConfig[];
  settings?: {
    healthCheckInterval?: number;
    maxRetries?: number;
    timeoutMs?: number;
  };
}

/**
 * Default provider configurations for different scenarios
 */
export const DEFAULT_CONFIGURATIONS: Record<string, ProviderConfiguration> = {
  // Cloud-first configuration with local fallback
  'cloud-primary': {
    primary: {
      type: 'cloud',
      provider: 'openai',
      config: {
        apiKey: '${OPENAI_API_KEY}',
        model: 'gpt-3.5-turbo',
        timeout: 3000
      }
    },
    fallbacks: [
      {
        type: 'cloud',
        provider: 'anthropic',
        config: {
          apiKey: '${ANTHROPIC_API_KEY}',
          model: 'claude-3-haiku-20240307',
          timeout: 3000
        }
      },
      {
        type: 'rule-based',
        provider: 'rule-based',
        config: {}
      }
    ]
  },

  // Local-first configuration with cloud fallback
  'local-primary': {
    primary: {
      type: 'local',
      provider: 'ollama',
      config: {
        baseUrl: 'http://localhost:11434',
        model: 'llama2:7b',
        timeout: 5000
      }
    },
    fallbacks: [
      {
        type: 'cloud',
        provider: 'openai',
        config: {
          apiKey: '${OPENAI_API_KEY}',
          model: 'gpt-3.5-turbo',
          timeout: 3000
        }
      },
      {
        type: 'rule-based',
        provider: 'rule-based',
        config: {}
      }
    ]
  },

  // Rule-based only (no external dependencies)
  'rule-based-only': {
    primary: {
      type: 'rule-based',
      provider: 'rule-based',
      config: {}
    },
    fallbacks: []
  },

  // Development configuration with multiple cloud providers
  'development': {
    primary: {
      type: 'cloud',
      provider: 'openai',
      config: {
        apiKey: '${OPENAI_API_KEY}',
        model: 'gpt-3.5-turbo',
        timeout: 3000
      }
    },
    fallbacks: [
      {
        type: 'cloud',
        provider: 'anthropic',
        config: {
          apiKey: '${ANTHROPIC_API_KEY}',
          model: 'claude-3-haiku-20240307',
          timeout: 3000
        }
      },
      {
        type: 'cloud',
        provider: 'openrouter',
        config: {
          apiKey: '${OPENROUTER_API_KEY}',
          model: 'microsoft/wizardlm-2-8x22b',
          timeout: 5000
        }
      },
      {
        type: 'local',
        provider: 'ollama',
        config: {
          baseUrl: 'http://localhost:11434',
          model: 'llama2:7b',
          timeout: 5000
        }
      },
      {
        type: 'rule-based',
        provider: 'rule-based',
        config: {}
      }
    ]
  }
};

/**
 * Configuration manager for model providers
 */
export class ProviderConfigManager {
  private configPath: string;
  private config: ProviderConfiguration;

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(process.cwd(), 'provider-config.json');
    this.config = {};
  }

  /**
   * Load configuration from file or use default
   */
  async loadConfiguration(defaultProfile?: string): Promise<ProviderConfiguration> {
    try {
      if (existsSync(this.configPath)) {
        const configData = await readFile(this.configPath, 'utf-8');
        this.config = JSON.parse(configData);
      } else if (defaultProfile && DEFAULT_CONFIGURATIONS[defaultProfile]) {
        this.config = DEFAULT_CONFIGURATIONS[defaultProfile];
      } else {
        // Use rule-based only as ultimate fallback
        this.config = DEFAULT_CONFIGURATIONS['rule-based-only'];
      }

      // Resolve environment variables
      this.config = this.resolveEnvironmentVariables(this.config);
      
      return this.config;
    } catch (error) {
      console.warn(`Failed to load provider configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Return rule-based fallback
      return DEFAULT_CONFIGURATIONS['rule-based-only'];
    }
  }

  /**
   * Save configuration to file
   */
  async saveConfiguration(config: ProviderConfiguration): Promise<void> {
    try {
      this.config = config;
      await writeFile(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
    } catch (error) {
      throw new Error(`Failed to save provider configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get current configuration
   */
  getConfiguration(): ProviderConfiguration {
    return this.config;
  }

  /**
   * Update primary provider configuration
   */
  async updatePrimaryProvider(config: ModelProviderConfig): Promise<void> {
    this.config.primary = config;
    await this.saveConfiguration(this.config);
  }

  /**
   * Add fallback provider configuration
   */
  async addFallbackProvider(config: ModelProviderConfig): Promise<void> {
    if (!this.config.fallbacks) {
      this.config.fallbacks = [];
    }
    
    // Remove existing provider with same name if exists
    this.config.fallbacks = this.config.fallbacks.filter(
      p => p.provider !== config.provider
    );
    
    this.config.fallbacks.push(config);
    await this.saveConfiguration(this.config);
  }

  /**
   * Remove fallback provider configuration
   */
  async removeFallbackProvider(providerName: string): Promise<void> {
    if (this.config.fallbacks) {
      this.config.fallbacks = this.config.fallbacks.filter(
        p => p.provider !== providerName
      );
      await this.saveConfiguration(this.config);
    }
  }

  /**
   * Resolve environment variables in configuration
   */
  private resolveEnvironmentVariables(config: ProviderConfiguration): ProviderConfiguration {
    const resolved = JSON.parse(JSON.stringify(config));
    
    const resolveInObject = (obj: any): void => {
      for (const key in obj) {
        if (typeof obj[key] === 'string' && obj[key].startsWith('${') && obj[key].endsWith('}')) {
          const envVar = obj[key].slice(2, -1);
          obj[key] = process.env[envVar] || obj[key];
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          resolveInObject(obj[key]);
        }
      }
    };

    resolveInObject(resolved);
    return resolved;
  }

  /**
   * Validate configuration
   */
  validateConfiguration(config: ProviderConfiguration): boolean {
    // Must have at least a primary provider or fallbacks
    if (!config.primary && (!config.fallbacks || config.fallbacks.length === 0)) {
      return false;
    }

    // Validate primary provider if exists
    if (config.primary && !this.validateProviderConfig(config.primary)) {
      return false;
    }

    // Validate fallback providers if exist
    if (config.fallbacks) {
      for (const fallback of config.fallbacks) {
        if (!this.validateProviderConfig(fallback)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Validate individual provider configuration
   */
  private validateProviderConfig(config: ModelProviderConfig): boolean {
    if (!config.type || !config.provider || !config.config) {
      return false;
    }

    if (!['local', 'cloud', 'rule-based'].includes(config.type)) {
      return false;
    }

    return true;
  }

  /**
   * Get available configuration profiles
   */
  static getAvailableProfiles(): string[] {
    return Object.keys(DEFAULT_CONFIGURATIONS);
  }

  /**
   * Create configuration from profile
   */
  static createFromProfile(profileName: string): ProviderConfiguration {
    const profile = DEFAULT_CONFIGURATIONS[profileName];
    if (!profile) {
      throw new Error(`Unknown configuration profile: ${profileName}`);
    }
    return JSON.parse(JSON.stringify(profile));
  }
}