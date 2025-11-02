// src/rules/llm-provider-factory.ts
import { RulesEngineConfig } from '../config/rules-engine-config';
import { LLMProvider } from './llm-provider';
import { LocalLlmProvider } from './providers/local-llm-provider';

/**
 * Factory class for creating LLM provider instances based on configuration
 */
export class LLMProviderFactory {
  /**
   * Create an LLM provider instance based on the configuration
   * 
   * @param config The rules engine configuration
   * @returns An instance of the configured LLM provider
   * @throws Error if the provider type is not supported
   */
  static createProvider(config: RulesEngineConfig): LLMProvider {
    const providerType = config.llm.provider;
    
    switch (providerType) {
      case 'local':
        return new LocalLlmProvider(config.llm as any);
      
      case 'openai':
        throw new Error(`OpenAI provider is not yet implemented. Currently only 'local' provider is supported.`);
      
      case 'azure_openai':
        throw new Error(`Azure OpenAI provider is not yet implemented. Currently only 'local' provider is supported.`);
      
      default:
        throw new Error(`Unsupported LLM provider: ${providerType}. Currently only 'local' provider is supported.`);
    }
  }
}