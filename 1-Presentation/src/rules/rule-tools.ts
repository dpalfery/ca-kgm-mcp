/**
 * ContextISO Rule Tools Configuration
 * 
 * Defines the MCP tools for context optimization and rule management.
 * These tools provide context detection, rule retrieval, and rule ingestion
 * capabilities for bringing clarity to LLM context through targeted knowledge graphs.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export function setupRuleTools(allowedModes?: string[]): Tool[] {
  const modes = allowedModes || ['architect', 'code', 'debug'];
  return [
    {
      name: 'memory.rules.query_directives',
      description: 'Retrieve contextually relevant rules and directives for a coding task. This is the primary interface for getting project-specific guidelines that match the task context.',
      inputSchema: {
        type: 'object',
        properties: {
          userPrompt: {
            type: 'string',
            description: 'The complete user prompt or task context to analyze for relevant rules'
          },
          modeSlug: {
            type: 'string',
            enum: modes,
            description: `Optional context mode to influence rule selection (${modes.join(', ')})`
          }
        },
        required: ['userPrompt'],
        additionalProperties: false
      }
    },
    {
      name: 'memory.rules.detect_context',
      description: 'Analyze text to detect architectural layer, topics, and technologies. Useful for testing context detection or advanced scenarios where you need standalone context analysis.',
      inputSchema: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: 'Text to analyze for context detection (task description, code snippet, etc.)'
          }
        },
        required: ['text'],
        additionalProperties: false
      }
    },
    {
      name: 'memory.rules.upsert_markdown',
      description: 'Ingest markdown rule documents into the knowledge graph. Supports batch processing of multiple documents with validation and error reporting.',
      inputSchema: {
        type: 'object',
        properties: {
          documents: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'File path to the markdown document (used for identification and source tracking)'
                },
                content: {
                  type: 'string',
                  description: 'Optional: Direct markdown content. If not provided, the system will attempt to read from the path'
                }
              },
              required: ['path'],
              additionalProperties: false
            },
            description: 'Array of markdown documents to process',
            minItems: 1
          }
        },
        required: ['documents'],
        additionalProperties: false
      }
    },
    {
      name: 'memory.rules.index_rules',
      description: 'Index project rules by crawling configured paths for markdown files. Recursively scans directories and imports all discovered rule documents into the knowledge graph for the current workspace. Paths are configured via INDEX_PATHS environment variable.',
      inputSchema: {
        type: 'object',
        properties: {},
        required: []
      }
    },
    {
      name: 'memory.rules.reset_index',
      description: 'Dangerous: Deletes all indexed data for the current WORKSPACE so you can perform a fresh full crawl. Removes Rule, Section, Directive nodes (workspace-scoped) and cleans up orphan Topic/Layer/Technology nodes.',
      inputSchema: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  ];
}
