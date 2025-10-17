/**
 * Context Block Formatter Module
 * 
 * Converts ranked directives into readable, LLM-optimized markdown context blocks.
 * Groups by severity, adds metadata, and ensures clean formatting.
 */

export interface FormattingInput {
  directives: Array<{
    id: string;
    content: string;
    severity: 'MUST' | 'SHOULD' | 'MAY';
    topics: string[];
    layers: string[];
    technologies: string[];
    section: string;
    sourcePath: string;
  }>;
  detectedLayer: string;
  detectedTopics: string[];
  detectedTechnologies: string[];
  includeBreadcrumbs: boolean;
}

export interface FormattedResult {
  contextBlock: string;
  tokenEstimate: number;
  groupCount: {
    must: number;
    should: number;
    may: number;
  };
}

export class ContextFormatter {
  /**
   * Format directives into a readable context block
   */
  static format(input: FormattingInput): FormattedResult {
    // Group directives by severity
    const must = input.directives.filter(d => d.severity === 'MUST');
    const should = input.directives.filter(d => d.severity === 'SHOULD');
    const may = input.directives.filter(d => d.severity === 'MAY');

    // Build markdown
    let markdown = '# Contextual Rules\n\n';

    // Add detected context header
    markdown += this.formatContextHeader(
      input.detectedLayer,
      input.detectedTopics,
      input.detectedTechnologies
    );

    // Add critical directives
    if (must.length > 0) {
      markdown += '\n## 🔴 Critical (MUST) Directives\n\n';
      markdown += this.formatDirectiveGroup(must, input.includeBreadcrumbs);
    }

    // Add recommended directives
    if (should.length > 0) {
      markdown += '\n## 🟡 Recommended (SHOULD) Directives\n\n';
      markdown += this.formatDirectiveGroup(should, input.includeBreadcrumbs);
    }

    // Add optional directives
    if (may.length > 0) {
      markdown += '\n## 🟢 Optional (MAY) Directives\n\n';
      markdown += this.formatDirectiveGroup(may, input.includeBreadcrumbs);
    }

    // Add footer
    markdown += '\n---\n';
    markdown += `**Retrieved:** ${input.directives.length} directives | `;
    markdown += `**Source:** ${this.getSourceFiles(input.directives).join(', ')}\n`;

    // Estimate tokens (rough: 1 token per 4 chars)
    const tokenEstimate = Math.ceil(markdown.length / 4);

    return {
      contextBlock: markdown,
      tokenEstimate,
      groupCount: {
        must: must.length,
        should: should.length,
        may: may.length
      }
    };
  }

  /**
   * Format the context header with detected layer and topics
   */
  private static formatContextHeader(
    layer: string,
    topics: string[],
    technologies: string[]
  ): string {
    let header = '**Detected Context:**\n';
    
    if (layer !== '*') {
      header += `- **Layer:** ${layer}\n`;
    }
    
    if (topics.length > 0) {
      header += `- **Topics:** ${topics.slice(0, 5).join(', ')}\n`;
    }
    
    if (technologies.length > 0) {
      header += `- **Technologies:** ${technologies.slice(0, 5).join(', ')}\n`;
    }

    return header;
  }

  /**
   * Format a group of directives
   */
  private static formatDirectiveGroup(
    directives: Array<{
      id: string;
      content: string;
      severity: 'MUST' | 'SHOULD' | 'MAY';
      topics: string[];
      layers: string[];
      technologies: string[];
      section: string;
      sourcePath: string;
    }>,
    includeBreadcrumbs: boolean
  ): string {
    let output = '';

    // Group by section for better organization
    const bySection = new Map<string, typeof directives>();
    for (const d of directives) {
      const section = d.section || 'General';
      if (!bySection.has(section)) {
        bySection.set(section, []);
      }
      bySection.get(section)!.push(d);
    }

    // Format each section
    for (const [section, sectionDirectives] of bySection) {
      output += `### ${section}\n\n`;

      for (const d of sectionDirectives) {
        const severity = d.severity === 'MUST' ? '🔴' : d.severity === 'SHOULD' ? '🟡' : '🟢';
        output += `- ${severity} **[${d.severity}]** ${d.content}\n`;

        if (includeBreadcrumbs) {
          const breadcrumbs = [d.topics.join(', '), d.technologies.join(', ')]
            .filter(x => x)
            .join(' | ');
          if (breadcrumbs) {
            output += `  *Tags:* ${breadcrumbs}\n`;
          }
          output += `  *Source:* \`${d.sourcePath}\` → ${d.section}\n`;
        }

        output += '\n';
      }
    }

    return output;
  }

  /**
   * Extract unique source files from directives
   */
  private static getSourceFiles(
    directives: Array<{
      sourcePath: string;
      [key: string]: any;
    }>
  ): string[] {
    const sources = new Set(directives.map(d => d.sourcePath));
    return Array.from(sources);
  }
}
