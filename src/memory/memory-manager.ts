/**
 * Memory Manager
 * 
 * Handles original Memory MCP server functionality to ensure backward compatibility.
 * This module wraps the core memory operations (entities, relations, search) that
 * existing Memory MCP clients expect.
 */

import Database from 'better-sqlite3';
import { z } from 'zod';

// Schema definitions for memory operations
const EntitySchema = z.object({
  name: z.string(),
  entityType: z.string(),
  observations: z.array(z.string()).optional(),
});

const RelationSchema = z.object({
  from: z.string(),
  to: z.string(),
  relationType: z.string(),
});

const SearchNodeSchema = z.object({
  query: z.string(),
  limit: z.number().optional().default(10),
});

export type Entity = z.infer<typeof EntitySchema>;
export type Relation = z.infer<typeof RelationSchema>;
export type SearchNode = z.infer<typeof SearchNodeSchema>;

/**
 * Memory Manager class that provides original Memory MCP functionality
 */
export class MemoryManager {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor(dbPath: string = './memory.db') {
    this.dbPath = dbPath;
  }

  async initialize(): Promise<void> {
    try {
      this.db = new Database(this.dbPath);
      
      // Enable WAL mode for better concurrent access
      this.db.pragma('journal_mode = WAL');
      
      // Create original Memory MCP tables
      this.createMemoryTables();
      
      console.error('Memory manager initialized successfully');
    } catch (error) {
      throw new Error(`Failed to initialize memory manager: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private createMemoryTables(): void {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // Entities table (original Memory MCP schema)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS entities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        entity_type TEXT NOT NULL,
        observations TEXT, -- JSON array
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Relations table (original Memory MCP schema)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS relations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_entity TEXT NOT NULL,
        to_entity TEXT NOT NULL,
        relation_type TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (from_entity) REFERENCES entities(name),
        FOREIGN KEY (to_entity) REFERENCES entities(name)
      )
    `);

    // Create indexes for performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);
      CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(entity_type);
      CREATE INDEX IF NOT EXISTS idx_relations_from ON relations(from_entity);
      CREATE INDEX IF NOT EXISTS idx_relations_to ON relations(to_entity);
      CREATE INDEX IF NOT EXISTS idx_relations_type ON relations(relation_type);
    `);
  }

  async handleTool(name: string, args: any): Promise<any> {
    switch (name) {
      case 'memory.create_entities':
        return await this.createEntities(args);
      case 'memory.create_relations':
        return await this.createRelations(args);
      case 'memory.search_nodes':
        return await this.searchNodes(args);
      case 'memory.read_graph':
        return await this.readGraph(args);
      default:
        throw new Error(`Unknown memory tool: ${name}`);
    }
  }

  private async createEntities(args: any): Promise<any> {
    const { entities } = args;
    
    if (!Array.isArray(entities)) {
      throw new Error('entities must be an array');
    }

    const validatedEntities = entities.map(entity => EntitySchema.parse(entity));
    const created: string[] = [];
    const updated: string[] = [];

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const insertStmt = this.db.prepare(`
      INSERT OR REPLACE INTO entities (name, entity_type, observations, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `);

    const checkStmt = this.db.prepare(`
      SELECT name FROM entities WHERE name = ?
    `);

    for (const entity of validatedEntities) {
      const existing = checkStmt.get(entity.name);
      const observations = entity.observations ? JSON.stringify(entity.observations) : null;
      
      insertStmt.run(entity.name, entity.entityType, observations);
      
      if (existing) {
        updated.push(entity.name);
      } else {
        created.push(entity.name);
      }
    }

    return {
      created: created.length,
      updated: updated.length,
      entities: [...created, ...updated]
    };
  }

  private async createRelations(args: any): Promise<any> {
    const { relations } = args;
    
    if (!Array.isArray(relations)) {
      throw new Error('relations must be an array');
    }

    const validatedRelations = relations.map(relation => RelationSchema.parse(relation));
    let created = 0;

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const insertStmt = this.db.prepare(`
      INSERT OR IGNORE INTO relations (from_entity, to_entity, relation_type)
      VALUES (?, ?, ?)
    `);

    for (const relation of validatedRelations) {
      const result = insertStmt.run(relation.from, relation.to, relation.relationType);
      if (result.changes > 0) {
        created++;
      }
    }

    return {
      created,
      total: validatedRelations.length
    };
  }

  private async searchNodes(args: any): Promise<any> {
    const searchParams = SearchNodeSchema.parse(args);
    
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // Simple text-based search for now (can be enhanced with vector search later)
    const searchStmt = this.db.prepare(`
      SELECT 
        name,
        entity_type,
        observations,
        created_at,
        updated_at
      FROM entities 
      WHERE 
        name LIKE ? OR 
        entity_type LIKE ? OR 
        observations LIKE ?
      ORDER BY updated_at DESC
      LIMIT ?
    `);

    const searchTerm = `%${searchParams.query}%`;
    const results = searchStmt.all(searchTerm, searchTerm, searchTerm, searchParams.limit);

    return {
      nodes: results.map(row => ({
        name: row.name,
        entityType: row.entity_type,
        observations: row.observations ? JSON.parse(row.observations) : [],
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }))
    };
  }

  private async readGraph(args: any): Promise<any> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // Get all entities and relations
    const entitiesStmt = this.db.prepare(`
      SELECT name, entity_type, observations, created_at, updated_at
      FROM entities
      ORDER BY name
    `);

    const relationsStmt = this.db.prepare(`
      SELECT from_entity, to_entity, relation_type, created_at
      FROM relations
      ORDER BY from_entity, to_entity
    `);

    const entities = entitiesStmt.all();
    const relations = relationsStmt.all();

    return {
      entities: entities.map(row => ({
        name: row.name,
        entityType: row.entity_type,
        observations: row.observations ? JSON.parse(row.observations) : [],
        createdAt: row.created_at,
        updatedAt: row.updated_at
      })),
      relations: relations.map(row => ({
        from: row.from_entity,
        to: row.to_entity,
        relationType: row.relation_type,
        createdAt: row.created_at
      }))
    };
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}