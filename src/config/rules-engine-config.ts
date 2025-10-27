// src/config/rules-engine-config.ts
import { z } from 'zod';

const LlmConfigSchema = z.object({
  provider: z.enum(['openai', 'azure_openai', 'local']).default('local'),
  endpoint: z.string().url(),
  apiKey: z.string().optional(),
  model: z.string(),
  // ... other LLM settings
});

const RuleProcessingConfigSchema = z.object({
  enableSplitting: z.boolean().default(true),
  minWordCountForSplit: z.number().int().positive().default(250),
  enableDirectiveGeneration: z.boolean().default(true),
  minWordCountForGeneration: z.number().int().positive().default(100),
});

export const RulesEngineConfigSchema = z.object({
  llm: LlmConfigSchema,
  processing: RuleProcessingConfigSchema,
});

export type RulesEngineConfig = z.infer<typeof RulesEngineConfigSchema>;