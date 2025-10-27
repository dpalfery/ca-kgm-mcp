// src/rules/llm-provider.ts
import { z } from 'zod';

export interface LLMGenerationOptions {
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  retries?: number;
}

export interface LLMJsonResponse<T> {
  data: T;
  success: boolean;
  error?: string;
}

export interface LLMProvider {
  generateJson<T>(prompt: string, schema: z.ZodType<T>, options?: LLMGenerationOptions): Promise<LLMJsonResponse<T>>;
  generateText(prompt: string, options?: LLMGenerationOptions): Promise<string>;
}