// Integration Test for Knowledge Graph Retrieval
// Simulates "implement new API endpoint" task and verifies relevant rules are surfaced

import { detectTaskContext } from './task-context-detector';
import { buildRetrievalQuery, executeRetrievalQuery } from './query-builder';
import { rankRetrievalResults, filterAndLimitResults } from './ranked-retrieval';
import { formatRetrievalResponse } from './response-formatter';

async function runIntegrationTest() {
  console.log('Running knowledge graph integration test...\n');

  // Test task: "implement new API endpoint for user authentication"
  const testTask = "implement new API endpoint for user authentication";

  console.log(`Test Task: "${testTask}"\n`);

  // Step 1: Detect context
  const context = detectTaskContext(testTask);
  console.log('Detected Context:');
  console.log(`- Layer: ${context.layer}`);
  console.log(`- Topics: ${context.topics.join(', ')}`);
  console.log(`- Keywords: ${context.keywords.slice(0, 5).join(', ')}`);
  console.log(`- Confidence: ${(context.confidence * 100).toFixed(1)}%\n`);

  // Step 2: Build query
  const query = buildRetrievalQuery(testTask, context);
  console.log('Built Query:');
  console.log(`- Semantic Query: "${query.semanticQuery}"`);
  console.log(`- Filters: ${JSON.stringify(query.filters, null, 2)}`);
  console.log(`- Limit: ${query.limit}\n`);

  // Step 3: Execute retrieval (mocked for test)
  const mockResults = [
    {
      entity: 'kg:Directive|.kilocode/rules/security-general-rule.md#authentication-and-authorization|d0',
      type: 'Directive',
      content: 'Authorize every action after authentication check',
      score: 0.9,
      metadata: {
        severity: 'must',
        topics: ['security'],
        layer: '1-Presentation',
        source: '.kilocode/rules/security-general-rule.md#authentication-and-authorization',
        whenToApply: 'always',
        authoritativeFor: ['security']
      }
    },
    {
      entity: 'kg:Directive|.kilocode/rules/security-general-rule.md#input-validation-and-sanitization|d1',
      type: 'Directive',
      content: 'Validate all user inputs on both client and server',
      score: 0.85,
      metadata: {
        severity: 'must',
        topics: ['security'],
        layer: '1-Presentation',
        source: '.kilocode/rules/security-general-rule.md#input-validation-and-sanitization',
        whenToApply: 'always',
        authoritativeFor: ['security']
      }
    },
    {
      entity: 'kg:Directive|.kilocode/rules/testing-general-rule.md#unit-testing|d2',
      type: 'Directive',
      content: 'All business logic must be covered by unit tests',
      score: 0.75,
      metadata: {
        severity: 'must',
        topics: ['testing'],
        layer: '2-Application',
        source: '.kilocode/rules/testing-general-rule.md#unit-testing',
        whenToApply: 'always',
        authoritativeFor: ['testing']
      }
    },
    {
      entity: 'kg:Directive|.kilocode/rules/architecture-general.md#presentation-layer|d3',
      type: 'Directive',
      content: 'Presentation layer calls into Application only',
      score: 0.7,
      metadata: {
        severity: 'must',
        topics: ['architecture'],
        layer: '1-Presentation',
        source: '.kilocode/rules/architecture-general.md#presentation-layer',
        whenToApply: 'always',
        authoritativeFor: ['architecture']
      }
    }
  ];

  console.log('Mock Retrieval Results:');
  mockResults.forEach((result, i) => {
    console.log(`${i + 1}. ${result.content} (score: ${result.score})`);
  });
  console.log();

  // Step 4: Rank and filter results
  const rankedResults = rankRetrievalResults(mockResults, context);
  const filteredResults = filterAndLimitResults(rankedResults, 5);

  console.log('Ranked and Filtered Results:');
  filteredResults.forEach((result, i) => {
    console.log(`${i + 1}. ${result.content} (final score: ${result.score.toFixed(1)})`);
  });
  console.log();

  // Step 5: Format response
  const formattedResponse = formatRetrievalResponse(filteredResults, context);

  console.log('Formatted Response:');
  formattedResponse.forEach((directive, i) => {
    console.log(`${i + 1}. [${directive.severity.toUpperCase()}] ${directive.directive}`);
    console.log(`   Source: ${directive.source}`);
    console.log(`   Breadcrumb: ${directive.breadcrumb}`);
    console.log(`   Rationale: ${directive.rationale}\n`);
  });

  // Step 6: Verify expectations
  console.log('Test Verification:');
  const hasSecurityDirectives = formattedResponse.some(d => d.rationale.includes('security'));
  const hasArchitectureDirectives = formattedResponse.some(d => d.rationale.includes('architecture'));
  const hasTestingDirectives = formattedResponse.some(d => d.rationale.includes('testing'));
  const hasPresentationLayer = formattedResponse.some(d => d.rationale.includes('1-Presentation'));

  console.log(`✓ Security directives surfaced: ${hasSecurityDirectives}`);
  console.log(`✓ Architecture directives surfaced: ${hasArchitectureDirectives}`);
  console.log(`✓ Testing directives surfaced: ${hasTestingDirectives}`);
  console.log(`✓ Presentation layer focus: ${hasPresentationLayer}`);

  const testPassed = hasSecurityDirectives && hasArchitectureDirectives && hasTestingDirectives && hasPresentationLayer;
  console.log(`\nOverall Test Result: ${testPassed ? 'PASSED' : 'FAILED'}`);

  return testPassed;
}

// Run the test
runIntegrationTest().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Test failed with error:', error);
  process.exit(1);
});