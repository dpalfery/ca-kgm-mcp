/**
 * ContextISO Memory Tools Configuration
 * 
 * Defines the memory tools for context storage and retrieval.
 * These tools provide the interface for storing and accessing contextual information.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export function setupMemoryTools(): Tool[] {
  return [
    {
      name: 'memory.create_entities',
      description: 'Create or update entities in the memory graph',
      inputSchema: {
        type: 'object',
        properties: {
          entities: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Unique name/identifier for the entity'
                },
                entityType: {
                  type: 'string',
                  description: 'Type/category of the entity'
                },
                observations: {
                  type: 'array',
                  items: {
                    type: 'string'
                  },
                  description: 'List of observations about this entity'
                }
              },
              required: ['name', 'entityType']
            }
          }
        },
        required: ['entities']
      }
    },
    {
      name: 'memory.create_relations',
      description: 'Create relationships between entities in the memory graph',
      inputSchema: {
        type: 'object',
        properties: {
          relations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                from: {
                  type: 'string',
                  description: 'Name of the source entity'
                },
                to: {
                  type: 'string',
                  description: 'Name of the target entity'
                },
                relationType: {
                  type: 'string',
                  description: 'Type of relationship'
                }
              },
              required: ['from', 'to', 'relationType']
            }
          }
        },
        required: ['relations']
      }
    },
    {
      name: 'memory.search_nodes',
      description: 'Search for entities in the memory graph',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query string'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return',
            default: 10
          }
        },
        required: ['query']
      }
    },
    {
      name: 'memory.read_graph',
      description: 'Read the entire memory graph structure',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false
      }
    }
  ];
}