import { spawn } from 'child_process';

async function testMCPProtocol() {
  console.log('Testing MCP protocol directly...');
  
  // Start the MCP server
  const server = spawn('npx', ['tsx', '1-Presentation/src/index.ts'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  let responseData = '';
  
  server.stdout.on('data', (data) => {
    responseData += data.toString();
    console.log('Server response:', data.toString());
  });
  
  server.stderr.on('data', (data) => {
    console.log('Server stderr:', data.toString());
  });
  
  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Send MCP request to detect context
  const request = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "memory.rules.detect_context",
      arguments: {
        text: "I need to implement a new REST API endpoint for user authentication in a Node.js Express application",
        options: {
          returnKeywords: true,
          confidenceThreshold: 0.5
        }
      }
    }
  };
  
  console.log('Sending request:', JSON.stringify(request));
  server.stdin.write(JSON.stringify(request) + '\n');
  
  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  console.log('Full response data:', responseData);
  
  // Clean up
  server.kill();
}

testMCPProtocol().catch(console.error);