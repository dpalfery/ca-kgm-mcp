/**
 * ContextISO Rule Manager (Neo4j Implementation)
 * 
 * Handles rule-specific functionality for context isolation and optimization.
 * Provides context detection, rule retrieval, and ranking capabilities.
 */

import { z } from 'zod';
import { Neo4jConnection } from '../storage/neo4j-connection.js';
import { Neo4jConfig } from '../config/neo4j-types.js';
import { detectLayer } from '../detection/layer-detector.js';
import { detectTechnologies } from '../detection/tech-detector.js';
import { detectTopics } from '../detection/topic-detector.js';
import { MarkdownParser } from '../parsing/markdown-parser.js';
import { DirectiveExtractor } from '../parsing/directive-extractor.js';
import { GraphBuilder } from '../parsing/graph-builder.js';

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
    
    // Detect context from task description
    const context = await this.detectContext({
      text: params.taskDescription,
      options: {
        returnKeywords: false,
        confidenceThreshold: 0.5
      }
    });
    
    // Build context block with detected information
    const contextBlock = `# Contextual Rules for Task

**Detected Context:**
- Layer: ${context.detectedLayer}
- Confidence: ${(context.confidence * 100).toFixed(0)}%
- Topics: ${context.topics.length > 0 ? context.topics.join(', ') : 'none detected'}
- Technologies: ${context.technologies.length > 0 ? context.technologies.join(', ') : 'none detected'}

## Task
${params.taskDescription}

## Key Directives

*Note: Full rule retrieval and ranking will be implemented in Phase 3*

- **[MUST]** Follow the architectural patterns appropriate for ${context.detectedLayer} layer
- **[SHOULD]** Apply best practices for detected topics: ${context.topics.slice(0, 3).join(', ')}
${context.technologies.length > 0 ? `- **[SHOULD]** Use ${context.technologies[0]} best practices and conventions` : ''}

`;

    return {
      context_block: contextBlock,
      citations: [],
      diagnostics: {
        detectedLayer: context.detectedLayer,
        confidence: context.confidence,
        topics: context.topics,
        technologies: context.technologies,
        retrievalStats: {
          searched: 0,
          considered: 0,
          selected: 3
        }
      }
    };
  }

  private async detectContext(args: any): Promise<any> {
    const params = DetectContextSchema.parse(args);
    
    // Detect layer using layer-detector
    const layerResult = detectLayer(params.text, {
      confidenceThreshold: params.options.confidenceThreshold,
      returnAlternatives: true
    });

    // Detect technologies
    const techResults = detectTechnologies(params.text);
    const technologies = techResults.map(t => t.name);

    // Detect topics
    const topicResults = detectTopics(params.text);
    const topics = topicResults.map(t => t.topic);

    // Build response
    const response: any = {
      detectedLayer: layerResult.layer,
      confidence: layerResult.confidence,
      topics: topics,
      technologies: technologies,
      timestamp: new Date().toISOString()
    };

    // Add keywords if requested
    if (params.options.returnKeywords) {
      // Extract significant words from text
      const words = params.text.toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 3)
        .slice(0, 10);
      response.keywords = words;
    }

    // Add alternative contexts
    if (layerResult.alternatives && layerResult.alternatives.length > 0) {
      response.alternativeContexts = layerResult.alternatives.map(alt => ({
        layer: alt.layer,
        confidence: alt.confidence,
        topics: topics,
        technologies: technologies
      }));
    } else {
      response.alternativeContexts = [];
    }

    return response;
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