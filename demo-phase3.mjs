/**
 * Demo script for Phase 3: Intelligent Rule Ranking
 * 
 * This demonstrates the scoring, ranking, and token budget management
 * capabilities implemented in Phase 3.
 */

import { ScoringEngine } from './dist/ranking/scoring-engine.js';
import { TokenCounter } from './dist/ranking/token-counter.js';
import { RankingEngine } from './dist/ranking/ranking-engine.js';

console.log('='.repeat(80));
console.log('Phase 3 Demo: Intelligent Rule Ranking');
console.log('='.repeat(80));
console.log();

// Sample directives for demonstration
const sampleDirectives = [
  {
    id: '1',
    text: 'All API endpoints must require authentication using JWT tokens',
    severity: 'MUST',
    topics: ['security', 'api'],
    layers: ['5-Integration'],
    technologies: ['JWT', 'REST'],
    authoritative: true,
    section: 'Security Guidelines → Authentication'
  },
  {
    id: '2',
    text: 'Implement rate limiting to prevent API abuse',
    severity: 'SHOULD',
    topics: ['security', 'performance', 'api'],
    layers: ['5-Integration'],
    technologies: ['REST'],
    section: 'Security Guidelines → Rate Limiting'
  },
  {
    id: '3',
    text: 'Use HTTPS for all connections',
    severity: 'MUST',
    topics: ['security'],
    layers: ['*'],
    technologies: ['HTTPS'],
    authoritative: true,
    section: 'Security Guidelines → Transport'
  },
  {
    id: '4',
    text: 'Add comprehensive unit tests for all endpoints',
    severity: 'MUST',
    topics: ['testing', 'api'],
    layers: ['6-Tests'],
    technologies: ['Jest', 'Vitest'],
    section: 'Testing Guidelines → Unit Tests'
  },
  {
    id: '5',
    text: 'Document API endpoints using OpenAPI/Swagger',
    severity: 'MAY',
    topics: ['documentation', 'api'],
    layers: ['5-Integration'],
    technologies: ['OpenAPI', 'Swagger'],
    section: 'Documentation Guidelines → API Docs'
  },
  {
    id: '6',
    text: 'Implement caching for frequently accessed data',
    severity: 'SHOULD',
    topics: ['performance', 'database'],
    layers: ['4-Persistence'],
    technologies: ['Redis'],
    section: 'Performance Guidelines → Caching'
  },
  {
    id: '7',
    text: 'Log all authentication attempts',
    severity: 'SHOULD',
    topics: ['security', 'logging'],
    layers: ['7-Infrastructure'],
    technologies: [],
    section: 'Logging Guidelines → Security Events'
  },
  {
    id: '8',
    text: 'Validate all input data',
    severity: 'MUST',
    topics: ['security', 'validation'],
    layers: ['2-Application'],
    technologies: ['Zod'],
    section: 'Security Guidelines → Input Validation'
  }
];

// Demo 1: Basic Scoring
console.log('Demo 1: Basic Scoring with Different Contexts');
console.log('-'.repeat(80));
console.log();

const scoringEngine = new ScoringEngine();

// Context 1: Security-focused task
const securityContext = {
  detectedLayer: '5-Integration',
  topics: ['security', 'api'],
  technologies: ['JWT'],
  keywords: ['authentication', 'secure']
};

console.log('Context: Building a secure API endpoint');
console.log(`  Layer: ${securityContext.detectedLayer}`);
console.log(`  Topics: ${securityContext.topics.join(', ')}`);
console.log(`  Technologies: ${securityContext.technologies.join(', ')}`);
console.log();

const scored1 = scoringEngine.scoreDirectives(sampleDirectives, securityContext);
console.log('Top 3 Ranked Directives:');
scored1.slice(0, 3).forEach((d, i) => {
  console.log(`${i + 1}. [${d.severity}] ${d.text.substring(0, 60)}...`);
  console.log(`   Score: ${(d.score * 100).toFixed(1)}%`);
  console.log(`   Breakdown: Severity=${d.scoreBreakdown.severity}, Relevance=${d.scoreBreakdown.relevance}, Layer=${d.scoreBreakdown.layerMatch}, Topic=${d.scoreBreakdown.topicMatch}`);
  console.log();
});

// Context 2: Testing-focused task
const testingContext = {
  detectedLayer: '6-Tests',
  topics: ['testing', 'api'],
  technologies: ['Vitest'],
  keywords: ['test', 'coverage']
};

console.log('Context: Writing unit tests for API');
console.log(`  Layer: ${testingContext.detectedLayer}`);
console.log(`  Topics: ${testingContext.topics.join(', ')}`);
console.log(`  Technologies: ${testingContext.technologies.join(', ')}`);
console.log();

const scored2 = scoringEngine.scoreDirectives(sampleDirectives, testingContext);
console.log('Top 3 Ranked Directives:');
scored2.slice(0, 3).forEach((d, i) => {
  console.log(`${i + 1}. [${d.severity}] ${d.text.substring(0, 60)}...`);
  console.log(`   Score: ${(d.score * 100).toFixed(1)}%`);
  console.log();
});

// Demo 2: Mode-Based Adjustments
console.log();
console.log('Demo 2: Mode-Based Score Adjustments');
console.log('-'.repeat(80));
console.log();

const mixedContext = {
  detectedLayer: '2-Application',
  topics: ['security', 'testing', 'performance'],
  technologies: [],
  keywords: []
};

const baseScored = scoringEngine.scoreDirectives(sampleDirectives, mixedContext);

console.log('Architect Mode (boosts architecture, design):');
const architectScored = scoringEngine.applyModeAdjustments(baseScored, 'architect');
architectScored.slice(0, 3).forEach((d, i) => {
  console.log(`${i + 1}. [${d.severity}] ${d.text.substring(0, 60)}... (${(d.score * 100).toFixed(1)}%)`);
});
console.log();

console.log('Code Mode (boosts testing, coding standards):');
const codeScored = scoringEngine.applyModeAdjustments(baseScored, 'code');
codeScored.slice(0, 3).forEach((d, i) => {
  console.log(`${i + 1}. [${d.severity}] ${d.text.substring(0, 60)}... (${(d.score * 100).toFixed(1)}%)`);
});
console.log();

console.log('Debug Mode (boosts error-handling, logging):');
const debugScored = scoringEngine.applyModeAdjustments(baseScored, 'debug');
debugScored.slice(0, 3).forEach((d, i) => {
  console.log(`${i + 1}. [${d.severity}] ${d.text.substring(0, 60)}... (${(d.score * 100).toFixed(1)}%)`);
});
console.log();

// Demo 3: Token Budget Management
console.log();
console.log('Demo 3: Token Budget Management');
console.log('-'.repeat(80));
console.log();

const tokenCounter = new TokenCounter();

// Calculate token estimates
const directiveTexts = sampleDirectives.map(d => d.text);
const stats = tokenCounter.getTokenStats(directiveTexts);

console.log('Token Statistics for Sample Directives:');
console.log(`  Total: ${stats.total} tokens`);
console.log(`  Average: ${stats.average.toFixed(1)} tokens per directive`);
console.log(`  Min: ${stats.min} tokens`);
console.log(`  Max: ${stats.max} tokens`);
console.log(`  Median: ${stats.median} tokens`);
console.log();

// Apply budget constraints
const budget300 = tokenCounter.allocateBudgetBySeverity(
  sampleDirectives.map(d => ({ text: d.text, severity: d.severity })),
  300
);

console.log(`Budget Allocation (300 tokens):`);
console.log(`  Items Considered: ${budget300.itemsConsidered}`);
console.log(`  Items Included: ${budget300.itemsIncluded}`);
console.log(`  Total Tokens: ${budget300.totalTokens}`);
console.log(`  Budget Remaining: ${budget300.budgetRemaining}`);
console.log();

const budget600 = tokenCounter.allocateBudgetBySeverity(
  sampleDirectives.map(d => ({ text: d.text, severity: d.severity })),
  600
);

console.log(`Budget Allocation (600 tokens):`);
console.log(`  Items Considered: ${budget600.itemsConsidered}`);
console.log(`  Items Included: ${budget600.itemsIncluded}`);
console.log(`  Total Tokens: ${budget600.totalTokens}`);
console.log(`  Budget Remaining: ${budget600.budgetRemaining}`);
console.log();

// Demo 4: Severity Prioritization
console.log();
console.log('Demo 4: Severity Prioritization');
console.log('-'.repeat(80));
console.log();

const rankingEngine = new RankingEngine();
const grouped = rankingEngine.groupBySeverity(scored1);

console.log(`MUST Directives: ${grouped.MUST.length}`);
grouped.MUST.forEach(d => {
  console.log(`  - ${d.text.substring(0, 60)}... (${(d.score * 100).toFixed(1)}%)`);
});
console.log();

console.log(`SHOULD Directives: ${grouped.SHOULD.length}`);
grouped.SHOULD.forEach(d => {
  console.log(`  - ${d.text.substring(0, 60)}... (${(d.score * 100).toFixed(1)}%)`);
});
console.log();

console.log(`MAY Directives: ${grouped.MAY.length}`);
grouped.MAY.forEach(d => {
  console.log(`  - ${d.text.substring(0, 60)}... (${(d.score * 100).toFixed(1)}%)`);
});
console.log();

// Demo 5: Complete Context Block Example
console.log();
console.log('Demo 5: Sample Context Block Output');
console.log('-'.repeat(80));
console.log();

const topDirectives = scored1.slice(0, 5);
const groupedTop = rankingEngine.groupBySeverity(topDirectives);

console.log('# Contextual Rules\n');
console.log('**Detected Context:**');
console.log(`- Layer: ${securityContext.detectedLayer}`);
console.log(`- Topics: ${securityContext.topics.join(', ')}`);
console.log(`- Keywords: ${securityContext.keywords?.join(', ')}\n`);

if (groupedTop.MUST.length > 0) {
  console.log('## Critical (MUST) Directives\n');
  groupedTop.MUST.forEach(d => {
    console.log(`### ${d.section || 'General'}`);
    console.log(`- **[MUST]** ${d.text}`);
    console.log(`  *Applies to: ${d.topics.join(', ')}*`);
    console.log(`  *Source: ${d.section}*`);
    console.log(`  *Score: ${(d.score * 100).toFixed(1)}%*\n`);
  });
}

if (groupedTop.SHOULD.length > 0) {
  console.log('## Recommended (SHOULD) Directives\n');
  groupedTop.SHOULD.forEach(d => {
    console.log(`### ${d.section || 'General'}`);
    console.log(`- **[SHOULD]** ${d.text}`);
    console.log(`  *Applies to: ${d.topics.join(', ')}*`);
    console.log(`  *Source: ${d.section}*`);
    console.log(`  *Score: ${(d.score * 100).toFixed(1)}%*\n`);
  });
}

if (groupedTop.MAY.length > 0) {
  console.log('## Optional (MAY) Directives\n');
  groupedTop.MAY.forEach(d => {
    console.log(`### ${d.section || 'General'}`);
    console.log(`- **[MAY]** ${d.text}`);
    console.log(`  *Applies to: ${d.topics.join(', ')}*`);
    console.log(`  *Source: ${d.section}*`);
    console.log(`  *Score: ${(d.score * 100).toFixed(1)}%*\n`);
  });
}

console.log('---');
console.log(`**Retrieved:** ${topDirectives.length} directive(s)`);
console.log();

console.log('='.repeat(80));
console.log('Demo Complete!');
console.log('='.repeat(80));
