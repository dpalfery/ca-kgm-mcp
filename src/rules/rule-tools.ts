/**
 * ContextISO Rule Tools Configuration
 * 
 * Defines the MCP tools for context optimization and rule management.
 * These tools provide context detection, rule retrieval, and rule ingestion
 * capabilities for bringing clarity to LLM context through targeted knowledge graphs.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export function setupRuleTools(): Tool[] {
  return [
    {
      name: 'memory.rules.query_directives',
      description: 'Retrieve contextually relevant rules and directives for a coding task. This is the primary interface for getting project-specific guidelines that match the task context.',
      inputSchema: {
        type: 'object',
        properties: {
          taskDescription: {
            type: 'string',
            description: 'Description of the coding task or development work being performed'
          },
          modeSlug: {
            type: 'string',
            enum: ['architect', 'code', 'debug'],
            description: 'Optional context mode to influence rule selection (architect: high-level design, code: implementation, debug: troubleshooting)'
          },
          options: {
            type: 'object',
            properties: {
              strictLayer: {
                type: 'boolean',
                description: 'If true, only return rules that exactly match the detected architectural layer',
                default: false
              },
              maxItems: {
                type: 'number',
                description: 'Maximum number of directives to return in the context block',
                default: 8,
                minimum: 1,
                maximum: 20
              },
              tokenBudget: {
                type: 'number',
                description: 'Soft limit on the number of tokens in the returned context block',
                default: 1000,
                minimum: 100
              },
              includeBreadcrumbs: {
                type: 'boolean',
                description: 'Include source file paths and section references in the output',
                default: true
              },
              severityFilter: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['MUST', 'SHOULD', 'MAY']
                },
                description: 'Filter directives by severity level (MUST = required, SHOULD = recommended, MAY = optional)'
              }
            },
            additionalProperties: false
          }
        },
        required: ['taskDescription'],
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
          },
          options: {
            type: 'object',
            properties: {
              returnKeywords: {
                type: 'boolean',
                description: 'Include extracted keywords in the response',
                default: false
              },
              confidenceThreshold: {
                type: 'number',
                description: 'Minimum confidence level for context detection (0.0 to 1.0)',
                default: 0.5,
                minimum: 0,
                maximum: 1
              }
            },
            additionalProperties: false
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
          },
          options: {
            type: 'object',
            properties: {
              overwrite: {
                type: 'boolean',
                description: 'Replace existing rules from the same source files',
                default: false
              },
              validateOnly: {
                type: 'boolean',
                description: 'Parse and validate documents without storing them (useful for testing rule syntax)',
                default: false
              }
            },
            additionalProperties: false
          }
        },
        required: ['documents'],
        additionalProperties: false
      }
    }
  ];
}