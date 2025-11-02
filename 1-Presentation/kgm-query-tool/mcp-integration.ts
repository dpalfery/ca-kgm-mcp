// MCP Memory Server Integration
// Handles create_entities and create_relations calls for knowledge graph population

import { use_mcp_tool } from './mcp-client'; // Assuming MCP client utility

export async function populateKnowledgeGraph(entities: any[], relations: any[]): Promise<void> {
  console.log(`Populating knowledge graph with ${entities.length} entities and ${relations.length} relations`);

  // Batch entities to avoid MCP limits
  const entityBatches = chunkArray(entities, 50);
  for (const batch of entityBatches) {
    await use_mcp_tool({
      server_name: 'memory',
      tool_name: 'create_entities',
      arguments: {
        entities: batch.map(entity => ({
          name: entity.name,
          entityType: entity.entityType,
          observations: entity.observations
        }))
      }
    });
  }

  // Batch relations
  const relationBatches = chunkArray(relations, 100);
  for (const batch of relationBatches) {
    await use_mcp_tool({
      server_name: 'memory',
      tool_name: 'create_relations',
      arguments: {
        relations: batch.map(relation => ({
          from: relation.from,
          to: relation.to,
          relationType: relation.relationType
        }))
      }
    });
  }

  console.log('Knowledge graph population completed');
}

export async function queryKnowledgeGraph(query: string, filters?: any): Promise<any[]> {
  const result = await use_mcp_tool({
    server_name: 'memory',
    tool_name: 'search_nodes',
    arguments: {
      query,
      ...(filters && { filters })
    }
  });

  return result.nodes || [];
}

function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

// Example usage:
// import { populateKnowledgeGraph } from './mcp-integration';
// await populateKnowledgeGraph(entities, relations);