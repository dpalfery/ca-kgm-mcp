/**
 * ContextISO Neo4j Connection Manager
 * 
 * Manages Neo4j driver and session lifecycle for Aura cloud database
 */

import neo4j, { Driver, Session } from 'neo4j-driver';
import { Neo4jConfig } from '../config/neo4j-types.js';

export class Neo4jConnection {
  private driver: Driver | null = null;
  private config: Neo4jConfig;
  private schemaCreated: boolean = false;

  constructor(config: Neo4jConfig) {
    this.config = config;
  }

  /**
   * Connect to Neo4j Aura instance
   */
  async connect(): Promise<void> {
    try {
      // For neo4j+s:// URIs (Aura), encryption is already specified in the scheme
      // Don't set encrypted config to avoid "Encryption/trust can only be configured either through URL or config, not both"
      const driverConfig: Record<string, any> = {
        maxConnectionPoolSize: this.config.maxConnectionPoolSize || 50,
        connectionTimeout: this.config.connectionTimeout || 30000
      };

      // Only set encrypted if using non-encrypted scheme (neo4j://)
      if (this.config.uri.startsWith('neo4j://')) {
        driverConfig.encrypted = true;
      }

      this.driver = neo4j.driver(
        this.config.uri,
        neo4j.auth.basic(this.config.username, this.config.password),
        driverConfig
      );

      // Verify connectivity
      await this.driver.verifyConnectivity();
      console.error('✅ Connected to Neo4j Aura successfully');
    } catch (error) {
      throw new Error(
        `Failed to connect to Neo4j: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get a new session for executing queries
   */
  getSession(): Session {
    if (!this.driver) {
      throw new Error('Driver not initialized. Call connect() first.');
    }
    return this.driver.session({
      database: this.config.database || 'neo4j'
    });
  }

  /**
   * Create database schema (constraints and indexes)
   */
  async createSchema(): Promise<void> {
    if (this.schemaCreated) {
      return;
    }

    const session = this.getSession();
    try {
      // Create unique constraints
      await session.run(
        `CREATE CONSTRAINT entity_name_unique IF NOT EXISTS
         FOR (e:Entity) REQUIRE e.name IS UNIQUE`
      );

      await session.run(
        `CREATE CONSTRAINT rule_id_unique IF NOT EXISTS
         FOR (r:Rule) REQUIRE r.id IS UNIQUE`
      );

      await session.run(
        `CREATE CONSTRAINT section_id_unique IF NOT EXISTS
         FOR (s:Section) REQUIRE s.id IS UNIQUE`
      );

      await session.run(
        `CREATE CONSTRAINT directive_id_unique IF NOT EXISTS
         FOR (d:Directive) REQUIRE d.id IS UNIQUE`
      );

      // Create performance indexes
      await session.run(
        `CREATE INDEX entity_type_idx IF NOT EXISTS
         FOR (e:Entity) ON (e.entityType)`
      );

      await session.run(
        `CREATE INDEX rule_layer_idx IF NOT EXISTS
         FOR (r:Rule) ON (r.layer)`
      );

      await session.run(
        `CREATE INDEX directive_severity_idx IF NOT EXISTS
         FOR (d:Directive) ON (d.severity)`
      );

      await session.run(
        `CREATE INDEX directive_layer_idx IF NOT EXISTS
         FOR (d:Directive) ON (d.layer)`
      );

      // Create full-text search indexes
      await session.run(
        `CREATE FULLTEXT INDEX entity_search IF NOT EXISTS
         FOR (e:Entity) ON EACH [e.name, e.observations]`
      );

      await session.run(
        `CREATE FULLTEXT INDEX directive_search IF NOT EXISTS
         FOR (d:Directive) ON EACH [d.text, d.rationale, d.topics]`
      );

      this.schemaCreated = true;
      console.error('✅ Schema created successfully');
    } catch (error) {
      // Some constraints may already exist; log but don't fail
      console.error('⚠️  Schema creation warning:', error instanceof Error ? error.message : String(error));
      this.schemaCreated = true;
    } finally {
      await session.close();
    }
  }

  /**
   * Close connection and cleanup resources
   */
  async close(): Promise<void> {
    if (this.driver) {
      await this.driver.close();
      this.driver = null;
      console.error('✅ Disconnected from Neo4j');
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.driver !== null;
  }
}
