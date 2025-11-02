/**
 * ContextISO Rule Manager (Neo4j Implementation)
 * 
 * Handles rule-specific functionality for context isolation and optimization.
 * Provides context detection, rule retrieval, and ranking capabilities.
 * 
 */

import { z } from 'zod';
import { Neo4jConnection } from '../storage/neo4j-connection.js';
import { Neo4jConfig } from '../config/neo4j-types';
import { RulesEngineConfig } from '../config/rules-engine-config';
import { MarkdownParser } from '../parsing/markdown-parser';
import { DirectiveProcessor } from '../parsing/directive-processor';
import { GraphBuilder } from '../parsing/graph-builder';
import { RuleAnalyzer } from '../parsing/rule-analyzer';
import { LayerDetector } from '../detection/layer-detector';
import { TechDetector } from '../detection/tech-detector';
import { TopicDetector } from '../detection/topic-detector';
import { ScoringEngine, TokenCounter } from '../ranking/scoring-engine';
import { ContextFormatter } from '../formatting/context-formatter';
import { CitationGenerator } from '../formatting/citation-generator';
import { LocalModelManager } from './local-model-manager';
import * as fs from 'fs';
import * as path from 'path';

// Schema definitions for rule operations
const QueryDirectivesSchema = z.object({
  taskDescription: z.string(),
  modeSlug: z.string().optional(),
  options: z.object({
    strictLayer: z.boolean().optional(),
    maxItems: z.number().optional(),
    tokenBudget: z.number().optional(),
    includeBreadcrumbs: z.boolean().optional().default(true),
    includeMetadata: z.boolean().optional(),
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

const IndexRulesSchema = z.object({
  paths: z.string(),
  options: z.object({
    overwrite: z.boolean().optional().default(false),
    filePattern: z.string().optional().default('**/*.md'),
    excludePatterns: z.array(z.string()).optional().default([])
  }).optional().default({})
});

export type QueryDirectivesInput = z.infer<typeof QueryDirectivesSchema>;
export type DetectContextInput = z.infer<typeof DetectContextSchema>;
export type UpsertMarkdownInput = z.infer<typeof UpsertMarkdownSchema>;
export type IndexRulesInput = z.infer<typeof IndexRulesSchema>;

/**
 * Rule Manager class that provides new rule-specific functionality via Neo4j
 */
export class RuleManager {
  private connection: Neo4jConnection | null = null;
  private neo4jConfig: Neo4jConfig;
  private rulesEngineConfig: RulesEngineConfig;
  private workspace: string;
  private localModelManager: LocalModelManager;
  private ruleAnalyzer: RuleAnalyzer;
  private directiveProcessor: DirectiveProcessor;

  constructor(neo4jConfig: Neo4jConfig, rulesEngineConfig: RulesEngineConfig) {
    this.neo4jConfig = neo4jConfig;
    this.rulesEngineConfig = rulesEngineConfig;
    this.workspace = neo4jConfig.workspace;
    
    // Initialize the new components
    this.localModelManager = new LocalModelManager(rulesEngineConfig);
    this.ruleAnalyzer = new RuleAnalyzer(this.localModelManager);
    this.directiveProcessor = new DirectiveProcessor(this.localModelManager);
  }

  async initialize(): Promise<void> {
    try {
      this.connection = new Neo4jConnection(this.neo4jConfig);
      await this.connection.connect();
      await this.connection.createSchema();
      
      // Initialize the LocalModelManager
      this.localModelManager.initialize();
      
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
      case 'memory.rules.index_rules':
        return await this.indexRules(args);
      default:
        throw new Error(`Unknown rule tool: ${name}`);
    }
  }

  private async queryDirectives(args: any): Promise<any> {
    const params = QueryDirectivesSchema.parse(args);
    
    if (!this.connection) {
      throw new Error('Connection not initialized');
    }

    // Validate modeSlug if provided
    if (params.modeSlug && !this.rulesEngineConfig.modes.allowedModes.includes(params.modeSlug)) {
      throw new Error(`Invalid modeSlug '${params.modeSlug}'. Allowed modes: ${this.rulesEngineConfig.modes.allowedModes.join(', ')}`);
    }

    // Apply config defaults for options not explicitly provided
    const maxItems = params.options.maxItems ?? this.rulesEngineConfig.queryDefaults.maxItems;
    const tokenBudget = params.options.tokenBudget ?? this.rulesEngineConfig.queryDefaults.tokenBudget;
    const includeMetadata = params.options.includeMetadata ?? this.rulesEngineConfig.queryDefaults.includeMetadata;

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
        const result = await session.run(
          `
          MATCH (d:Directive {workspace: $workspace})
          RETURN d.id as id, d.content as content, d.severity as severity,
                 d.topics as topics, d.layers as layers, d.technologies as technologies,
                 d.section as section, d.sourcePath as sourcePath
          LIMIT 1000
          `,
          { workspace: this.workspace }
        );

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

      // Limit by maxItems first (using config default or request override)
      filtered = filtered.slice(0, maxItems);

      // Apply token budget only if explicitly provided (> 0)
      let selected = filtered;
      let totalTokens: number;
      if (typeof tokenBudget === 'number' && tokenBudget > 0) {
        const sel = TokenCounter.selectWithinBudget(filtered, tokenBudget);
        selected = sel.selected;
        totalTokens = sel.totalTokens;
      } else {
        // Rough estimate without trimming
        totalTokens = selected.reduce((sum, d) => sum + TokenCounter.estimateTokens(d.content) + 50, 0);
      }

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
        // Slim rules for prompt focus; metadata kept out by default
        rules: includeMetadata
          ? selected.map(d => ({
              id: d.id,
              text: d.content,
              severity: d.severity,
              section: d.section,
              sourcePath: d.sourcePath,
              topics: d.topics,
              layers: d.layers,
              technologies: d.technologies
            }))
          : selected.map(d => ({
              text: d.content,
              severity: d.severity
            })),
        context_block: formatted.contextBlock,
        citations: citations.map(c => c.full),
        diagnostics: {
          detectedLayer: contextResult.detectedLayer,
          confidence: contextResult.confidence,
          topics: contextResult.topics,
          technologies: contextResult.technologies,
          // Keep metadata here for traceability/auditing without polluting prompt context
          rulesMeta: selected.map(d => ({
            id: d.id,
            section: d.section,
            sourcePath: d.sourcePath,
            topics: d.topics,
            layers: d.layers,
            technologies: d.technologies
          })),
          retrievalStats: {
            searched: allDirectives.length,
            considered: filtered.length,
            selected: selected.length,
            tokenEstimate: totalTokens,
            tokenBudget: tokenBudget
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
   * Generate error response when no rules found or error occurs
   */
  private generateFallbackResponse(
    _contextResult?: any,
    error?: any
  ): Record<string, any> {
    // Throw an error instead of returning fallback
    const errorMessage = error
      ? `Error retrieving rules: ${error instanceof Error ? error.message : String(error)}`
      : 'No rules found in knowledge base. Please load rules using the memory.rules.upsert_markdown tool before querying.';
    
    throw new Error(errorMessage);
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

        // Step 1: Call the RuleAnalyzer to analyze and split the document
        const documentSplits = await this.ruleAnalyzer.analyzeAndSplit(content);
        
        // Process each document split
        for (const split of documentSplits) {
          const splitContent = split.content;
          const splitPath = documentSplits.length > 1
            ? `${doc.path} (split ${documentSplits.indexOf(split) + 1})`
            : doc.path;

          // Parse markdown
          const parsed = parser.parse(splitContent);

          // Step 2: Use the DirectiveProcessor to extract or generate directives
          const extractionResult = await this.directiveProcessor.extractFromSections(
            parsed.sections,
            parsed.metadata
          );

          // Add extraction warnings
          warnings.push(...extractionResult.warnings);

          // Step 3: Call the existing GraphBuilder for each document
          const graphResult = graphBuilder.buildGraph(
            parsed,
            extractionResult.directives,
            splitPath,
            this.workspace
          );

          // Add graph warnings and errors
          warnings.push(...graphResult.warnings);
          errors.push(...graphResult.errors);

          // Validate graph
          const validation = graphBuilder.validateGraph(graphResult.structure);
          if (!validation.valid) {
            errors.push(`Validation failed for ${splitPath}: ${validation.errors.join(', ')}`);
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
                'MATCH (r:Rule {sourcePath: $path, workspace: $workspace}) RETURN r LIMIT 1',
                { path: splitPath, workspace: this.workspace }
              );

              if (existing.records.length > 0) {
                warnings.push(`Rule from ${splitPath} already exists, skipping (use overwrite: true to replace)`);
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
                'MATCH (r:Rule {sourcePath: $path, workspace: $workspace}) DETACH DELETE r',
                { path: splitPath, workspace: this.workspace }
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
              `Failed to persist ${splitPath}: ${error instanceof Error ? error.message : String(error)}`
            );
          } finally {
            await session.close();
          }
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

  private async indexRules(args: any): Promise<any> {
    const params = IndexRulesSchema.parse(args);
    
    // Parse comma-delimited paths
    const pathList = params.paths.split(',').map(p => p.trim());
    const markdownFiles: string[] = [];
    const warnings: string[] = [];
    
    // Default exclude patterns
    const defaultExcludes = ['**/node_modules/**', '**/.git/**', '**/build/**', '**/dist/**'];
    const excludePatterns = [...defaultExcludes, ...params.options.excludePatterns];
    
    // Crawl each path
    for (const inputPath of pathList) {
      try {
        // Resolve path (could be relative or absolute)
        const resolvedPath = path.resolve(inputPath);
        
        if (!fs.existsSync(resolvedPath)) {
          warnings.push(`Path does not exist: ${inputPath}`);
          continue;
        }
        
        const stat = fs.statSync(resolvedPath);
        
        if (stat.isFile()) {
          // Single file
          if (resolvedPath.endsWith('.md') && !this.isExcluded(resolvedPath, excludePatterns)) {
            markdownFiles.push(resolvedPath);
          }
        } else if (stat.isDirectory()) {
          // Recursively find markdown files
          const files = this.findMarkdownFiles(resolvedPath, excludePatterns);
          markdownFiles.push(...files);
        }
      } catch (error) {
        warnings.push(`Error processing path ${inputPath}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    if (markdownFiles.length === 0) {
      return {
        indexed: { rules: 0, sections: 0, directives: 0, patterns: 0 },
        files: [],
        warnings: [...warnings, 'No markdown files found in specified paths'],
        errors: [],
        timestamp: new Date().toISOString()
      };
    }
    
    // Prepare documents for upsert
    const documents = markdownFiles.map(filePath => ({
      path: filePath,
      content: fs.readFileSync(filePath, 'utf-8')
    }));
    
    // Call existing upsertMarkdown logic
    const result = await this.upsertMarkdown({
      documents,
      options: {
        overwrite: params.options.overwrite,
        validateOnly: false
      }
    });
    
    // Return index-specific response
    return {
      indexed: result.upserted,
      relations: result.relations,
      files: markdownFiles,
      filesProcessed: markdownFiles.length,
      warnings: [...warnings, ...result.warnings],
      errors: result.errors,
      timestamp: result.timestamp
    };
  }
  
  /**
   * Recursively find markdown files in a directory
   */
  private findMarkdownFiles(dir: string, excludePatterns: string[]): string[] {
    const files: string[] = [];
    
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (this.isExcluded(fullPath, excludePatterns)) {
          continue;
        }
        
        if (entry.isDirectory()) {
          files.push(...this.findMarkdownFiles(fullPath, excludePatterns));
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Silently skip directories we can't read
    }
    
    return files;
  }
  
  /**
   * Check if a path matches any exclude pattern
   */
  private isExcluded(filePath: string, excludePatterns: string[]): boolean {
    const normalized = filePath.replace(/\\/g, '/');
    
    for (const pattern of excludePatterns) {
      // Simple glob matching for common patterns
      const regex = pattern
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*')
        .replace(/\//g, '[\\\\/]'); // Handle both / and \
      
      if (new RegExp(regex).test(normalized)) {
        return true;
      }
    }
    
    return false;
  }

  async close(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
  }
}
