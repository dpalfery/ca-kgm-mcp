import { Directive, RankedDirective, TaskContext, RankingOptions, RankingConfig } from '../types.js';
import { RankingEngine } from '../interfaces/ranking-engine.js';
import { ScoringAlgorithm, DEFAULT_RANKING_CONFIG } from './scoring-algorithm.js';
import { TokenBudgetManager, DEFAULT_TOKEN_BUDGET_CONFIG } from './token-budget-manager.js';

/**
 * Performance optimization settings for ranking
 */
interface RankingPerformanceConfig {
  maxCandidates: number;
  batchSize: number;
  enableParallelScoring: boolean;
  scoreThreshold: number;
}

const DEFAULT_PERFORMANCE_CONFIG: RankingPerformanceConfig = {
  maxCandidates: 1000,
  batchSize: 50,
  enableParallelScoring: true,
  scoreThreshold: 0.1
};

/**
 * Implementation of the directive ranking engine that scores and ranks directives
 * based on task context using the scoring algorithm
 */
export class DirectiveRankingEngine implements RankingEngine {
  private scoringAlgorithm: ScoringAlgorithm;
  private tokenBudgetManager: TokenBudgetManager;
  private performanceConfig: RankingPerformanceConfig;

  constructor(
    config: RankingConfig = DEFAULT_RANKING_CONFIG,
    performanceConfig: RankingPerformanceConfig = DEFAULT_PERFORMANCE_CONFIG
  ) {
    this.scoringAlgorithm = new ScoringAlgorithm(config);
    this.tokenBudgetManager = new TokenBudgetManager(config.tokenEstimation ? {
      ...DEFAULT_TOKEN_BUDGET_CONFIG,
      averageTokensPerDirective: config.tokenEstimation.averageTokensPerDirective,
      overheadTokens: config.tokenEstimation.overheadTokens
    } : DEFAULT_TOKEN_BUDGET_CONFIG);
    this.performanceConfig = performanceConfig;
  }

  /**
   * Rank directives based on task context and options
   */
  async rankDirectives(
    candidates: Directive[], 
    context: TaskContext, 
    options: RankingOptions = {}
  ): Promise<RankedDirective[]> {
    // Validate inputs
    if (!candidates || candidates.length === 0) {
      return [];
    }

    if (!context) {
      throw new Error('Task context is required for ranking');
    }

    // Apply performance limits
    const limitedCandidates = this.applyPerformanceLimits(candidates);

    // Score all directives
    const rankedDirectives = await this.scoreDirectives(limitedCandidates, context);

    // Filter by score threshold
    const filteredDirectives = this.filterByScoreThreshold(rankedDirectives);

    // Sort by score (descending)
    const sortedDirectives = this.sortByScore(filteredDirectives);

    // Apply result limits
    const limitedResults = this.applyResultLimits(sortedDirectives, options);

    // Validate results
    this.validateResults(limitedResults, context);

    return limitedResults;
  }

  /**
   * Calculate relevance score for a single directive
   */
  async calculateScore(directive: Directive, context: TaskContext): Promise<number> {
    if (!directive || !context) {
      return 0;
    }

    return this.scoringAlgorithm.calculateScore(directive, context);
  }

  /**
   * Apply token budget constraints to ranked results
   */
  applyTokenBudget(
    rankedDirectives: RankedDirective[], 
    tokenBudget: number
  ): RankedDirective[] {
    const result = this.tokenBudgetManager.applyBudget(rankedDirectives, tokenBudget);
    return result.selectedDirectives;
  }

  /**
   * Apply performance limits to candidate directives
   */
  private applyPerformanceLimits(candidates: Directive[]): Directive[] {
    if (candidates.length <= this.performanceConfig.maxCandidates) {
      return candidates;
    }

    // For large candidate sets, apply pre-filtering based on severity
    const mustDirectives = candidates.filter(d => d.severity === 'MUST');
    const shouldDirectives = candidates.filter(d => d.severity === 'SHOULD');
    const mayDirectives = candidates.filter(d => d.severity === 'MAY');

    const result: Directive[] = [];
    const remainingSlots = this.performanceConfig.maxCandidates;

    // Prioritize MUST directives
    result.push(...mustDirectives.slice(0, Math.min(mustDirectives.length, remainingSlots)));
    
    if (result.length < remainingSlots) {
      const shouldSlots = Math.min(shouldDirectives.length, remainingSlots - result.length);
      result.push(...shouldDirectives.slice(0, shouldSlots));
    }

    if (result.length < remainingSlots) {
      const maySlots = Math.min(mayDirectives.length, remainingSlots - result.length);
      result.push(...mayDirectives.slice(0, maySlots));
    }

    return result;
  }

  /**
   * Score all directives using the scoring algorithm
   */
  private async scoreDirectives(
    candidates: Directive[], 
    context: TaskContext
  ): Promise<RankedDirective[]> {
    const rankedDirectives: RankedDirective[] = [];

    if (this.performanceConfig.enableParallelScoring && candidates.length > this.performanceConfig.batchSize) {
      // Process in batches for better performance
      for (let i = 0; i < candidates.length; i += this.performanceConfig.batchSize) {
        const batch = candidates.slice(i, i + this.performanceConfig.batchSize);
        const batchResults = await Promise.all(
          batch.map(directive => this.scoreDirective(directive, context))
        );
        rankedDirectives.push(...batchResults);
      }
    } else {
      // Sequential processing for smaller sets
      for (const directive of candidates) {
        const rankedDirective = await this.scoreDirective(directive, context);
        rankedDirectives.push(rankedDirective);
      }
    }

    return rankedDirectives;
  }

  /**
   * Score a single directive and create a RankedDirective
   */
  private async scoreDirective(directive: Directive, context: TaskContext): Promise<RankedDirective> {
    const scoreBreakdown = {
      authority: this.scoringAlgorithm.authorityScore(directive, context.topics),
      layerMatch: this.scoringAlgorithm.layerMatchScore(directive, context.layer),
      topicOverlap: this.scoringAlgorithm.topicOverlapScore(directive, context.topics),
      severityBoost: this.scoringAlgorithm.severityBoost(directive.severity),
      semanticSimilarity: this.scoringAlgorithm.semanticSimilarity(directive, context.keywords.join(' ')),
      whenToApply: this.scoringAlgorithm.whenToApplyScore(directive, context.keywords)
    };

    const totalScore = this.scoringAlgorithm.calculateScore(directive, context);

    return {
      ...directive,
      score: totalScore,
      scoreBreakdown
    };
  }

  /**
   * Filter directives by minimum score threshold
   */
  private filterByScoreThreshold(rankedDirectives: RankedDirective[]): RankedDirective[] {
    return rankedDirectives.filter(directive => 
      directive.score >= this.performanceConfig.scoreThreshold
    );
  }

  /**
   * Sort directives by score in descending order
   */
  private sortByScore(rankedDirectives: RankedDirective[]): RankedDirective[] {
    return rankedDirectives.sort((a, b) => {
      // Primary sort: by score (descending)
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      
      // Secondary sort: by severity (MUST > SHOULD > MAY)
      const severityOrder = { 'MUST': 3, 'SHOULD': 2, 'MAY': 1 };
      const aSeverity = severityOrder[a.severity];
      const bSeverity = severityOrder[b.severity];
      
      if (bSeverity !== aSeverity) {
        return bSeverity - aSeverity;
      }
      
      // Tertiary sort: by ID for consistency
      return a.id.localeCompare(b.id);
    });
  }

  /**
   * Apply result limits based on options
   */
  private applyResultLimits(
    sortedDirectives: RankedDirective[], 
    options: RankingOptions
  ): RankedDirective[] {
    let result = sortedDirectives;

    // Apply maxItems limit
    if (options.maxItems && options.maxItems > 0) {
      result = result.slice(0, options.maxItems);
    }

    // Apply token budget if specified
    if (options.tokenBudget && options.tokenBudget > 0) {
      result = this.applyTokenBudget(result, options.tokenBudget);
    }

    return result;
  }

  /**
   * Validate ranking results for quality and consistency
   */
  private validateResults(rankedDirectives: RankedDirective[], context: TaskContext): void {
    if (rankedDirectives.length === 0) {
      return; // Empty results are valid
    }

    // Ensure scores are in descending order
    for (let i = 1; i < rankedDirectives.length; i++) {
      if (rankedDirectives[i].score > rankedDirectives[i - 1].score) {
        throw new Error('Ranking results are not properly sorted by score');
      }
    }

    // Ensure all scores are non-negative
    for (const directive of rankedDirectives) {
      if (directive.score < 0) {
        throw new Error(`Invalid negative score: ${directive.score} for directive ${directive.id}`);
      }
    }

    // Warn if no high-confidence results for high-confidence context
    if (context.confidence > 0.8 && rankedDirectives[0].score < 10) {
      console.warn('Low relevance scores despite high context confidence');
    }
  }



  /**
   * Update ranking configuration
   */
  updateConfig(config: Partial<RankingConfig>): void {
    this.scoringAlgorithm.updateConfig(config);
    
    // Update token budget manager if token estimation config changed
    if (config.tokenEstimation) {
      this.tokenBudgetManager.updateConfig({
        averageTokensPerDirective: config.tokenEstimation.averageTokensPerDirective,
        overheadTokens: config.tokenEstimation.overheadTokens
      });
    }
  }

  /**
   * Update performance configuration
   */
  updatePerformanceConfig(config: Partial<RankingPerformanceConfig>): void {
    this.performanceConfig = { ...this.performanceConfig, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): { ranking: RankingConfig; performance: RankingPerformanceConfig; tokenBudget: any } {
    return {
      ranking: this.scoringAlgorithm.getConfig(),
      performance: { ...this.performanceConfig },
      tokenBudget: this.tokenBudgetManager.getConfig()
    };
  }

  /**
   * Get token budget manager for advanced token management
   */
  getTokenBudgetManager(): TokenBudgetManager {
    return this.tokenBudgetManager;
  }
}