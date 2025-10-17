/**
 * ContextISO Neo4j Configuration Loader
 * 
 * Loads Neo4j Aura configuration from environment variables
 */

import { Neo4jConfig } from './neo4j-types.js';

export function loadNeo4jConfig(): Neo4jConfig {
  const uri = process.env.NEO4J_URI;
  const username = process.env.NEO4J_USERNAME;
  const password = process.env.NEO4J_PASSWORD;

  if (!uri || !username || !password) {
    throw new Error(
      'Missing required Neo4j configuration. Please set NEO4J_URI, NEO4J_USERNAME, and NEO4J_PASSWORD environment variables.'
    );
  }

  return {
    uri,
    username,
    password,
    database: process.env.NEO4J_DATABASE || 'neo4j',
    encrypted: true,
    maxConnectionPoolSize: 50,
    connectionTimeout: 30000
  };
}
