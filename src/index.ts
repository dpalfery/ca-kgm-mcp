#!/usr/bin/env node

/**
 * Knowledge Graph Memory MCP Server
 * 
 * Extended Memory MCP server with knowledge graph-based rule management capabilities.
 * Provides both original Memory MCP functionality and new rule-specific tools.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

import { MemoryManager } from './memory/memory-manager.js';
import { RuleManager } from './rules/rule-manager.js';
import { setupMemoryTools } from './memory/memory-tools.js';
import { setupRuleTools } from './rules/rule-tools.js';

const SERVER_NAME = 'knowledge-graph-memory-mcp';
const SERVER_VERSION = '1.0.0';

/**
 * Main server class that extends Memory MCP with rule management capabilities
 */
class KnowledgeGraphMemoryServer {
  private server: Server;
  private memoryManager: MemoryManager;
  private ruleManager: RuleManager;

  constructor() {
    this.server = new Server(
      {
        name: SERVER_NAME,
        version: SERVER_VERSION,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.memoryManager = new MemoryManager();
    this.ruleManager = new RuleManager();
  }

  async initialize(): Promise<void> {
    // Initialize memory manager (original Memory MCP functionality)
    await this.memoryManager.initialize();
    
    // Initialize rule manager (new rule-specific functionality)
    await this.ruleManager.initialize();

    // Set up tool handlers
    this.setupToolHandlers();
  }

  private setupToolHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const memoryTools = setupMemoryTools();
      const ruleTools = setupRuleTools();
      
      return {
        tools: [
          ...memoryTools,
          ...ruleTools
        ]
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        // Route to appropriate handler based on tool name
        if (name.startsWith('memory.rules.')) {
          return await this.handleRuleTool(name, args);
        } else if (name.startsWith('memory.')) {
          return await this.handleMemoryTool(name, args);
        } else {
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${name}`
          );
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  private async handleMemoryTool(name: string, args: any): Promise<any> {
    // Delegate to memory manager for original Memory MCP functionality
    return await this.memoryManager.handleTool(name, args);
  }

  private async handleRuleTool(name: string, args: any): Promise<any> {
    // Delegate to rule manager for new rule-specific functionality
    return await this.ruleManager.handleTool(name, args);
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    console.error(`${SERVER_NAME} v${SERVER_VERSION} started`);
    console.error('Server capabilities: Memory MCP + Rule Management');
  }
}

// Start the server
async function main(): Promise<void> {
  const server = new KnowledgeGraphMemoryServer();
  
  try {
    await server.initialize();
    await server.start();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.error('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { KnowledgeGraphMemoryServer };