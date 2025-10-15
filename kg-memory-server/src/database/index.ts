/**
 * Database layer for the Knowledge Graph Memory system
 * 
 * This module provides SQLite-based storage that extends the base Memory MCP Server
 * with rule-specific tables and operations while maintaining compatibility with
 * the original entity-relation-observation model.
 */

export { DatabaseConnection, getDatabase, initializeDatabase } from './connection.js';
export { MigrationManager, createMigrationManager } from './migrations.js';

// Re-export types for convenience
export type { Rule, Directive, RuleRelationship, IngestionStats } from '../types.js';