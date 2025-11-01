import { RuleManager } from '../src/rules/rule-manager.js';
import { loadNeo4jConfig } from '../src/config/neo4j-config.js';

async function testDetectContext() {
  console.log('Testing detect_context directly...');
  
  try {
    // Load config
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
    
    // Create rule manager
    const ruleManager = new RuleManager(config, rulesEngineConfig);
    await ruleManager.initialize();
    
    // Test detect_context
    const result = await ruleManager.handleTool('memory.rules.detect_context', {
      text: "I need to implement a new REST API endpoint for user authentication in a Node.js Express application",
      options: {
        returnKeywords: true,
        confidenceThreshold: 0.5
      }
    });
    
    console.log('Result:', JSON.stringify(result, null, 2));
    
    await ruleManager.close();
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testDetectContext();