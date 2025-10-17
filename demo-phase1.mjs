/**
 * Demonstration script for Phase 1 implementation
 */

import { readFileSync } from 'fs';
import { MarkdownParser } from './dist/parsing/markdown-parser.js';
import { DirectiveExtractor } from './dist/parsing/directive-extractor.js';
import { GraphBuilder } from './dist/parsing/graph-builder.js';

// Read example rule document
const examplePath = '/tmp/example-rules/security-guidelines.md';
const content = readFileSync(examplePath, 'utf-8');

console.log('='.repeat(80));
console.log('PHASE 1 DEMONSTRATION: Rule Document Ingestion');
console.log('='.repeat(80));
console.log();

// Step 1: Parse markdown
console.log('Step 1: Parsing markdown document...');
const parser = new MarkdownParser();
const parsed = parser.parse(content);

console.log(`✓ Document metadata:`);
console.log(`  - Title: ${parsed.metadata.title}`);
console.log(`  - Layer: ${parsed.metadata.layer}`);
console.log(`  - Authoritative for: ${parsed.metadata.authoritativeFor?.join(', ')}`);
console.log(`  - Topics: ${parsed.metadata.topics?.join(', ')}`);
console.log(`✓ Found ${parsed.sections.length} top-level section(s)`);
console.log();

// Step 2: Extract directives
console.log('Step 2: Extracting directives...');
const extractor = new DirectiveExtractor();
const { directives, metadata } = extractor.extractFromSections(
  parsed.sections,
  parsed.metadata
);

console.log(`✓ Extracted ${metadata.totalDirectives} directive(s):`);
console.log(`  - MUST: ${metadata.mustCount}`);
console.log(`  - SHOULD: ${metadata.shouldCount}`);
console.log(`  - MAY: ${metadata.mayCount}`);
console.log();

// Show some extracted directives
console.log('Sample directives:');
directives.slice(0, 3).forEach((dir, idx) => {
  console.log(`  ${idx + 1}. [${dir.severity}] ${dir.content.substring(0, 60)}...`);
  console.log(`     Topics: ${dir.topics.join(', ') || 'none'}`);
  console.log(`     Layers: ${dir.layers.join(', ') || 'none'}`);
  console.log(`     Technologies: ${dir.technologies.join(', ') || 'none'}`);
});
console.log();

// Step 3: Build graph structure
console.log('Step 3: Building graph structure...');
const builder = new GraphBuilder();
const graph = builder.buildGraph(parsed, directives, examplePath);

console.log(`✓ Graph structure created:`);
console.log(`  - Rules: ${graph.stats.rulesCreated}`);
console.log(`  - Sections: ${graph.stats.sectionsCreated}`);
console.log(`  - Directives: ${graph.stats.directivesCreated}`);
console.log(`  - Relationships: ${graph.stats.relationshipsCreated}`);
console.log();

// Show node breakdown
const nodesByType = graph.structure.nodes.reduce((acc, node) => {
  acc[node.type] = (acc[node.type] || 0) + 1;
  return acc;
}, {});

console.log('Node breakdown:');
Object.entries(nodesByType).forEach(([type, count]) => {
  console.log(`  - ${type}: ${count}`);
});
console.log();

// Step 4: Validate graph
console.log('Step 4: Validating graph structure...');
const validation = builder.validateGraph(graph.structure);

if (validation.valid) {
  console.log('✓ Graph structure is valid!');
} else {
  console.log('✗ Graph validation failed:');
  validation.errors.forEach(err => console.log(`  - ${err}`));
}
console.log();

// Show relationship breakdown
const relsByType = graph.structure.relationships.reduce((acc, rel) => {
  acc[rel.type] = (acc[rel.type] || 0) + 1;
  return acc;
}, {});

console.log('Relationship breakdown:');
Object.entries(relsByType).forEach(([type, count]) => {
  console.log(`  - ${type}: ${count}`);
});
console.log();

console.log('='.repeat(80));
console.log('✓ Phase 1 implementation is ready for use!');
console.log('✓ Next: Phase 2 - Context Detection Engine');
console.log('='.repeat(80));
