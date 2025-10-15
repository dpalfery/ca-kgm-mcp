import { ModelProvider, ModelProviderManager, ModelProviderFactory, ProviderHealthInfo } from '../interfaces/model-provider.js';
import { ModelProviderConfig, TaskContext, ErrorType } from '../types.js';
import { DefaultModelProviderFactory } from './model-provider-factory.js';

/**
 * Configuration for the provider manager
 */
export interface ProviderManagerConfig {
  primaryProvider?: ModelProviderConfig;
  fallbackProviders?: ModelProviderConfig[];
  healthCheckInterval?: number; // milliseconds
  maxRetries?: number;
  timeoutMs?: number;
}

/**
 * Manages multiple model providers with automatic fallback capabilities
 */
export class DefaultModelProviderManager implements ModelProviderManager {
  private primaryProvider?: ModelProvider;
  private fallbackProviders: ModelProvider[] = [];
  private factory: ModelProviderFactory;
  private healthCheckInterval: number;
  private maxRetries: number;
  private timeoutMs: number;
  private healthCheckTimer?: NodeJS.Timeout;
  private providerHealth = new Map<string, ProviderHealthInfo>();

  constructor(
    config: ProviderManagerConfig = {},
    factory?: ModelProviderFactory
  ) {
    this.factory = factory || new DefaultModelProviderFactory();
    this.healthCheckInterval = config.healthCheckInterval || 60000; // 1 minute
    this.maxRetries = config.maxRetries || 3;
    this.timeoutMs = config.timeoutMs || 5000; // 5 seconds

    // Initialize providers if configuration provided
    if (config.primaryProvider) {
      this.initializePrimaryProvider(config.primaryProvider);
    }
    if (config.fallbackProviders) {
      this.initializeFallbackProviders(config.fallbackProviders);
    }

    // Start health monitoring
    this.startHealthMonitoring();
  }

  /**
   * Initialize primary provider from configuration
   */
  private async initializePrimaryProvider(config: ModelProviderConfig): Promise<void> {
    try {
      this.primaryProvider = await this.factory.createProvider(config);
    } catch (error) {
      console.warn(`Failed to initialize primary provider: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Initialize fallback providers from configuration
   */
  private async initializeFallbackProviders(configs: ModelProviderConfig[]): Promise<void> {
    for (const config of configs) {
      try {
        const provider = await this.factory.createProvider(config);
        this.fallbackProviders.push(provider);
      } catch (error) {
        console.warn(`Failed to initialize fallback provider ${config.provider}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Get the primary provider for context detection
   */
  async getPrimaryProvider(): Promise<ModelProvider> {
    if (!this.primaryProvider) {
      throw new Error('No primary provider configured');
    }

    const isAvailable = await this.primaryProvider.isAvailable();
    if (!isAvailable) {
      throw new Error('Primary provider is not available');
    }

    return this.primaryProvider;
  }

  /**
   * Get fallback provider chain
   */
  async getFallbackProviders(): Promise<ModelProvider[]> {
    const availableProviders: ModelProvider[] = [];
    
    for (const provider of this.fallbackProviders) {
      try {
        const isAvailable = await provider.isAvailable();
        if (isAvailable) {
          availableProviders.push(provider);
        }
      } catch (error) {
        // Skip unavailable providers
        console.debug(`Fallback provider ${provider.name} is unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return availableProviders;
  }

  /**
   * Execute context detection with automatic fallback
   */
  async detectContextWithFallback(text: string): Promise<{
    context: TaskContext;
    providerUsed: string;
    fallbackUsed: boolean;
  }> {
    let lastError: Error | null = null;
    let fallbackUsed = false;

    // Try primary provider first
    if (this.primaryProvider) {
      try {
        const context = await this.executeWithTimeout(
          () => this.primaryProvider!.detectContext(text),
          this.timeoutMs
        );
        
        return {
          context,
          providerUsed: this.primaryProvider.name,
          fallbackUsed: false
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.warn(`Primary provider ${this.primaryProvider.name} failed: ${lastError.message}`);
        fallbackUsed = true;
      }
    }

    // Try fallback providers
    const fallbackProviders = await this.getFallbackProviders();
    for (const provider of fallbackProviders) {
      try {
        const context = await this.executeWithTimeout(
          () => provider.detectContext(text),
          this.timeoutMs
        );
        
        return {
          context,
          providerUsed: provider.name,
          fallbackUsed: true
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.warn(`Fallback provider ${provider.name} failed: ${lastError.message}`);
      }
    }

    // If all providers failed, throw the last error
    throw new Error(`All providers failed. Last error: ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * Add or update a provider configuration
   */
  async configureProvider(name: string, config: ModelProviderConfig): Promise<void> {
    try {
      const provider = await this.factory.createProvider(config);
      
      // If this is the primary provider, update it
      if (!this.primaryProvider || this.primaryProvider.name === name) {
        this.primaryProvider = provider;
      } else {
        // Otherwise, add/update in fallback providers
        const existingIndex = this.fallbackProviders.findIndex(p => p.name === name);
        if (existingIndex >= 0) {
          this.fallbackProviders[existingIndex] = provider;
        } else {
          this.fallbackProviders.push(provider);
        }
      }
    } catch (error) {
      throw new Error(`Failed to configure provider ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Remove a provider configuration
   */
  async removeProvider(name: string): Promise<void> {
    // Remove from primary provider
    if (this.primaryProvider?.name === name) {
      this.primaryProvider = undefined;
    }

    // Remove from fallback providers
    this.fallbackProviders = this.fallbackProviders.filter(p => p.name !== name);
    
    // Remove from health tracking
    this.providerHealth.delete(name);
  }

  /**
   * Execute a function with timeout
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      fn()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Start health monitoring for all providers
   */
  private startHealthMonitoring(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(() => {
      this.performHealthChecks();
    }, this.healthCheckInterval);
  }

  /**
   * Perform health checks on all providers
   */
  private async performHealthChecks(): Promise<void> {
    const allProviders = [
      ...(this.primaryProvider ? [this.primaryProvider] : []),
      ...this.fallbackProviders
    ];

    for (const provider of allProviders) {
      try {
        const startTime = Date.now();
        const isAvailable = await this.executeWithTimeout(
          () => provider.isAvailable(),
          this.timeoutMs
        );
        const latency = Date.now() - startTime;

        const healthInfo: ProviderHealthInfo = {
          status: isAvailable ? 'healthy' : 'unavailable',
          latency,
          lastChecked: new Date(),
          details: provider.getHealthInfo ? await provider.getHealthInfo() : undefined
        };

        this.providerHealth.set(provider.name, healthInfo);
      } catch (error) {
        const healthInfo: ProviderHealthInfo = {
          status: 'unavailable',
          lastChecked: new Date(),
          details: { error: error instanceof Error ? error.message : 'Unknown error' }
        };

        this.providerHealth.set(provider.name, healthInfo);
      }
    }
  }

  /**
   * Get health information for all providers
   */
  getProviderHealth(): Map<string, ProviderHealthInfo> {
    return new Map(this.providerHealth);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
  }
}