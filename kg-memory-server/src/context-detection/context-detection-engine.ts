import { TaskContext, DetectionOptions, ModelProvider, ErrorType } from '../types.js';
import { LayerDetector, LayerDetectionResult } from './layer-detector.js';
import { TopicExtractor, TopicExtractionResult } from './topic-extractor.js';
import { ModelProviderManager } from '../interfaces/model-provider.js';

export interface ContextDetectionResult extends TaskContext {
  diagnostics: {
    detectionTime: number;
    modelProvider?: string;
    fallbackUsed: boolean;
    layerDetection: LayerDetectionResult;
    topicExtraction: TopicExtractionResult;
  };
}

export class ContextDetectionEngine {
  private layerDetector: LayerDetector;
  private topicExtractor: TopicExtractor;
  private modelProviderManager: ModelProviderManager;

  constructor(modelProviderManager: ModelProviderManager) {
    this.layerDetector = new LayerDetector();
    this.topicExtractor = new TopicExtractor();
    this.modelProviderManager = modelProviderManager;
  }

  /**
   * Detect context from text using available model providers with fallback
   */
  async detectContext(text: string, options: DetectionOptions = {}): Promise<ContextDetectionResult> {
    const startTime = Date.now();
    let modelProvider: string | undefined;
    let fallbackUsed = false;

    try {
      // Try to use model provider first
      const provider = await this.getPrimaryProvider();
      
      if (provider) {
        try {
          const modelResult = await this.detectContextWithModel(text, provider, options);
          const detectionTime = Date.now() - startTime;
          
          return {
            ...modelResult,
            diagnostics: {
              detectionTime,
              modelProvider: provider.name,
              fallbackUsed: false,
              layerDetection: {
                layer: modelResult.layer,
                confidence: modelResult.confidence,
                indicators: []
              },
              topicExtraction: {
                topics: modelResult.topics,
                keywords: modelResult.keywords,
                technologies: modelResult.technologies,
                confidence: modelResult.confidence
              }
            }
          };
        } catch (error) {
          console.warn(`Model provider ${provider.name} failed, falling back to rule-based detection:`, error);
          fallbackUsed = true;
        }
      } else {
        fallbackUsed = true;
      }

      // Fallback to rule-based detection
      const ruleBasedResult = await this.detectContextRuleBased(text, options);
      const detectionTime = Date.now() - startTime;

      return {
        ...ruleBasedResult.context,
        diagnostics: {
          detectionTime,
          modelProvider: undefined,
          fallbackUsed: true,
          layerDetection: ruleBasedResult.layerDetection,
          topicExtraction: ruleBasedResult.topicExtraction
        }
      };

    } catch (error) {
      // Ultimate fallback - return minimal context
      const detectionTime = Date.now() - startTime;
      
      return {
        layer: "*",
        topics: [],
        keywords: [],
        technologies: [],
        confidence: 0.1,
        diagnostics: {
          detectionTime,
          modelProvider: undefined,
          fallbackUsed: true,
          layerDetection: {
            layer: "*",
            confidence: 0.1,
            indicators: []
          },
          topicExtraction: {
            topics: [],
            keywords: [],
            technologies: [],
            confidence: 0.1
          }
        }
      };
    }
  }

  /**
   * Get primary provider, handling errors gracefully
   */
  private async getPrimaryProvider(): Promise<ModelProvider | null> {
    try {
      return await this.modelProviderManager.getPrimaryProvider();
    } catch (error) {
      // Try fallback providers
      const fallbackProviders = await this.modelProviderManager.getFallbackProviders();
      return fallbackProviders.length > 0 ? fallbackProviders[0] : null;
    }
  }

  /**
   * Detect context using a model provider
   */
  private async detectContextWithModel(
    text: string, 
    provider: ModelProvider, 
    options: DetectionOptions
  ): Promise<TaskContext> {
    // Use the model provider's detectContext method
    const result = await provider.detectContext(text);
    
    // Enhance with rule-based detection for additional keywords if requested
    if (options.returnKeywords) {
      const ruleBasedResult = await this.detectContextRuleBased(text, options);
      
      // Merge keywords from both approaches
      const combinedKeywords = new Set([
        ...result.keywords,
        ...ruleBasedResult.topicExtraction.keywords
      ]);
      
      result.keywords = Array.from(combinedKeywords);
    }

    return result;
  }

  /**
   * Detect context using rule-based approach (fallback)
   */
  private async detectContextRuleBased(
    text: string, 
    options: DetectionOptions
  ): Promise<{
    context: TaskContext;
    layerDetection: LayerDetectionResult;
    topicExtraction: TopicExtractionResult;
  }> {
    // Run layer detection and topic extraction in parallel
    const [layerResult, topicResult] = await Promise.all([
      Promise.resolve(this.layerDetector.detectLayer(text)),
      Promise.resolve(this.topicExtractor.extractTopics(text))
    ]);

    // Combine results into unified context
    const combinedConfidence = this.calculateCombinedConfidence(
      layerResult.confidence,
      topicResult.confidence
    );

    // Filter keywords if not requested
    const keywords = options.returnKeywords ? topicResult.keywords : [];

    const context: TaskContext = {
      layer: layerResult.layer,
      topics: topicResult.topics,
      keywords,
      technologies: topicResult.technologies,
      confidence: combinedConfidence
    };

    return {
      context,
      layerDetection: layerResult,
      topicExtraction: topicResult
    };
  }

  /**
   * Calculate combined confidence from layer and topic detection
   */
  private calculateCombinedConfidence(layerConfidence: number, topicConfidence: number): number {
    // Weighted average with slight bias toward layer detection
    const layerWeight = 0.6;
    const topicWeight = 0.4;
    
    return Math.min(
      (layerConfidence * layerWeight) + (topicConfidence * topicWeight),
      0.95 // Cap at 95%
    );
  }

  /**
   * Validate context detection result
   */
  private validateContext(context: TaskContext): boolean {
    // Basic validation rules
    if (!context.layer) return false;
    if (context.confidence < 0 || context.confidence > 1) return false;
    if (!Array.isArray(context.topics)) return false;
    if (!Array.isArray(context.keywords)) return false;
    if (!Array.isArray(context.technologies)) return false;

    return true;
  }

  /**
   * Get available model providers for diagnostics
   */
  async getAvailableProviders(): Promise<string[]> {
    const available: string[] = [];
    
    try {
      const primary = await this.modelProviderManager.getPrimaryProvider();
      if (await primary.isAvailable()) {
        available.push(primary.name);
      }
    } catch (error) {
      // Primary provider not available
    }

    try {
      const fallbackProviders = await this.modelProviderManager.getFallbackProviders();
      for (const provider of fallbackProviders) {
        if (await provider.isAvailable()) {
          available.push(provider.name);
        }
      }
    } catch (error) {
      // Fallback providers not available
    }

    return available;
  }

  /**
   * Test context detection with different providers
   */
  async testContextDetection(text: string): Promise<{
    ruleBasedResult: TaskContext;
    modelResults: Record<string, TaskContext | Error>;
  }> {
    // Get rule-based result
    const ruleBasedDetection = await this.detectContextRuleBased(text, { returnKeywords: true });
    const ruleBasedResult = ruleBasedDetection.context;

    // Test all available model providers
    const modelResults: Record<string, TaskContext | Error> = {};
    
    // Test primary provider
    try {
      const primary = await this.modelProviderManager.getPrimaryProvider();
      if (await primary.isAvailable()) {
        modelResults[primary.name] = await primary.detectContext(text);
      } else {
        modelResults[primary.name] = new Error('Provider not available');
      }
    } catch (error) {
      // Primary provider not configured
    }

    // Test fallback providers
    try {
      const fallbackProviders = await this.modelProviderManager.getFallbackProviders();
      for (const provider of fallbackProviders) {
        try {
          if (await provider.isAvailable()) {
            modelResults[provider.name] = await provider.detectContext(text);
          } else {
            modelResults[provider.name] = new Error('Provider not available');
          }
        } catch (error) {
          modelResults[provider.name] = error as Error;
        }
      }
    } catch (error) {
      // Fallback providers not configured
    }

    return {
      ruleBasedResult,
      modelResults
    };
  }

  /**
   * Update layer detector with custom keywords
   */
  addLayerKeywords(layer: string, keywords: string[]): void {
    if (layer !== "*") {
      this.layerDetector.addLayerKeywords(layer as any, keywords);
    }
  }

  /**
   * Update topic extractor with custom domain vocabulary
   */
  addDomainVocabulary(domain: string, vocabulary: {
    keywords: string[];
    technologies: string[];
    synonyms: Record<string, string[]>;
  }): void {
    this.topicExtractor.addDomainVocabulary(domain, vocabulary);
  }

  /**
   * Get detection statistics for monitoring
   */
  async getDetectionStats(): Promise<{
    availableProviders: string[];
    layerKeywordCount: number;
    domainCount: number;
  }> {
    const availableProviders = await this.getAvailableProviders();
    const layerKeywords = this.layerDetector.getLayerKeywords();
    const domainVocabulary = this.topicExtractor.getDomainVocabulary();

    const layerKeywordCount = Object.values(layerKeywords)
      .reduce((total, keywords) => total + keywords.length, 0);

    return {
      availableProviders,
      layerKeywordCount,
      domainCount: Object.keys(domainVocabulary).length
    };
  }
}