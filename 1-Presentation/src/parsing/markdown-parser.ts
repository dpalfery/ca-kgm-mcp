/**
 * Markdown Parser Engine
 * 
 * Parses markdown rule documents into a structured AST format.
 * Extracts sections, subsections, code blocks, and metadata.
 */

import matter from 'gray-matter';

export interface MarkdownMetadata {
  [key: string]: any;
}

export interface CodeBlock {
  language: string;
  code: string;
  startLine: number;
}

export interface MarkdownSection {
  id: string;
  level: number;
  title: string;
  content: string;
  lineNumber: number;
  subsections: MarkdownSection[];
  codeBlocks: CodeBlock[];
}

export interface ParsedMarkdown {
  metadata: MarkdownMetadata;
  content: string;
  sections: MarkdownSection[];
  rawContent: string;
}

/**
 * Markdown Parser class that parses markdown documents
 */
export class MarkdownParser {
  /**
   * Parse a markdown document into structured format
   */
  parse(markdownContent: string): ParsedMarkdown {
    // Extract front matter (YAML metadata)
    const { data: metadata, content } = matter(markdownContent);
    
    // Parse sections
    const sections = this.parseSections(content);

    return {
      metadata,
      content,
      sections,
      rawContent: markdownContent
    };
  }

  /**
   * Parse sections from markdown content
   */
  private parseSections(content: string): MarkdownSection[] {
    const lines = content.split('\n');
    const sections: MarkdownSection[] = [];
    const sectionStack: MarkdownSection[] = [];

    let currentLineNumber = 0;
    let currentContent: string[] = [];
    let inCodeBlock = false;
    let currentCodeBlock: { language: string; code: string[]; startLine: number } | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      currentLineNumber = i + 1;

      // Check for code block boundaries
      const codeBlockMatch = line.match(/^```(\w*)/);
      if (codeBlockMatch) {
        if (!inCodeBlock) {
          // Start of code block
          inCodeBlock = true;
          currentCodeBlock = {
            language: codeBlockMatch[1] || 'text',
            code: [],
            startLine: currentLineNumber
          };
        } else {
          // End of code block
          inCodeBlock = false;
          if (currentCodeBlock && sectionStack.length > 0) {
            const currentSection = sectionStack[sectionStack.length - 1];
            currentSection.codeBlocks.push({
              language: currentCodeBlock.language,
              code: currentCodeBlock.code.join('\n'),
              startLine: currentCodeBlock.startLine
            });
          }
          currentCodeBlock = null;
        }
        continue;
      }

      // If in code block, collect code lines
      if (inCodeBlock && currentCodeBlock) {
        currentCodeBlock.code.push(line);
        continue;
      }

      // Check for headers
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headerMatch) {
        const level = headerMatch[1].length;
        const title = headerMatch[2].trim();

        // Save accumulated content to previous section
        if (sectionStack.length > 0) {
          const prevSection = sectionStack[sectionStack.length - 1];
          prevSection.content = currentContent.join('\n').trim();
          currentContent = [];
        }

        // Create new section
        const newSection: MarkdownSection = {
          id: this.generateSectionId(title, currentLineNumber),
          level,
          title,
          content: '',
          lineNumber: currentLineNumber,
          subsections: [],
          codeBlocks: []
        };

        // Pop sections from stack until we find the right parent
        while (sectionStack.length > 0 && sectionStack[sectionStack.length - 1].level >= level) {
          const completed = sectionStack.pop()!;
          if (sectionStack.length === 0) {
            sections.push(completed);
          } else {
            sectionStack[sectionStack.length - 1].subsections.push(completed);
          }
        }

        // Add new section to stack
        sectionStack.push(newSection);
      } else {
        // Accumulate content for current section
        currentContent.push(line);
      }
    }

    // Finalize remaining sections
    if (sectionStack.length > 0) {
      const lastSection = sectionStack[sectionStack.length - 1];
      lastSection.content = currentContent.join('\n').trim();

      // Pop all remaining sections
      while (sectionStack.length > 0) {
        const completed = sectionStack.pop()!;
        if (sectionStack.length === 0) {
          sections.push(completed);
        } else {
          sectionStack[sectionStack.length - 1].subsections.push(completed);
        }
      }
    }

    return sections;
  }

  /**
   * Generate a unique section ID
   */
  private generateSectionId(title: string, lineNumber: number): string {
    const slug = title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
    return `${slug}-${lineNumber}`;
  }

  /**
   * Normalize whitespace in content
   */
  normalizeWhitespace(content: string): string {
    return content
      .replace(/\r\n/g, '\n')  // Normalize line endings
      .replace(/\t/g, '    ')   // Convert tabs to spaces
      .trim();
  }

  /**
   * Extract all headers from content
   */
  extractHeaders(content: string): Array<{ level: number; text: string; line: number }> {
    const lines = content.split('\n');
    const headers: Array<{ level: number; text: string; line: number }> = [];

    lines.forEach((line, index) => {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        headers.push({
          level: match[1].length,
          text: match[2].trim(),
          line: index + 1
        });
      }
    });

    return headers;
  }

  /**
   * Extract all code blocks from content
   */
  extractCodeBlocks(content: string): CodeBlock[] {
    const lines = content.split('\n');
    const codeBlocks: CodeBlock[] = [];
    let inCodeBlock = false;
    let currentBlock: { language: string; code: string[]; startLine: number } | null = null;

    lines.forEach((line, index) => {
      const match = line.match(/^```(\w*)/);
      if (match) {
        if (!inCodeBlock) {
          inCodeBlock = true;
          currentBlock = {
            language: match[1] || 'text',
            code: [],
            startLine: index + 1
          };
        } else {
          inCodeBlock = false;
          if (currentBlock) {
            codeBlocks.push({
              language: currentBlock.language,
              code: currentBlock.code.join('\n'),
              startLine: currentBlock.startLine
            });
          }
          currentBlock = null;
        }
      } else if (inCodeBlock && currentBlock) {
        currentBlock.code.push(line);
      }
    });

    return codeBlocks;
  }
}
