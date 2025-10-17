/**
 * Scoring & Ranking Engine (Phase 3)
 * 
 * Implements intelligent rule ranking with:
 * - Weighted multi-factor scoring algorithm
 * - Severity-based prioritization
 * - Token budget management
 * - Mode-based adjustments (architect, code, debug)
 */

export interface ScoringWeights {
  severity: number;         // 0.30
  relevance: number;        // 0.25
  layerMatch: number;       // 0.20
  topicMatch: number;       // 0.15
  authoritativeness: number; // 0.10
}

export interface ScoredDirective {
  id: string;
  content: string;
  severity: 'MUST' | 'SHOULD' | 'MAY';
  topics: string[];
  layers: string[];
  technologies: string[];
  section: string;
  sourcePath: string;
  
  // Scoring fields
  severityScore: number;
  relevanceScore: number;
  layerScore: number;
  topicScore: number;
  authorityScore: number;
  totalScore: number;  // 0-1 normalized
}

export interface RankingInput {
  detectedLayer: string;
  detectedTopics: string[];
  detectedTechnologies: string[];
  directives: Array<{
    id: string;
    content: string;
    severity: 'MUST' | 'SHOULD' | 'MAY';
    topics: string[];
    layers: string[];
    technologies: string[];
    section: string;
    sourcePath: string;
  }>;
  mode?: 'architect' | 'code' | 'debug';
  maxItems?: number;
  tokenBudget?: number;
}

const DEFAULT_WEIGHTS: ScoringWeights = {
  severity: 0.30,
  relevance: 0.25,
  layerMatch: 0.20,
  topicMatch: 0.15,
  authoritativeness: 0.10
};

const MODE_ADJUSTMENTS: Record<string, Record<string, number>> = {
  architect: {
    'architecture': 1.5,
    'pattern': 1.5,
    '1-Presentation': 0.8,
    '7-Deployment': 0.8
  },
  code: {
    'testing': 1.3,
    'performance': 1.1,
    'implementation': 1.2,
    '3-Domain': 1.2,
    '4-Persistence': 1.1
  },
  debug: {
    'error': 1.5,
    'logging': 1.3,
    'testing': 1.2,
    'performance': 0.8
  }
};

export class ScoringEngine {
  /**
   * Score a single directive based on multiple factors
   */
  static scoreDirective(
    directive: RankingInput['directives'][0],
    input: {
      detectedLayer: string;
      detectedTopics: string[];
      detectedTechnologies: string[];
      mode?: 'architect' | 'code' | 'debug';
    },
    weights: ScoringWeights = DEFAULT_WEIGHTS
  ): ScoredDirective {
    // Calculate individual scores
    const severityScore = this.calculateSeverityScore(directive.severity);
    const relevanceScore = this.calculateRelevanceScore(
      directive.content,
      input.detectedLayer
    );
    const layerScore = this.calculateLayerScore(
      directive.layers,
      input.detectedLayer
    );
    const topicScore = this.calculateTopicScore(
      directive.topics,
      input.detectedTopics
    );
    const authorityScore = this.calculateAuthorityScore(
      directive.severity,
      directive.section
    );

    // Apply weighted combination
    let totalScore = (
      severityScore * weights.severity +
      relevanceScore * weights.relevance +
      layerScore * weights.layerMatch +
      topicScore * weights.topicMatch +
      authorityScore * weights.authoritativeness
    );

    // Normalize to 0-1 range
    totalScore = Math.min(totalScore / 100, 1.0);

    // Apply mode adjustments
    if (input.mode) {
      totalScore = this.applyModeAdjustment(
        totalScore,
        directive,
        input.mode as 'architect' | 'code' | 'debug'
      );
    }

    return {
      ...directive,
      severityScore,
      relevanceScore,
      layerScore,
      topicScore,
      authorityScore,
      totalScore
    };
  }

  /**
   * Calculate severity score (MUST=100, SHOULD=50, MAY=25)
   */
  private static calculateSeverityScore(severity: string): number {
    switch (severity) {
      case 'MUST':
        return 100;
      case 'SHOULD':
        return 50;
      case 'MAY':
        return 25;
      default:
        return 0;
    }
  }

  /**
   * Calculate relevance score based on content match
   */
  private static calculateRelevanceScore(content: string, layer: string): number {
    const contentLength = content.length;
    const relevanceBase = Math.min(contentLength / 100, 1) * 50; // Max 50 points

    // Bonus if layer mentioned in content
    if (layer !== '*' && content.toLowerCase().includes(layer.toLowerCase())) {
      return Math.min(relevanceBase + 25, 100);
    }

    return relevanceBase;
  }

  /**
   * Calculate layer matching score
   */
  private static calculateLayerScore(
    directiveLayers: string[],
    detectedLayer: string
  ): number {
    if (detectedLayer === '*' || directiveLayers.length === 0) {
      return 25; // Default score for wildcard
    }

    // Exact match
    if (directiveLayers.includes(detectedLayer)) {
      return 100;
    }

    // Adjacent layer (difference of 1)
    const detectedNum = parseInt(detectedLayer.split('-')[0]);
    for (const layer of directiveLayers) {
      const layerNum = parseInt(layer.split('-')[0]);
      if (Math.abs(detectedNum - layerNum) === 1) {
        return 50;
      }
    }

    // Different layer
    return 10;
  }

  /**
   * Calculate topic matching score
   */
  private static calculateTopicScore(
    directiveTopics: string[],
    detectedTopics: string[]
  ): number {
    if (directiveTopics.length === 0 || detectedTopics.length === 0) {
      return 25;
    }

    let matches = 0;
    for (const topic of directiveTopics) {
      if (detectedTopics.includes(topic)) {
        matches++;
      }
    }

    // Score based on percentage of matches
    return (matches / Math.max(directiveTopics.length, detectedTopics.length)) * 100;
  }

  /**
   * Calculate authoritativeness score (based on section and severity)
   */
  private static calculateAuthorityScore(severity: string, section: string): number {
    let score = 30; // Base score

    // Bonus for critical sections
    const criticalKeywords = [
      'security', 'authentication', 'authorization',
      'database', 'transaction', 'performance',
      'deployment', 'production'
    ];

    for (const keyword of criticalKeywords) {
      if (section.toLowerCase().includes(keyword)) {
        score += 20;
        break;
      }
    }

    // Bonus for MUST severity
    if (severity === 'MUST') {
      score += 20;
    }

    return Math.min(score, 100);
  }

  /**
   * Apply mode-based scoring adjustments
   */
  private static applyModeAdjustment(
    baseScore: number,
    directive: RankingInput['directives'][0],
    mode: 'architect' | 'code' | 'debug'
  ): number {
    const adjustments = MODE_ADJUSTMENTS[mode] || {};

    let multiplier = 1.0;

    // Check for mode-specific keywords
    for (const [keyword, adjustment] of Object.entries(adjustments)) {
      const searchText = `${directive.content} ${directive.topics.join(' ')} ${directive.section}`.toLowerCase();
      if (searchText.includes(keyword.toLowerCase())) {
        multiplier *= adjustment;
      }
    }

    // Ensure result stays in 0-1 range
    return Math.min(baseScore * multiplier, 1.0);
  }
}

/**
 * Token Counter for budget management
 */
export class TokenCounter {
  /**
   * Estimate tokens in text (rough: 1 token ≈ 4 characters)
   */
  static estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Select directives that fit within token budget
   */
  static selectWithinBudget(
    directives: ScoredDirective[],
    budget: number
  ): { selected: ScoredDirective[]; totalTokens: number } {
    const selected: ScoredDirective[] = [];
    let totalTokens = 0;

    for (const directive of directives) {
      const directiveTokens = this.estimateTokens(directive.content) + 50; // Add overhead

      if (totalTokens + directiveTokens <= budget) {
        selected.push(directive);
        totalTokens += directiveTokens;
      } else {
        break; // Stop when budget exceeded
      }
    }

    return { selected, totalTokens };
  }
}
