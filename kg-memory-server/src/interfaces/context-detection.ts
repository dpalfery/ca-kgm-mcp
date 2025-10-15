import { TaskContext, DetectionOptions, ArchitecturalLayer } from '../types.js';

/**
 * Interface for context detection engines that analyze task descriptions
 * to identify architectural context and relevant topics
 */
export interface ContextDetectionEngine {
  /**
   * Analyze text to detect architectural context and topics
   */
  detectContext(text: string, options?: DetectionOptions): Promise<TaskContext>;
  
  /**
   * Detect the architectural layer using pattern matching and ML
   */
  detectArchitecturalLayer(text: string): Promise<{
    layer: ArchitecturalLayer;
    confidence: number;
    indicators: string[];
  }>;
  
  /**
   * Extract topics using NLP and domain dictionaries
   */
  extractTopics(text: string): Promise<{
    topics: string[];
    keywords: string[];
    technologies: string[];
  }>;
}

/**
 * Layer detection result with confidence and reasoning
 */
export interface LayerDetectionResult {
  layer: ArchitecturalLayer;
  confidence: number;
  indicators: string[];
  reasoning?: string;
}

/**
 * Topic extraction result with categorized information
 */
export interface TopicExtractionResult {
  topics: string[];
  keywords: string[];
  technologies: string[];
  domains: string[];
}