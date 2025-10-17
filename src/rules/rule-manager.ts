/**
 * ContextISO Rule Manager (Neo4j Implementation)
 * 
 * Handles rule-specific functionality for context isolation and optimization.
 * Provides context detection, rule retrieval, and ranking capabilities.
 */

import { z } from 'zod';
import { Neo4jConnection } from '../storage/neo4j-connection.js';
import { Neo4jConfig } from '../config/neo4j-types.js';
import { MarkdownParser } from '../parsing/markdown-parser.js';
import { DirectiveExtractor } from '../parsing/directive-extractor.js';
import { GraphBuilder } from '../parsing/graph-builder.js';
import { RankingEngine } from '../ranking/ranking-engine.js';
import { ScoringEngine } from '../ranking/scoring-engine.js';
import { TokenCounter } from '../ranking/token-counter.js';

// Schema definitions for rule operations
const QueryDirectivesSchema = z.object({
  taskDescription: z.string(),
  modeSlug: z.enum(['architect', 'code', 'debug']).optional(),
  options: z.object({
    strictLayer: z.boolean().optional(),
    maxItems: z.number().optional().default(8),
    tokenBudget: z.number().optional().default(1000),
    includeBreadcrumbs: z.boolean().optional().default(true),
    severityFilter: z.array(z.enum(['MUST', 'SHOULD', 'MAY'])).optional(),
  }).optional().default({})
});

const DetectContextSchema = z.object({
  text: z.string(),
  options: z.object({
    returnKeywords: z.boolean().optional().default(false),
    confidenceThreshold: z.number().min(0).max(1).optional().default(0.5),
  }).optional().default({})
});

const UpsertMarkdownSchema = z.object({
  documents: z.array(z.object({
    path: z.string(),
    content: z.string().optional(),
  })),
  options: z.object({
    overwrite: z.boolean().optional().default(false),
    validateOnly: z.boolean().optional().default(false),
  }).optional().default({})
});

export type QueryDirectivesInput = z.infer<typeof QueryDirectivesSchema>;
export type DetectContextInput = z.infer<typeof DetectContextSchema>;
export type UpsertMarkdownInput = z.infer<typeof UpsertMarkdownSchema>;

/**
 * Rule Manager class that provides new rule-specific functionality via Neo4j
 */
export class RuleManager {
  private connection: Neo4jConnection | null = null;
  private config: Neo4jConfig;
  private rankingEngine: RankingEngine;

  constructor(config: Neo4jConfig) {
    this.config = config;
    this.rankingEngine = new RankingEngine(new ScoringEngine(), new TokenCounter());
  }

  async initialize(): Promise<void> {
    try {
      this.connection = new Neo4jConnection(this.config);
      await this.connection.connect();
      await this.connection.createSchema();
      console.error('Rule manager initialized successfully');
    } catch (error) {
      throw new Error(
        `Failed to initialize rule manager: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async handleTool(name: string, args: any): Promise<any> {
    switch (name) {
      case 'memory.rules.query_directives':
        return await this.queryDirectives(args);
      case 'memory.rules.detect_context':
        return await this.detectContext(args);
      case 'memory.rules.upsert_markdown':
        return await this.upsertMarkdown(args);
      default:
        throw new Error(`Unknown rule tool: ${name}`);
    }
  }

  private async queryDirectives(args: any): Promise<any> {
    const params = QueryDirectivesSchema.parse(args);
    
    if (!this.connection) {
      throw new Error('Connection not initialized');
    }

    // Use detectContext for now (will be enhanced in Phase 2)
    const contextResult = await this.detectContext({
      text: params.taskDescription,
      options: {
        returnKeywords: true,
        confidenceThreshold: 0.5
      }
    });

    // Query and rank directives using the ranking engine
    const session = this.connection.getSession();
    try {
      // Build ranking options
      const rankingOptions: any = {
        maxItems: params.options.maxItems || 8,
        tokenBudget: params.options.tokenBudget || 1000
      };
      
      if (params.options.severityFilter) {
        rankingOptions.severityFilter = params.options.severityFilter;
      }
      if (params.options.strictLayer !== undefined) {
        rankingOptions.strictLayer = params.options.strictLayer;
      }
      if (params.modeSlug) {
        rankingOptions.mode = params.modeSlug;
      }

      const rankingResult = await this.rankingEngine.queryAndRank(
        session,
        {
          detectedLayer: contextResult.detectedLayer,
          topics: contextResult.topics,
          technologies: [], // Will be populated in Phase 2
          keywords: contextResult.keywords
        },
        rankingOptions
      );

      // Format the context block
      const contextBlock = this.formatContextBlock(
        rankingResult.directives,
        contextResult,
        params.options.includeBreadcrumbs ?? true
      );

      // Generate citations
      const citations = rankingResult.directives.map(d => ({
        directiveId: d.id,
        source: d.section || 'Unknown',
        severity: d.severity
      }));

      return {
        context_block: contextBlock,
        citations,
        diagnostics: {
          detectedLayer: contextResult.detectedLayer,
          topics: contextResult.topics,
          retrievalStats: {
            searched: rankingResult.stats.searched,
            considered: rankingResult.stats.considered,
            selected: rankingResult.stats.selected
          },
          tokenStats: {
            totalTokens: rankingResult.stats.totalTokens,
            budgetRemaining: rankingResult.stats.budgetRemaining
          }
        }
      };
    } finally {
      await session.close();
    }
  }

  private async detectContext(args: any): Promise<any> {
    const params = DetectContextSchema.parse(args);
    
    // For now, return a placeholder response
    // This will be implemented in Phase 2 with full context detection
    return {
      detectedLayer: '*',
      topics: ['general'],
      keywords: params.options.returnKeywords ? ['placeholder'] : undefined,
      confidence: 0.5,
      alternativeContexts: []
    };
  }

  /**
   * Format directives into a markdown context block
   */
  private formatContextBlock(
    directives: any[],
    context: any,
    includeBreadcrumbs: boolean
  ): string {
    const grouped = this.rankingEngine.groupBySeverity(directives);
    
    let block = '# Contextual Rules\n\n';
    
    // Add detected context info
    block += '**Detected Context:**\n';
    block += `- Layer: ${context.detectedLayer}\n`;
    block += `- Topics: ${context.topics.join(', ')}\n`;
    if (context.keywords && context.keywords.length > 0) {
      block += `- Keywords: ${context.keywords.join(', ')}\n`;
    }
    block += '\n';

    // Add MUST directives
    if (grouped.MUST.length > 0) {
      block += '## Critical (MUST) Directives\n\n';
      for (const directive of grouped.MUST) {
        block += `### ${directive.section || 'General'}\n`;
        block += `- **[MUST]** ${directive.text}\n`;
        block += `  *Applies to: ${directive.topics.join(', ') || 'general'}*\n`;
        if (includeBreadcrumbs && directive.section) {
          block += `  *Source: ${directive.section}*\n`;
        }
        block += `  *Score: ${(directive.score * 100).toFixed(1)}%*\n`;
        block += '\n';
      }
    }

    // Add SHOULD directives
    if (grouped.SHOULD.length > 0) {
      block += '## Recommended (SHOULD) Directives\n\n';
      for (const directive of grouped.SHOULD) {
        block += `### ${directive.section || 'General'}\n`;
        block += `- **[SHOULD]** ${directive.text}\n`;
        block += `  *Applies to: ${directive.topics.join(', ') || 'general'}*\n`;
        if (includeBreadcrumbs && directive.section) {
          block += `  *Source: ${directive.section}*\n`;
        }
        block += `  *Score: ${(directive.score * 100).toFixed(1)}%*\n`;
        block += '\n';
      }
    }

    // Add MAY directives
    if (grouped.MAY.length > 0) {
      block += '## Optional (MAY) Directives\n\n';
      for (const directive of grouped.MAY) {
        block += `### ${directive.section || 'General'}\n`;
        block += `- **[MAY]** ${directive.text}\n`;
        block += `  *Applies to: ${directive.topics.join(', ') || 'general'}*\n`;
        if (includeBreadcrumbs && directive.section) {
          block += `  *Source: ${directive.section}*\n`;
        }
        block += `  *Score: ${(directive.score * 100).toFixed(1)}%*\n`;
        block += '\n';
      }
    }

    // Add summary
    block += '---\n';
    block += `**Retrieved:** ${directives.length} directive(s)\n`;

    return block;
  }

  private async upsertMarkdown(args: any): Promise<any> {
    const params = UpsertMarkdownSchema.parse(args);
    
    if (!this.connection) {
      throw new Error('Connection not initialized');
    }

    const parser = new MarkdownParser();
    const extractor = new DirectiveExtractor();
    const graphBuilder = new GraphBuilder();

    const totalStats = {
      rules: 0,
      sections: 0,
      directives: 0,
      patterns: 0
    };
    let totalRelations = 0;
    const warnings: string[] = [];
    const errors: string[] = [];

    for (const doc of params.documents) {
      try {
        // Get markdown content
        let content = doc.content;
        if (!content) {
          // If no content provided, try to read from file (not implemented yet)
          warnings.push(`No content provided for ${doc.path}, skipping`);
          continue;
        }

        // Parse markdown
        const parsed = parser.parse(content);

        // Extract directives
        const extractionResult = extractor.extractFromSections(
          parsed.sections,
          parsed.metadata
        );

        // Add extraction warnings
        warnings.push(...extractionResult.warnings);

        // Build graph structure
        const graphResult = graphBuilder.buildGraph(
          parsed,
          extractionResult.directives,
          doc.path
        );

        // Add graph warnings and errors
        warnings.push(...graphResult.warnings);
        errors.push(...graphResult.errors);

        // Validate graph
        const validation = graphBuilder.validateGraph(graphResult.structure);
        if (!validation.valid) {
          errors.push(`Validation failed for ${doc.path}: ${validation.errors.join(', ')}`);
          continue;
        }

        // If validateOnly, skip persistence
        if (params.options.validateOnly) {
          totalStats.rules += graphResult.stats.rulesCreated;
          totalStats.sections += graphResult.stats.sectionsCreated;
          totalStats.directives += graphResult.stats.directivesCreated;
          totalRelations += graphResult.stats.relationshipsCreated;
          continue;
        }

        // Check if rule already exists (if not overwrite)
        if (!params.options.overwrite) {
          const session = this.connection.getSession();
          try {
            const existing = await session.run(
              'MATCH (r:Rule {sourcePath: $path}) RETURN r LIMIT 1',
              { path: doc.path }
            );

            if (existing.records.length > 0) {
              warnings.push(`Rule from ${doc.path} already exists, skipping (use overwrite: true to replace)`);
              await session.close();
              continue;
            }
          } finally {
            await session.close();
          }
        } else {
          // Delete existing rule and related nodes
          const session = this.connection.getSession();
          try {
            await session.run(
              'MATCH (r:Rule {sourcePath: $path}) DETACH DELETE r',
              { path: doc.path }
            );
          } finally {
            await session.close();
          }
        }

        // Persist to Neo4j in a transaction
        const session = this.connection.getSession();
        try {
          await session.executeWrite(async (tx) => {
            const result = await graphBuilder.persistToNeo4j(
              tx as any, // Type cast for compatibility
              graphResult.structure
            );

            totalStats.rules += graphResult.stats.rulesCreated;
            totalStats.sections += graphResult.stats.sectionsCreated;
            totalStats.directives += graphResult.stats.directivesCreated;
            totalRelations += result.relationshipsCreated;
          });
        } catch (error) {
          errors.push(
            `Failed to persist ${doc.path}: ${error instanceof Error ? error.message : String(error)}`
          );
        } finally {
          await session.close();
        }

      } catch (error) {
        errors.push(
          `Failed to process ${doc.path}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return {
      upserted: totalStats,
      relations: totalRelations,
      warnings,
      errors,
      timestamp: new Date().toISOString()
    };
  }

  async close(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
  }
}