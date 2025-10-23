/**
 * ContextISO Neo4j Configuration Loader
 * 
 * Loads Neo4j Aura configuration from environment variables
 */

import { Neo4jConfig } from './neo4j-types.js';

export function loadNeo4jConfig(): Neo4jConfig {
  // Read env with safe fallbacks (do not log values)
  const uri = process.env.NEO4J_URI;
  const username = process.env.NEO4J_USERNAME || process.env.NEO4J_USER; // allow common alias
  const password = process.env.NEO4J_PASSWORD;

  const missing: string[] = [];
  if (!uri) missing.push('NEO4J_URI');
  if (!username) missing.push('NEO4J_USERNAME');
  if (!password) missing.push('NEO4J_PASSWORD');

  if (missing.length > 0) {
    throw new Error(
      `Missing required Neo4j configuration: ${missing.join(', ')}. Ensure these environment variables are set and that your terminal/VS Code session has inherited them.`
    );
  }

  return {
    uri: uri!,
    username: username!,
    password: password!,
    database: process.env.NEO4J_DATABASE || 'neo4j',
    encrypted: true,
    maxConnectionPoolSize: 50,
    connectionTimeout: 30000
  };
}
