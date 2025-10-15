import { Rule, Directive, RuleRelationship, IngestionStats } from '../types.js';

/**
 * Extended knowledge graph interface that builds upon the base Memory MCP Server
 * functionality with rule-specific operations and schema extensions
 */
export interface RuleKnowledgeGraph {
  // Rule management operations
  
  /**
   * Create or update rules in the knowledge graph
   */
  upsertRules(rules: Rule[]): Promise<Rule[]>;
  
  /**
   * Create or update directives associated with rules
   */
  upsertDirectives(directives: Directive[]): Promise<Directive[]>;
  
  /**
   * Create relationships between rules and other entities
   */
  createRuleRelationships(relationships: RuleRelationship[]): Promise<RuleRelationship[]>;
  
  /**
   * Query directives based on criteria
   */
  queryDirectives(criteria: DirectiveQueryCriteria): Promise<Directive[]>;
  
  /**
   * Get rules by various filters
   */
  getRules(filters: RuleFilters): Promise<Rule[]>;
  
  /**
   * Delete rules and cascade to related directives
   */
  deleteRules(ruleIds: string[]): Promise<void>;
  
  /**
   * Get rule statistics and health information
   */
  getRuleStats(): Promise<RuleGraphStats>;
  
  // Batch operations for performance
  
  /**
   * Batch upsert operation for rules and directives
   */
  batchUpsert(batch: BatchUpsertData): Promise<IngestionStats>;
  
  /**
   * Incremental update based on source file changes
   */
  incrementalUpdate(sourcePath: string, rules: Rule[], directives: Directive[]): Promise<IngestionStats>;
}

/**
 * Criteria for querying directives
 */
export interface DirectiveQueryCriteria {
  ruleIds?: string[];
  layers?: string[];
  topics?: string[];
  severities?: string[];
  textSearch?: string;
  limit?: number;
  offset?: number;
}

/**
 * Filters for rule queries
 */
export interface RuleFilters {
  layers?: string[];
  topics?: string[];
  authoritativeFor?: string[];
  sourcePaths?: string[];
  updatedAfter?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Statistics about the rule knowledge graph
 */
export interface RuleGraphStats {
  totalRules: number;
  totalDirectives: number;
  totalRelationships: number;
  rulesByLayer: Record<string, number>;
  directivesBySeverity: Record<string, number>;
  topicDistribution: Record<string, number>;
  lastUpdated: Date;
  storageSize: number;
}

/**
 * Batch data for bulk operations
 */
export interface BatchUpsertData {
  rules: Rule[];
  directives: Directive[];
  relationships: RuleRelationship[];
  deleteExisting?: boolean;
}

/**
 * Interface for rule document parsing and ingestion
 */
export interface RuleDocumentParser {
  /**
   * Parse markdown rule document into structured data
   */
  parseRuleDocument(content: string, sourcePath: string): Promise<ParsedRuleDocument>;
  
  /**
   * Validate rule document format and structure
   */
  validateRuleDocument(content: string): Promise<ValidationResult>;
  
  /**
   * Extract metadata from rule document
   */
  extractMetadata(content: string): Promise<RuleMetadata>;
}

/**
 * Result of parsing a rule document
 */
export interface ParsedRuleDocument {
  rule: Rule;
  directives: Directive[];
  relationships: RuleRelationship[];
  warnings: string[];
}

/**
 * Validation result for rule documents
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

/**
 * Metadata extracted from rule documents
 */
export interface RuleMetadata {
  name: string;
  layer: string;
  authoritativeFor: string[];
  topics: string[];
  whenToApply: string[];
  lastModified?: Date;
}