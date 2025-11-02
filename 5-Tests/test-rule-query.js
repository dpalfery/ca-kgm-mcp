#!/usr/bin/env node

/**
 * Test script to validate memory.rules.query_directives functionality
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

console.log('🧪 Testing memory.rules.query_directives functionality...\n');

// Read the test rule file with proper directive formatting
const securityRulePath = '5-Tests/test-formatted-rule.md';
const securityRuleContent = fs.readFileSync(securityRulePath, 'utf-8');

// Start the MCP server process
const tsxPath = path.join(process.cwd(), 'node_modules', '.bin', 'tsx.cmd');
const mcpServer = spawn('cmd.exe', ['/c', tsxPath, '1-Presentation/src/index.ts'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: process.env,
  cwd: process.cwd()
});

let requestId = 1;
let serverInitialized = false;
let rulesLoaded = false;

// Collect server output
mcpServer.stdout.on('data', (data) => {
  const output = data.toString();
  console.log('📥 Server Response:', output);
  
  try {
    // Try to parse each line as JSON
    const lines = output.split('\n').filter(line => line.trim());
    for (const line of lines) {
      if (line.startsWith('{')) {
        const response = JSON.parse(line);
        handleResponse(response);
      }
    }
  } catch (error) {
    // Not JSON, probably server logs
  }
});

mcpServer.stderr.on('data', (data) => {
  const output = data.toString();
  console.log('📋 Server Log:', output);
  
  // Check if server is ready
  if (output.includes('Server is now listening for MCP requests')) {
    console.log('✅ Server is ready, sending initialize request...');
    sendInitialize();
  }
});

function handleResponse(response) {
  console.log('📥 Parsed Response:', JSON.stringify(response, null, 2));
  
  if (response.id === 1 && response.result) {
    // Initialize successful, load rules
    console.log('✅ Server initialized, loading security rules...');
    serverInitialized = true;
    loadSecurityRules();
  } else if (response.id === 2 && response.result) {
    // Rules loaded successfully
    console.log('✅ Security rules loaded successfully');
    rulesLoaded = true;
    queryDirectives();
  } else if (response.id === 3 && response.result) {
    // Query response received
    console.log('✅ Query directives response received');
    console.log('📊 Query Results:');
    
    if (response.result.context_block) {
      console.log('Context Block:', response.result.context_block);
    }
    
    if (response.result.diagnostics) {
      console.log('Diagnostics:', JSON.stringify(response.result.diagnostics, null, 2));
    }
    
    if (response.result.citations) {
      console.log('Citations:', response.result.citations);
    }
    
    // Test completed successfully
    console.log('\n🎉 Test completed successfully!');
    console.log('✅ memory.rules.query_directives is working correctly');
    mcpServer.kill();
    process.exit(0);
  } else if (response.error) {
    console.error('❌ Error response:', response.error);
    mcpServer.kill();
    process.exit(1);
  }
}

function sendInitialize() {
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
}

function loadSecurityRules() {
  const upsertRequest = {
    jsonrpc: '2.0',
    id: requestId++,
    method: 'tools/call',
    params: {
      name: 'memory.rules.upsert_markdown',
      arguments: {
        documents: [
          {
            path: securityRulePath,
            content: securityRuleContent
          }
        ],
        options: {
          overwrite: true,
          validateOnly: false
        }
      }
    }
  };
  
  console.log('📤 Sending upsert_markdown request...');
  mcpServer.stdin.write(JSON.stringify(upsertRequest) + '\n');
}

function queryDirectives() {
  const queryRequest = {
    jsonrpc: '2.0',
    id: requestId++,
    method: 'tools/call',
    params: {
      name: 'memory.rules.query_directives',
      arguments: {
        taskDescription: 'implement secure API endpoint with authentication and input validation',
        modeSlug: 'code',
        options: {
          maxItems: 10,
          tokenBudget: 2000,
          includeBreadcrumbs: true,
          severityFilter: ['MUST', 'SHOULD', 'MAY']
        }
      }
    }
  };
  
  console.log('📤 Sending query_directives request...');
  mcpServer.stdin.write(JSON.stringify(queryRequest) + '\n');
}

// Handle errors
mcpServer.on('error', (error) => {
  console.error('❌ MCP Server error:', error);
  process.exit(1);
});

mcpServer.on('close', (code) => {
  console.log(`\n🏁 MCP Server exited with code ${code}`);
  if (code !== 0 && !rulesLoaded) {
    console.error('❌ Test failed - server exited unexpectedly');
    process.exit(1);
  }
});

// Timeout after 60 seconds
setTimeout(() => {
  console.log('\n⏰ Test timed out after 60 seconds');
  mcpServer.kill();
  process.exit(1);
}, 60000);