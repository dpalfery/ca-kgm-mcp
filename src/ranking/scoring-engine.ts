/**
 * Scoring Engine for Rule Ranking
 * 
 * Implements sophisticated scoring algorithm to rank directives based on:
 * - Severity (MUST > SHOULD > MAY)
 * - Relevance (exact match > keyword match > fuzzy)
 * - Layer matching (exact > adjacent > distant)
 * - Topic matching
 * - Technology matching
 * - Authoritativeness
 */

export interface ScoringWeights {
  severity: number;           // 0-1, default 0.30
  relevance: number;          // 0-1, default 0.25
  layerMatch: number;         // 0-1, default 0.20
  topicMatch: number;         // 0-1, default 0.15
  techMatch: number;          // 0-1, default 0.05
  authoritativeness: number;  // 0-1, default 0.05
}

export interface DirectiveForScoring {
  id: string;
  text: string;
  severity: 'MUST' | 'SHOULD' | 'MAY';
  topics: string[];
  layers: string[];
  technologies: string[];
  authoritative?: boolean;
  section?: string;
}

export interface ScoringContext {
  detectedLayer?: string;
  topics: string[];
  technologies: string[];
  keywords?: string[];
}

export interface ScoredDirective extends DirectiveForScoring {
  score: number;
  scoreBreakdown: {
    severity: number;
    relevance: number;
    layerMatch: number;
    topicMatch: number;
    techMatch: number;
    authoritativeness: number;
  };
}

const DEFAULT_WEIGHTS: ScoringWeights = {
  severity: 0.30,
  relevance: 0.25,
  layerMatch: 0.20,
  topicMatch: 0.15,
  techMatch: 0.05,
  authoritativeness: 0.05
};

// Layer hierarchy for adjacency calculation
const LAYER_ORDER = [
  '1-Presentation',
  '2-Application',
  '3-Domain',
  '4-Persistence',
  '5-Integration',
  '6-Tests',
  '7-Infrastructure'
];

export class ScoringEngine {
  private weights: ScoringWeights;

  constructor(weights: Partial<ScoringWeights> = {}) {
    this.weights = { ...DEFAULT_WEIGHTS, ...weights };
    this.validateWeights();
  }

  private validateWeights(): void {
    const sum = Object.values(this.weights).reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1.0) > 0.01) {
      throw new Error(`Scoring weights must sum to 1.0, got ${sum}`);
    }
  }

  /**
   * Score a single directive based on the context
   */
  scoreDirective(directive: DirectiveForScoring, context: ScoringContext): ScoredDirective {
    const breakdown = {
      severity: this.calculateSeverityScore(directive.severity),
      relevance: this.calculateRelevanceScore(directive, context),
      layerMatch: this.calculateLayerScore(directive.layers, context.detectedLayer),
      topicMatch: this.calculateTopicScore(directive.topics, context.topics),
      techMatch: this.calculateTechScore(directive.technologies, context.technologies),
      authoritativeness: directive.authoritative ? 100 : 0
    };

    const totalScore = (
      breakdown.severity * this.weights.severity +
      breakdown.relevance * this.weights.relevance +
      breakdown.layerMatch * this.weights.layerMatch +
      breakdown.topicMatch * this.weights.topicMatch +
      breakdown.techMatch * this.weights.techMatch +
      breakdown.authoritativeness * this.weights.authoritativeness
    );

    return {
      ...directive,
      score: totalScore / 100, // Normalize to 0-1
      scoreBreakdown: breakdown
    };
  }

  /**
   * Score multiple directives and sort by score
   */
  scoreDirectives(directives: DirectiveForScoring[], context: ScoringContext): ScoredDirective[] {
    return directives
      .map(d => this.scoreDirective(d, context))
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Calculate severity score
   * MUST = 100, SHOULD = 50, MAY = 25
   */
  private calculateSeverityScore(severity: 'MUST' | 'SHOULD' | 'MAY'): number {
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
   * Calculate relevance score based on keyword matching
   * Exact match = 100, Keyword match = 60, Fuzzy match = 30
   */
  private calculateRelevanceScore(directive: DirectiveForScoring, context: ScoringContext): number {
    if (!context.keywords || context.keywords.length === 0) {
      return 50; // Default medium relevance if no keywords
    }

    const directiveText = directive.text.toLowerCase();
    let maxScore = 0;

    for (const keyword of context.keywords) {
      const keywordLower = keyword.toLowerCase();
      
      // Exact phrase match
      if (directiveText.includes(keywordLower)) {
        maxScore = Math.max(maxScore, 100);
      }
      // Word-level match
      else if (this.hasWordMatch(directiveText, keywordLower)) {
        maxScore = Math.max(maxScore, 60);
      }
      // Fuzzy match (contains parts of the keyword)
      else if (this.hasFuzzyMatch(directiveText, keywordLower)) {
        maxScore = Math.max(maxScore, 30);
      }
    }

    return maxScore;
  }

  /**
   * Calculate layer matching score
   * Exact match = 100, Adjacent = 50, Distant = 10, Wildcard = 40
   */
  private calculateLayerScore(directiveLayers: string[], detectedLayer?: string): number {
    if (!detectedLayer || detectedLayer === '*') {
      return 40; // Default for wildcard/unknown layer
    }

    if (directiveLayers.length === 0) {
      return 40; // No layer specified, give default score
    }

    let maxScore = 0;
    const detectedIndex = LAYER_ORDER.indexOf(detectedLayer);

    for (const layer of directiveLayers) {
      if (layer === '*') {
        maxScore = Math.max(maxScore, 40);
        continue;
      }

      if (layer === detectedLayer) {
        return 100; // Exact match, return immediately
      }

      const layerIndex = LAYER_ORDER.indexOf(layer);
      if (layerIndex === -1 || detectedIndex === -1) {
        continue;
      }

      const distance = Math.abs(layerIndex - detectedIndex);
      if (distance === 1) {
        maxScore = Math.max(maxScore, 50); // Adjacent layer
      } else if (distance === 2) {
        maxScore = Math.max(maxScore, 30); // Close layer
      } else {
        maxScore = Math.max(maxScore, 10); // Distant layer
      }
    }

    return maxScore;
  }

  /**
   * Calculate topic matching score
   * Per topic matched: +20 points (max 100)
   */
  private calculateTopicScore(directiveTopics: string[], contextTopics: string[]): number {
    if (contextTopics.length === 0 || directiveTopics.length === 0) {
      return 0;
    }

    const matches = directiveTopics.filter(dt => 
      contextTopics.some(ct => ct.toLowerCase() === dt.toLowerCase())
    ).length;

    return Math.min(matches * 20, 100);
  }

  /**
   * Calculate technology matching score
   * Per technology matched: +25 points (max 100)
   */
  private calculateTechScore(directiveTech: string[], contextTech: string[]): number {
    if (contextTech.length === 0 || directiveTech.length === 0) {
      return 0;
    }

    const matches = directiveTech.filter(dt => 
      contextTech.some(ct => ct.toLowerCase() === dt.toLowerCase())
    ).length;

    return Math.min(matches * 25, 100);
  }

  /**
   * Check if text contains keyword as a complete word
   */
  private hasWordMatch(text: string, keyword: string): boolean {
    const words = text.split(/\s+/);
    return words.some(word => word.includes(keyword));
  }

  /**
   * Check if text contains parts of the keyword (fuzzy match)
   */
  private hasFuzzyMatch(text: string, keyword: string): boolean {
    if (keyword.length < 4) return false; // Don't fuzzy match short keywords
    
    const parts = keyword.split(/[-_\s]/);
    return parts.some(part => part.length >= 3 && text.includes(part));
  }

  /**
   * Apply mode-specific scoring adjustments
   */
  applyModeAdjustments(
    scoredDirectives: ScoredDirective[],
    mode?: 'architect' | 'code' | 'debug'
  ): ScoredDirective[] {
    if (!mode) return scoredDirectives;

    const modeAdjustments = this.getModeAdjustments(mode);

    return scoredDirectives.map(directive => {
      let adjustment = 1.0;

      for (const topic of directive.topics) {
        const topicAdjustment = modeAdjustments[topic.toLowerCase()];
        if (topicAdjustment) {
          adjustment = Math.max(adjustment, topicAdjustment);
        }
      }

      return {
        ...directive,
        score: Math.min(directive.score * adjustment, 1.0) // Cap at 1.0
      };
    }).sort((a, b) => b.score - a.score);
  }

  private getModeAdjustments(mode: 'architect' | 'code' | 'debug'): Record<string, number> {
    const adjustments = {
      architect: {
        'architecture': 1.5,
        'design-pattern': 1.5,
        'design': 1.5,
        'scalability': 1.2,
        'testing': 0.8,
        'documentation': 1.1
      },
      code: {
        'coding-standard': 1.5,
        'testing': 1.3,
        'performance': 1.1,
        'architecture': 0.8,
        'code-quality': 1.4
      },
      debug: {
        'error-handling': 1.5,
        'logging': 1.3,
        'testing': 1.2,
        'documentation': 0.8,
        'debugging': 1.5
      }
    };

    return adjustments[mode];
  }
}
