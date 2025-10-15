// Model Provider Abstraction Layer
export { DefaultModelProviderFactory } from './model-provider-factory.js';
export { DefaultModelProviderManager, type ProviderManagerConfig } from './model-provider-manager.js';
export { 
  ProviderConfigManager, 
  type ProviderConfiguration,
  DEFAULT_CONFIGURATIONS 
} from './provider-config.js';

// Provider implementations
export { RuleBasedProvider, type RuleBasedProviderConfig } from './rule-based-provider.js';
export { OpenAIProvider, type OpenAIProviderConfig } from './openai-provider.js';
export { AnthropicProvider, type AnthropicProviderConfig } from './anthropic-provider.js';
export { OpenRouterProvider, type OpenRouterProviderConfig } from './openrouter-provider.js';
export { OpenAICompatibleProvider, type OpenAICompatibleProviderConfig } from './openai-compatible-provider.js';
export { OllamaProvider, type OllamaProviderConfig } from './ollama-provider.js';

// Re-export interfaces for convenience
export type {
  ModelProvider,
  ModelProviderFactory,
  ModelProviderManager,
  ProviderHealthInfo
} from '../interfaces/model-provider.js';

export type {
  ModelProviderConfig
} from '../types.js';