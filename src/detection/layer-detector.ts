/**
 * Architectural Layer Detection
 * 
 * Analyzes text to detect which architectural layer(s) apply based on keywords and patterns.
 * Supports layers 1-7 from the ContextISO architecture.
 */

export interface LayerDetectionResult {
  layer: string;
  confidence: number;
  alternatives?: Array<{
    layer: string;
    confidence: number;
  }>;
}

export interface LayerDetectorOptions {
  confidenceThreshold?: number;
  returnAlternatives?: boolean;
}

/**
 * Layer keyword mappings based on architectural patterns
 */
const LAYER_KEYWORDS: Record<string, string[]> = {
  '1-Presentation': [
    'ui', 'frontend', 'view', 'component', 'template', 'page', 'screen',
    'react', 'vue', 'angular', 'html', 'css', 'jsx', 'tsx',
    'button', 'form', 'modal', 'dialog', 'layout', 'navigation',
    'render', 'display', 'user interface', 'gui', 'web page'
  ],
  '2-Application': [
    'service', 'use case', 'business logic', 'handler', 'controller',
    'workflow', 'orchestration', 'coordinator', 'facade',
    'application service', 'command', 'query', 'mediator',
    'process', 'application layer', 'app logic'
  ],
  '3-Domain': [
    'entity', 'model', 'domain object', 'aggregate', 'value object',
    'domain model', 'business rule', 'domain logic', 'domain entity',
    'aggregate root', 'domain service', 'invariant', 'business entity',
    'domain', 'core business', 'business model'
  ],
  '4-Persistence': [
    'repository', 'dao', 'database access', 'data access',
    'orm', 'query', 'crud', 'sql', 'database', 'db',
    'persistence', 'storage', 'data layer', 'entity framework',
    'sequelize', 'typeorm', 'prisma', 'mongoose',
    'save', 'fetch', 'retrieve', 'store data'
  ],
  '5-Integration': [
    'api client', 'external service', 'adapter', 'integration',
    'rest', 'graphql', 'grpc', 'http client', 'api',
    'third party', 'webhook', 'event', 'message', 'queue',
    'kafka', 'rabbitmq', 'api gateway', 'microservice',
    'endpoint', 'request', 'response', 'external api'
  ],
  '6-Infrastructure': [
    'config', 'configuration', 'logging', 'logger', 'monitoring',
    'caching', 'cache', 'redis', 'messaging', 'email',
    'notification', 'file system', 'utility', 'helper',
    'infrastructure', 'cross-cutting', 'middleware',
    'security', 'authentication', 'authorization', 'auth'
  ],
  '7-Deployment': [
    'containerization', 'docker', 'kubernetes', 'k8s', 'orchestration',
    'cloud', 'aws', 'azure', 'gcp', 'deployment', 'devops',
    'ci/cd', 'pipeline', 'build', 'release', 'environment',
    'infrastructure as code', 'terraform', 'ansible',
    'helm', 'container', 'pod', 'service mesh'
  ]
};

/**
 * Detect architectural layer from text
 */
export function detectLayer(
  text: string,
  options: LayerDetectorOptions = {}
): LayerDetectionResult {
  const { 
    confidenceThreshold = 0.5, 
    returnAlternatives = false 
  } = options;

  // Normalize text for matching
  const normalizedText = text.toLowerCase();
  const words = normalizedText.split(/\s+/);
  const wordSet = new Set(words);

  // Score each layer
  const layerScores: Array<{ layer: string; score: number; matches: number }> = [];

  for (const [layer, keywords] of Object.entries(LAYER_KEYWORDS)) {
    let matches = 0;
    let totalWeight = 0;

    for (const keyword of keywords) {
      const keywordWords = keyword.toLowerCase().split(/\s+/);
      
      // Check for exact phrase match (higher weight)
      if (normalizedText.includes(keyword.toLowerCase())) {
        matches += 2;
        totalWeight += 2;
      }
      // Check for individual word matches
      else if (keywordWords.every(word => wordSet.has(word))) {
        matches += 1.5;
        totalWeight += 1.5;
      }
      // Check for partial word matches
      else if (keywordWords.some(word => wordSet.has(word))) {
        matches += 0.5;
        totalWeight += 0.5;
      }
    }

    // Calculate confidence as ratio of matches to total possible keywords
    const confidence = keywords.length > 0 
      ? Math.min(matches / (keywords.length * 0.3), 1.0) 
      : 0;

    layerScores.push({ layer, score: confidence, matches: totalWeight });
  }

  // Sort by score descending
  layerScores.sort((a, b) => b.score - a.score);

  // Get the best match
  const bestMatch = layerScores[0];

  // If confidence is too low, return wildcard
  if (bestMatch.score < confidenceThreshold) {
    const wildcardResult: LayerDetectionResult = {
      layer: '*',
      confidence: 0
    };
    
    if (returnAlternatives) {
      wildcardResult.alternatives = layerScores.slice(0, 3).map(s => ({ layer: s.layer, confidence: s.score }));
    }
    
    return wildcardResult;
  }

  // Build result
  const result: LayerDetectionResult = {
    layer: bestMatch.layer,
    confidence: bestMatch.score
  };

  if (returnAlternatives) {
    result.alternatives = layerScores
      .slice(1, 4)
      .filter(s => s.score >= confidenceThreshold * 0.5)
      .map(s => ({ layer: s.layer, confidence: s.score }));
  }

  return result;
}

/**
 * Detect multiple applicable layers from text
 */
export function detectMultipleLayers(
  text: string,
  options: LayerDetectorOptions = {}
): Array<{ layer: string; confidence: number }> {
  const { confidenceThreshold = 0.3 } = options;

  const normalizedText = text.toLowerCase();
  const words = normalizedText.split(/\s+/);
  const wordSet = new Set(words);

  const layerScores: Array<{ layer: string; confidence: number }> = [];

  for (const [layer, keywords] of Object.entries(LAYER_KEYWORDS)) {
    let matches = 0;

    for (const keyword of keywords) {
      const keywordWords = keyword.toLowerCase().split(/\s+/);
      
      if (normalizedText.includes(keyword.toLowerCase())) {
        matches += 2;
      } else if (keywordWords.every(word => wordSet.has(word))) {
        matches += 1.5;
      } else if (keywordWords.some(word => wordSet.has(word))) {
        matches += 0.5;
      }
    }

    const confidence = keywords.length > 0 
      ? Math.min(matches / (keywords.length * 0.3), 1.0) 
      : 0;

    if (confidence >= confidenceThreshold) {
      layerScores.push({ layer, confidence });
    }
  }

  return layerScores.sort((a, b) => b.confidence - a.confidence);
}
