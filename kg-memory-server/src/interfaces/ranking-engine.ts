import { Directive, RankedDirective, TaskContext, RankingOptions } from '../types.js';

/**
 * Interface for relevance ranking engines that score and rank directives
 * based on task context and various relevance factors
 */
export interface RankingEngine {
  /**
   * Rank directives based on task context and options
   */
  rankDirectives(
    candidates: Directive[], 
    context: TaskContext, 
    options: RankingOptions
  ): Promise<RankedDirective[]>;
  
  /**
   * Calculate relevance score for a single directive
   */
  calculateScore(directive: Directive, context: TaskContext): Promise<number>;
  
  /**
   * Apply token budget constraints to ranked results
   */
  applyTokenBudget(
    rankedDirectives: RankedDirective[], 
    tokenBudget: number
  ): RankedDirective[];
}

/**
 * Interface for the scoring algorithm components
 */
export interface RankingAlgorithm {
  /**
   * Calculate weighted score for a directive given task context
   */
  calculateScore(directive: Directive, context: TaskContext): number;
  
  /**
   * Score based on rule authority for detected topics
   */
  authorityScore(directive: Directive, topics: string[]): number;
  
  /**
   * Score based on architectural layer match
   */
  layerMatchScore(directive: Directive, layer: string): number;
  
  /**
   * Score based on topic overlap between directive and context
   */
  topicOverlapScore(directive: Directive, topics: string[]): number;
  
  /**
   * Boost score based on directive severity (MUST > SHOULD > MAY)
   */
  severityBoost(severity: "MUST" | "SHOULD" | "MAY"): number;
  
  /**
   * Score based on semantic similarity to task description
   */
  semanticSimilarity(directive: Directive, taskText: string): number;
  
  /**
   * Score based on "when to apply" conditions matching task keywords
   */
  whenToApplyScore(directive: Directive, keywords: string[]): number;
}

/**
 * Configuration for ranking weights and parameters
 */
export interface RankingConfig {
  weights: {
    authority: number;
    layerMatch: number;
    topicOverlap: number;
    severityBoost: number;
    semanticSimilarity: number;
    whenToApply: number;
  };
  severityMultipliers: {
    MUST: number;
    SHOULD: number;
    MAY: number;
  };
  tokenEstimation: {
    averageTokensPerDirective: number;
    overheadTokens: number;
  };
}