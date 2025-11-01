import { RuleManager } from '../src/rules/rule-manager.js';
import { loadNeo4jConfig } from '../src/config/neo4j-config.js';

async function testDetectContextVariations() {
  console.log('Testing detect_context with different inputs...');
  
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
    
    const testCases = [
      {
        name: "Frontend React Component",
        text: "Create a React component with TypeScript for displaying user profiles with responsive CSS styling",
        options: { returnKeywords: true, confidenceThreshold: 0.3 }
      },
      {
        name: "Database Query",
        text: "Write a PostgreSQL query to join user tables and create an index for performance optimization",
        options: { returnKeywords: false, confidenceThreshold: 0.7 }
      },
      {
        name: "DevOps Deployment",
        text: "Set up Docker containers with Kubernetes orchestration for AWS cloud deployment using Terraform",
        options: { returnKeywords: true, confidenceThreshold: 0.1 }
      },
      {
        name: "Domain Model",
        text: "Define business entities and value objects for an e-commerce domain with validation rules",
        options: { returnKeywords: true, confidenceThreshold: 0.5 }
      },
      {
        name: "Minimal Text",
        text: "fix bug",
        options: { returnKeywords: true, confidenceThreshold: 0.0 }
      }
    ];
    
    for (const testCase of testCases) {
      console.log(`\n=== ${testCase.name} ===`);
      console.log(`Input: "${testCase.text}"`);
      console.log(`Options:`, testCase.options);
      
      const result = await ruleManager.handleTool('memory.rules.detect_context', {
        text: testCase.text,
        options: testCase.options
      });
      
      console.log('Result:');
      console.log(`  Layer: ${result.detectedLayer} (confidence: ${result.confidence.toFixed(3)})`);
      console.log(`  Technologies: [${result.technologies.join(', ')}]`);
      console.log(`  Topics: [${result.topics.join(', ')}]`);
      console.log(`  Indicators: [${result.indicators.join(', ')}]`);
      if (result.keywords) {
        console.log(`  Keywords: [${result.keywords.join(', ')}]`);
      }
      console.log(`  Alternatives: ${result.alternativeContexts.length} found`);
    }
    
    await ruleManager.close();
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testDetectContextVariations();