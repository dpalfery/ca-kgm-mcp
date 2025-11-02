/**
 * Architectural Layer Detection Module
 * 
 * Analyzes text to detect which of the 7 architectural layers a task/code belongs to.
 * Provides confidence scores and alternative layer suggestions.
 */

export interface LayerDetectionResult {
  layer: string;           // "1-Presentation", "2-Application", etc.
  confidence: number;      // 0-1
  indicators: string[];    // Keywords found
  alternatives: Array<{
    layer: string;
    confidence: number;
  }>;
}

const LAYER_KEYWORDS = {
  '1-Presentation': {
    keywords: [
      'ui', 'frontend', 'component', 'view', 'template', 'layout', 'page',
      'button', 'form', 'dialog', 'modal', 'page', 'screen', 'display',
      'render', 'react', 'vue', 'angular', 'html', 'css', 'styling',
      'accessibility', 'a11y', 'wcag', 'responsive', 'mobile'
    ],
    weight: 1.0
  },
  '2-Application': {
    keywords: [
      'service', 'handler', 'controller', 'use case', 'business logic',
      'workflow', 'orchestration', 'middleware', 'interceptor', 'decorator',
      'router', 'route handler', 'express', 'fastify', 'http handler',
      'request processing', 'validation', 'authorization',
      'api', 'rest', 'endpoint', 'client', 'adapter', 'integration'
    ],
    weight: 0.95
  },
  '3-Domain': {
    keywords: [
      'entity', 'model', 'domain', 'aggregate', 'value object',
      'business object', 'data structure', 'type', 'interface',
      'schema', 'class', 'struct', 'record', 'object',
      'logic', 'rule', 'constraint', 'invariant'
    ],
    weight: 0.9
  },
  '4-Persistence': {
    keywords: [
      'repository', 'dao', 'database', 'query', 'sql', 'mongodb',
      'postgres', 'mysql', 'orm', 'sequelize', 'typeorm', 'mongoose',
      'migration', 'schema', 'table', 'collection', 'index',
      'transaction', 'backup', 'restore'
    ],
    weight: 0.95
  },
  '5-Tests': {
    keywords: [
      'test', 'testing', 'spec', 'unit test', 'integration test', 'e2e',
      'test case', 'test suite', 'assertion', 'mock', 'stub', 'spy',
      'jest', 'mocha', 'vitest', 'cypress', 'playwright', 'selenium',
      'coverage', 'tdd', 'bdd', 'scenario', 'expect', 'should'
    ],
    weight: 0.93
  },
  '6-Docs': {
    keywords: [
      'documentation', 'readme', 'docs', 'guide', 'tutorial', 'specification',
      'diagram', 'architecture doc', 'api doc', 'swagger', 'openapi',
      'markdown', 'comment', 'inline doc', 'jsdoc', 'docstring',
      'user guide', 'developer guide', 'onboarding', 'wiki'
    ],
    weight: 0.92
  },
  '7-Deployment': {
    keywords: [
      'deployment', 'container', 'docker', 'image', 'kubernetes', 'k8s',
      'orchestration', 'cloud', 'aws', 'azure', 'gcp', 'helm',
      'manifest', 'ci/cd', 'pipeline', 'github actions', 'gitlab ci',
      'infra', 'terraform', 'cloudformation'
    ],
    weight: 0.94
  }
};

export class LayerDetector {
  /**
   * Detect the architectural layer from text
   */
  static detect(text: string): LayerDetectionResult {
    const lowerText = text.toLowerCase();
    const words = lowerText.split(/\W+/);
    const wordSet = new Set(words);

    // Score each layer
    const scores: Array<{ layer: string; score: number; indicators: string[] }> = [];

    for (const [layerName, config] of Object.entries(LAYER_KEYWORDS)) {
      let score = 0;
      const indicators: string[] = [];

      for (const keyword of config.keywords) {
        if (wordSet.has(keyword)) {
          score += 1;
          indicators.push(keyword);
        }
      }

      if (score > 0) {
        score = (score / config.keywords.length) * config.weight;
        scores.push({ layer: layerName, score, indicators });
      }
    }

    // If no keywords found, return wildcard with low confidence
    if (scores.length === 0) {
      return {
        layer: '*',
        confidence: 0.0,
        indicators: [],
        alternatives: []
      };
    }

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    // Normalize confidence to 0-1 range
    const maxScore = scores[0].score;
    const topResult = scores[0];
    const confidence = Math.min(maxScore, 1.0);

    // Collect alternatives
    const alternatives = scores.slice(1, 3).map(s => ({
      layer: s.layer,
      confidence: Math.min(s.score, 1.0)
    }));

    return {
      layer: topResult.layer,
      confidence,
      indicators: topResult.indicators,
      alternatives
    };
  }
}
