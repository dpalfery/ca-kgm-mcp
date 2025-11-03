#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const server = new Server(
  { name: 'test-server', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'test_tool',
      description: 'A simple test tool',
      inputSchema: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'Test message' }
        },
        required: ['message']
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  console.error(`Test server: received ${name} with args:`, args);
  
  return {
    content: [
      {
        type: 'text',
        text: `Test response: ${JSON.stringify(args)}`
      }
    ]
  };
});

async function main() {
  console.error('Test server starting...');
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Test server ready');
}

main().catch(console.error);