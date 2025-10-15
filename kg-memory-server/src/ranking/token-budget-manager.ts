import { RankedDirective } from '../types.js';

/**
 * Configuration for token estimation and budget management
 */
export interface TokenBudgetConfig {
  /** Average tokens per directive (used for estimation) */
  averageTokensPerDirective: number;
  /** Overhead tokens for formatting, citations, etc. */
  overheadTokens: number;
  /** Minimum tokens required for a directive to be included */
  minimumDirectiveTokens: number;
  /** Maximum percentage of budget that can be used for a single directive */
  maxSingleDirectivePercentage: number;
  /** Enable aggressive truncation for high-priority directives */
  enableAggressiveTruncation: boolean;
  /** Tokens to reserve for truncation indicators (...) */
  truncationIndicatorTokens: number;
}

export const DEFAULT_TOKEN_BUDGET_CONFIG: TokenBudgetConfig = {
  averageTokensPerDirective: 50,
  overheadTokens: 20,
  minimumDirectiveTokens: 15,
  maxSingleDirectivePercentage: 0.4,
  enableAggressiveTruncation: true,
  truncationIndicatorTokens: 3
};

/**
 * Result of token budget analysis
 */
export interface TokenBudgetResult {
  /** Directives that fit within the budget */
  selectedDirectives: RankedDirective[];
  /** Total estimated tokens used */
  tokensUsed: number;
  /** Remaining tokens in budget */
  tokensRemaining: number;
  /** Number of directives that were truncated */
  truncatedCount: number;
  /** Number of directives that were excluded due to budget */
  excludedCount: number;
  /** Breakdown of token usage */
  tokenBreakdown: {
    overhead: number;
    directives: number;
    truncationIndicators: number;
  };
}

/**
 * Manages token budget constraints for directive selection and formatting
 */
export class TokenBudgetManager {
  private config: TokenBudgetConfig;

  constructor(config: TokenBudgetConfig = DEFAULT_TOKEN_BUDGET_CONFIG) {
    this.config = { ...config };
  }

  /**
   * Apply token budget constraints to a list of ranked directives
   */
  applyBudget(
    rankedDirectives: RankedDirective[], 
    tokenBudget: number
  ): TokenBudgetResult {
    if (!tokenBudget || tokenBudget <= 0) {
      return this.createEmptyResult(rankedDirectives.length);
    }

    if (rankedDirectives.length === 0) {
      return this.createEmptyResult(0);
    }

    // Reserve overhead tokens
    const availableTokens = Math.max(0, tokenBudget - this.config.overheadTokens);
    
    if (availableTokens < this.config.minimumDirectiveTokens) {
      return this.createEmptyResult(rankedDirectives.length);
    }

    const result = this.selectDirectivesWithinBudget(rankedDirectives, availableTokens);
    
    return {
      ...result,
      tokenBreakdown: {
        overhead: this.config.overheadTokens,
        directives: result.tokensUsed,
        truncationIndicators: result.truncatedCount * this.config.truncationIndicatorTokens
      }
    };
  }

  /**
   * Estimate token count for a directive
   */
  estimateDirectiveTokens(directive: RankedDirective): number {
    const textContent = this.getDirectiveTextContent(directive);
    return this.estimateTokensFromText(textContent);
  }

  /**
   * Estimate tokens from text content using character-based approximation
   */
  estimateTokensFromText(text: string): number {
    if (!text || text.trim().length === 0) {
      return 0;
    }

    // Rough approximation: 4 characters per token for English text
    // This can be refined with more sophisticated tokenization
    const charCount = text.length;
    const estimatedTokens = Math.ceil(charCount / 4);
    
    // Apply minimum token count
    return Math.max(estimatedTokens, 5);
  }

  /**
   * Truncate directive text to fit within token limit
   */
  truncateDirective(directive: RankedDirective, maxTokens: number): RankedDirective {
    if (maxTokens < this.config.minimumDirectiveTokens) {
      throw new Error(`Cannot truncate directive to ${maxTokens} tokens (minimum: ${this.config.minimumDirectiveTokens})`);
    }

    const availableTokens = maxTokens - this.config.truncationIndicatorTokens;
    const maxChars = availableTokens * 4; // Rough approximation

    const truncatedDirective = { ...directive };

    // Truncate main text first
    if (directive.text.length > maxChars) {
      truncatedDirective.text = this.truncateText(directive.text, maxChars * 0.7);
    }

    // Truncate rationale if still too long
    const currentTokens = this.estimateDirectiveTokens(truncatedDirective);
    if (currentTokens > availableTokens && directive.rationale) {
      const remainingChars = (availableTokens - this.estimateTokensFromText(truncatedDirective.text)) * 4;
      if (remainingChars > 20) {
        truncatedDirective.rationale = this.truncateText(directive.rationale, remainingChars);
      } else {
        delete truncatedDirective.rationale;
      }
    }

    // Remove example and anti-pattern if still too long
    const finalTokens = this.estimateDirectiveTokens(truncatedDirective);
    if (finalTokens > availableTokens) {
      delete truncatedDirective.example;
      delete truncatedDirective.antiPattern;
    }

    return truncatedDirective;
  }

  /**
   * Check if a directive can fit within the remaining budget
   */
  canFitDirective(directive: RankedDirective, remainingTokens: number): boolean {
    const estimatedTokens = this.estimateDirectiveTokens(directive);
    return estimatedTokens <= remainingTokens;
  }

  /**
   * Get priority-based directive selection within budget
   */
  selectByPriority(
    rankedDirectives: RankedDirective[], 
    tokenBudget: number
  ): RankedDirective[] {
    const result = this.applyBudget(rankedDirectives, tokenBudget);
    return result.selectedDirectives;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<TokenBudgetConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): TokenBudgetConfig {
    return { ...this.config };
  }

  /**
   * Select directives within the available token budget
   */
  private selectDirectivesWithinBudget(
    rankedDirectives: RankedDirective[], 
    availableTokens: number
  ): Omit<TokenBudgetResult, 'tokenBreakdown'> {
    const selectedDirectives: RankedDirective[] = [];
    let tokensUsed = 0;
    let truncatedCount = 0;
    let excludedCount = 0;

    const maxSingleDirectiveTokens = Math.floor(availableTokens * this.config.maxSingleDirectivePercentage);

    for (const directive of rankedDirectives) {
      const estimatedTokens = this.estimateDirectiveTokens(directive);
      const remainingTokens = availableTokens - tokensUsed;

      if (estimatedTokens <= remainingTokens) {
        // Directive fits as-is
        selectedDirectives.push(directive);
        tokensUsed += estimatedTokens;
      } else if (this.shouldTruncateDirective(directive, remainingTokens, maxSingleDirectiveTokens)) {
        // Try to truncate high-priority directive
        try {
          const truncatedDirective = this.truncateDirective(directive, remainingTokens);
          const truncatedTokens = this.estimateDirectiveTokens(truncatedDirective);
          
          if (truncatedTokens <= remainingTokens) {
            selectedDirectives.push(truncatedDirective);
            tokensUsed += truncatedTokens;
            truncatedCount++;
          } else {
            excludedCount++;
          }
        } catch {
          excludedCount++;
        }
      } else {
        excludedCount++;
      }

      // Stop if no more tokens available
      if (tokensUsed >= availableTokens) {
        excludedCount += rankedDirectives.length - selectedDirectives.length - truncatedCount;
        break;
      }
    }

    return {
      selectedDirectives,
      tokensUsed,
      tokensRemaining: availableTokens - tokensUsed,
      truncatedCount,
      excludedCount
    };
  }

  /**
   * Determine if a directive should be truncated rather than excluded
   */
  private shouldTruncateDirective(
    directive: RankedDirective, 
    remainingTokens: number, 
    maxSingleDirectiveTokens: number
  ): boolean {
    if (!this.config.enableAggressiveTruncation) {
      return false;
    }

    // Only truncate high-priority directives
    if (directive.severity !== 'MUST' && directive.score < 50) {
      return false;
    }

    // Must have minimum tokens available for truncation
    if (remainingTokens < this.config.minimumDirectiveTokens) {
      return false;
    }

    // Don't truncate if it would use too much of the remaining budget
    return remainingTokens <= maxSingleDirectiveTokens;
  }

  /**
   * Get all text content from a directive for token estimation
   */
  private getDirectiveTextContent(directive: RankedDirective): string {
    const parts = [directive.text];
    
    if (directive.rationale) {
      parts.push(directive.rationale);
    }
    
    if (directive.example) {
      parts.push(directive.example);
    }
    
    if (directive.antiPattern) {
      parts.push(directive.antiPattern);
    }

    return parts.join(' ');
  }

  /**
   * Truncate text to approximately fit within character limit
   */
  private truncateText(text: string, maxChars: number): string {
    if (text.length <= maxChars) {
      return text;
    }

    // Try to truncate at word boundary
    const truncated = text.substring(0, maxChars - 3);
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > maxChars * 0.7) {
      return truncated.substring(0, lastSpace) + '...';
    }
    
    return truncated + '...';
  }

  /**
   * Create empty result for cases where no directives can be selected
   */
  private createEmptyResult(totalDirectives: number): TokenBudgetResult {
    return {
      selectedDirectives: [],
      tokensUsed: 0,
      tokensRemaining: 0,
      truncatedCount: 0,
      excludedCount: totalDirectives,
      tokenBreakdown: {
        overhead: this.config.overheadTokens,
        directives: 0,
        truncationIndicators: 0
      }
    };
  }
}