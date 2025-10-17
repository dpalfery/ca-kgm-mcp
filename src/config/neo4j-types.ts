/**
 * Neo4j Configuration Types
 * 
 * Type definitions for Neo4j Aura cloud database configuration
 */

export interface Neo4jConfig {
  uri: string;                        // Neo4j Aura instance URI (e.g., neo4j+s://xxxxx.databases.neo4j.io)
  username: string;                   // Database username (typically 'neo4j')
  password: string;                   // Database password
  database?: string;                  // Database name (default: 'neo4j')
  encrypted: boolean;                 // Always true for Aura (should be 'ENCRYPTION_ON')
  maxConnectionPoolSize?: number;     // Maximum connection pool size (default: 50)
  connectionTimeout?: number;         // Connection timeout in milliseconds (default: 30000)
}
