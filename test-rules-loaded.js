import { RuleManager } from './src/rules/rule-manager.js';
import { loadNeo4jConfig } from './src/config/neo4j-config.js';

async function testRulesLoaded() {
  console.log('Testing if rules are loaded...');
  
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
    
    // Try to query directives to see if any rules are loaded
    try {
      const result = await ruleManager.handleTool('memory.rules.query_directives', {
        taskDescription: "Test task to check if rules exist"
      });
      
      console.log('Query result:', JSON.stringify(result, null, 2));
    } catch (error) {
      console.log('Query error (expected if no rules loaded):', error.message);
    }
    
    await ruleManager.close();
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testRulesLoaded();