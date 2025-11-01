#!/usr/bin/env node

/**
 * Test script to load sample rules and test the memory.rules.detect_context tool
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testDetectContextTool() {
  console.log('🧪 Testing memory.rules.detect_context tool...\n');

  try {
    // Import the required modules
    const { RuleManager } = await import('../dist/rules/rule-manager.js');
    const { loadNeo4jConfig } = await import('../dist/config/neo4j-config.js');
    
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
    
    // Load test rule
    const testRulePath = path.join(__dirname, 'test-formatted-rule.md');
    const testRuleContent = fs.readFileSync(testRulePath, 'utf8');
    
    console.log('📤 Loading test rule...');
    const upsertResult = await ruleManager.handleTool('memory.rules.upsert_markdown', {
      documents: [
        {
          path: testRulePath,
          content: testRuleContent
        }
      ],
      options: {
        overwrite: true
      }
    });
    
    console.log('✅ Rule loaded:', JSON.stringify(upsertResult, null, 2));
    
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
    
    // Test query_directives tool
    console.log('\n📤 Testing memory.rules.query_directives...');
    const queryResult = await ruleManager.handleTool('memory.rules.query_directives', {
      taskDescription: 'I need to implement authentication for a React frontend application',
      modeSlug: 'code',
      options: {
        maxItems: 5,
        tokenBudget: 1000,
        includeBreadcrumbs: true
      }
    });
    
    console.log('✅ Query directives result:', JSON.stringify(queryResult, null, 2));
    
    await ruleManager.close();
    console.log('\n🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

testDetectContextTool();