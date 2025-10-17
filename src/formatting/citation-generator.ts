/**
 * Citation & Breadcrumb Generation Module
 * 
 * Generates source file references, section hierarchy breadcrumbs,
 * and clickable citations for rule origins.
 */

export interface Citation {
  source: string;          // File path
  section: string;         // Section in document
  subsection: string | undefined;     // Optional subsection
  lineNumber: number | undefined;     // Optional line number
  full: string;            // Full formatted citation
}

export class CitationGenerator {
  /**
   * Generate a citation for a directive
   */
  static generateCitation(
    sourcePath: string,
    section: string,
    subsection?: string,
    lineNumber?: number
  ): Citation {
    const breadcrumbs = [sourcePath];
    
    if (section) {
      breadcrumbs.push(section);
    }
    
    if (subsection) {
      breadcrumbs.push(subsection);
    }

    let fullCitation = breadcrumbs.join(' → ');
    
    if (lineNumber) {
      fullCitation += ` [Line ${lineNumber}]`;
    }

    return {
      source: sourcePath,
      section,
      subsection,
      lineNumber,
      full: fullCitation
    };
  }

  /**
   * Generate inline citation markdown
   */
  static generateInlineCitation(citation: Citation): string {
    return `*Source: ${citation.full}*`;
  }

  /**
   * Generate a reference list of all unique citations
   */
  static generateReferenceList(
    citations: Citation[]
  ): string {
    // Group by source file
    const bySource = new Map<string, Citation[]>();
    
    for (const citation of citations) {
      if (!bySource.has(citation.source)) {
        bySource.set(citation.source, []);
      }
      bySource.get(citation.source)!.push(citation);
    }

    let output = '## References\n\n';

    for (const [source, sourceCitations] of bySource) {
      output += `**${source}**\n`;

      const sections = new Set(sourceCitations.map(c => c.section));
      for (const section of sections) {
        if (section) {
          output += `- ${section}\n`;
        }
      }

      output += '\n';
    }

    return output;
  }

  /**
   * Extract breadcrumb hierarchy from a path/section structure
   */
  static extractBreadcrumbs(
    sourcePath: string,
    section: string,
    subsection?: string
  ): string[] {
    const breadcrumbs: string[] = [];

    // Extract file name without extension
    const fileName = sourcePath.split('/').pop()?.replace('.md', '') || sourcePath;
    breadcrumbs.push(fileName);

    if (section) {
      breadcrumbs.push(section);
    }

    if (subsection) {
      breadcrumbs.push(subsection);
    }

    return breadcrumbs;
  }

  /**
   * Format a full citation with hierarchy
   */
  static formatCitationWithHierarchy(
    sourcePath: string,
    section: string,
    subsection?: string,
    lineNumber?: number
  ): string {
    const breadcrumbs = this.extractBreadcrumbs(sourcePath, section, subsection);
    let citation = breadcrumbs.join(' › ');

    if (lineNumber) {
      citation += ` (line ${lineNumber})`;
    }

    return citation;
  }

  /**
   * Generate abbreviated citation (e.g., "API-Guide › Auth" instead of full path)
   */
  static generateAbbreviatedCitation(
    sourcePath: string,
    section: string,
    subsection?: string
  ): string {
    const fileName = sourcePath.split('/').pop()?.replace('.md', '') || 'unknown';
    const parts = [fileName];

    if (section) {
      parts.push(section);
    }

    if (subsection) {
      parts.push(subsection);
    }

    return parts.join(' › ');
  }
}
