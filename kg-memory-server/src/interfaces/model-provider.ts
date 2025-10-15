import { TaskContext, ModelProviderConfig } from '../types.js';

/**
 * Abstract interface for model providers that can perform context detection
 * and semantic analysis. Supports local, cloud, and rule-based providers.
 */
export interface ModelProvider {
  /** Provider name for identification */
  name: string;
  
  /** Provider type classification */
  type: "local" | "cloud" | "rule-based";
  
  /**
   * Check if the provider is available and ready to use
   */
  isAvailable(): Promise<boolean>;
  
  /**
   * Detect context from task description text
   */
  detectContext(text: string): Promise<TaskContext>;
  
  /**
   * Generate vector embedding for semantic similarity (optional)
   */
  generateEmbedding?(text: string): Promise<number[]>;
  
  /**
   * Get provider-specific health information
   */
  getHealthInfo?(): Promise<ProviderHealthInfo>;
}

/**
 * Health information for monitoring provider status
 */
export interface ProviderHealthInfo {
  status: "healthy" | "degraded" | "unavailable";
  latency?: number;
  errorRate?: number;
  lastChecked: Date;
  details?: Record<string, any>;
}

/**
 * Factory interface for creating model providers
 */
export interface ModelProviderFactory {
  /**
   * Create a provider instance from configuration
   */
  createProvider(config: ModelProviderConfig): Promise<ModelProvider>;
  
  /**
   * List available provider types
   */
  getAvailableProviders(): string[];
  
  /**
   * Validate provider configuration
   */
  validateConfig(config: ModelProviderConfig): boolean;
}

/**
 * Provider manager for handling multiple providers and fallbacks
 */
export interface ModelProviderManager {
  /**
   * Get the primary provider for context detection
   */
  getPrimaryProvider(): Promise<ModelProvider>;
  
  /**
   * Get fallback provider chain
   */
  getFallbackProviders(): Promise<ModelProvider[]>;
  
  /**
   * Execute context detection with automatic fallback
   */
  detectContextWithFallback(text: string): Promise<{
    context: TaskContext;
    providerUsed: string;
    fallbackUsed: boolean;
  }>;
  
  /**
   * Add or update a provider configuration
   */
  configureProvider(name: string, config: ModelProviderConfig): Promise<void>;
  
  /**
   * Remove a provider configuration
   */
  removeProvider(name: string): Promise<void>;
}