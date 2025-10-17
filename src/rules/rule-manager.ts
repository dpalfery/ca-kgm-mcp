/**
 * ContextISO Rule Manager (Neo4j Implementation)
 * 
 * Handles rule-specific functionality for context isolation and optimization.
 * Provides context detection, rule retrieval, and ranking capabilities.
 * 
 * Phases implemented:
 * - Phase 1: Rule document ingestion (markdown parsing, directive extraction)
 * - Phase 2: Context detection (layer, technology, topic detection)
 * - Phase 3: Intelligent ranking (scoring, filtering, token budget)
 * - Phase 4: Smart context retrieval (query directives, formatting, citations)
 */

import { z } from 'zod';
import { Neo4jConnection } from '../storage/neo4j-connection.js';
import { Neo4jConfig } from '../config/neo4j-types.js';
import { MarkdownParser } from '../parsing/markdown-parser.js';
import { DirectiveExtractor } from '../parsing/directive-extractor.js';
import { GraphBuilder } from '../parsing/graph-builder.js';
import { LayerDetector } from '../detection/layer-detector.js';
import { TechDetector } from '../detection/tech-detector.js';
import { TopicDetector } from '../detection/topic-detector.js';
import { ScoringEngine, TokenCounter } from '../ranking/scoring-engine.js';
import { ContextFormatter } from '../formatting/context-formatter.js';
import { CitationGenerator } from '../formatting/citation-generator.js';

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

  constructor(config: Neo4jConfig) {
    this.config = config;
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

    try {
      // Phase 2: Detect context from task description
      const contextResult = await this.detectContext({
        text: params.taskDescription,
        options: { returnKeywords: true }
      });

      // Query all directives from Neo4j
      const session = this.connection.getSession();
      let allDirectives: Array<any> = [];

      try {
        const result = await session.run(`
          MATCH (d:Directive)
          RETURN d.id as id, d.content as content, d.severity as severity,
                 d.topics as topics, d.layers as layers, d.technologies as technologies,
                 d.section as section, d.sourcePath as sourcePath
          LIMIT 1000
        `);

        allDirectives = result.records.map(record => ({
          id: record.get('id'),
          content: record.get('content'),
          severity: record.get('severity'),
          topics: record.get('topics') || [],
          layers: record.get('layers') || [],
          technologies: record.get('technologies') || [],
          section: record.get('section'),
          sourcePath: record.get('sourcePath')
        }));
      } finally {
        await session.close();
      }

      // If no rules found, return fallback response
      if (allDirectives.length === 0) {
        return this.generateFallbackResponse(contextResult);
      }

      // Phase 3: Score and rank directives
      const scoredDirectives = allDirectives.map(d =>
        ScoringEngine.scoreDirective(d, {
          detectedLayer: contextResult.detectedLayer,
          detectedTopics: contextResult.topics,
          detectedTechnologies: contextResult.technologies,
          mode: params.modeSlug
        } as any)
      );

      // Apply severity filter if provided
      let filtered = scoredDirectives;
      if (params.options.severityFilter && params.options.severityFilter.length > 0) {
        filtered = scoredDirectives.filter(d =>
          params.options.severityFilter!.includes(d.severity)
        );
      }

      // Sort by score (MUST first, then by total score)
      filtered.sort((a, b) => {
        // Prioritize MUST directives
        const severityOrder: Record<string, number> = {
          'MUST': 3,
          'SHOULD': 2,
          'MAY': 1
        };
        
        const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
        if (severityDiff !== 0) return severityDiff;
        
        // Then by total score
        return b.totalScore - a.totalScore;
      });

      // Limit by maxItems
      const maxItems = params.options.maxItems || 8;
      filtered = filtered.slice(0, maxItems);

      // Apply token budget if specified
      const budget = params.options.tokenBudget || 1000;
      const { selected, totalTokens } = TokenCounter.selectWithinBudget(filtered, budget);

      // Phase 4: Format output
      const formattingInput = {
        directives: selected,
        detectedLayer: contextResult.detectedLayer,
        detectedTopics: contextResult.topics,
        detectedTechnologies: contextResult.technologies,
        includeBreadcrumbs: params.options.includeBreadcrumbs !== false
      };

      const formatted = ContextFormatter.format(formattingInput);

      // Generate citations
      const citations = selected.map(d =>
        CitationGenerator.generateCitation(
          d.sourcePath,
          d.section,
          undefined,
          undefined
        )
      );

      return {
        context_block: formatted.contextBlock,
        citations: citations.map(c => c.full),
        diagnostics: {
          detectedLayer: contextResult.detectedLayer,
          confidence: contextResult.confidence,
          topics: contextResult.topics,
          technologies: contextResult.technologies,
          retrievalStats: {
            searched: allDirectives.length,
            considered: filtered.length,
            selected: selected.length,
            tokenEstimate: totalTokens,
            tokenBudget: budget
          },
          mode: params.modeSlug || 'default'
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error in queryDirectives:', error);
      
      // Return fallback on error
      return this.generateFallbackResponse(undefined, error);
    }
  }

  /**
   * Generate fallback response when no rules found or error occurs
   */
  private generateFallbackResponse(
    contextResult?: any,
    error?: any
  ): Record<string, any> {
    const fallbackBlock = `# Contextual Rules - Fallback Mode

**Note:** No specific rules found in knowledge base. Using core programming principles.

## 🔴 Critical Principles

- **[MUST]** Write clean, readable code that future developers can understand
- **[MUST]** Add meaningful tests for all new functionality
- **[MUST]** Follow your project's established code style guide
- **[MUST]** Document public APIs and complex logic

## 🟡 Recommended Practices

- **[SHOULD]** Consider performance implications of your design choices
- **[SHOULD]** Use meaningful variable and function names
- **[SHOULD]** Keep functions small and focused on a single responsibility
- **[SHOULD]** Review your code for potential edge cases

## 🟢 Best Practices

- **[MAY]** Add inline documentation for particularly complex algorithms
- **[MAY]** Consider creating helper functions to improve readability
- **[MAY]** Think about error handling and graceful degradation

---
**Status:** Fallback response (no rules loaded)
`;

    return {
      context_block: fallbackBlock,
      citations: [],
      diagnostics: {
        detectedLayer: contextResult?.detectedLayer || '*',
        confidence: contextResult?.confidence || 0,
        topics: contextResult?.topics || [],
        technologies: contextResult?.technologies || [],
        retrievalStats: {
          searched: 0,
          considered: 0,
          selected: 0,
          tokenEstimate: 500,
          tokenBudget: 1000,
          fallback: true,
          error: error ? String(error) : undefined
        }
      },
      timestamp: new Date().toISOString()
    };
  }

  private async detectContext(args: any): Promise<any> {
    const params = DetectContextSchema.parse(args);
    
    // Phase 2: Context Detection
    const layerResult = LayerDetector.detect(params.text);
    const technologies = TechDetector.extract(params.text);
    const topics = TopicDetector.detect(params.text);

    // Extract keywords if requested
    let keywords: string[] | undefined = undefined;
    if (params.options.returnKeywords) {
      const words = params.text.toLowerCase().split(/\W+/);
      keywords = Array.from(new Set(words)).filter(w => w.length > 3).slice(0, 10);
    }

    // Filter by confidence threshold
    const filteredTopics = topics
      .filter(t => t.confidence >= params.options.confidenceThreshold)
      .map(t => t.name);

    const filteredTechs = technologies
      .filter(t => t.confidence >= params.options.confidenceThreshold)
      .map(t => t.name);

    // Build alternatives
    const alternatives = layerResult.alternatives.map(alt => ({
      layer: alt.layer,
      confidence: alt.confidence,
      topics: filteredTopics,
      technologies: filteredTechs
    }));

    return {
      detectedLayer: layerResult.layer,
      confidence: layerResult.confidence,
      topics: filteredTopics,
      technologies: filteredTechs,
      keywords,
      indicators: layerResult.indicators,
      alternativeContexts: alternatives.length > 0 ? alternatives : [],
      timestamp: new Date().toISOString()
    };
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