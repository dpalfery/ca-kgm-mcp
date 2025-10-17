/**
 * Unit tests for Markdown Parser
 */

import { describe, test, expect } from 'vitest';
import { MarkdownParser } from './markdown-parser.js';

describe('MarkdownParser', () => {
  const parser = new MarkdownParser();

  describe('parse', () => {
    test('parses simple markdown with headers', () => {
      const markdown = `# Main Title

This is content.

## Section 1

Section 1 content.

## Section 2

Section 2 content.`;

      const result = parser.parse(markdown);

      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].title).toBe('Main Title');
      expect(result.sections[0].level).toBe(1);
      expect(result.sections[0].subsections).toHaveLength(2);
      expect(result.sections[0].subsections[0].title).toBe('Section 1');
      expect(result.sections[0].subsections[1].title).toBe('Section 2');
    });

    test('parses markdown with YAML front matter', () => {
      const markdown = `---
title: Test Document
author: Test Author
tags:
  - test
  - markdown
---

# Content

Body text.`;

      const result = parser.parse(markdown);

      expect(result.metadata).toEqual({
        title: 'Test Document',
        author: 'Test Author',
        tags: ['test', 'markdown']
      });
      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].title).toBe('Content');
    });

    test('parses nested sections correctly', () => {
      const markdown = `# Level 1

Content 1

## Level 2

Content 2

### Level 3

Content 3

## Another Level 2

Content 4`;

      const result = parser.parse(markdown);

      expect(result.sections).toHaveLength(1);
      const root = result.sections[0];
      expect(root.level).toBe(1);
      expect(root.subsections).toHaveLength(2);
      expect(root.subsections[0].level).toBe(2);
      expect(root.subsections[0].subsections).toHaveLength(1);
      expect(root.subsections[0].subsections[0].level).toBe(3);
    });

    test('handles empty sections', () => {
      const markdown = `# Empty Section

## Another Empty Section

# Section with Content

Some content here.`;

      const result = parser.parse(markdown);

      expect(result.sections).toHaveLength(2);
      expect(result.sections[0].content).toBe('');
      expect(result.sections[0].subsections[0].content).toBe('');
      expect(result.sections[1].content).toContain('Some content here');
    });

    test('handles special characters in headers', () => {
      const markdown = `# Test: Special Characters (2024)

## Sub-Section #1: Details

Content here.`;

      const result = parser.parse(markdown);

      expect(result.sections[0].title).toBe('Test: Special Characters (2024)');
      expect(result.sections[0].subsections[0].title).toBe('Sub-Section #1: Details');
    });
  });

  describe('extractHeaders', () => {
    test('extracts all headers with levels and line numbers', () => {
      const markdown = `# Header 1

Some text.

## Header 2

More text.

### Header 3`;

      const headers = parser.extractHeaders(markdown);

      expect(headers).toHaveLength(3);
      expect(headers[0]).toEqual({ level: 1, text: 'Header 1', line: 1 });
      expect(headers[1]).toEqual({ level: 2, text: 'Header 2', line: 5 });
      expect(headers[2]).toEqual({ level: 3, text: 'Header 3', line: 9 });
    });

    test('handles markdown with no headers', () => {
      const markdown = `Just plain text.

No headers here.`;

      const headers = parser.extractHeaders(markdown);

      expect(headers).toHaveLength(0);
    });
  });

  describe('extractCodeBlocks', () => {
    test('extracts code blocks with language', () => {
      const markdown = `# Code Example

\`\`\`typescript
function hello() {
  return 'world';
}
\`\`\`

Some text.

\`\`\`javascript
const x = 42;
\`\`\``;

      const codeBlocks = parser.extractCodeBlocks(markdown);

      expect(codeBlocks).toHaveLength(2);
      expect(codeBlocks[0].language).toBe('typescript');
      expect(codeBlocks[0].code).toContain('function hello()');
      expect(codeBlocks[1].language).toBe('javascript');
      expect(codeBlocks[1].code).toContain('const x = 42');
    });

    test('handles code blocks without language specification', () => {
      const markdown = `\`\`\`
plain code
\`\`\``;

      const codeBlocks = parser.extractCodeBlocks(markdown);

      expect(codeBlocks).toHaveLength(1);
      expect(codeBlocks[0].language).toBe('text');
      expect(codeBlocks[0].code).toBe('plain code');
    });

    test('preserves code block formatting', () => {
      const markdown = `\`\`\`python
def function():
    if True:
        return "indented"
\`\`\``;

      const codeBlocks = parser.extractCodeBlocks(markdown);

      expect(codeBlocks[0].code).toContain('    if True:');
      expect(codeBlocks[0].code).toContain('        return "indented"');
    });
  });

  describe('normalizeWhitespace', () => {
    test('converts CRLF to LF', () => {
      const content = 'Line 1\r\nLine 2\r\nLine 3';
      const normalized = parser.normalizeWhitespace(content);

      expect(normalized).toBe('Line 1\nLine 2\nLine 3');
    });

    test('converts tabs to spaces', () => {
      const content = 'Text\twith\ttabs';
      const normalized = parser.normalizeWhitespace(content);

      expect(normalized).toBe('Text    with    tabs');
    });

    test('trims leading and trailing whitespace', () => {
      const content = '  \n  Content  \n  ';
      const normalized = parser.normalizeWhitespace(content);

      expect(normalized).toBe('Content');
    });
  });

  describe('parse with code blocks in sections', () => {
    test('associates code blocks with their sections', () => {
      const markdown = `# API Guidelines

## Authentication

Use JWT tokens.

\`\`\`typescript
const token = generateJWT();
\`\`\`

## Authorization

Check permissions.

\`\`\`typescript
if (hasPermission()) {
  // allow
}
\`\`\``;

      const result = parser.parse(markdown);

      expect(result.sections[0].subsections).toHaveLength(2);
      expect(result.sections[0].subsections[0].codeBlocks).toHaveLength(1);
      expect(result.sections[0].subsections[0].codeBlocks[0].code).toContain('generateJWT');
      expect(result.sections[0].subsections[1].codeBlocks).toHaveLength(1);
      expect(result.sections[0].subsections[1].codeBlocks[0].code).toContain('hasPermission');
    });
  });

  describe('edge cases', () => {
    test('handles empty markdown', () => {
      const result = parser.parse('');

      expect(result.sections).toHaveLength(0);
      expect(result.metadata).toEqual({});
    });

    test('handles markdown with only front matter', () => {
      const markdown = `---
title: Test
---`;

      const result = parser.parse(markdown);

      expect(result.metadata).toEqual({ title: 'Test' });
      expect(result.sections).toHaveLength(0);
    });

    test('handles consecutive headers without content', () => {
      const markdown = `# Header 1
## Header 2
### Header 3
Content here.`;

      const result = parser.parse(markdown);

      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].subsections[0].subsections[0].content).toContain('Content here');
    });

    test('tracks line numbers correctly', () => {
      const markdown = `# First

Content line 3

## Second

Content line 7`;

      const result = parser.parse(markdown);

      expect(result.sections[0].lineNumber).toBe(1);
      expect(result.sections[0].subsections[0].lineNumber).toBe(5);
    });
  });
});
