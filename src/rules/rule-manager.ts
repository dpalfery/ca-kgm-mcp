/**
 * Rule Manager
 * 
 * Handles new rule-specific functionality for knowledge graph-based rule management.
 * This module provides context detection, rule retrieval, and ranking capabilities.
 */

import Database from 'better-sqlite3';
import { z } from 'zod';

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
 * Rule Manager class that provides new rule-specific functionality
 */
export class RuleManager {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor(dbPath: string = './memory.db') {
    this.dbPath = dbPath;
  }

  async initialize(): Promise<void> {
    try {
      // Use the same database as memory manager for unified storage
      this.db = new Database(this.dbPath);
      
      // Create rule-specific tables
      this.createRuleTables();
      
      console.error('Rule manager initialized successfully');
    } catch (error) {
      throw new Error(`Failed to initialize rule manager: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private createRuleTables(): void {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // Rules table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS rules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        layer TEXT NOT NULL,
        authoritative_for TEXT, -- JSON array
        topics TEXT,            -- JSON array
        severity TEXT NOT NULL,
        when_to_apply TEXT,     -- JSON array
        source_path TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Sections table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sections (
        id TEXT PRIMARY KEY,
        rule_id TEXT NOT NULL,
        name TEXT NOT NULL,
        content TEXT,
        FOREIGN KEY (rule_id) REFERENCES rules(id) ON DELETE CASCADE
      )
    `);

    // Directives table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS directives (
        id TEXT PRIMARY KEY,
        section_id TEXT NOT NULL,
        text TEXT NOT NULL,
        severity TEXT NOT NULL,
        topics TEXT,            -- JSON array
        layer TEXT,
        when_to_apply TEXT,     -- JSON array
        rationale TEXT,
        examples TEXT,          -- JSON array of CodeExample
        anti_patterns TEXT,     -- JSON array of CodeExample
        source_rule_name TEXT,
        source_section_name TEXT,
        source_path TEXT,
        embedding BLOB,         -- Vector embedding
        FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
      )
    `);

    // Create indexes for performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_directives_topics ON directives(topics);
      CREATE INDEX IF NOT EXISTS idx_directives_layer ON directives(layer);
      CREATE INDEX IF NOT EXISTS idx_directives_severity ON directives(severity);
      CREATE INDEX IF NOT EXISTS idx_rules_authoritative_for ON rules(authoritative_for);
      CREATE INDEX IF NOT EXISTS idx_rules_layer ON rules(layer);
      CREATE INDEX IF NOT EXISTS idx_rules_topics ON rules(topics);
    `);
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
    
    // For now, return a placeholder response
    // This will be implemented in later tasks
    return {
      context_block: `# Contextual Rules for Task

**Detected Context**: Placeholder detection

## Key Directives

- **[MUST]** This is a placeholder directive for task: "${params.taskDescription}"
  - *Applies to: general*
  - *Source: Placeholder Rule → General Section*

`,
      citations: [],
      diagnostics: {
        detectedLayer: '*',
        topics: ['general'],
        retrievalStats: {
          searched: 0,
          considered: 0,
          selected: 1
        }
      }
    };
  }

  private async detectContext(args: any): Promise<any> {
    const params = DetectContextSchema.parse(args);
    
    // For now, return a placeholder response
    // This will be implemented in later tasks
    return {
      detectedLayer: '*',
      topics: ['general'],
      keywords: params.options.returnKeywords ? ['placeholder'] : undefined,
      confidence: 0.5,
      alternativeContexts: []
    };
  }

  private async upsertMarkdown(args: any): Promise<any> {
    const params = UpsertMarkdownSchema.parse(args);
    
    // For now, return a placeholder response
    // This will be implemented in later tasks
    return {
      upserted: {
        rules: 0,
        sections: 0,
        directives: 0,
        patterns: 0
      },
      relations: 0,
      warnings: [],
      errors: []
    };
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}