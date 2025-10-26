#!/usr/bin/env node

/**
 * ContextISO - Context Isolation & Optimization
 * 
 * Brings context into clarity for LLMs by targeting and isolating relevant knowledge.
 * Provides memory management and rule-based context optimization through a knowledge graph.
 * 
 * Backend: Neo4j Aura cloud database
 */

import { fileURLToPath } from 'url';

// Force early output to verify script execution
console.error('[context-iso] entrypoint loaded');

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
import { loadNeo4jConfig } from './config/neo4j-config.js';

const SERVER_NAME = 'context-iso';
const SERVER_VERSION = '1.0.0';

/**
 * ContextISO Server - Brings context into clarity for LLMs
 */
class ContextISOServer {
  private server: Server;
  private memoryManager: MemoryManager;
  private ruleManager: RuleManager;

  constructor() {
    console.error('[context-iso] constructor: creating Server instance');
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

    // Load Neo4j configuration from environment
    console.error('[context-iso] constructor: loading Neo4j config');
    const config = loadNeo4jConfig();

    const debugConfig = {
      hasUri: Boolean(process.env.NEO4J_URI),
      hasUsername: Boolean(process.env.NEO4J_USERNAME || process.env.NEO4J_USER),
      hasPassword: Boolean(process.env.NEO4J_PASSWORD),
      database: config.database,
      poolSize: config.maxConnectionPoolSize,
      nodeVersion: process.version,
      cwd: process.cwd(),
    } satisfies Record<string, unknown>;

    if (process.env.CONTEXT_ISO_LOG_CONFIG === '1') {
      console.error('[context-iso] debug-config', JSON.stringify(debugConfig));
    }
    
    this.memoryManager = new MemoryManager(config);
    this.ruleManager = new RuleManager(config);
  }

  async initialize(): Promise<void> {
    console.error('[context-iso] initialize: starting');
    // Initialize memory manager (context storage and retrieval)
    console.error('[context-iso] initialize: memory manager');
    await this.memoryManager.initialize();
    
    // Initialize rule manager (new rule-specific functionality)
    console.error('[context-iso] initialize: rule manager');
    await this.ruleManager.initialize();

    // Set up tool handlers
    console.error('[context-iso] initialize: setting up tool handlers');
    this.setupToolHandlers();
    console.error('[context-iso] initialize: complete');
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
    // Delegate to memory manager for context operations
    return await this.memoryManager.handleTool(name, args);
  }

  private async handleRuleTool(name: string, args: any): Promise<any> {
    // Delegate to rule manager for new rule-specific functionality
    return await this.ruleManager.handleTool(name, args);
  }

  async start(): Promise<void> {
    console.error('Creating stdio transport...');
    const transport = new StdioServerTransport();
    console.error('Connecting server to transport...');
    await this.server.connect(transport);
    
    console.error(`${SERVER_NAME} v${SERVER_VERSION} started`);
    console.error('Server capabilities: ContextISO - Context Isolation & Optimization');
    console.error('Server is now listening for MCP requests...');
  }
}

// Start the server
async function main(): Promise<void> {
  console.error('[context-iso] main: creating server instance');
  const server = new ContextISOServer();
  
  try {
    console.error('[context-iso] main: initializing');
    await server.initialize();
    console.error('[context-iso] main: starting');
    await server.start();
  } catch (error) {
    console.error('[context-iso] FATAL:', error);
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

// Run if this is the entry point (handle Windows path differences)
const isMainModule = () => {
  try {
    const modulePath = fileURLToPath(import.meta.url);
    const scriptPath = process.argv[1];
    return modulePath === scriptPath || modulePath.replace(/\\/g, '/') === scriptPath.replace(/\\/g, '/');
  } catch {
    return false;
  }
};

if (isMainModule()) {
  console.error('[context-iso] entry condition matched, calling main()');
  main().catch((error) => {
    console.error('[context-iso] Unhandled error:', error);
    process.exit(1);
  });
} else {
  console.error('[context-iso] module imported but not executed as main');
}

export { ContextISOServer };