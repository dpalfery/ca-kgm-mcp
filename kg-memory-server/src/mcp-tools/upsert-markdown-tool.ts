import { 
  UpsertMarkdownInput, 
  UpsertMarkdownOutput, 
  IngestionStats,
  Rule,
  Directive,
  RuleRelationship
} from '../types.js';
import { RuleDocumentParser } from '../interfaces/knowledge-graph.js';
import { RuleKnowledgeGraph } from '../interfaces/knowledge-graph.js';
import { CacheManager } from '../cache/cache-manager.js';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * MCP tool for ingesting rule documents from markdown files
 * Supports batch processing and incremental updates
 */
export class UpsertMarkdownTool {
  private parser: RuleDocumentParser;
  private knowledgeGraph: RuleKnowledgeGraph;
  private cacheManager: CacheManager;

  constructor(
    parser: RuleDocumentParser,
    knowledgeGraph: RuleKnowledgeGraph,
    cacheManager?: CacheManager
  ) {
    this.parser = parser;
    this.knowledgeGraph = knowledgeGraph;
    this.cacheManager = cacheManager || new CacheManager();
  }

  /**
   * Execute the upsert_markdown tool
   */
  async execute(input: UpsertMarkdownInput): Promise<UpsertMarkdownOutput> {
    try {
      // Validate input
      this.validateInput(input);

      // Process documents
      const results = await this.processDocuments(input.documents, input.options);

      return results;

    } catch (error) {
      // Handle errors gracefully
      return this.handleError(error, input);
    }
  }

  /**
   * Validate input parameters
   */
  private validateInput(input: UpsertMarkdownInput): void {
    if (!input.documents || !Array.isArray(input.documents)) {
      throw new Error('documents is required and must be an array');
    }

    if (input.documents.length === 0) {
      throw new Error('documents array cannot be empty');
    }

    if (input.documents.length > 100) {
      throw new Error('cannot process more than 100 documents at once');
    }

    for (const doc of input.documents) {
      if (!doc.path || typeof doc.path !== 'string') {
        throw new Error('each document must have a valid path string');
      }

      if (!doc.path.endsWith('.md')) {
        throw new Error('only markdown files (.md) are supported');
      }
    }
  }

  /**
   * Process multiple documents
   */
  private async processDocuments(
    documents: { path: string }[],
    options?: { overwrite?: boolean }
  ): Promise<UpsertMarkdownOutput> {
    const stats: IngestionStats = {
      rulesProcessed: 0,
      directivesExtracted: 0,
      entitiesCreated: 0,
      relationsCreated: 0,
      warnings: []
    };

    const allRules: Rule[] = [];
    const allDirectives: Directive[] = [];
    const allRelationships: RuleRelationship[] = [];

    // Process each document
    for (const doc of documents) {
      try {
        const result = await this.processDocument(doc.path, options?.overwrite);
        
        // Accumulate results
        allRules.push(result.rule);
        allDirectives.push(...result.directives);
        allRelationships.push(...result.relationships);
        
        stats.rulesProcessed++;
        stats.directivesExtracted += result.directives.length;
        stats.warnings.push(...result.warnings);

      } catch (error) {
        const errorMsg = `Failed to process ${doc.path}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        stats.warnings.push(errorMsg);
        console.error(errorMsg, error);
      }
    }

    // Batch upsert to knowledge graph
    if (allRules.length > 0) {
      try {
        const upsertResult = await this.knowledgeGraph.batchUpsert({
          rules: allRules,
          directives: allDirectives,
          relationships: allRelationships,
          deleteExisting: options?.overwrite
        });

        stats.entitiesCreated = upsertResult.entitiesCreated;
        stats.relationsCreated = upsertResult.relationsCreated;
        stats.warnings.push(...upsertResult.warnings);

        // Invalidate cache for updated rules
        const ruleIds = allRules.map(rule => rule.id);
        this.cacheManager.invalidateOnRuleUpdate(ruleIds);

      } catch (error) {
        const errorMsg = `Failed to upsert to knowledge graph: ${error instanceof Error ? error.message : 'Unknown error'}`;
        stats.warnings.push(errorMsg);
        throw new Error(errorMsg);
      }
    }

    return {
      upserted: stats,
      relations: allRelationships.length,
      warnings: stats.warnings
    };
  }

  /**
   * Process a single document
   */
  private async processDocument(
    filePath: string, 
    overwrite?: boolean
  ): Promise<{
    rule: Rule;
    directives: Directive[];
    relationships: RuleRelationship[];
    warnings: string[];
  }> {
    // Read file content
    let content: string;
    try {
      content = await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      throw new Error(`Cannot read file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    if (content.trim().length === 0) {
      throw new Error(`File ${filePath} is empty`);
    }

    // Validate document format
    const validation = await this.parser.validateRuleDocument(content);
    if (!validation.isValid) {
      throw new Error(`Invalid rule document format in ${filePath}: ${validation.errors.join(', ')}`);
    }

    // Parse document
    const parsed = await this.parser.parseRuleDocument(content, filePath);

    // Check for existing rule if not overwriting
    if (!overwrite) {
      const existingRules = await this.knowledgeGraph.getRules({
        sourcePaths: [filePath],
        limit: 1
      });

      if (existingRules.length > 0) {
        // Perform incremental update
        return await this.performIncrementalUpdate(filePath, parsed);
      }
    }

    return parsed;
  }

  /**
   * Perform incremental update for existing rule
   */
  private async performIncrementalUpdate(
    sourcePath: string,
    parsed: {
      rule: Rule;
      directives: Directive[];
      relationships: RuleRelationship[];
      warnings: string[];
    }
  ): Promise<{
    rule: Rule;
    directives: Directive[];
    relationships: RuleRelationship[];
    warnings: string[];
  }> {
    try {
      const result = await this.knowledgeGraph.incrementalUpdate(
        sourcePath,
        [parsed.rule],
        parsed.directives
      );

      return {
        ...parsed,
        warnings: [...parsed.warnings, ...result.warnings]
      };

    } catch (error) {
      // Fall back to full replacement
      parsed.warnings.push(`Incremental update failed, performing full replacement: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return parsed;
    }
  }

  /**
   * Handle errors with graceful fallback
   */
  private handleError(error: any, _input: UpsertMarkdownInput): UpsertMarkdownOutput {
    console.error('Error in upsert_markdown tool:', error);

    const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return {
      upserted: {
        rulesProcessed: 0,
        directivesExtracted: 0,
        entitiesCreated: 0,
        relationsCreated: 0,
        warnings: [errorMsg]
      },
      relations: 0,
      warnings: [errorMsg]
    };
  }

  /**
   * Validate markdown files before processing
   */
  async validateDocuments(filePaths: string[]): Promise<{
    valid: string[];
    invalid: { path: string; errors: string[] }[];
  }> {
    const valid: string[] = [];
    const invalid: { path: string; errors: string[] }[] = [];

    for (const filePath of filePaths) {
      try {
        // Check if file exists and is readable
        await fs.access(filePath, fs.constants.R_OK);
        
        // Read and validate content
        const content = await fs.readFile(filePath, 'utf-8');
        const validation = await this.parser.validateRuleDocument(content);
        
        if (validation.isValid) {
          valid.push(filePath);
        } else {
          invalid.push({
            path: filePath,
            errors: validation.errors
          });
        }

      } catch (error) {
        invalid.push({
          path: filePath,
          errors: [`Cannot access file: ${error instanceof Error ? error.message : 'Unknown error'}`]
        });
      }
    }

    return { valid, invalid };
  }

  /**
   * Get ingestion statistics
   */
  async getIngestionStats(): Promise<{
    totalRules: number;
    totalDirectives: number;
    recentIngestions: {
      sourcePath: string;
      lastUpdated: Date;
      ruleCount: number;
      directiveCount: number;
    }[];
  }> {
    const stats = await this.knowledgeGraph.getRuleStats();
    
    // Get recent ingestions (last 10)
    const recentRules = await this.knowledgeGraph.getRules({
      limit: 10,
      // Would need to add orderBy to interface
    });

    const recentIngestions = recentRules.map(rule => ({
      sourcePath: rule.sourcePath,
      lastUpdated: rule.lastUpdated,
      ruleCount: 1,
      directiveCount: 0 // Would need to query directives for each rule
    }));

    return {
      totalRules: stats.totalRules,
      totalDirectives: stats.totalDirectives,
      recentIngestions
    };
  }

  /**
   * Batch validate and process documents from directory
   */
  async processDirectory(
    directoryPath: string,
    options?: {
      recursive?: boolean;
      overwrite?: boolean;
      filePattern?: RegExp;
    }
  ): Promise<UpsertMarkdownOutput> {
    const filePattern = options?.filePattern || /\.md$/;
    const documents: { path: string }[] = [];

    // Scan directory for markdown files
    const scanDirectory = async (dirPath: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          
          if (entry.isDirectory() && options?.recursive) {
            await scanDirectory(fullPath);
          } else if (entry.isFile() && filePattern.test(entry.name)) {
            documents.push({ path: fullPath });
          }
        }
      } catch (error) {
        throw new Error(`Cannot scan directory ${dirPath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    };

    await scanDirectory(directoryPath);

    if (documents.length === 0) {
      return {
        upserted: {
          rulesProcessed: 0,
          directivesExtracted: 0,
          entitiesCreated: 0,
          relationsCreated: 0,
          warnings: [`No markdown files found in ${directoryPath}`]
        },
        relations: 0,
        warnings: [`No markdown files found in ${directoryPath}`]
      };
    }

    return await this.execute({
      documents,
      options: {
        overwrite: options?.overwrite
      }
    });
  }

  /**
   * Get tool schema for MCP server registration
   */
  static getToolSchema() {
    return {
      name: "upsert_markdown",
      description: "Ingest rule documents from markdown files into the knowledge graph. Supports batch processing and incremental updates.",
      inputSchema: {
        type: "object",
        properties: {
          documents: {
            type: "array",
            items: {
              type: "object",
              properties: {
                path: {
                  type: "string",
                  description: "Path to the markdown file containing rule document"
                }
              },
              required: ["path"],
              additionalProperties: false
            },
            description: "Array of document paths to process",
            maxItems: 100
          },
          options: {
            type: "object",
            properties: {
              overwrite: {
                type: "boolean",
                description: "Whether to overwrite existing rules (default: false, performs incremental update)"
              }
            },
            additionalProperties: false
          }
        },
        required: ["documents"],
        additionalProperties: false
      }
    };
  }
}