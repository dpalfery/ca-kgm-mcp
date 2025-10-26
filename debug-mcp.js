#!/usr/bin/env node

/**
 * Debug script for ContextISO MCP Server
 * This script helps test the MCP server manually for debugging purposes
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 Starting ContextISO MCP Server Debug Mode (Development with TypeScript)...\n');

// Get environment variables
const neo4jUri = process.env.NEO4J_URI;
const neo4jUsername = process.env.NEO4J_USERNAME;
const neo4jPassword = process.env.NEO4J_PASSWORD;

if (!neo4jUri || !neo4jUsername || !neo4jPassword) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEO4J_URI:', neo4jUri ? '✓' : '✗');
  console.error('   NEO4J_USERNAME:', neo4jUsername ? '✓' : '✗');
  console.error('   NEO4J_PASSWORD:', neo4jPassword ? '✓' : '✗');
  process.exit(1);
}

console.log('✅ Environment variables found:');
console.log(`   NEO4J_URI: ${neo4jUri}`);
console.log(`   NEO4J_USERNAME: ${neo4jUsername}`);
console.log(`   NEO4J_PASSWORD: ${'*'.repeat(neo4jPassword.length)}\n`);

// Start the MCP server
const serverPath = path.join(__dirname, 'src', 'index.ts');
const tsxPath = path.join(__dirname, 'node_modules', '.bin', 'tsx.cmd');
console.log(`🚀 Starting MCP server in development mode: ${serverPath}\n`);

const mcpServer = spawn('cmd.exe', ['/c', tsxPath, serverPath], {
  stdio: ['inherit', 'pipe', 'pipe'],
  env: process.env,
  cwd: __dirname
});

// Handle server output
mcpServer.stdout.on('data', (data) => {
  const output = data.toString().trim();
  if (output) {
    console.log(`[MCP Server STDOUT] ${output}`);
  }
});

mcpServer.stderr.on('data', (data) => {
  const output = data.toString().trim();
  if (output) {
    console.error(`[MCP Server STDERR] ${output}`);
  }
});

// Handle spawn errors
mcpServer.on('error', (error) => {
  console.error(`[MCP Server ERROR] Failed to start server: ${error.message}`);
  console.error(`[MCP Server ERROR] Error code: ${error.code}`);
  if (error.code === 'ENOENT') {
    console.error(`[MCP Server ERROR] Make sure tsx is installed and accessible`);
  }
});

// Handle server exit
mcpServer.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ MCP server exited successfully');
  } else {
    console.error(`\n❌ MCP server exited with code ${code}`);
  }
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down MCP server...');
  mcpServer.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down MCP server...');
  mcpServer.kill('SIGTERM');
});

console.log('📝 Server is running. Press Ctrl+C to stop.\n');
console.log('💡 To test with MCP client, use the configuration in .kilocode/mcp.json');