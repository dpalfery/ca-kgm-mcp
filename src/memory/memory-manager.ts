/**
 * Memory Manager (Neo4j Implementation)
 * 
 * ContextISO Memory Layer - Manages entity storage, relationships, and retrieval.
 * Provides context isolation and optimization through Neo4j Aura cloud backend.
 * Handles core operations: entity management, relationship tracking, and context search.
 */

import { z } from 'zod';
import neo4j from 'neo4j-driver';
import { Neo4jConnection } from '../storage/neo4j-connection.js';
import { Neo4jConfig } from '../config/neo4j-types.js';

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
  limit: z.number().int().optional().default(10),
});

export type Entity = z.infer<typeof EntitySchema>;
export type Relation = z.infer<typeof RelationSchema>;
export type SearchNode = z.infer<typeof SearchNodeSchema>;

/**
 * Memory Manager class that provides ContextISO context management via Neo4j
 */
export class MemoryManager {
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
      console.error('Memory manager initialized successfully');
    } catch (error) {
      throw new Error(
        `Failed to initialize memory manager: ${error instanceof Error ? error.message : String(error)}`
      );
    }
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

    if (!this.connection) {
      throw new Error('Connection not initialized');
    }

    const session = this.connection.getSession();
    try {
      const result = await session.run(
        `
        UNWIND $entities AS entity
        MERGE (e:Entity {name: entity.name})
        ON CREATE SET
          e.entityType = entity.entityType,
          e.observations = entity.observations,
          e.createdAt = datetime(),
          e.updatedAt = datetime()
        ON MATCH SET
          e.entityType = entity.entityType,
          e.observations = entity.observations,
          e.updatedAt = datetime()
        RETURN e.name AS name,
               e.createdAt AS createdAt,
               e.updatedAt AS updatedAt
        `,
        { entities: validatedEntities }
      );

      const created = result.records.filter(
        r => r.get('createdAt').toString() === r.get('updatedAt').toString()
      ).length;

      return {
        created,
        updated: result.records.length - created,
        entities: result.records.map(r => r.get('name'))
      };
    } finally {
      await session.close();
    }
  }

  private async createRelations(args: any): Promise<any> {
    const { relations } = args;

    if (!Array.isArray(relations)) {
      throw new Error('relations must be an array');
    }

    const validatedRelations = relations.map(relation => RelationSchema.parse(relation));

    if (!this.connection) {
      throw new Error('Connection not initialized');
    }

    const session = this.connection.getSession();
    try {
      const result = await session.run(
        `
        UNWIND $relations AS rel
        MATCH (from:Entity {name: rel.from})
        MATCH (to:Entity {name: rel.to})
        MERGE (from)-[r:RELATES_TO {type: rel.relationType}]->(to)
        ON CREATE SET r.createdAt = datetime()
        RETURN count(r) AS created
        `,
        { relations: validatedRelations }
      );

      return {
        created: result.records[0].get('created').toNumber(),
        total: validatedRelations.length
      };
    } finally {
      await session.close();
    }
  }

  private async searchNodes(args: any): Promise<any> {
    const searchParams = SearchNodeSchema.parse(args);

    if (!this.connection) {
      throw new Error('Connection not initialized');
    }

    const session = this.connection.getSession();
    try {
      // Use full-text search
      const result = await session.run(
        `
        CALL db.index.fulltext.queryNodes('entity_search', $query)
        YIELD node, score
        RETURN node.name AS name,
               node.entityType AS entityType,
               node.observations AS observations,
               node.createdAt AS createdAt,
               node.updatedAt AS updatedAt,
               score
        ORDER BY score DESC
        LIMIT $limit
        `,
        {
          query: searchParams.query,
          limit: neo4j.int(Math.floor(searchParams.limit))
        }
      );

      return {
        nodes: result.records.map(record => ({
          name: record.get('name'),
          entityType: record.get('entityType'),
          observations: record.get('observations') || [],
          createdAt: record.get('createdAt'),
          updatedAt: record.get('updatedAt'),
          score: record.get('score')
        }))
      };
    } finally {
      await session.close();
    }
  }

  private async readGraph(_args: any): Promise<any> {
    if (!this.connection) {
      throw new Error('Connection not initialized');
    }

    const session = this.connection.getSession();
    try {
      const entitiesResult = await session.run(`
        MATCH (e:Entity)
        RETURN e.name AS name,
               e.entityType AS entityType,
               e.observations AS observations,
               e.createdAt AS createdAt,
               e.updatedAt AS updatedAt
        ORDER BY e.name
      `);

      const relationsResult = await session.run(`
        MATCH (from:Entity)-[r:RELATES_TO]->(to:Entity)
        RETURN from.name AS fromEntity,
               to.name AS toEntity,
               r.type AS relationType,
               r.createdAt AS createdAt
        ORDER BY from.name, to.name
      `);

      return {
        entities: entitiesResult.records.map(r => ({
          name: r.get('name'),
          entityType: r.get('entityType'),
          observations: r.get('observations') || [],
          createdAt: r.get('createdAt'),
          updatedAt: r.get('updatedAt')
        })),
        relations: relationsResult.records.map(r => ({
          from: r.get('fromEntity'),
          to: r.get('toEntity'),
          relationType: r.get('relationType'),
          createdAt: r.get('createdAt')
        }))
      };
    } finally {
      await session.close();
    }
  }

  async close(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
  }
}