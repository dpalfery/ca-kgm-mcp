import { ModelProvider, ModelProviderFactory, ProviderHealthInfo } from '../interfaces/model-provider.js';
import { ModelProviderConfig, ErrorType } from '../types.js';
import { RuleBasedProvider } from './rule-based-provider.js';
import { OpenAIProvider } from './openai-provider.js';
import { AnthropicProvider } from './anthropic-provider.js';
import { OpenRouterProvider } from './openrouter-provider.js';
import { OpenAICompatibleProvider } from './openai-compatible-provider.js';
import { OllamaProvider } from './ollama-provider.js';

// Provider constructor type
type ProviderConstructor = new (config: any) => ModelProvider;

/**
 * Factory for creating model provider instances based on configuration
 */
export class DefaultModelProviderFactory implements ModelProviderFactory {
  private readonly providerRegistry = new Map<string, ProviderConstructor>();

  constructor() {
    // Register available provider types
    this.registerProvider('rule-based', RuleBasedProvider);
    this.registerProvider('openai', OpenAIProvider);
    this.registerProvider('anthropic', AnthropicProvider);
    this.registerProvider('openrouter', OpenRouterProvider);
    this.registerProvider('openai-compatible', OpenAICompatibleProvider);
    this.registerProvider('ollama', OllamaProvider);
  }

  /**
   * Register a new provider type
   */
  registerProvider(name: string, providerClass: ProviderConstructor): void {
    this.providerRegistry.set(name, providerClass);
  }

  /**
   * Register multiple providers at once
   */
  registerProviders(providers: Record<string, ProviderConstructor>): void {
    for (const [name, providerClass] of Object.entries(providers)) {
      this.registerProvider(name, providerClass);
    }
  }

  /**
   * Create a provider instance from configuration
   */
  async createProvider(config: ModelProviderConfig): Promise<ModelProvider> {
    if (!this.validateConfig(config)) {
      throw new Error(`Invalid configuration for provider: ${config.provider}`);
    }

    const ProviderClass = this.providerRegistry.get(config.provider);
    if (!ProviderClass) {
      throw new Error(`Provider type '${config.provider}' is not registered. Available providers: ${this.getAvailableProviders().join(', ')}`);
    }

    try {
      // Create instance using the provider class constructor
      const provider = new ProviderClass(config.config);
      
      // Verify the provider is available
      const isAvailable = await provider.isAvailable();
      if (!isAvailable) {
        throw new Error(`Provider ${config.provider} is not available`);
      }

      return provider;
    } catch (error) {
      throw new Error(`Failed to create provider ${config.provider}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List available provider types
   */
  getAvailableProviders(): string[] {
    return Array.from(this.providerRegistry.keys());
  }

  /**
   * Validate provider configuration
   */
  validateConfig(config: ModelProviderConfig): boolean {
    if (!config || typeof config !== 'object') {
      return false;
    }

    if (!config.type || !config.provider || !config.config) {
      return false;
    }

    if (!['local', 'cloud', 'rule-based'].includes(config.type)) {
      return false;
    }

    // Provider-specific validation
    return this.validateProviderSpecificConfig(config);
  }

  /**
   * Validate provider-specific configuration requirements
   */
  private validateProviderSpecificConfig(config: ModelProviderConfig): boolean {
    switch (config.provider) {
      case 'rule-based':
        // Rule-based provider requires no external configuration
        return true;

      case 'openai':
        return this.validateCloudProviderConfig(config, ['apiKey']);

      case 'anthropic':
        return this.validateCloudProviderConfig(config, ['apiKey']);

      case 'openrouter':
        return this.validateCloudProviderConfig(config, ['apiKey']);

      case 'ollama':
        return this.validateLocalProviderConfig(config, ['baseUrl']);

      default:
        // For unknown providers (like test mocks), just check if they're registered
        return this.providerRegistry.has(config.provider);
    }
  }

  /**
   * Validate cloud provider configuration
   */
  private validateCloudProviderConfig(config: ModelProviderConfig, requiredFields: string[]): boolean {
    if (config.type !== 'cloud') {
      return false;
    }

    return requiredFields.every(field => 
      config.config[field] && typeof config.config[field] === 'string'
    );
  }

  /**
   * Validate local provider configuration
   */
  private validateLocalProviderConfig(config: ModelProviderConfig, requiredFields: string[]): boolean {
    if (config.type !== 'local') {
      return false;
    }

    return requiredFields.every(field => 
      config.config[field] && typeof config.config[field] === 'string'
    );
  }
}