// src/rules/local-model-manager.ts
import { RulesEngineConfig } from '../config/rules-engine-config.js';
import { LLMProvider, LLMGenerationOptions, LLMJsonResponse } from './llm-provider.js';
import { LLMProviderFactory } from './llm-provider-factory.js';
import { z } from 'zod';

export class LocalModelManager {
  private config: RulesEngineConfig;
  private provider: LLMProvider | null = null;

  constructor(config: RulesEngineConfig) {
    this.config = config;
  }

  /**
   * Initialize the LLM provider based on the configuration
   */
  public initialize(): void {
    try {
      this.provider = LLMProviderFactory.createProvider(this.config);
      console.error(`LLM provider initialized with ${this.config.llm.provider} configuration`);
    } catch (error) {
      console.error('Failed to initialize LLM provider:', error);
      this.provider = null;
    }
  }

  /**
   * Generate structured JSON response from the LLM
   */
  public async generateJson<T>(
    prompt: string,
    schema: z.ZodType<T>,
    options?: LLMGenerationOptions
  ): Promise<LLMJsonResponse<T>> {
    if (!this.provider) {
      console.warn('LLM provider not initialized. Returning empty response.');
      return {
        data: {} as T,
        success: false,
        error: 'LLM provider not initialized'
      };
    }
    
    try {
      return await this.provider.generateJson(prompt, schema, options);
    } catch (error) {
      console.error('Failed to generate JSON from LLM:', error);
      return {
        data: {} as T,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate text response from the LLM
   */
  public async generateText(
    prompt: string,
    options?: LLMGenerationOptions
  ): Promise<string> {
    if (!this.provider) {
      console.warn('LLM provider not initialized. Returning empty response.');
      return '';
    }
    
    try {
      return await this.provider.generateText(prompt, options);
    } catch (error) {
      console.error('Failed to generate text from LLM:', error);
      return '';
    }
  }

  /**
   * Check if the LLM provider is initialized and ready
   */
  public isReady(): boolean {
    return this.provider !== null;
  }

  /**
   * Get the current configuration
   */
  public getConfig(): RulesEngineConfig {
    return { ...this.config };
  }
}