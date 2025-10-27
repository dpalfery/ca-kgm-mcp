#!/usr/bin/env node

/**
 * Test script to directly test the MCP server connection and rule query
 */

const { spawn } = require('child_process');
const { createInterface } = require('readline');
const path = require('path');

console.log('🧪 Testing MCP Server Connection...\n');

// Start the MCP server process
// Find tsx in node_modules
const tsxPath = path.join(process.cwd(), 'node_modules', '.bin', 'tsx.cmd');
const mcpServer = spawn('cmd.exe', ['/c', tsxPath, 'src/index.ts'], {
  stdio: ['pipe', 'pipe', 'inherit'],
  env: process.env,
  cwd: process.cwd()
});

const rl = createInterface({
  input: mcpServer.stdout,
  output: mcpServer.stdin,
  terminal: false
});

let responseBuffer = '';
let requestId = 1;

// Send initialization request
const initRequest = {
  jsonrpc: '2.0',
  id: requestId++,
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

// Handle responses
rl.on('line', (line) => {
  try {
    const response = JSON.parse(line);
    console.log('📥 Received:', JSON.stringify(response, null, 2));
    
    if (response.id === 1) {
      // After init, list tools
      console.log('\n📤 Sending listTools request...');
      const listToolsRequest = {
        jsonrpc: '2.0',
        id: requestId++,
        method: 'tools/list',
        params: {}
      };
      mcpServer.stdin.write(JSON.stringify(listToolsRequest) + '\n');
    } else if (response.id === 2 && response.result && response.result.tools) {
      // After listing tools, try to call query_directives
      const hasRuleTool = response.result.tools.some(tool => tool.name === 'memory.rules.query_directives');
      
      if (hasRuleTool) {
        console.log('\n📤 Sending query_directives request...');
        const queryRequest = {
          jsonrpc: '2.0',
          id: requestId++,
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
      } else {
        console.log('\n❌ memory.rules.query_directives tool not found in available tools');
        mcpServer.kill();
      }
    } else if (response.id === 3) {
      // Got query response, exit
      console.log('\n✅ Test completed');
      mcpServer.kill();
    }
  } catch (error) {
    console.error('❌ Failed to parse response:', error);
    console.error('Raw response:', line);
  }
});

// Handle errors
mcpServer.on('error', (error) => {
  console.error('❌ MCP Server error:', error);
});

mcpServer.on('close', (code) => {
  console.log(`\n🏁 MCP Server exited with code ${code}`);
  process.exit(code);
});

// Timeout after 30 seconds
setTimeout(() => {
  console.log('\n⏰ Test timed out after 30 seconds');
  mcpServer.kill();
  process.exit(1);
}, 30000);