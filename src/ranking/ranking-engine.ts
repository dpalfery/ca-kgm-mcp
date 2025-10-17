/**
 * Ranking Engine for Directive Retrieval
 * 
 * Queries Neo4j for directives matching the context,
 * applies scoring, filtering, and ranking.
 */

import { Session, Transaction } from 'neo4j-driver';
import { ScoringEngine, DirectiveForScoring, ScoringContext, ScoredDirective } from './scoring-engine.js';
import { TokenCounter } from './token-counter.js';

export interface RankingOptions {
  maxItems?: number;
  tokenBudget?: number;
  severityFilter?: ('MUST' | 'SHOULD' | 'MAY')[];
  strictLayer?: boolean;
  mode?: 'architect' | 'code' | 'debug';
}

export interface RankingResult {
  directives: ScoredDirective[];
  stats: {
    searched: number;
    considered: number;
    selected: number;
    totalTokens: number;
    budgetRemaining: number;
  };
}

/**
 * Ranking Engine class for querying and ranking directives
 */
export class RankingEngine {
  private scoringEngine: ScoringEngine;
  private tokenCounter: TokenCounter;

  constructor(scoringEngine?: ScoringEngine, tokenCounter?: TokenCounter) {
    this.scoringEngine = scoringEngine || new ScoringEngine();
    this.tokenCounter = tokenCounter || new TokenCounter();
  }

  /**
   * Query directives from Neo4j and rank them
   */
  async queryAndRank(
    session: Session | Transaction,
    context: ScoringContext,
    options: RankingOptions = {}
  ): Promise<RankingResult> {
    const maxItems = options.maxItems || 8;
    const tokenBudget = options.tokenBudget || 1000;
    const severityFilter = options.severityFilter || ['MUST', 'SHOULD', 'MAY'];
    
    // Query Neo4j for matching directives
    const directives = await this.queryDirectives(
      session,
      context,
      severityFilter,
      options.strictLayer || false
    );

    // Score all directives
    let scored = this.scoringEngine.scoreDirectives(directives, context);

    // Apply mode-based adjustments
    if (options.mode) {
      scored = this.scoringEngine.applyModeAdjustments(scored, options.mode);
    }

    // Apply severity prioritization and token budget
    const filtered = this.applySeverityAndBudget(scored, maxItems, tokenBudget);

    return {
      directives: filtered.items,
      stats: {
        searched: directives.length,
        considered: scored.length,
        selected: filtered.itemsIncluded,
        totalTokens: filtered.totalTokens,
        budgetRemaining: filtered.budgetRemaining
      }
    };
  }

  /**
   * Query Neo4j for directives matching the context
   */
  private async queryDirectives(
    session: Session | Transaction,
    context: ScoringContext,
    severityFilter: string[],
    strictLayer: boolean
  ): Promise<DirectiveForScoring[]> {
    // Build Cypher query based on context
    const query = this.buildQuery(context, severityFilter, strictLayer);
    const params = this.buildQueryParams(context, severityFilter);

    try {
      const result = await session.run(query, params);
      
      return result.records.map(record => {
        const directive = record.get('d').properties;
        const rule = record.get('r')?.properties;
        
        return {
          id: directive.id || directive.directiveId,
          text: directive.text,
          severity: directive.severity as 'MUST' | 'SHOULD' | 'MAY',
          topics: directive.topics || [],
          layers: directive.layers || [],
          technologies: directive.technologies || [],
          authoritative: rule?.authoritative || false,
          section: directive.section || undefined
        };
      });
    } catch (error) {
      console.error('Error querying directives:', error);
      return [];
    }
  }

  /**
   * Build Cypher query based on context
   */
  private buildQuery(
    context: ScoringContext,
    severityFilter: string[],
    strictLayer: boolean
  ): string {
    const conditions: string[] = [];

    // Severity filter
    if (severityFilter.length < 3) {
      conditions.push('d.severity IN $severityFilter');
    }

    // Layer filter (if strict)
    if (strictLayer && context.detectedLayer && context.detectedLayer !== '*') {
      conditions.push('$detectedLayer IN d.layers');
    }

    // Topic or technology filter (at least one match)
    if (context.topics.length > 0 || context.technologies.length > 0) {
      const topicCondition = context.topics.length > 0 
        ? 'any(t IN $topics WHERE t IN d.topics)'
        : null;
      const techCondition = context.technologies.length > 0
        ? 'any(tech IN $technologies WHERE tech IN d.technologies)'
        : null;

      if (topicCondition && techCondition) {
        conditions.push(`(${topicCondition} OR ${techCondition})`);
      } else if (topicCondition) {
        conditions.push(topicCondition);
      } else if (techCondition) {
        conditions.push(techCondition);
      }
    }

    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    return `
      MATCH (d:Directive)
      OPTIONAL MATCH (r:Rule)-[:HAS_DIRECTIVE]->(d)
      ${whereClause}
      RETURN d, r
      LIMIT 100
    `;
  }

  /**
   * Build query parameters
   */
  private buildQueryParams(
    context: ScoringContext,
    severityFilter: string[]
  ): Record<string, any> {
    return {
      severityFilter,
      detectedLayer: context.detectedLayer || '*',
      topics: context.topics,
      technologies: context.technologies
    };
  }

  /**
   * Apply severity prioritization and token budget filtering
   */
  private applySeverityAndBudget(
    directives: ScoredDirective[],
    maxItems: number,
    tokenBudget: number
  ): {
    items: ScoredDirective[];
    totalTokens: number;
    budgetRemaining: number;
    itemsIncluded: number;
  } {
    // Reserve tokens for formatting overhead
    const formatOverhead = this.tokenCounter.calculateFormatOverhead({
      includeHeader: true,
      includeMetadata: true,
      includeCitations: true,
      numSections: 3
    });

    // Apply severity-based budget allocation
    const budgetResult = this.tokenCounter.allocateBudgetBySeverity(
      directives,
      tokenBudget,
      { reserveTokens: formatOverhead }
    );

    // Limit to maxItems (already sorted by score within severity)
    const limited = budgetResult.items.slice(0, maxItems) as ScoredDirective[];

    return {
      items: limited,
      totalTokens: budgetResult.totalTokens,
      budgetRemaining: budgetResult.budgetRemaining,
      itemsIncluded: limited.length
    };
  }

  /**
   * Get directives by severity with score threshold
   */
  filterByScoreThreshold(
    directives: ScoredDirective[],
    threshold: number
  ): ScoredDirective[] {
    return directives.filter(d => d.score >= threshold);
  }

  /**
   * Get top N directives by score
   */
  getTopN(directives: ScoredDirective[], n: number): ScoredDirective[] {
    return directives.slice(0, n);
  }

  /**
   * Group directives by severity for formatting
   */
  groupBySeverity(directives: ScoredDirective[]): {
    MUST: ScoredDirective[];
    SHOULD: ScoredDirective[];
    MAY: ScoredDirective[];
  } {
    return {
      MUST: directives.filter(d => d.severity === 'MUST'),
      SHOULD: directives.filter(d => d.severity === 'SHOULD'),
      MAY: directives.filter(d => d.severity === 'MAY')
    };
  }
}
