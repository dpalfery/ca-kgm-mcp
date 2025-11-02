/**
 * Rule Analyzer
 *
 * Analyzes markdown documents to determine if they should be split into multiple rules.
 * Uses LLM to make intelligent splitting decisions based on content analysis.
 */

import { LocalModelManager } from '../rules/local-model-manager';
import { z } from 'zod';

export interface DocumentSplit {
  content: string;
  metadata?: any;
  splitReason?: string;
}

export interface AnalysisResult {
  shouldSplit: boolean;
  concerns: Array<{
    name: string;
    description: string;
    suggestedSplitPoint?: number | undefined;
  }>;
  confidence: number;
  reasoning: string;
}

// Schema for LLM response
const AnalysisResultSchema = z.object({
  shouldSplit: z.boolean(),
  concerns: z.array(z.object({
    name: z.string(),
    description: z.string(),
    suggestedSplitPoint: z.number().optional()
  })),
  confidence: z.number().min(0).max(1),
  reasoning: z.string()
});

/**
 * Rule Analyzer class
 */
export class RuleAnalyzer {
  private localModelManager: LocalModelManager;

  constructor(localModelManager: LocalModelManager) {
    this.localModelManager = localModelManager;
  }

  /**
   * Analyze a markdown document and determine if it should be split
   * 
   * @param markdownContent The markdown document content to analyze
   * @returns Promise<DocumentSplit[]> Array of document splits (original or split documents)
   */
  async analyzeAndSplit(markdownContent: string): Promise<DocumentSplit[]> {
    // Check if content should be analyzed
    if (!this.shouldAnalyze(markdownContent)) {
      return [{
        content: markdownContent,
        metadata: {
          analyzed: false,
          reason: "Content too short or has explicit split markers",
          timestamp: new Date().toISOString()
        }
      }];
    }

    try {
      // Analyze the content using LLM
      const analysisResult = await this.analyzeContent(markdownContent);
      
      if (!analysisResult.shouldSplit || analysisResult.concerns.length === 0) {
        return [{
          content: markdownContent,
          metadata: {
            analyzed: true,
            splitDecision: false,
            confidence: analysisResult.confidence,
            reasoning: analysisResult.reasoning,
            timestamp: new Date().toISOString()
          },
          splitReason: "Analysis determined no splitting needed"
        }];
      }

      // Split the content based on identified concerns
      return this.splitContent(markdownContent, analysisResult.concerns);
    } catch (error) {
      console.error('Error during content analysis:', error);
      // Fall back to returning the original document
      return [{
        content: markdownContent,
        metadata: {
          analyzed: true,
          splitDecision: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        },
        splitReason: "Analysis failed, returning original document"
      }];
    }
  }

  /**
   * Analyze content to determine if splitting is needed
   * 
   * @param content The content to analyze
   * @returns Promise<AnalysisResult> Analysis results including splitting decision
   */
  private async analyzeContent(content: string): Promise<AnalysisResult> {
    const prompt = `Analyze the following markdown document content to determine if it should be split into multiple separate rules.

Content:
"""
${content}
"""

Please analyze this content and:
1. Identify if there are multiple distinct concerns or topics that should be separated
2. For each concern, provide a name, description, and suggested split point (character position)
3. Indicate your confidence in the analysis (0.0 to 1.0)
4. Provide reasoning for your decision

A document should be split if it contains:
- Multiple unrelated topics or concerns
- Different types of rules (e.g., security rules mixed with performance rules)
- Different architectural layers or components
- Separate workflows or processes

Do not split if the content:
- Is focused on a single cohesive topic
- Contains rules that are closely related and should be considered together
- Is already well-organized with clear sections`;

    const response = await this.localModelManager.generateJson(prompt, AnalysisResultSchema);
    
    if (response.success) {
      return response.data;
    } else {
      console.error('LLM analysis failed:', response.error);
      // Return a default result indicating no splitting
      return {
        shouldSplit: false,
        concerns: [],
        confidence: 0.0,
        reasoning: `Analysis failed: ${response.error}`
      };
    }
  }

  /**
   * Split content based on identified concerns
   * 
   * @param content The original content
   * @param concerns The identified concerns to split by
   * @returns DocumentSplit[] Array of split documents
   */
  private splitContent(content: string, concerns: AnalysisResult['concerns']): DocumentSplit[] {
    if (concerns.length === 0) {
      return [{
        content,
        metadata: {
          split: false,
          concernsCount: 0
        }
      }];
    }

    // Sort concerns by suggested split point
    const sortedConcerns = [...concerns]
      .filter(c => c.suggestedSplitPoint !== undefined)
      .sort((a, b) => (a.suggestedSplitPoint || 0) - (b.suggestedSplitPoint || 0));

    if (sortedConcerns.length === 0) {
      // No split points provided, return original content
      return [{
        content,
        metadata: {
          split: false,
          concernsCount: concerns.length,
          reason: "No split points provided"
        }
      }];
    }

    const splits: DocumentSplit[] = [];
    let previousPoint = 0;

    for (let i = 0; i < sortedConcerns.length; i++) {
      const concern = sortedConcerns[i];
      const splitPoint = concern.suggestedSplitPoint || 0;
      
      // Ensure we have content to split
      if (splitPoint > previousPoint) {
        const splitContent = content.substring(previousPoint, splitPoint).trim();
        if (splitContent) {
          splits.push({
            content: splitContent,
            metadata: {
              concern: concern.name,
              concernDescription: concern.description,
              splitIndex: i,
              totalSplits: sortedConcerns.length
            },
            splitReason: `Split for concern: ${concern.name}`
          });
        }
      }
      
      previousPoint = splitPoint;
    }

    // Add the remaining content
    if (previousPoint < content.length) {
      const remainingContent = content.substring(previousPoint).trim();
      if (remainingContent) {
        splits.push({
          content: remainingContent,
          metadata: {
            concern: "Remaining content",
            splitIndex: sortedConcerns.length,
            totalSplits: sortedConcerns.length + 1
          },
          splitReason: "Remaining content after last split"
        });
      }
    }

    return splits.length > 0 ? splits : [{
      content,
      metadata: {
        split: false,
        concernsCount: concerns.length,
        reason: "Splitting failed, returning original content"
      }
    }];
  }

  /**
   * Check if content meets minimum requirements for analysis
   * 
   * @param content The content to check
   * @returns boolean True if content should be analyzed
   */
  private shouldAnalyze(content: string): boolean {
    // Basic checks to avoid unnecessary LLM calls
    const wordCount = content.split(/\s+/).length;
    
    // Skip analysis for very short content
    if (wordCount < 100) {
      return false;
    }
    
    // Skip analysis if content already has explicit split markers
    if (content.includes('<!-- split: false -->') || content.includes('split: false')) {
      return false;
    }
    
    return true;
  }
}