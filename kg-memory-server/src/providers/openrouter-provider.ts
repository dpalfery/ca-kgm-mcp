import { ModelProvider, ProviderHealthInfo } from '../interfaces/model-provider.js';
import { TaskContext, ArchitecturalLayer } from '../types.js';

/**
 * Configuration for OpenRouter provider
 */
export interface OpenRouterProviderConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  timeout?: number;
  maxTokens?: number;
  temperature?: number;
  siteName?: string;
  siteUrl?: string;
}

/**
 * OpenRouter model provider for context detection using various models
 */
export class OpenRouterProvider implements ModelProvider {
  name = 'openrouter';
  type = 'cloud' as const;

  private apiKey: string;
  private model: string;
  private baseUrl: string;
  private timeout: number;
  private maxTokens: number;
  private temperature: number;
  private siteName: string;
  private siteUrl: string;

  constructor(config: OpenRouterProviderConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model || 'microsoft/wizardlm-2-8x22b';
    this.baseUrl = config.baseUrl || 'https://openrouter.ai/api/v1';
    this.timeout = config.timeout || 8000; // OpenRouter can be slower
    this.maxTokens = config.maxTokens || 150;
    this.temperature = config.temperature || 0.1;
    this.siteName = config.siteName || 'KG Memory System';
    this.siteUrl = config.siteUrl || 'https://github.com/kg-memory-system';

    if (!this.apiKey) {
      throw new Error('OpenRouter API key is required');
    }
  }

  /**
   * Check if OpenRouter API is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await this.makeRequest('/models', 'GET');
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Detect context using OpenRouter model
   */
  async detectContext(text: string): Promise<TaskContext> {
    const prompt = this.buildContextDetectionPrompt(text);
    
    try {
      const response = await this.makeRequest('/chat/completions', 'POST', {
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert software architect. Analyze the given task description and return a JSON response with the architectural context.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        response_format: { type: 'json_object' }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      
      if (!content) {
        throw new Error('No response content from OpenRouter');
      }

      return this.parseContextResponse(content);
    } catch (error) {
      throw new Error(`OpenRouter context detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get provider health information
   */
  async getHealthInfo(): Promise<ProviderHealthInfo> {
    const startTime = Date.now();
    
    try {
      const isAvailable = await this.isAvailable();
      const latency = Date.now() - startTime;
      
      return {
        status: isAvailable ? 'healthy' : 'unavailable',
        latency,
        lastChecked: new Date(),
        details: {
          model: this.model,
          baseUrl: this.baseUrl,
          timeout: this.timeout
        }
      };
    } catch (error) {
      return {
        status: 'unavailable',
        latency: Date.now() - startTime,
        lastChecked: new Date(),
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Build prompt for context detection
   */
  private buildContextDetectionPrompt(text: string): string {
    return `Analyze this software development task and identify its architectural context:

Task: "${text}"

Please respond with a JSON object containing:
{
  "layer": "1-Presentation" | "2-Application" | "3-Domain" | "4-Persistence" | "5-Infrastructure" | "*",
  "topics": ["array", "of", "relevant", "topics"],
  "keywords": ["key", "technical", "terms"],
  "technologies": ["specific", "technologies", "mentioned"],
  "confidence": 0.0-1.0
}

Architectural layers:
- 1-Presentation: UI components, frontend, user interfaces, styling, React/Vue/Angular
- 2-Application: API endpoints, business logic coordination, services, controllers
- 3-Domain: Core business rules, entities, domain models, business logic
- 4-Persistence: Database operations, data storage, repositories, ORM
- 5-Infrastructure: Deployment, DevOps, system configuration, monitoring
- *: General or unclear context

Topics should include relevant areas like: security, api, database, testing, performance, validation, error-handling

Technologies should identify specific frameworks, languages, or tools mentioned.

Confidence should reflect how certain you are about the layer classification (0.1 = very uncertain, 1.0 = very certain).

Return only the JSON object, no additional text.`;
  }

  /**
   * Parse the JSON response from OpenRouter
   */
  private parseContextResponse(content: string): TaskContext {
    try {
      // Extract JSON from response (some models add extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : content;
      
      const parsed = JSON.parse(jsonStr);
      
      // Validate and normalize the response
      const layer = this.validateLayer(parsed.layer) ? parsed.layer : '*';
      const topics = Array.isArray(parsed.topics) ? parsed.topics.filter((t: any) => typeof t === 'string') : [];
      const keywords = Array.isArray(parsed.keywords) ? parsed.keywords.filter((k: any) => typeof k === 'string') : [];
      const technologies = Array.isArray(parsed.technologies) ? parsed.technologies.filter((t: any) => typeof t === 'string') : [];
      const confidence = typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5;

      return {
        layer,
        topics,
        keywords,
        technologies,
        confidence
      };
    } catch (error) {
      // Fallback to basic parsing if JSON parsing fails
      return this.fallbackContextParsing(content);
    }
  }

  /**
   * Validate architectural layer
   */
  private validateLayer(layer: any): layer is ArchitecturalLayer {
    const validLayers: ArchitecturalLayer[] = [
      '1-Presentation', '2-Application', '3-Domain', '4-Persistence', '5-Infrastructure', '*'
    ];
    return typeof layer === 'string' && validLayers.includes(layer as ArchitecturalLayer);
  }

  /**
   * Fallback context parsing when JSON parsing fails
   */
  private fallbackContextParsing(content: string): TaskContext {
    const text = content.toLowerCase();
    
    // Simple keyword-based layer detection as fallback
    let layer: ArchitecturalLayer = '*';
    if (text.includes('ui') || text.includes('component') || text.includes('frontend')) {
      layer = '1-Presentation';
    } else if (text.includes('api') || text.includes('service') || text.includes('endpoint')) {
      layer = '2-Application';
    } else if (text.includes('business') || text.includes('domain') || text.includes('model')) {
      layer = '3-Domain';
    } else if (text.includes('database') || text.includes('repository') || text.includes('persistence')) {
      layer = '4-Persistence';
    } else if (text.includes('deploy') || text.includes('infrastructure') || text.includes('devops')) {
      layer = '5-Infrastructure';
    }

    // Extract basic topics from content
    const topics: string[] = [];
    if (text.includes('security') || text.includes('auth')) topics.push('security');
    if (text.includes('api') || text.includes('rest') || text.includes('graphql')) topics.push('api');
    if (text.includes('database') || text.includes('sql')) topics.push('database');
    if (text.includes('test')) topics.push('testing');
    if (text.includes('performance') || text.includes('optimization')) topics.push('performance');

    return {
      layer,
      topics,
      keywords: [],
      technologies: [],
      confidence: 0.3 // Low confidence for fallback parsing
    };
  }

  /**
   * Make HTTP request to OpenRouter API
   */
  private async makeRequest(endpoint: string, method: string, body?: any): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': this.siteUrl,
          'X-Title': this.siteName,
          'User-Agent': 'kg-memory-system/1.0'
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
}