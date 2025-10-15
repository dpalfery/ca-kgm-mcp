import { 
  DetectContextInput, 
  DetectContextOutput
} from '../types.js';
import { ContextDetectionEngine } from '../context-detection/context-detection-engine.js';
import { ModelProviderManager } from '../interfaces/model-provider.js';
import { CacheManager } from '../cache/cache-manager.js';

/**
 * MCP tool for standalone context detection from text
 * Provides detailed context analysis with optional keyword extraction
 */
export class DetectContextTool {
  private contextDetectionEngine: ContextDetectionEngine;
  private cacheManager: CacheManager;

  constructor(modelProviderManager: ModelProviderManager, cacheManager?: CacheManager) {
    this.contextDetectionEngine = new ContextDetectionEngine(modelProviderManager);
    this.cacheManager = cacheManager || new CacheManager();
  }

  /**
   * Execute the detect_context tool
   */
  async execute(input: DetectContextInput): Promise<DetectContextOutput> {
    try {
      // Validate input
      this.validateInput(input);

      // Check cache first
      const cachedResult = this.cacheManager.getCachedContextDetection(
        input.text,
        input.options
      );

      if (cachedResult) {
        return cachedResult;
      }

      // Detect context using the context detection engine
      const result = await this.contextDetectionEngine.detectContext(
        input.text,
        {
          returnKeywords: input.options?.returnKeywords ?? true,
          strictLayer: false // Always allow flexible layer detection for standalone use
        }
      );

      // Return the detected context
      const output: DetectContextOutput = {
        detectedLayer: result.layer,
        topics: result.topics,
        confidence: result.confidence
      };

      // Include keywords if requested
      if (input.options?.returnKeywords) {
        output.keywords = result.keywords;
      }

      // Cache the result
      this.cacheManager.cacheContextDetection(input.text, input.options, output);

      return output;

    } catch (error) {
      // Handle errors gracefully with fallback
      return this.handleError(error, input);
    }
  }

  /**
   * Validate input parameters
   */
  private validateInput(input: DetectContextInput): void {
    if (!input.text || typeof input.text !== 'string') {
      throw new Error('text is required and must be a string');
    }

    if (input.text.trim().length === 0) {
      throw new Error('text cannot be empty');
    }

    if (input.text.length > 10000) {
      throw new Error('text cannot exceed 10,000 characters');
    }
  }

  /**
   * Handle errors with graceful fallback
   */
  private handleError(error: any, input: DetectContextInput): DetectContextOutput {
    console.error('Error in detect_context tool:', error);

    // Provide basic fallback context detection
    const fallbackResult = this.performBasicContextDetection(input.text);

    return {
      detectedLayer: fallbackResult.layer,
      topics: fallbackResult.topics,
      keywords: input.options?.returnKeywords ? fallbackResult.keywords : undefined,
      confidence: 0.1 // Low confidence for fallback
    };
  }

  /**
   * Perform basic rule-based context detection as fallback
   */
  private performBasicContextDetection(text: string): {
    layer: any;
    topics: string[];
    keywords: string[];
  } {
    const lowerText = text.toLowerCase();
    const words = lowerText.split(/\s+/);
    
    // Basic layer detection using keywords
    let layer: any = "*";
    
    const layerKeywords = {
      "1-Presentation": ["ui", "component", "react", "vue", "angular", "frontend", "css", "html", "interface", "view"],
      "2-Application": ["service", "controller", "api", "endpoint", "route", "middleware", "business", "logic"],
      "3-Domain": ["model", "entity", "domain", "business", "rule", "validation", "aggregate", "value"],
      "4-Persistence": ["database", "repository", "sql", "query", "storage", "data", "orm", "migration"],
      "5-Infrastructure": ["deploy", "config", "docker", "kubernetes", "aws", "cloud", "infrastructure", "devops"]
    };

    let maxMatches = 0;
    for (const [layerName, keywords] of Object.entries(layerKeywords)) {
      const matches = keywords.filter(keyword => lowerText.includes(keyword)).length;
      if (matches > maxMatches) {
        maxMatches = matches;
        layer = layerName;
      }
    }

    // Basic topic extraction
    const topicKeywords = {
      "security": ["auth", "security", "login", "password", "token", "jwt", "oauth", "permission"],
      "api": ["api", "rest", "graphql", "endpoint", "request", "response", "http"],
      "database": ["database", "sql", "query", "table", "index", "migration", "schema"],
      "testing": ["test", "spec", "mock", "unit", "integration", "e2e", "jest", "vitest"],
      "performance": ["performance", "optimize", "cache", "speed", "latency", "memory"],
      "error-handling": ["error", "exception", "try", "catch", "throw", "handle", "fail"],
      "logging": ["log", "debug", "trace", "monitor", "audit", "event"],
      "validation": ["validate", "check", "verify", "sanitize", "clean", "format"]
    };

    const topics: string[] = [];
    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        topics.push(topic);
      }
    }

    // Extract potential keywords (simple approach)
    const technicalWords = words.filter(word => 
      word.length > 3 && 
      /^[a-z]+$/.test(word) &&
      !['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use'].includes(word)
    );

    const keywords = [...new Set(technicalWords)].slice(0, 10); // Limit to 10 unique keywords

    return {
      layer,
      topics,
      keywords
    };
  }

  /**
   * Test context detection with detailed diagnostics
   */
  async testDetection(text: string): Promise<{
    result: DetectContextOutput;
    diagnostics: {
      detectionTime: number;
      modelProvider?: string;
      fallbackUsed: boolean;
      availableProviders: string[];
    };
  }> {
    const startTime = Date.now();
    
    try {
      const result = await this.execute({
        text,
        options: { returnKeywords: true }
      });

      const availableProviders = await this.contextDetectionEngine.getAvailableProviders();
      
      return {
        result,
        diagnostics: {
          detectionTime: Date.now() - startTime,
          modelProvider: undefined, // Would need to track this in the engine
          fallbackUsed: result.confidence < 0.5,
          availableProviders
        }
      };
    } catch (error) {
      const result = this.handleError(error, { text, options: { returnKeywords: true } });
      
      return {
        result,
        diagnostics: {
          detectionTime: Date.now() - startTime,
          modelProvider: undefined,
          fallbackUsed: true,
          availableProviders: []
        }
      };
    }
  }

  /**
   * Batch context detection for multiple texts
   */
  async batchDetect(texts: string[], options?: { returnKeywords?: boolean }): Promise<DetectContextOutput[]> {
    const results: DetectContextOutput[] = [];
    
    for (const text of texts) {
      try {
        const result = await this.execute({
          text,
          options
        });
        results.push(result);
      } catch (error) {
        // Add error result but continue processing
        results.push(this.handleError(error, { text, options }));
      }
    }
    
    return results;
  }

  /**
   * Get context detection statistics
   */
  async getDetectionStats(): Promise<{
    availableProviders: string[];
    layerKeywordCount: number;
    domainCount: number;
  }> {
    return await this.contextDetectionEngine.getDetectionStats();
  }

  /**
   * Add custom layer keywords for improved detection
   */
  addLayerKeywords(layer: string, keywords: string[]): void {
    this.contextDetectionEngine.addLayerKeywords(layer, keywords);
  }

  /**
   * Add custom domain vocabulary for improved topic extraction
   */
  addDomainVocabulary(domain: string, vocabulary: {
    keywords: string[];
    technologies: string[];
    synonyms: Record<string, string[]>;
  }): void {
    this.contextDetectionEngine.addDomainVocabulary(domain, vocabulary);
  }

  /**
   * Get tool schema for MCP server registration
   */
  static getToolSchema() {
    return {
      name: "detect_context",
      description: "Detect architectural layer, topics, and keywords from text description. Useful for understanding the context of coding tasks or technical documentation.",
      inputSchema: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description: "Text to analyze for context detection",
            maxLength: 10000
          },
          options: {
            type: "object",
            properties: {
              returnKeywords: {
                type: "boolean",
                description: "Whether to include extracted keywords in the response (default: true)"
              }
            },
            additionalProperties: false
          }
        },
        required: ["text"],
        additionalProperties: false
      }
    };
  }
}