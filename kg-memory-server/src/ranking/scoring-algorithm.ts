import { Directive, TaskContext, RankingConfig } from '../types.js';
import { RankingAlgorithm } from '../interfaces/ranking-engine.js';

/**
 * Default configuration for ranking weights and parameters
 */
export const DEFAULT_RANKING_CONFIG: RankingConfig = {
  weights: {
    authority: 10,
    whenToApply: 8,
    layerMatch: 7,
    topicOverlap: 5,
    severityBoost: 4,
    semanticSimilarity: 3
  },
  severityMultipliers: {
    MUST: 1.0,
    SHOULD: 0.7,
    MAY: 0.4
  },
  tokenEstimation: {
    averageTokensPerDirective: 50,
    overheadTokens: 20
  }
};

/**
 * Implementation of the scoring algorithm components for directive ranking
 */
export class ScoringAlgorithm implements RankingAlgorithm {
  private config: RankingConfig;

  constructor(config: RankingConfig = DEFAULT_RANKING_CONFIG) {
    this.config = config;
  }

  /**
   * Calculate weighted score for a directive given task context
   * Formula: (Authority × 10) + (WhenToApply × 8) + (LayerMatch × 7) + 
   *          (TopicOverlap × 5) + (SeverityBoost × 4) + (SemanticSim × 3)
   */
  calculateScore(directive: Directive, context: TaskContext): number {
    const scores = {
      authority: this.authorityScore(directive, context.topics),
      layerMatch: this.layerMatchScore(directive, context.layer),
      topicOverlap: this.topicOverlapScore(directive, context.topics),
      severityBoost: this.severityBoost(directive.severity),
      semanticSimilarity: this.semanticSimilarity(directive, context.keywords.join(' ')),
      whenToApply: this.whenToApplyScore(directive, context.keywords)
    };

    const weightedScore = 
      (scores.authority * this.config.weights.authority) +
      (scores.layerMatch * this.config.weights.layerMatch) +
      (scores.topicOverlap * this.config.weights.topicOverlap) +
      (scores.severityBoost * this.config.weights.severityBoost) +
      (scores.semanticSimilarity * this.config.weights.semanticSimilarity) +
      (scores.whenToApply * this.config.weights.whenToApply);

    return Math.round(weightedScore * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Score based on rule authority for detected topics
   * Returns 1.0 if directive's rule is authoritative for any detected topic, 0.0 otherwise
   */
  authorityScore(directive: Directive, topics: string[]): number {
    if (!topics || topics.length === 0) {
      return 0.0;
    }

    // This would need to be enhanced to check the rule's authoritativeFor field
    // For now, we'll use a simplified approach based on topic overlap
    const directiveTopics = directive.topics.map(t => t.toLowerCase());
    const contextTopics = topics.map(t => t.toLowerCase());
    
    const hasAuthorityMatch = contextTopics.some(topic => 
      directiveTopics.includes(topic) || 
      directiveTopics.some(dt => dt.includes(topic) || topic.includes(dt))
    );

    return hasAuthorityMatch ? 1.0 : 0.0;
  }

  /**
   * Score based on architectural layer match
   * Returns 1.0 for exact match, 0.5 for wildcard (*), 0.0 for mismatch
   */
  layerMatchScore(directive: Directive, layer: string): number {
    // Get the rule's layer - this would need to be passed or looked up
    // For now, we'll assume the directive has layer information or use a heuristic
    
    // If directive applies to all layers (*)
    if (directive.topics.includes('*') || directive.whenToApply.some(w => w.includes('all') || w.includes('any'))) {
      return 0.5;
    }

    // Check if directive topics suggest a specific layer
    const layerKeywords = {
      '1-Presentation': ['ui', 'component', 'react', 'vue', 'angular', 'css', 'html', 'frontend'],
      '2-Application': ['service', 'controller', 'api', 'endpoint', 'business', 'logic'],
      '3-Domain': ['model', 'entity', 'domain', 'business', 'rule', 'validation'],
      '4-Persistence': ['database', 'repository', 'sql', 'orm', 'storage', 'data'],
      '5-Infrastructure': ['deployment', 'docker', 'kubernetes', 'config', 'logging', 'monitoring']
    };

    const directiveText = (directive.text + ' ' + directive.topics.join(' ')).toLowerCase();
    const currentLayerKeywords = layerKeywords[layer as keyof typeof layerKeywords] || [];
    
    const hasLayerMatch = currentLayerKeywords.some(keyword => 
      directiveText.includes(keyword)
    );

    return hasLayerMatch ? 1.0 : 0.0;
  }

  /**
   * Score based on topic overlap between directive and context
   * Returns ratio of overlapping topics (0.0 to 1.0)
   */
  topicOverlapScore(directive: Directive, topics: string[]): number {
    if (!topics || topics.length === 0 || !directive.topics || directive.topics.length === 0) {
      return 0.0;
    }

    const directiveTopics = directive.topics.map(t => t.toLowerCase());
    const contextTopics = topics.map(t => t.toLowerCase());
    
    let matches = 0;
    for (const contextTopic of contextTopics) {
      if (directiveTopics.some(dt => 
        dt === contextTopic || 
        dt.includes(contextTopic) || 
        contextTopic.includes(dt)
      )) {
        matches++;
      }
    }

    return matches / Math.max(contextTopics.length, directiveTopics.length);
  }

  /**
   * Boost score based on directive severity (MUST > SHOULD > MAY)
   * Returns multiplier based on severity level
   */
  severityBoost(severity: "MUST" | "SHOULD" | "MAY"): number {
    return this.config.severityMultipliers[severity];
  }

  /**
   * Score based on semantic similarity to task description
   * Simple keyword-based similarity for now (could be enhanced with embeddings)
   */
  semanticSimilarity(directive: Directive, taskText: string): number {
    if (!taskText || taskText.trim().length === 0) {
      return 0.0;
    }

    const directiveText = (directive.text + ' ' + (directive.rationale || '')).toLowerCase();
    const taskWords = taskText.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    
    if (taskWords.length === 0) {
      return 0.0;
    }

    let matches = 0;
    for (const word of taskWords) {
      if (directiveText.includes(word)) {
        matches++;
      }
    }

    return matches / taskWords.length;
  }

  /**
   * Score based on "when to apply" conditions matching task keywords
   * Returns ratio of matching conditions (0.0 to 1.0)
   */
  whenToApplyScore(directive: Directive, keywords: string[]): number {
    if (!keywords || keywords.length === 0 || !directive.whenToApply || directive.whenToApply.length === 0) {
      return 0.0;
    }

    const keywordSet = new Set(keywords.map(k => k.toLowerCase()));
    let matches = 0;

    for (const condition of directive.whenToApply) {
      const conditionWords = condition.toLowerCase().split(/\s+/);
      const hasMatch = conditionWords.some(word => 
        keywordSet.has(word) || 
        Array.from(keywordSet).some(k => k.includes(word) || word.includes(k))
      );
      
      if (hasMatch) {
        matches++;
      }
    }

    return matches / directive.whenToApply.length;
  }

  /**
   * Update configuration weights and parameters
   */
  updateConfig(newConfig: Partial<RankingConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig,
      weights: { ...this.config.weights, ...newConfig.weights },
      severityMultipliers: { ...this.config.severityMultipliers, ...newConfig.severityMultipliers },
      tokenEstimation: { ...this.config.tokenEstimation, ...newConfig.tokenEstimation }
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): RankingConfig {
    return { ...this.config };
  }
}