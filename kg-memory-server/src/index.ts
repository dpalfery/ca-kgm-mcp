/**
 * Knowledge Graph Memory System - Main exports
 * 
 * This module exports all the core functionality for the extended
 * Memory MCP Server with rule-based context detection and ranking.
 */

// Core types
export * from './types.js';

// Database layer
export * from './database/index.js';

// Document parsers
export { RuleDocumentParser } from './parsers/rule-document-parser.js';

// Storage layer
export { RuleKnowledgeGraphImpl } from './storage/rule-knowledge-graph.js';

// Interfaces (selective exports to avoid conflicts)
export type { 
  RuleKnowledgeGraph,
  DirectiveQueryCriteria,
  RuleFilters,
  RuleGraphStats,
  BatchUpsertData,
  ParsedRuleDocument,
  ValidationResult,
  RuleMetadata
} from './interfaces/knowledge-graph.js';

export type {
  ContextDetectionEngine,
  LayerDetectionResult,
  TopicExtractionResult
} from './interfaces/context-detection.js';

export type {
  RankingEngine,
  RankingAlgorithm,
  RankingConfig
} from './interfaces/ranking-engine.js';

export type {
  OutputFormatter,
  FormattingOptions,
  DirectiveFormattingOptions,
  QueryInfo,
  BreadcrumbGenerator,
  NavigationNode,
  TemplateEngine,
  TemplateData
} from './interfaces/output-formatter.js';