import { ModelProvider, ProviderHealthInfo } from '../interfaces/model-provider.js';
import { TaskContext, ArchitecturalLayer } from '../types.js';

/**
 * Configuration for Ollama provider
 */
export interface OllamaProviderConfig {
  baseUrl?: string;
  model: string;
  timeout?: number;
  maxTokens?: number;
  temperature?: number;
  embeddingModel?: string;
}

/**
 * Ollama model provider for local context detection
 */
export class OllamaProvider implements ModelProvider {
  name = 'ollama';
  type = 'local' as const;

  private baseUrl: string;
  private model: string;
  private timeout: number;
  private maxTokens: number;
  private temperature: number;
  private embeddingModel?: string;

  constructor(config: OllamaProviderConfig) {
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
    this.model = config.model;
    this.timeout = config.timeout || 10000; // Local models can be slower
    this.maxTokens = config.maxTokens || 150;
    this.temperature = config.temperature || 0.1;
    this.embeddingModel = config.embeddingModel;

    if (!this.model) {
      throw new Error('Ollama model name is required');
    }

    // Remove trailing slash from baseUrl
    this.baseUrl = this.baseUrl.replace(/\/$/, '');
  }

  /**
   * Check if Ollama is available and the model is loaded
   */
  async isAvailable(): Promise<boolean> {
    try {
      // First check if Ollama is running
      const response = await this.makeRequest('/api/tags', 'GET');
      if (!response.ok) {
        return false;
      }

      // Check if our specific model is available
      const data = await response.json();
      const models = data.models || [];
      const modelExists = models.some((m: any) => m.name === this.model || m.name.startsWith(this.model + ':'));
      
      return modelExists;
    } catch (error) {
      return false;
    }
  }

  /**
   * Detect context using Ollama model
   */
  async detectContext(text: string): Promise<TaskContext> {
    const prompt = this.buildContextDetectionPrompt(text);
    
    try {
      const response = await this.makeRequest('/api/generate', 'POST', {
        model: this.model,
        prompt: prompt,
        stream: false,
        options: {
          num_predict: this.maxTokens,
          temperature: this.temperature,
          stop: ['\n\n', '```']
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      const content = data.response;
      
      if (!content) {
        throw new Error('No response content from Ollama');
      }

      return this.parseContextResponse(content);
    } catch (error) {
      throw new Error(`Ollama context detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate embedding using Ollama embeddings API
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const modelToUse = this.embeddingModel || this.model;
    
    try {
      const response = await this.makeRequest('/api/embeddings', 'POST', {
        model: modelToUse,
        prompt: text
      });

      if (!response.ok) {
        throw new Error(`Ollama embeddings API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.embedding || [];
    } catch (error) {
      throw new Error(`Ollama embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      
      // Get additional model information
      let modelInfo = {};
      try {
        const modelsResponse = await this.makeRequest('/api/tags', 'GET');
        if (modelsResponse.ok) {
          const modelsData = await modelsResponse.json();
          const currentModel = modelsData.models?.find((m: any) => 
            m.name === this.model || m.name.startsWith(this.model + ':')
          );
          if (currentModel) {
            modelInfo = {
              size: currentModel.size,
              modified_at: currentModel.modified_at,
              digest: currentModel.digest
            };
          }
        }
      } catch (error) {
        // Ignore errors getting model info
      }
      
      return {
        status: isAvailable ? 'healthy' : 'unavailable',
        latency,
        lastChecked: new Date(),
        details: {
          model: this.model,
          baseUrl: this.baseUrl,
          timeout: this.timeout,
          embeddingModel: this.embeddingModel,
          modelInfo
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
   * Build prompt for context detection optimized for local models
   */
  private buildContextDetectionPrompt(text: string): string {
    return `You are a software architect. Analyze this development task and respond with JSON only:

Task: "${text}"

Respond with this exact JSON format:
{
  "layer": "1-Presentation|2-Application|3-Domain|4-Persistence|5-Infrastructure|*",
  "topics": ["security", "api", "database", "testing", "performance"],
  "keywords": ["key", "terms"],
  "technologies": ["React", "Node.js", "PostgreSQL"],
  "confidence": 0.8
}

Layers:
- 1-Presentation: UI, frontend, components, styling
- 2-Application: API, services, controllers, middleware
- 3-Domain: Business logic, entities, models
- 4-Persistence: Database, storage, repositories
- 5-Infrastructure: Deployment, DevOps, monitoring
- *: General/unclear

JSON only:`;
  }

  /**
   * Parse the JSON response from Ollama
   */
  private parseContextResponse(content: string): TaskContext {
    try {
      // Clean up the response - remove any markdown formatting
      let cleanContent = content.trim();
      
      // Remove markdown code blocks if present
      cleanContent = cleanContent.replace(/```json\s*/, '').replace(/```\s*$/, '');
      
      // Extract JSON from response
      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : cleanContent;
      
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
    if (text.includes('ui') || text.includes('component') || text.includes('frontend') || text.includes('presentation')) {
      layer = '1-Presentation';
    } else if (text.includes('api') || text.includes('service') || text.includes('endpoint') || text.includes('application')) {
      layer = '2-Application';
    } else if (text.includes('business') || text.includes('domain') || text.includes('model') || text.includes('entity')) {
      layer = '3-Domain';
    } else if (text.includes('database') || text.includes('repository') || text.includes('persistence') || text.includes('storage')) {
      layer = '4-Persistence';
    } else if (text.includes('deploy') || text.includes('infrastructure') || text.includes('devops') || text.includes('docker')) {
      layer = '5-Infrastructure';
    }

    // Extract basic topics from content
    const topics: string[] = [];
    if (text.includes('security') || text.includes('auth')) topics.push('security');
    if (text.includes('api') || text.includes('rest') || text.includes('graphql')) topics.push('api');
    if (text.includes('database') || text.includes('sql')) topics.push('database');
    if (text.includes('test')) topics.push('testing');
    if (text.includes('performance') || text.includes('optimization')) topics.push('performance');

    // Extract basic technologies
    const technologies: string[] = [];
    if (text.includes('react')) technologies.push('React');
    if (text.includes('node') || text.includes('nodejs')) technologies.push('Node.js');
    if (text.includes('postgres') || text.includes('postgresql')) technologies.push('PostgreSQL');
    if (text.includes('docker')) technologies.push('Docker');
    if (text.includes('typescript')) technologies.push('TypeScript');

    return {
      layer,
      topics,
      keywords: [],
      technologies,
      confidence: 0.3 // Low confidence for fallback parsing
    };
  }

  /**
   * Make HTTP request to Ollama API
   */
  private async makeRequest(endpoint: string, method: string, body?: any): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
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

  /**
   * Get available models from Ollama
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await this.makeRequest('/api/tags', 'GET');
      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return (data.models || []).map((m: any) => m.name);
    } catch (error) {
      return [];
    }
  }

  /**
   * Pull a model if it's not available locally
   */
  async pullModel(modelName?: string): Promise<boolean> {
    const model = modelName || this.model;
    
    try {
      const response = await this.makeRequest('/api/pull', 'POST', {
        name: model,
        stream: false
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  }
}