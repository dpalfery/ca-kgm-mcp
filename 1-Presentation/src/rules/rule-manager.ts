/**
 * ContextISO Rule Manager (Neo4j Implementation)
 * 
 * Handles rule-specific functionality for context isolation and optimization.
 * Provides context detection, rule retrieval, and ranking capabilities.
 * 
 */

import { z } from 'zod';
import { Neo4jConnection } from '../storage/neo4j-connection.js';
import { Neo4jConfig } from '../config/neo4j-types.js';
import { RulesEngineConfig } from '../config/rules-engine-config.js';
import { MarkdownParser } from '../parsing/markdown-parser.js';
import { DirectiveProcessor } from '../parsing/directive-processor.js';
import { GraphBuilder } from '../parsing/graph-builder.js';
import { RuleAnalyzer } from '../parsing/rule-analyzer.js';
import { LayerDetector } from '../detection/layer-detector.js';
import { TechDetector } from '../detection/tech-detector.js';
import { TopicDetector } from '../detection/topic-detector.js';
import { ScoringEngine, TokenCounter } from '../ranking/scoring-engine.js';
import { ContextFormatter } from '../formatting/context-formatter.js';
import { CitationGenerator } from '../formatting/citation-generator.js';
import { LocalModelManager } from './local-model-manager.js';
import { MemoryManager } from '../memory/memory-manager.js';
import * as fs from 'fs';
import * as path from 'path';

// Schema definitions for rule operations
const QueryDirectivesSchema = z.object({
  userPrompt: z.string(),
  modeSlug: z.string().optional()
});

const DetectContextSchema = z.object({
  text: z.string()
});

const UpsertMarkdownSchema = z.object({
  documents: z.array(z.object({
    path: z.string(),
    content: z.string().optional(),
  }))
});

export type QueryDirectivesInput = z.infer<typeof QueryDirectivesSchema>;
export type DetectContextInput = z.infer<typeof DetectContextSchema>;
export type UpsertMarkdownInput = z.infer<typeof UpsertMarkdownSchema>;

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
  private memoryManager: MemoryManager | null = null;

  constructor(neo4jConfig: Neo4jConfig, rulesEngineConfig: RulesEngineConfig) {
    this.neo4jConfig = neo4jConfig;
    this.rulesEngineConfig = rulesEngineConfig;
    this.workspace = neo4jConfig.workspace;
    
    // Initialize the new components
    this.localModelManager = new LocalModelManager(rulesEngineConfig);
    this.ruleAnalyzer = new RuleAnalyzer(this.localModelManager);
    this.directiveProcessor = new DirectiveProcessor(this.localModelManager);
  }

  /**
   * Set memory manager reference for AI-enhanced indexing
   */
  setMemoryManager(memoryManager: MemoryManager): void {
    this.memoryManager = memoryManager;
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
    console.error(`🔍 DEBUG handleTool: name="${name}"`);
    switch (name) {
      case 'memory.rules.query_directives':
        console.error('🔍 DEBUG: Routing to queryDirectives');
        return await this.queryDirectives(args);
      case 'memory.rules.detect_context':
        console.error('🔍 DEBUG: Routing to detectContext');
        return await this.detectContext(args);
      case 'memory.rules.upsert_markdown':
        console.error('🔍 DEBUG: Routing to upsertMarkdown');
        return await this.upsertMarkdown(args);
      case 'memory.rules.index_rules':
        console.error('🔍 DEBUG: Routing to indexRules');
        return await this.indexRules();
      case 'memory.rules.reset_index':
        console.error('🔍 DEBUG: Routing to resetIndex');
        return await this.resetIndex();
      default:
        throw new Error(`Unknown rule tool: ${name}`);
    }
  }

  private async queryDirectives(args: any): Promise<any> {
    // Get workspace from environment variable
    const workspaceFromEnv = process.env.WORKSPACE;
    if (!workspaceFromEnv) {
      throw new Error('WORKSPACE environment variable is not set');
    }

    const params = QueryDirectivesSchema.parse(args);
    
    if (!this.connection) {
      throw new Error('Connection not initialized');
    }

    // Override workspace from environment variable
    const originalWorkspace = this.workspace;
    this.workspace = workspaceFromEnv;

    // Validate modeSlug if provided
    if (params.modeSlug && !this.rulesEngineConfig.modes.allowedModes.includes(params.modeSlug)) {
      throw new Error(`Invalid modeSlug '${params.modeSlug}'. Allowed modes: ${this.rulesEngineConfig.modes.allowedModes.join(', ')}`);
    }

    // Inject options from environment variables
    const maxItems = parseInt(process.env.QUERY_MAX_ITEMS || '') || this.rulesEngineConfig.queryDefaults.maxItems;
    const tokenBudget = parseInt(process.env.QUERY_TOKEN_BUDGET || '') || this.rulesEngineConfig.queryDefaults.tokenBudget;
    const includeMetadata = process.env.QUERY_INCLUDE_METADATA === 'true' || this.rulesEngineConfig.queryDefaults.includeMetadata;
    const includeBreadcrumbs = process.env.QUERY_INCLUDE_BREADCRUMBS !== 'false';
    const severityFilterStr = process.env.QUERY_SEVERITY_FILTER;
    const severityFilter = severityFilterStr ? severityFilterStr.split(',').map(s => s.trim() as 'MUST' | 'SHOULD' | 'MAY') : undefined;

    try {
      // Phase 2: Detect context from user prompt
      const contextResult = await this.detectContext({
        text: params.userPrompt,
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

      // If no rules found, try fallback from Entity graph (entityType='Directive')
      if (allDirectives.length === 0) {
        const session2 = this.connection.getSession();
        try {
          const result2 = await session2.run(
            `
            MATCH (e:Entity {workspace: $workspace})
            WHERE toLower(e.entityType) = 'directive'
            RETURN e.name AS name, e.observations AS observations
            LIMIT 2000
            `,
            { workspace: this.workspace }
          );

          const mapped = result2.records.map(r => {
            const name = r.get('name') as string;
            const obs = (r.get('observations') || []) as string[];
            const joined = Array.isArray(obs) ? obs.join(' ') : String(obs || '');
            let severity: 'MUST'|'SHOULD'|'MAY' = 'SHOULD';
            if (/\bMUST\b/i.test(joined)) severity = 'MUST';
            else if (/\bMAY\b/i.test(joined)) severity = 'MAY';
            // Choose a content candidate: first long-ish observation that isn't a tag
            let content = name;
            if (Array.isArray(obs) && obs.length > 0) {
              const cand = obs.find(s => typeof s === 'string' && s.length > 20 && !/AI-Generated|Confidence:|Layer|Topic|Technolog/i.test(s));
              if (cand) content = cand;
            }
            return {
              id: name,
              content,
              severity,
              topics: [],
              layers: [],
              technologies: [],
              section: undefined,
              sourcePath: undefined
            };
          });

          if (mapped.length > 0) {
            allDirectives = mapped;
          }
        } finally {
          await session2.close();
        }
      }

      // If still no rules found, return fallback response
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
      if (severityFilter && severityFilter.length > 0) {
        filtered = scoredDirectives.filter(d =>
          severityFilter.includes(d.severity)
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
        includeBreadcrumbs: includeBreadcrumbs
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
      const msg = error instanceof Error ? error.message : JSON.stringify(error);
      const stack = error instanceof Error ? (error.stack || '') : undefined;
      try {
        console.error('Error in queryDirectives:', { msg, stack, args });
      } catch {}
      
      // Return fallback on error
      return this.generateFallbackResponse(undefined, error);
    } finally {
      // Restore original workspace
      this.workspace = originalWorkspace;
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
    
    // Inject options from environment variables
    const returnKeywords = process.env.DETECT_RETURN_KEYWORDS === 'true';
    const confidenceThreshold = parseFloat(process.env.DETECT_CONFIDENCE_THRESHOLD || '0.5');
    
    // Phase 2: Context Detection
    const layerResult = LayerDetector.detect(params.text);
    const technologies = TechDetector.extract(params.text);
    const topics = TopicDetector.detect(params.text);

    // Extract keywords if requested
    let keywords: string[] | undefined = undefined;
    if (returnKeywords) {
      const words = params.text.toLowerCase().split(/\W+/);
      keywords = Array.from(new Set(words)).filter(w => w.length > 3).slice(0, 10);
    }

    // Filter by confidence threshold
    const filteredTopics = topics
      .filter(t => t.confidence >= confidenceThreshold)
      .map(t => t.name);

    const filteredTechs = technologies
      .filter(t => t.confidence >= confidenceThreshold)
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

    // Inject options from environment variables
    const overwrite = process.env.UPSERT_OVERWRITE === 'true';
    const validateOnly = process.env.UPSERT_VALIDATE_ONLY === 'true';

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
          if (validateOnly) {
            totalStats.rules += graphResult.stats.rulesCreated;
            totalStats.sections += graphResult.stats.sectionsCreated;
            totalStats.directives += graphResult.stats.directivesCreated;
            totalRelations += graphResult.stats.relationshipsCreated;
            continue;
          }

          // Check if rule already exists (if not overwrite)
          if (!overwrite) {
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

  private async indexRules(): Promise<any> {
    if (!this.memoryManager) {
      throw new Error('Memory manager not set. Call setMemoryManager() before using index_rules.');
    }
    
    // Get paths from environment variable
    console.error('🔍 DEBUG: Checking environment variables...');
    console.error('🔍 DEBUG: process.env keys:', Object.keys(process.env).filter(k => k.includes('INDEX') || k.includes('WORKSPACE') || k.includes('QUERY')));
    console.error('🔍 DEBUG: INDEX_PATHS =', process.env.INDEX_PATHS);
    console.error('🔍 DEBUG: WORKSPACE =', process.env.WORKSPACE);
    console.error('🔍 DEBUG: QUERY_MAX_ITEMS =', process.env.QUERY_MAX_ITEMS);
    
    const pathsFromEnv = process.env.INDEX_PATHS;
    if (!pathsFromEnv) {
      throw new Error('INDEX_PATHS environment variable is not set');
    }
    
    // Inject options from environment variables
    const filePattern = process.env.INDEX_FILE_PATTERN || '**/*.md';
    const excludePatternsStr = process.env.INDEX_EXCLUDE_PATTERNS;
    const customExcludePatterns = excludePatternsStr ? excludePatternsStr.split(',').map(p => p.trim()) : [];
    console.error(`[index_rules] Using filePattern: ${filePattern}`);
    console.error(`[index_rules] Using excludePatterns: ${JSON.stringify(customExcludePatterns)}`);
    
    // Parse comma-delimited paths
    const pathList = pathsFromEnv.split(',').map(p => p.trim());
    const markdownFiles: string[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];
    
    // Default exclude patterns
    const defaultExcludes = ['**/node_modules/**', '**/.git/**', '**/build/**', '**/dist/**'];
    const excludePatterns = [...defaultExcludes, ...customExcludePatterns];
    
    // Prepare knowledge graph builders
    const parser = new MarkdownParser();
    const graphBuilder = new GraphBuilder();
    
    // Crawl each path
    for (const inputPath of pathList) {
      try {
        // Resolve path (could be relative or absolute)
        const resolvedPath = path.resolve(inputPath);
        console.error(`[index_rules] Scanning inputPath=${inputPath} -> resolved=${resolvedPath}`);
        
        if (!fs.existsSync(resolvedPath)) {
          warnings.push(`Path does not exist: ${inputPath}`);
          console.error(`[index_rules] Path not found: ${resolvedPath}`);
          continue;
        }
        
        const stat = fs.statSync(resolvedPath);
        
        if (stat.isFile()) {
          // Single file - use filePattern for matching
          const match = this.matchesPattern(resolvedPath, filePattern);
          const excluded = this.isExcluded(resolvedPath, excludePatterns);
          console.error(`[index_rules] File check: match=${match} excluded=${excluded} file=${resolvedPath}`);
          if (match && !excluded) {
            markdownFiles.push(resolvedPath);
          }
        } else if (stat.isDirectory()) {
          // Recursively find markdown files
          const files = this.findMarkdownFilesWithPattern(resolvedPath, filePattern, excludePatterns);
          console.error(`[index_rules] Dir matched files: ${files.length} under ${resolvedPath}`);
          markdownFiles.push(...files);
        }
      } catch (error) {
        warnings.push(`Error processing path ${inputPath}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    console.error(`[index_rules] Total markdown files discovered: ${markdownFiles.length}`);
    
    if (markdownFiles.length === 0) {
      return {
        indexed: { rules: 0, sections: 0, directives: 0, patterns: 0 },
        files: [],
        warnings: [...warnings, 'No markdown files found in specified paths'],
        errors: [],
        timestamp: new Date().toISOString()
      };
    }
    
    console.error(`📁 Processing ${markdownFiles.length} markdown files...`);
    
    // AI-ENHANCED PARSING: process file-by-file with incremental persistence
    let totalFilesProcessed = 0;
    let totalAIDirectives = 0;
    let totalEntitiesCreated = 0;
    let totalRelationsCreated = 0;

    for (const filePath of markdownFiles) {
      try {
        console.error(`🔍 Processing file: ${filePath}`);
        const content = fs.readFileSync(filePath, 'utf-8');
        
        // Build knowledge graph (Rule/Section/Directive) and persist per file
        try {
          const parsedDoc = parser.parse(content);
          const extraction = await this.directiveProcessor.extractFromSections(parsedDoc.sections, parsedDoc.metadata);
          const graphResult = graphBuilder.buildGraph(parsedDoc, extraction.directives, filePath, this.workspace);
          const validation = graphBuilder.validateGraph(graphResult.structure);
          if (!validation.valid) {
            errors.push(`Validation failed for ${filePath}: ${validation.errors.join(', ')}`);
          } else {
            const session = this.connection!.getSession();
            try {
              await session.executeWrite(async (tx) => {
                await graphBuilder.persistToNeo4j(tx as any, graphResult.structure);
              });
            } finally {
              await session.close();
            }
          }
        } catch (e) {
          errors.push(`Graph persistence failed for ${filePath}: ${e instanceof Error ? e.message : String(e)}`);
        }
        
        // Parse markdown with AI directive extraction (Entity graph analytics)
        const parsed = await this.parseMarkdownWithAI(content, filePath);
        totalAIDirectives += parsed.directives.length;

        // Incrementally store Entities for this file
        const entitiesBatch = [
          ...parsed.rules.map(r => ({
            name: r.name,
            entityType: 'Rule',
            observations: this.buildObservations(r.description, r.whenToApply, r.content, r.layerTags, r.topics)
          })),
          ...parsed.sections.map(s => ({
            name: s.title,
            entityType: 'Section',
            observations: this.buildObservations(s.content, s.layerTags, s.topics)
          })),
          ...parsed.directives.map(d => ({
            name: `${d.text.substring(0, 50)}...`,
            entityType: 'Directive',
            observations: this.buildObservations(
              d.text,
              d.severity,
              d.layerTags,
              d.topics,
              d.technologies,
              d.isGenerated ? 'AI-Generated' : 'Manual',
              d.confidence ? `Confidence: ${d.confidence}` : '',
              d.reasoning || ''
            )
          })),
          ...parsed.patterns.map(p => ({
            name: p.context || 'Pattern',
            entityType: 'Pattern',
            observations: this.buildObservations(p.snippet, p.topics)
          }))
        ];
        if (entitiesBatch.length > 0) {
          const res = await this.memoryManager.handleTool('memory.create_entities', { entities: entitiesBatch });
          totalEntitiesCreated += (res.created || 0) + (res.updated || 0);
        }

        // Build Entity relations per file (CONTAINS only; skip taxonomy which is not an Entity)
        const relationsBatch: any[] = [];
        for (const rule of parsed.rules) {
          for (const section of parsed.sections) {
            if (section.filePath === rule.filePath) {
              relationsBatch.push({ from: rule.name, to: section.title, relationType: 'CONTAINS' });
            }
          }
          for (const directive of parsed.directives) {
            if (directive.filePath === rule.filePath && directive.sectionTitle === rule.name) {
              relationsBatch.push({ from: rule.name, to: directive.text.substring(0, 50) + '...', relationType: 'CONTAINS_AI_DIRECTIVE' });
            }
          }
        }
        for (const section of parsed.sections) {
          for (const directive of parsed.directives) {
            if (directive.filePath === section.filePath && directive.sectionTitle === section.title) {
              relationsBatch.push({ from: section.title, to: directive.text.substring(0, 50) + '...', relationType: 'CONTAINS_AI_DIRECTIVE' });
            }
          }
        }
        if (relationsBatch.length > 0) {
          const relRes = await this.memoryManager.handleTool('memory.create_relations', { relations: relationsBatch });
          totalRelationsCreated += (relRes.created || 0);
        }

        totalFilesProcessed++;
      } catch (error) {
        errors.push(`Failed to process ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    console.error(`\n📊 AI-Enhanced Crawling Summary:`);
    console.error(`   Files processed: ${totalFilesProcessed}`);
    console.error(`   AI Directives generated: ${totalAIDirectives}`);
    console.error(`\n💾 Entity graph persisted incrementally`);
    console.error(`   Entities stored (created/updated): ${totalEntitiesCreated}`);
    console.error(`   Relations created: ${totalRelationsCreated}`);

    console.error(`✅ Knowledge graph persisted (Rule/Section/Directive)`);

    return {
      indexed: {
        rules: 0, // Knowledge graph counts can be computed via db if needed
        sections: 0,
        directives: totalAIDirectives,
        patterns: 0
      },
      files: markdownFiles,
      filesProcessed: totalFilesProcessed,
      warnings,
      errors,
      entityStats: { entities: totalEntitiesCreated, relations: totalRelationsCreated },
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Recursively find markdown files in a directory with pattern matching
   */
  private findMarkdownFilesWithPattern(dir: string, pattern: string, excludePatterns: string[]): string[] {
    const files: string[] = [];
    
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (this.isExcluded(fullPath, excludePatterns)) {
          continue;
        }
        
        if (entry.isDirectory()) {
          files.push(...this.findMarkdownFilesWithPattern(fullPath, pattern, excludePatterns));
        } else if (entry.isFile() && this.matchesPattern(fullPath, pattern)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Silently skip directories we can't read
    }
    
    return files;
  }

  /**
   * Check if a file path matches a glob pattern
   */
  private matchesPattern(filePath: string, pattern: string): boolean {
    const normalized = filePath.replace(/\\/g, '/');
    // Convert glob pattern to regex (case-insensitive), supporting ** and windows separators
    let regexStr = '';
    for (let i = 0; i < pattern.length; i++) {
      const ch = pattern[i];
      const next = pattern[i + 1];
      if (ch === '*' && next === '*') {
        regexStr += '.*';
        i++; // skip next
        continue;
      }
      if (ch === '*') {
        regexStr += '[^\\\\/]*';
        continue;
      }
      if (ch === '/') {
        regexStr += '[\\\\/]';
        continue;
      }
      // Escape regex specials
      if (/[-\\^$+?.()|{}\[\]]/.test(ch)) {
        regexStr += '\\' + ch;
      } else {
        regexStr += ch;
      }
    }
    const re = new RegExp('^' + regexStr + '$', 'i');
    const ok = re.test(normalized);
    // Debug for tests
    try { if (process.env.VITEST) { console.error(`[matchesPattern] pattern=${pattern} regex=${re} path=${normalized} => ${ok}`); } } catch {}
    return ok;
  }
  
  /**
   * Check if a path matches any exclude pattern
   */
  private isExcluded(filePath: string, excludePatterns: string[]): boolean {
    const normalized = filePath.replace(/\\/g, '/');
    
    for (const pattern of excludePatterns) {
      if (this.matchesPattern(normalized, pattern)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Build observations array (helper from AI-enhanced crawler)
   */
  private buildObservations(
    ...parts: Array<string | string[] | null | undefined>
  ): string[] {
    const normalized: string[] = [];

    for (const part of parts) {
      if (!part) {
        continue;
      }

      if (Array.isArray(part)) {
        for (const value of part) {
          if (typeof value !== 'string') {
            continue;
          }
          const trimmed = value.trim();
          if (trimmed) {
            normalized.push(trimmed);
          }
        }
        continue;
      }

      const trimmed = part.trim();
      if (trimmed) {
        normalized.push(trimmed);
      }
    }

    return [...new Set(normalized)];
  }

  /**
   * AI-enhanced markdown parsing (from AI-enhanced crawler)
   */
  private async parseMarkdownWithAI(
    content: string,
    filePath: string
  ): Promise<{
    rules: any[];
    sections: any[];
    directives: any[];
    patterns: any[];
  }> {
    const lines = content.split('\n');

    const rules: any[] = [];
    const sections: any[] = [];
    const directives: any[] = [];
    const patterns: any[] = [];

    let currentRule: any = null;
    let currentSection: any = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Parse rule metadata
      if (line.startsWith('name: ')) {
        currentRule = {
          name: line.replace('name: ', '').replace(/"/g, ''),
          filePath,
          content: '',
          authoritativeFor: [],
          layerTags: [],
          topics: []
        };
      } else if (currentRule && line.startsWith('description: ')) {
        currentRule.description = line.replace('description: ', '').replace(/"/g, '');
      } else if (currentRule && line.startsWith('when-to-apply: ')) {
        currentRule.whenToApply = line.replace('when-to-apply: ', '').replace(/"/g, '');
      } else if (currentRule && line.startsWith('rule: |')) {
        let ruleContent = '';
        i++;
        while (i < lines.length && !lines[i].startsWith('---')) {
          ruleContent += lines[i] + '\n';
          i++;
        }
        currentRule.content = ruleContent;
        rules.push(currentRule);
        currentRule = null;
      }

      // Parse sections
      if (line.startsWith('## ') || line.startsWith('### ')) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          title: line.replace(/^#+\s*/, ''),
          filePath,
          content: '',
          layerTags: [],
          topics: []
        };
        this.extractTagsFromContent(currentSection, line);
      } else if (currentSection) {
        currentSection.content += line + '\n';
      }

      // Parse patterns/examples
      if (line.startsWith('```') || line.includes('Example:')) {
        let patternContent = '';
        if (line.startsWith('```')) {
          i++;
          while (i < lines.length && !lines[i].startsWith('```')) {
            patternContent += lines[i] + '\n';
            i++;
          }
        } else {
          while (i < lines.length && !lines[i].startsWith('##') && !lines[i].startsWith('###')) {
            patternContent += lines[i] + '\n';
            i++;
          }
          i--;
        }

        const pattern = {
          snippet: patternContent,
          topics: [],
          filePath,
          context: currentSection?.title || ''
        };
        this.extractTagsFromContent(pattern, patternContent);
        patterns.push(pattern);
      }
    }

    if (currentSection) {
      sections.push(currentSection);
    }

    // AI-ENHANCED DIRECTIVE DETECTION
    if (this.rulesEngineConfig.processing.enableDirectiveGeneration) {
      console.error(`🤖 Running AI directive analysis on ${sections.length} sections...`);

      for (const section of sections) {
        if (section.content && section.content.trim().length > this.rulesEngineConfig.processing.minWordCountForGeneration) {
          try {
            const aiDirectives = await this.detectDirectivesWithAI(
              section.content,
              section.title,
              filePath
            );
            directives.push(...aiDirectives);

            if (aiDirectives.length > 0) {
              console.error(`   ✅ Found ${aiDirectives.length} AI directives in section: ${section.title}`);
            }
          } catch (error) {
            console.error(
              `   ⚠️  AI directive detection failed for section ${section.title}:`,
              error instanceof Error ? error.message : 'Unknown error'
            );
          }
        }
      }

      for (const rule of rules) {
        if (rule.content && rule.content.trim().length > this.rulesEngineConfig.processing.minWordCountForGeneration) {
          try {
            const aiDirectives = await this.detectDirectivesWithAI(
              rule.content,
              rule.name,
              filePath
            );
            directives.push(...aiDirectives);

            if (aiDirectives.length > 0) {
              console.error(`   ✅ Found ${aiDirectives.length} AI directives in rule: ${rule.name}`);
            }
          } catch (error) {
            console.error(
              `   ⚠️  AI directive detection failed for rule ${rule.name}:`,
              error instanceof Error ? error.message : 'Unknown error'
            );
          }
        }
      }
    }

    console.error(
      `📊 File processing complete: ${rules.length} rules, ${sections.length} sections, ${directives.length} AI directives, ${patterns.length} patterns`
    );

    return { rules, sections, directives, patterns };
  }

  /**
   * AI-powered directive detection
   */
  private async detectDirectivesWithAI(
    content: string,
    sectionTitle: string,
    filePath: string
  ): Promise<any[]> {
    if (!this.localModelManager || !this.localModelManager.isReady()) {
      console.error('🤖 AI model not ready, skipping AI directive detection');
      return [];
    }

    const AIDirectiveAnalysisSchema = z.array(
      z.object({
        content: z.string(),
        severity: z.string(),
        reasoning: z.string(),
        confidence: z.number().min(0).max(1)
      })
    );

    const prompt = `Extract actionable directives from this software development content:

Content:
"""
${content}
"""

Return a JSON array of directives. Each directive should have:
- content: what developers need to do
- severity: "High" for critical requirements, "Medium" for recommendations, "Low" for optional
- reasoning: why this directive is important
- confidence: number between 0 and 1

Example format:
[
  {
    "content": "validate all user inputs",
    "severity": "High",
    "reasoning": "prevents security vulnerabilities",
    "confidence": 0.9
  }
]

Only return the JSON array, no other text.`;

    try {
      const response = await this.localModelManager.generateJson(prompt, AIDirectiveAnalysisSchema, {
        temperature: 0.3,
        maxTokens: 2000,
        timeout: 30000
      });

      if (!response.success) {
        console.error('AI directive analysis failed:', response.error);
        return [];
      }

      const directiveArray = response.data;
      const aiDirectives: any[] = [];

      for (const directive of directiveArray) {
        let mappedSeverity: 'MUST' | 'SHOULD' | 'MAY' = 'SHOULD';
        if (directive.severity.toLowerCase().includes('high') || directive.severity.toLowerCase().includes('critical')) {
          mappedSeverity = 'MUST';
        } else if (directive.severity.toLowerCase().includes('low') || directive.severity.toLowerCase().includes('optional')) {
          mappedSeverity = 'MAY';
        }

        const { topics, layers, technologies } = this.extractMetadataFromDirective(
          directive.content,
          content,
          [],
          [],
          []
        );

        aiDirectives.push({
          text: directive.content,
          severity: mappedSeverity,
          layerTags: layers,
          topics: topics,
          technologies: technologies,
          filePath,
          sectionTitle,
          isGenerated: true,
          confidence: directive.confidence,
          reasoning: directive.reasoning
        });
      }

      return aiDirectives;
    } catch (error) {
      console.error('Error in AI directive detection:', error);
      return [];
    }
  }

  /**
   * Enhanced metadata extraction for AI-generated directives
   */
  private extractMetadataFromDirective(
    directiveContent: string,
    sectionContent: string,
    aiTopics: string[] = [],
    aiLayers: string[] = [],
    aiTechnologies: string[] = []
  ): {
    topics: string[];
    layers: string[];
    technologies: string[];
  } {
    const topics = new Set<string>(aiTopics.map(t => t.toLowerCase()));
    const layers = new Set<string>(aiLayers);
    const technologies = new Set<string>(aiTechnologies.map(t => t.toLowerCase()));

    const fullText = `${directiveContent} ${sectionContent}`.toLowerCase();

    // Enhanced topic detection
    const topicKeywords: Record<string, string[]> = {
      security: ['security', 'authentication', 'authorization', 'encrypt', 'validate', 'sanitize', 'xss', 'csrf', 'injection', 'secret', 'password', 'token'],
      testing: ['test', 'unit test', 'integration test', 'e2e', 'coverage', 'mock', 'tdd', 'bdd', 'assert'],
      performance: ['performance', 'optimize', 'cache', 'index', 'scale', 'latency', 'throughput', 'memory', 'speed'],
      api: ['api', 'rest', 'graphql', 'endpoint', 'http', 'request', 'response', 'contract', 'swagger'],
      database: ['database', 'sql', 'nosql', 'query', 'transaction', 'migration', 'schema', 'table', 'index'],
      frontend: ['ui', 'component', 'view', 'page', 'css', 'style', 'button', 'form', 'react', 'angular', 'vue'],
      backend: ['service', 'business logic', 'workflow', 'server', 'backend', 'microservice'],
      documentation: ['documentation', 'document', 'readme', 'spec', 'diagram', 'comment'],
      logging: ['log', 'logging', 'audit', 'trace', 'debug', 'monitor'],
      'error-handling': ['error', 'exception', 'fault', 'failure', 'retry', 'fallback'],
      architecture: ['architecture', 'design', 'pattern', 'structure', 'layer', 'component'],
      'code-quality': ['quality', 'clean code', 'refactor', 'maintainable', 'readable', 'standard'],
      deployment: ['deploy', 'deployment', 'ci/cd', 'pipeline', 'build', 'release'],
      configuration: ['config', 'configuration', 'setting', 'environment', 'variable']
    };

    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(keyword => fullText.includes(keyword))) {
        topics.add(topic);
      }
    }

    // Enhanced layer detection
    const layerKeywords: Record<string, string[]> = {
      '1-Presentation': ['ui', 'component', 'page', 'view', 'frontend', 'css', 'react', 'angular', 'vue', 'presentation'],
      '2-Application': ['service', 'business logic', 'workflow', 'orchestration', 'application', 'use case'],
      '3-Domain': ['entity', 'aggregate', 'domain model', 'business rule', 'domain', 'core'],
      '4-Persistence': ['database', 'repository', 'dao', 'sql', 'query', 'storage', 'persistence', 'data'],
      '5-Tests': ['test', 'testing', 'spec', 'jest', 'mocha', 'vitest', 'unit', 'integration', 'e2e'],
      '6-Tests': ['test', 'testing', 'unit test', 'integration test', 'e2e', 'spec'],
      '7-Infrastructure': ['deploy', 'infrastructure', 'ci/cd', 'monitoring', 'docker', 'kubernetes', 'cloud']
    };

    for (const [layer, keywords] of Object.entries(layerKeywords)) {
      if (keywords.some(keyword => fullText.includes(keyword))) {
        layers.add(layer);
      }
    }

    // Enhanced technology detection
    const techKeywords = [
      'react', 'angular', 'vue', 'typescript', 'javascript', 'node.js', 'nodejs',
      'c#', 'csharp', '.net', 'dotnet', 'java', 'python', 'go', 'rust',
      'sql', 'postgresql', 'mysql', 'mongodb', 'redis', 'neo4j', 'elasticsearch',
      'docker', 'kubernetes', 'azure', 'aws', 'gcp',
      'rest', 'graphql', 'grpc', 'http', 'https', 'jwt', 'oauth',
      'git', 'github', 'gitlab', 'jenkins', 'terraform'
    ];

    for (const tech of techKeywords) {
      if (fullText.includes(tech)) {
        technologies.add(tech);
      }
    }

    return {
      topics: Array.from(topics),
      layers: Array.from(layers),
      technologies: Array.from(technologies)
    };
  }

  /**
   * Legacy tag extraction (for backward compatibility)
   */
  private extractTagsFromContent(entity: any, content: string) {
    const layerMatches = content.match(/\b\d-[A-Za-z]+\b/g);
    if (layerMatches) {
      entity.layerTags = layerMatches;
    }

    const topicMatches = content.match(/\b(security|testing|process|architecture|data|build|quality)\b/gi);
    if (topicMatches) {
      entity.topics = topicMatches.map((t: string) => t.toLowerCase());
    }
  }

  async close(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
  }

  /**
   * Dangerous: Reset/delete all indexed data for current workspace
   */
  private async resetIndex(): Promise<any> {
    if (!this.connection) {
      throw new Error('Connection not initialized');
    }

    const workspace = this.workspace;
    const session = this.connection.getSession();

    const stats: Record<string, number> = {} as any;

    try {
      // Count nodes to be deleted
      const pre = await session.run(
        'MATCH (n {workspace: $workspace}) RETURN count(n) AS c',
        { workspace }
      );
      stats.toDelete = pre.records[0].get('c').toNumber();

      console.error(`[reset_index] Deleting ${stats.toDelete} workspace-scoped nodes for workspace='${workspace}'`);

      // Delete all workspace-scoped nodes (Rule, Section, Directive, Entity, etc.)
      await session.run(
        'MATCH (n {workspace: $workspace}) DETACH DELETE n',
        { workspace }
      );

      // Clean up orphan taxonomy nodes (shared across workspaces, safe if orphan)
      const topicDel = await session.run(
        'MATCH (t:Topic) WHERE NOT (t)<-[:APPLIES_TO_TOPIC]-(:Directive) DETACH DELETE t RETURN count(t) as c'
      );
      const layerDel = await session.run(
        'MATCH (l:Layer) WHERE NOT (l)<-[:APPLIES_TO_LAYER]-(:Directive) DETACH DELETE l RETURN count(l) as c'
      );
      const techDel = await session.run(
        'MATCH (t:Technology) WHERE NOT (t)<-[:APPLIES_TO_TECHNOLOGY]-(:Directive) DETACH DELETE t RETURN count(t) as c'
      );

      stats.orphanTopicsDeleted = topicDel.records[0].get('c').toNumber();
      stats.orphanLayersDeleted = layerDel.records[0].get('c').toNumber();
      stats.orphanTechnologiesDeleted = techDel.records[0].get('c').toNumber();

      return {
        workspace,
        deletedNodes: stats.toDelete,
        orphanTopicsDeleted: stats.orphanTopicsDeleted,
        orphanLayersDeleted: stats.orphanLayersDeleted,
        orphanTechnologiesDeleted: stats.orphanTechnologiesDeleted,
        timestamp: new Date().toISOString()
      };
    } finally {
      await session.close();
    }
  }
}
