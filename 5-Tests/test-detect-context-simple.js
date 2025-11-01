#!/usr/bin/env node

/**
 * Simple test for memory.rules.detect_context tool
 */

import { RuleManager } from '../dist/src/rules/rule-manager.js';
import { loadNeo4jConfig } from '../dist/src/config/neo4j-config.js';

async function testDetectContext() {
  console.log('🧪 Testing memory.rules.detect_context tool...\n');

  try {
    // Create rule manager
    const neo4jConfig = loadNeo4jConfig();
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
    
    const ruleManager = new RuleManager(neo4jConfig, rulesEngineConfig);
    await ruleManager.initialize();
    
    console.log('✅ Rule manager initialized');
    
    // Test detect_context tool
    console.log('\n📤 Testing memory.rules.detect_context...');
    const detectResult = await ruleManager.handleTool('memory.rules.detect_context', {
      text: 'I need to implement authentication for a React frontend application',
      options: {
        returnKeywords: true,
        confidenceThreshold: 0.1
      }
    });
    
    console.log('✅ Detect context result:', JSON.stringify(detectResult, null, 2));
    
    await ruleManager.close();
    console.log('\n🎉 Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

testDetectContext();