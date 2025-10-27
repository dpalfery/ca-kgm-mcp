// src/rules/providers/local-llm-provider.ts
import { LLMProvider, LLMGenerationOptions, LLMJsonResponse } from '../llm-provider';
import { z } from 'zod';

// Local LLM configuration interface
interface LocalLlmConfig {
  endpoint: string;
  model: string;
  apiKey?: string;
}

/**
 * Local LLM Provider implementation
 * Makes HTTP requests to a local LLM endpoint (e.g., Ollama, LM Studio)
 */
export class LocalLlmProvider implements LLMProvider {
  private config: LocalLlmConfig;
  private readonly DEFAULT_TIMEOUT = 30000; // 30 seconds
  private readonly DEFAULT_RETRIES = 2;

  constructor(config: LocalLlmConfig) {
    this.config = config;
    
    if (!config.endpoint) {
      throw new Error('Local LLM endpoint is required');
    }
    
    if (!config.model) {
      throw new Error('Local LLM model name is required');
    }
  }

  /**
   * Generate a structured JSON response from the LLM
   * 
   * @param prompt The prompt to send to the LLM
   * @param schema The Zod schema to validate the response against
   * @param options Generation options
   * @returns Promise<LLMJsonResponse<T>> Structured response with validation
   */
  async generateJson<T>(
    prompt: string, 
    schema: z.ZodType<T>, 
    options?: LLMGenerationOptions
  ): Promise<LLMJsonResponse<T>> {
    try {
      // Enhance the prompt to request JSON output
      const enhancedPrompt = `${prompt}

Please respond with valid JSON that conforms to the following schema:
${JSON.stringify(schema._def, null, 2)}

Your response should be ONLY the JSON object, without any additional text or explanation.`;

      const responseText = await this.generateText(enhancedPrompt, options);
      
      // Try to extract JSON from the response
      let jsonText = responseText.trim();
      
      // Remove any markdown code blocks
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\s*/, '').replace(/```\s*$/, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\s*/, '').replace(/```\s*$/, '');
      }
      
      // Parse and validate the JSON
      try {
        const parsedData = JSON.parse(jsonText);
        const validationResult = schema.safeParse(parsedData);
        
        if (validationResult.success) {
          return {
            data: validationResult.data,
            success: true
          };
        } else {
          return {
            data: {} as T,
            success: false,
            error: `Validation failed: ${validationResult.error.message}`
          };
        }
      } catch (parseError) {
        return {
          data: {} as T,
          success: false,
          error: `Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`
        };
      }
    } catch (error) {
      return {
        data: {} as T,
        success: false,
        error: `Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Generate text response from the LLM
   * 
   * @param prompt The prompt to send to the LLM
   * @param options Generation options
   * @returns Promise<string> The text response from the LLM
   */
  async generateText(
    prompt: string, 
    options?: LLMGenerationOptions
  ): Promise<string> {
    const timeout = options?.timeout || this.DEFAULT_TIMEOUT;
    const retries = options?.retries !== undefined ? options.retries : this.DEFAULT_RETRIES;
    
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const requestBody = {
          model: this.config.model,
          prompt: prompt,
          stream: false,
          options: {
            temperature: options?.temperature || 0.7,
            num_predict: options?.maxTokens || 2048
          }
        };

        const response = await fetch(this.config.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
          },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(timeout)
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
        }

        const data = await response.json() as any;
        
        // Handle different response formats from different local LLM servers
        if (data.response) {
          // Ollama format
          return data.response;
        } else if (data.content) {
          // Some other servers might use 'content'
          return data.content;
        } else if (data.choices && data.choices[0] && data.choices[0].text) {
          // OpenAI-compatible format
          return data.choices[0].text;
        } else {
          throw new Error('Unexpected response format from LLM endpoint');
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt < retries) {
          // Wait before retrying (exponential backoff)
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // All retries failed
    throw lastError || new Error('Failed to generate text after retries');
  }
}