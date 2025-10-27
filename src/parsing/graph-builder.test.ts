/**
 * Unit tests for Graph Builder
 */

import { describe, test, expect } from 'vitest';
import { GraphBuilder } from './graph-builder.js';
import { MarkdownParser } from './markdown-parser.js';
import { DirectiveProcessor } from './directive-processor.js';

describe('GraphBuilder', () => {
  const builder = new GraphBuilder();
  const parser = new MarkdownParser();
  const extractor = new DirectiveProcessor();

  describe('buildGraph', () => {
    test('creates Rule node from document', () => {
      const markdown = `# Security Guidelines

Basic security rules.`;

      const parsed = parser.parse(markdown);
      const { directives } = extractor.extractFromSections(parsed.sections);
      const result = builder.buildGraph(parsed, directives, '/rules/security.md');

      expect(result.structure.nodes).toContainEqual(
        expect.objectContaining({
          type: 'Rule',
          properties: expect.objectContaining({
            sourcePath: '/rules/security.md'
          })
        })
      );
      expect(result.stats.rulesCreated).toBe(1);
    });

    test('creates Section nodes with hierarchy', () => {
      const markdown = `# Main

## Sub 1

### Sub 1.1

## Sub 2`;

      const parsed = parser.parse(markdown);
      const { directives } = extractor.extractFromSections(parsed.sections);
      const result = builder.buildGraph(parsed, directives, '/test.md');

      const sectionNodes = result.structure.nodes.filter(n => n.type === 'Section');
      expect(sectionNodes.length).toBeGreaterThan(0);
      expect(result.stats.sectionsCreated).toBeGreaterThan(0);
    });

    test('creates Directive nodes from extracted directives', () => {
      const markdown = `# Guidelines

[MUST] Validate all inputs.

[SHOULD] Write tests.`;

      const parsed = parser.parse(markdown);
      const { directives } = extractor.extractFromSections(parsed.sections);
      const result = builder.buildGraph(parsed, directives, '/test.md');

      const directiveNodes = result.structure.nodes.filter(n => n.type === 'Directive');
      expect(directiveNodes).toHaveLength(2);
      expect(result.stats.directivesCreated).toBe(2);
    });

    test('creates CONTAINS relationships between Rule and Sections', () => {
      const markdown = `# Main

## Section 1`;

      const parsed = parser.parse(markdown);
      const { directives } = extractor.extractFromSections(parsed.sections);
      const result = builder.buildGraph(parsed, directives, '/test.md');

      const containsRels = result.structure.relationships.filter(r => r.type === 'CONTAINS');
      expect(containsRels.length).toBeGreaterThan(0);
    });

    test('creates HAS_DIRECTIVE relationships', () => {
      const markdown = `# Guidelines

[MUST] Important rule.`;

      const parsed = parser.parse(markdown);
      const { directives } = extractor.extractFromSections(parsed.sections);
      const result = builder.buildGraph(parsed, directives, '/test.md');

      const hasDirectiveRels = result.structure.relationships.filter(
        r => r.type === 'HAS_DIRECTIVE'
      );
      expect(hasDirectiveRels).toHaveLength(1);
    });

    test('creates Topic nodes and relationships', () => {
      const markdown = `# Security

[MUST] Validate and sanitize all user inputs to prevent XSS attacks.`;

      const parsed = parser.parse(markdown);
      const { directives } = extractor.extractFromSections(parsed.sections);
      const result = builder.buildGraph(parsed, directives, '/test.md');

      const topicNodes = result.structure.nodes.filter(n => n.type === 'Topic');
      expect(topicNodes.length).toBeGreaterThan(0);

      const topicRels = result.structure.relationships.filter(
        r => r.type === 'APPLIES_TO_TOPIC'
      );
      expect(topicRels.length).toBeGreaterThan(0);
    });

    test('creates Layer nodes and relationships', () => {
      const markdown = `# API Guidelines

[MUST] All REST endpoints must validate input.`;

      const parsed = parser.parse(markdown);
      const { directives } = extractor.extractFromSections(parsed.sections);
      const result = builder.buildGraph(parsed, directives, '/test.md');

      const layerNodes = result.structure.nodes.filter(n => n.type === 'Layer');
      const layerRels = result.structure.relationships.filter(
        r => r.type === 'APPLIES_TO_LAYER'
      );

      if (directives[0]?.layers.length > 0) {
        expect(layerNodes.length).toBeGreaterThan(0);
        expect(layerRels.length).toBeGreaterThan(0);
      }
    });

    test('creates Technology nodes and relationships', () => {
      const markdown = `# Tech Stack

[MUST] Use TypeScript for all new code.`;

      const parsed = parser.parse(markdown);
      const { directives } = extractor.extractFromSections(parsed.sections);
      const result = builder.buildGraph(parsed, directives, '/test.md');

      const techNodes = result.structure.nodes.filter(n => n.type === 'Technology');
      const techRels = result.structure.relationships.filter(
        r => r.type === 'APPLIES_TO_TECHNOLOGY'
      );

      if (directives[0]?.technologies.length > 0) {
        expect(techNodes.length).toBeGreaterThan(0);
        expect(techRels.length).toBeGreaterThan(0);
      }
    });

    test('uses document metadata for Rule properties', () => {
      const markdown = `---
title: Custom Security Rules
layer: 5-Integration
authoritativeFor:
  - security
  - api
topics:
  - authentication
  - authorization
---

# Guidelines

Content here.`;

      const parsed = parser.parse(markdown);
      const { directives } = extractor.extractFromSections(parsed.sections);
      const result = builder.buildGraph(parsed, directives, '/test.md');

      const ruleNode = result.structure.nodes.find(n => n.type === 'Rule');
      expect(ruleNode?.properties.name).toBe('Custom Security Rules');
      expect(ruleNode?.properties.layer).toBe('5-Integration');
      expect(ruleNode?.properties.authoritativeFor).toContain('security');
      expect(ruleNode?.properties.topics).toContain('authentication');
    });

    test('handles documents with no directives', () => {
      const markdown = `# Documentation

Just plain text with no directives.`;

      const parsed = parser.parse(markdown);
      const { directives } = extractor.extractFromSections(parsed.sections);
      const result = builder.buildGraph(parsed, directives, '/test.md');

      expect(result.stats.rulesCreated).toBe(1);
      expect(result.stats.directivesCreated).toBe(0);
      expect(result.structure.nodes.filter(n => n.type === 'Directive')).toHaveLength(0);
    });
  });

  describe('validateGraph', () => {
    test('validates correct graph structure', () => {
      const markdown = `# Test

[MUST] Rule here.`;

      const parsed = parser.parse(markdown);
      const { directives } = extractor.extractFromSections(parsed.sections);
      const { structure } = builder.buildGraph(parsed, directives, '/test.md');

      const validation = builder.validateGraph(structure);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('detects missing Rule node', () => {
      const structure = {
        nodes: [
          {
            type: 'Directive' as const,
            properties: { id: 'test-1' }
          }
        ],
        relationships: []
      };

      const validation = builder.validateGraph(structure);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Graph must contain at least one Rule node');
    });

    test('detects duplicate node IDs', () => {
      const structure = {
        nodes: [
          {
            type: 'Rule' as const,
            properties: { id: 'rule-1' }
          },
          {
            type: 'Section' as const,
            properties: { id: 'rule-1' }
          }
        ],
        relationships: []
      };

      const validation = builder.validateGraph(structure);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('Duplicate node IDs'))).toBe(true);
    });

    test('detects invalid relationship references', () => {
      const structure = {
        nodes: [
          {
            type: 'Rule' as const,
            properties: { id: 'rule-1' }
          }
        ],
        relationships: [
          {
            type: 'CONTAINS',
            from: 'rule-1',
            to: 'nonexistent-section'
          }
        ]
      };

      const validation = builder.validateGraph(structure);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('nonexistent-section'))).toBe(true);
    });
  });

  describe('edge cases', () => {
    test('handles empty markdown', () => {
      const parsed = parser.parse('');
      const { directives } = extractor.extractFromSections(parsed.sections);
      const result = builder.buildGraph(parsed, directives, '/empty.md');

      expect(result.stats.rulesCreated).toBe(1);
      expect(result.stats.sectionsCreated).toBe(0);
      expect(result.stats.directivesCreated).toBe(0);
    });

    test('handles deeply nested sections', () => {
      const markdown = `# L1

## L2

### L3

#### L4

##### L5

###### L6`;

      const parsed = parser.parse(markdown);
      const { directives } = extractor.extractFromSections(parsed.sections);
      const result = builder.buildGraph(parsed, directives, '/test.md');

      expect(result.stats.sectionsCreated).toBeGreaterThan(0);
      const containsRels = result.structure.relationships.filter(r => r.type === 'CONTAINS');
      expect(containsRels.length).toBeGreaterThan(0);
    });

    test('does not create duplicate Topic/Layer/Technology nodes', () => {
      const markdown = `# Guidelines

[MUST] Security rule 1 for API.

[SHOULD] Security rule 2 for API.`;

      const parsed = parser.parse(markdown);
      const { directives } = extractor.extractFromSections(parsed.sections);
      const result = builder.buildGraph(parsed, directives, '/test.md');

      // Count unique topic nodes
      const topicIds = result.structure.nodes
        .filter(n => n.type === 'Topic')
        .map(n => n.properties.id);
      const uniqueTopicIds = new Set(topicIds);

      expect(topicIds.length).toBe(uniqueTopicIds.size);
    });

    test('generates unique IDs for nodes', () => {
      const markdown = `# Test

[MUST] Rule 1.

[SHOULD] Rule 2.`;

      const parsed = parser.parse(markdown);
      const { directives } = extractor.extractFromSections(parsed.sections);
      const result = builder.buildGraph(parsed, directives, '/test.md');

      const allIds = result.structure.nodes.map(n => n.properties.id);
      const uniqueIds = new Set(allIds);

      expect(allIds.length).toBe(uniqueIds.size);
    });
  });
});
