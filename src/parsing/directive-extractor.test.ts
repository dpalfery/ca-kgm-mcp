/**
 * Unit tests for Directive Extractor
 */

import { describe, test, expect } from 'vitest';
import { DirectiveProcessor } from './directive-processor.js';
import { MarkdownParser } from './markdown-parser.js';

describe('DirectiveProcessor', () => {
  const extractor = new DirectiveProcessor();
  const parser = new MarkdownParser();

  describe('extractFromSections', () => {
    test('extracts MUST directives', () => {
      const markdown = `# Security Guidelines

[MUST] Validate all user inputs before processing.

[MUST] Use HTTPS for all API endpoints.`;

      const parsed = parser.parse(markdown);
      const result = extractor.extractFromSections(parsed.sections);

      expect(result.directives).toHaveLength(2);
      expect(result.directives[0].severity).toBe('MUST');
      expect(result.directives[0].content).toContain('Validate all user inputs');
      expect(result.directives[1].content).toContain('Use HTTPS');
    });

    test('extracts SHOULD directives', () => {
      const markdown = `# Best Practices

[SHOULD] Use meaningful variable names.

[SHOULD] Write unit tests for new functions.`;

      const parsed = parser.parse(markdown);
      const result = extractor.extractFromSections(parsed.sections);

      expect(result.directives).toHaveLength(2);
      expect(result.directives[0].severity).toBe('SHOULD');
      expect(result.directives[1].severity).toBe('SHOULD');
    });

    test('extracts MAY directives', () => {
      const markdown = `# Optional Guidelines

[MAY] Consider using a caching layer for frequently accessed data.`;

      const parsed = parser.parse(markdown);
      const result = extractor.extractFromSections(parsed.sections);

      expect(result.directives).toHaveLength(1);
      expect(result.directives[0].severity).toBe('MAY');
    });

    test('extracts mixed severity directives', () => {
      const markdown = `# Guidelines

[MUST] Follow security protocols.

[SHOULD] Optimize database queries.

[MAY] Add logging for debugging.`;

      const parsed = parser.parse(markdown);
      const result = extractor.extractFromSections(parsed.sections);

      expect(result.directives).toHaveLength(3);
      expect(result.metadata.mustCount).toBe(1);
      expect(result.metadata.shouldCount).toBe(1);
      expect(result.metadata.mayCount).toBe(1);
    });

    test('handles directives in nested sections', () => {
      const markdown = `# Main

## Subsection 1

[MUST] Rule in subsection 1.

### Nested Subsection

[SHOULD] Rule in nested subsection.

## Subsection 2

[MAY] Rule in subsection 2.`;

      const parsed = parser.parse(markdown);
      const result = extractor.extractFromSections(parsed.sections);

      expect(result.directives).toHaveLength(3);
      expect(result.directives[0].section).toContain('Subsection 1');
      expect(result.directives[1].section).toContain('Nested Subsection');
      expect(result.directives[2].section).toContain('Subsection 2');
    });
  });

  describe('metadata extraction', () => {
    test('extracts security topics', () => {
      const markdown = `# Security

[MUST] Validate and sanitize all user inputs to prevent XSS attacks.

[MUST] Use authentication for all API endpoints.`;

      const parsed = parser.parse(markdown);
      const result = extractor.extractFromSections(parsed.sections);

      expect(result.directives[0].topics).toContain('security');
      expect(result.directives[1].topics).toContain('security');
      expect(result.directives[1].topics).toContain('api');
    });

    test('extracts testing topics', () => {
      const markdown = `# Testing

[SHOULD] Write unit tests for all business logic.

[SHOULD] Achieve minimum 80% code coverage.`;

      const parsed = parser.parse(markdown);
      const result = extractor.extractFromSections(parsed.sections);

      expect(result.directives[0].topics).toContain('testing');
      expect(result.directives[1].topics).toContain('testing');
    });

    test('extracts performance topics', () => {
      const markdown = `# Performance

[SHOULD] Use caching to optimize database queries.

[MUST] Index frequently queried fields.`;

      const parsed = parser.parse(markdown);
      const result = extractor.extractFromSections(parsed.sections);

      expect(result.directives[0].topics).toContain('performance');
      expect(result.directives[0].topics).toContain('database');
    });

    test('extracts architectural layers', () => {
      const markdown = `# API Guidelines

[MUST] All REST endpoints must validate input.

[SHOULD] Use repository pattern for database access.`;

      const parsed = parser.parse(markdown);
      const result = extractor.extractFromSections(parsed.sections);

      expect(result.directives[0].layers).toContain('5-Integration');
      expect(result.directives[1].layers).toContain('4-Persistence');
    });

    test('extracts technologies', () => {
      const markdown = `# Technology Stack

[MUST] Use TypeScript for all new code.

[SHOULD] Use React for frontend components.

[MAY] Consider Neo4j for graph data.`;

      const parsed = parser.parse(markdown);
      const result = extractor.extractFromSections(parsed.sections);

      expect(result.directives[0].technologies).toContain('typescript');
      expect(result.directives[1].technologies).toContain('react');
      expect(result.directives[2].technologies).toContain('neo4j');
    });

    test('uses document metadata', () => {
      const markdown = `---
topics:
  - security
  - api
layer: 5-Integration
technologies:
  - TypeScript
---

# Guidelines

[MUST] Follow best practices.`;

      const parsed = parser.parse(markdown);
      const result = extractor.extractFromSections(parsed.sections, parsed.metadata);

      expect(result.directives[0].topics).toContain('security');
      expect(result.directives[0].topics).toContain('api');
      expect(result.directives[0].layers).toContain('5-Integration');
      expect(result.directives[0].technologies).toContain('typescript');
    });
  });

  describe('directive formatting', () => {
    test('handles directives with list markers', () => {
      const markdown = `# Guidelines

- [MUST] Validate inputs
* [SHOULD] Write tests
1. [MAY] Add comments`;

      const parsed = parser.parse(markdown);
      const result = extractor.extractFromSections(parsed.sections);

      expect(result.directives).toHaveLength(3);
      expect(result.directives[0].content).toBe('Validate inputs');
      expect(result.directives[1].content).toBe('Write tests');
      expect(result.directives[2].content).toBe('Add comments');
    });

    test('handles directives with different case', () => {
      const markdown = `# Guidelines

[must] Use lowercase.
[SHOULD] Use uppercase.
[May] Use mixed case.`;

      const parsed = parser.parse(markdown);
      const result = extractor.extractFromSections(parsed.sections);

      expect(result.directives).toHaveLength(3);
      expect(result.directives[0].severity).toBe('MUST');
      expect(result.directives[1].severity).toBe('SHOULD');
      expect(result.directives[2].severity).toBe('MAY');
    });

    test('skips empty directives', () => {
      const markdown = `# Guidelines

[MUST]

[SHOULD] Valid directive.

[MAY]   `;

      const parsed = parser.parse(markdown);
      const result = extractor.extractFromSections(parsed.sections);

      expect(result.directives).toHaveLength(1);
      expect(result.directives[0].content).toBe('Valid directive.');
    });
  });

  describe('validateDirective', () => {
    test('validates correct directive', () => {
      const directive = {
        id: 'test-1',
        content: 'Validate all inputs',
        severity: 'MUST' as const,
        topics: ['security'],
        layers: [],
        technologies: [],
        section: 'Security',
        lineNumber: 1
      };

      const result = extractor.validateDirective(directive);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('detects empty content', () => {
      const directive = {
        id: 'test-1',
        content: '',
        severity: 'MUST' as const,
        topics: [],
        layers: [],
        technologies: [],
        section: 'Test',
        lineNumber: 1
      };

      const result = extractor.validateDirective(directive);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Directive content cannot be empty');
    });

    test('detects content too long', () => {
      const directive = {
        id: 'test-1',
        content: 'x'.repeat(501),
        severity: 'MUST' as const,
        topics: [],
        layers: [],
        technologies: [],
        section: 'Test',
        lineNumber: 1
      };

      const result = extractor.validateDirective(directive);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('exceeds maximum length');
    });
  });

  describe('edge cases', () => {
    test('handles markdown with no directives', () => {
      const markdown = `# Regular Document

This is just regular text with no directives.

More text here.`;

      const parsed = parser.parse(markdown);
      const result = extractor.extractFromSections(parsed.sections);

      expect(result.directives).toHaveLength(0);
      expect(result.metadata.totalDirectives).toBe(0);
    });

    test('handles multiple directives on same line', () => {
      const markdown = `# Guidelines

[MUST] First [SHOULD] Second`;

      const parsed = parser.parse(markdown);
      const result = extractor.extractFromSections(parsed.sections);

      // Should extract the first directive
      expect(result.directives.length).toBeGreaterThan(0);
    });

    test('tracks line numbers correctly', () => {
      const markdown = `# Guidelines

Line 3

[MUST] Directive on line 5

Line 7

[SHOULD] Directive on line 9`;

      const parsed = parser.parse(markdown);
      const result = extractor.extractFromSections(parsed.sections);

      expect(result.directives).toHaveLength(2);
      // Line numbers are relative to section start
      expect(result.directives[0].lineNumber).toBeGreaterThan(0);
      expect(result.directives[1].lineNumber).toBeGreaterThan(result.directives[0].lineNumber);
    });
  });
});
