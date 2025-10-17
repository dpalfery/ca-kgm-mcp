/**
 * Token Counter for Budget Management
 * 
 * Estimates and tracks token usage for directives to ensure
 * we stay within the specified token budget.
 */

export interface TokenEstimate {
  text: string;
  estimatedTokens: number;
}

export interface TokenBudgetResult {
  items: any[];
  totalTokens: number;
  budgetRemaining: number;
  itemsConsidered: number;
  itemsIncluded: number;
}

/**
 * Token Counter class for estimating and tracking token usage
 */
export class TokenCounter {
  /**
   * Estimate tokens for a single text string
   * Using rough approximation: ~4 characters per token
   * This is conservative and works well for English text
   */
  estimateTokens(text: string): number {
    if (!text) return 0;
    
    // More accurate estimation considering:
    // - Average word length
    // - Punctuation
    // - Special characters
    const charCount = text.length;
    const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
    
    // Base estimation: 4 chars per token
    const baseEstimate = Math.ceil(charCount / 4);
    
    // Adjust for word boundaries (tokens often align with words)
    // Add ~20% for formatting and special tokens
    const adjustedEstimate = Math.ceil(wordCount * 1.2);
    
    // Use the more conservative (higher) estimate
    return Math.max(baseEstimate, adjustedEstimate);
  }

  /**
   * Estimate tokens for multiple text strings
   */
  estimateTokensForMultiple(texts: string[]): TokenEstimate[] {
    return texts.map(text => ({
      text,
      estimatedTokens: this.estimateTokens(text)
    }));
  }

  /**
   * Filter items to fit within token budget
   * Returns items that fit and total token count
   */
  filterByBudget<T extends { text: string }>(
    items: T[],
    budget: number,
    options: {
      reserveTokens?: number; // Tokens to reserve for formatting
      includeIndex?: boolean; // Include index in result
    } = {}
  ): TokenBudgetResult {
    const reserveTokens = options.reserveTokens || 0;
    
    const included: T[] = [];
    let totalTokens = reserveTokens;
    
    for (const item of items) {
      const itemTokens = this.estimateTokens(item.text);
      
      if (totalTokens + itemTokens <= budget) {
        included.push(item);
        totalTokens += itemTokens;
      } else {
        // Would exceed budget, stop here
        break;
      }
    }
    
    return {
      items: included,
      totalTokens,
      budgetRemaining: budget - totalTokens,
      itemsConsidered: items.length,
      itemsIncluded: included.length
    };
  }

  /**
   * Calculate overhead tokens for formatting
   * Includes markdown headers, sections, metadata, etc.
   */
  calculateFormatOverhead(options: {
    includeHeader?: boolean;
    includeMetadata?: boolean;
    includeCitations?: boolean;
    numSections?: number;
  }): number {
    let overhead = 0;
    
    if (options.includeHeader) {
      // "# Contextual Rules\n\n"
      overhead += 10;
    }
    
    if (options.includeMetadata) {
      // "**Detected Context:**\n- Layer: ...\n- Topics: ...\n\n"
      overhead += 50;
    }
    
    if (options.includeCitations) {
      // "*Source: ... → ...*\n"
      overhead += 20 * (options.numSections || 1);
    }
    
    // Section headers: "## Critical (MUST) Directives\n"
    overhead += 15 * (options.numSections || 3);
    
    // Footer: "---\n**Retrieved:** ..."
    overhead += 30;
    
    return overhead;
  }

  /**
   * Estimate total tokens for a formatted context block
   */
  estimateContextBlock(
    directiveTexts: string[],
    options: {
      includeHeader?: boolean;
      includeMetadata?: boolean;
      includeCitations?: boolean;
    } = {}
  ): number {
    const overhead = this.calculateFormatOverhead({
      includeHeader: options.includeHeader ?? false,
      includeMetadata: options.includeMetadata ?? false,
      includeCitations: options.includeCitations ?? false,
      numSections: 3 // MUST, SHOULD, MAY
    });
    
    const directiveTokens = directiveTexts.reduce(
      (sum, text) => sum + this.estimateTokens(text),
      0
    );
    
    return overhead + directiveTokens;
  }

  /**
   * Smart budget allocation across severity levels
   * Ensures MUST directives get priority, then SHOULD, then MAY
   */
  allocateBudgetBySeverity<T extends { text: string; severity: 'MUST' | 'SHOULD' | 'MAY' }>(
    items: T[],
    budget: number,
    options: {
      reserveTokens?: number;
      minMustItems?: number;
    } = {}
  ): TokenBudgetResult {
    const reserveTokens = options.reserveTokens || 0;
    
    // Separate by severity
    const mustItems = items.filter(i => i.severity === 'MUST');
    const shouldItems = items.filter(i => i.severity === 'SHOULD');
    const mayItems = items.filter(i => i.severity === 'MAY');
    
    const included: T[] = [];
    let totalTokens = reserveTokens;
    
    // First, include all MUST items (or as many as fit)
    for (const item of mustItems) {
      const itemTokens = this.estimateTokens(item.text);
      if (totalTokens + itemTokens <= budget) {
        included.push(item);
        totalTokens += itemTokens;
      }
    }
    
    // Check minimum MUST items requirement
    if (options.minMustItems && included.length < options.minMustItems) {
      // Not enough MUST items fit - this is a problem
      // Return what we have with a warning in the budget
      return {
        items: included,
        totalTokens,
        budgetRemaining: budget - totalTokens,
        itemsConsidered: items.length,
        itemsIncluded: included.length
      };
    }
    
    // Then, add SHOULD items
    for (const item of shouldItems) {
      const itemTokens = this.estimateTokens(item.text);
      if (totalTokens + itemTokens <= budget) {
        included.push(item);
        totalTokens += itemTokens;
      }
    }
    
    // Finally, add MAY items if space remains
    for (const item of mayItems) {
      const itemTokens = this.estimateTokens(item.text);
      if (totalTokens + itemTokens <= budget) {
        included.push(item);
        totalTokens += itemTokens;
      }
    }
    
    return {
      items: included,
      totalTokens,
      budgetRemaining: budget - totalTokens,
      itemsConsidered: items.length,
      itemsIncluded: included.length
    };
  }

  /**
   * Get statistics about token distribution
   */
  getTokenStats(texts: string[]): {
    total: number;
    average: number;
    min: number;
    max: number;
    median: number;
  } {
    if (texts.length === 0) {
      return { total: 0, average: 0, min: 0, max: 0, median: 0 };
    }
    
    const estimates = texts.map(t => this.estimateTokens(t));
    const total = estimates.reduce((a, b) => a + b, 0);
    const sorted = [...estimates].sort((a, b) => a - b);
    
    return {
      total,
      average: total / estimates.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      median: sorted[Math.floor(sorted.length / 2)]
    };
  }
}
