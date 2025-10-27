#!/usr/bin/env node

/**
 * Simple MCP test using the SDK directly
 */

import { spawn } from 'child_process';
import { createInterface } from 'readline';
import path from 'path';

console.log('🧪 Simple MCP Test...\n');

// Start the MCP server process
const tsxPath = path.join(process.cwd(), 'node_modules', '.bin', 'tsx.cmd');
const mcpServer = spawn('cmd.exe', ['/c', tsxPath, 'src/index.ts'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: process.env,
  cwd: process.cwd()
});

let responseBuffer = '';

// Collect all output
mcpServer.stdout.on('data', (data) => {
  responseBuffer += data.toString();
  console.log('STDOUT:', data.toString());
});

mcpServer.stderr.on('data', (data) => {
  console.error('STDERR:', data.toString());
});

// Send initialization request
const initRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: {
      name: 'test-client',
      version: '1.0.0'
    }
  }
};

console.log('📤 Sending initialize request...');
mcpServer.stdin.write(JSON.stringify(initRequest) + '\n');

// Wait a bit then send list tools
setTimeout(() => {
  console.log('\n📤 Sending listTools request...');
  const listToolsRequest = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {}
  };
  mcpServer.stdin.write(JSON.stringify(listToolsRequest) + '\n');
}, 2000);

// Wait a bit more then send query
setTimeout(() => {
  console.log('\n📤 Sending query_directives request...');
  const queryRequest = {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'memory.rules.query_directives',
      arguments: {
        taskDescription: 'Test task for getting top rules',
        modeSlug: 'code',
        options: {
          maxItems: 20,
          tokenBudget: 1000,
          includeBreadcrumbs: true,
          severityFilter: ['MUST', 'SHOULD', 'MAY']
        }
      }
    }
  };
  mcpServer.stdin.write(JSON.stringify(queryRequest) + '\n');
}, 4000);

// Handle errors
mcpServer.on('error', (error) => {
  console.error('❌ MCP Server error:', error);
});

mcpServer.on('close', (code) => {
  console.log(`\n🏁 MCP Server exited with code ${code}`);
  process.exit(code);
});

// Timeout after 10 seconds
setTimeout(() => {
  console.log('\n⏰ Test timed out after 10 seconds');
  mcpServer.kill();
  process.exit(1);
}, 10000);