/**
 * Storage layer for the Knowledge Graph Memory system
 * 
 * This module provides the storage implementations for rule-specific
 * knowledge graph operations, extending the base Memory MCP Server
 * functionality with domain-aware storage and retrieval.
 */

export { RuleKnowledgeGraphImpl } from './rule-knowledge-graph.js';

// Re-export interfaces for convenience
export type { 
  RuleKnowledgeGraph,
  DirectiveQueryCriteria,
  RuleFilters,
  RuleGraphStats,
  BatchUpsertData
} from '../interfaces/knowledge-graph.js';