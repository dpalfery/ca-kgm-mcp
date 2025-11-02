import { RuleManager } from './src/rules/rule-manager.js';
import { loadNeo4jConfig } from './src/config/neo4j-config.js';

async function debugMCPHandler() {
  console.log('Testing MCP handler response format...');
  
  try {
    const config = loadNeo4jConfig();
    const rulesEngineConfig = {
      llm: {
        provider: 'local',
        endpoint: 'http://localhost:11434',
        model: 'deepseek-coder-v2'
      },
      processing: {
        enableSplitting: false,
        minWordCountForSplit: 250,
        enableDirectiveGeneration: false,
        minWordCountForGeneration: 100
      }
    };
    
    const ruleManager = new RuleManager(config, rulesEngineConfig);
    await ruleManager.initialize();
    
    // Test what the handler returns
    const result = await ruleManager.handleTool('memory.rules.detect_context', {
      text: "Test input",
      options: { returnKeywords: true }
    });
    
    console.log('Raw handler result:');
    console.log('Type:', typeof result);
    console.log('Is array:', Array.isArray(result));
    console.log('Keys:', Object.keys(result));
    console.log('JSON:', JSON.stringify(result, null, 2));
    
    // Check what MCP expects - should be wrapped in content array
    const mcpResponse = {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
    
    console.log('\nProper MCP response format:');
    console.log(JSON.stringify(mcpResponse, null, 2));
    
    await ruleManager.close();
    
  } catch (error) {
    console.error('Error:', error);
  }
}

debugMCPHandler();