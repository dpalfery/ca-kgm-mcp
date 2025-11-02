/**
 * Directive Processor
 *
 * Extracts and generates directives ([MUST], [SHOULD], [MAY]) and metadata from markdown sections.
 */

import { MarkdownSection } from './markdown-parser';
import { LocalModelManager } from '../rules/local-model-manager';
import { z } from 'zod';

export type DirectiveSeverity = 'MUST' | 'SHOULD' | 'MAY';

export interface ExtractedDirective {
  id: string;
  content: string;
  severity: DirectiveSeverity;
  topics: string[];
  layers: string[];
  technologies: string[];
  section: string;
  subsection?: string;
  context?: string;
  lineNumber: number;
  isGenerated?: boolean;
}

export interface DirectiveExtractionResult {
  directives: ExtractedDirective[];
  warnings: string[];
  metadata: {
    totalDirectives: number;
    mustCount: number;
    shouldCount: number;
    mayCount: number;
  };
}

/**
 * Directive Processor class
 */
export class DirectiveProcessor {
  private localModelManager: LocalModelManager | undefined;

  constructor(localModelManager?: LocalModelManager) {
    this.localModelManager = localModelManager;
  }

  /**
   * Extract directives from parsed markdown sections
   */
  async extractFromSections(sections: MarkdownSection[], documentMetadata?: any): Promise<DirectiveExtractionResult> {
    const directives: ExtractedDirective[] = [];
    const warnings: string[] = [];

    for (const section of sections) {
      await this.extractFromSection(section, documentMetadata, directives, warnings);
    }

    return {
      directives,
      warnings,
      metadata: {
        totalDirectives: directives.length,
        mustCount: directives.filter(d => d.severity === 'MUST').length,
        shouldCount: directives.filter(d => d.severity === 'SHOULD').length,
        mayCount: directives.filter(d => d.severity === 'MAY').length
      }
    };
  }

  /**
   * Extract directives from a single section recursively
   */
  private async extractFromSection(
    section: MarkdownSection,
    documentMetadata: any,
    directives: ExtractedDirective[],
    warnings: string[],
    parentSection?: string
  ): Promise<void> {
    const sectionPath = parentSection ? `${parentSection} → ${section.title}` : section.title;

    // Extract directives from section content
    const sectionDirectives = this.extractDirectivesFromText(
      section.content,
      sectionPath,
      section.lineNumber,
      documentMetadata
    );

    directives.push(...sectionDirectives);

    // If no explicit directives found and generation is enabled, try to generate them
    if (sectionDirectives.length === 0 && this.localModelManager) {
      try {
        const generatedDirectives = await this.generateDirectives(
          section.content,
          sectionPath,
          section.lineNumber,
          documentMetadata,
          this.localModelManager
        );
        directives.push(...generatedDirectives);
        
        if (generatedDirectives.length > 0) {
          warnings.push(`Generated ${generatedDirectives.length} directive(s) for section: ${sectionPath}`);
        }
      } catch (error) {
        warnings.push(`Failed to generate directives for section ${sectionPath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Recursively process subsections
    for (const subsection of section.subsections) {
      await this.extractFromSection(subsection, documentMetadata, directives, warnings, sectionPath);
    }
  }

  /**
   * Extract directives from text content
   */
  private extractDirectivesFromText(
    text: string,
    section: string,
    baseLineNumber: number,
    documentMetadata?: any
  ): ExtractedDirective[] {
    const directives: ExtractedDirective[] = [];
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNumber = baseLineNumber + i;

      // Check if line contains a directive
      const severityMatch = line.match(/\[(MUST|SHOULD|MAY)\]/i);
      if (severityMatch) {
        const severity = severityMatch[1].toUpperCase() as DirectiveSeverity;
        
        // Extract the directive content (text after the severity marker)
        let content = line.replace(/\[(MUST|SHOULD|MAY)\]\s*/i, '').trim();
        
        // Remove leading markers like -, *, numbers
        content = content.replace(/^[-*\d.)\s]+/, '').trim();

        if (content) {
          // Get context (surrounding lines)
          const context = this.getContext(lines, i);

          // Extract metadata
          const { topics, layers, technologies } = this.extractMetadata(
            content,
            context,
            documentMetadata
          );

          directives.push({
            id: this.generateDirectiveId(content, lineNumber),
            content,
            severity,
            topics,
            layers,
            technologies,
            section,
            context,
            lineNumber
          });
        }
      }
    }

    return directives;
  }

  /**
   * Extract metadata from directive content and context
   */
  private extractMetadata(
    content: string,
    context: string,
    documentMetadata?: any
  ): {
    topics: string[];
    layers: string[];
    technologies: string[];
  } {
    const topics = new Set<string>();
    const layers = new Set<string>();
    const technologies = new Set<string>();

    // Combine content and context for analysis
    const fullText = `${content} ${context}`.toLowerCase();

    // Extract topics
    const topicKeywords = {
      security: ['security', 'authentication', 'authorization', 'encrypt', 'validate', 'sanitize', 'xss', 'csrf', 'injection'],
      testing: ['test', 'unit test', 'integration test', 'e2e', 'coverage', 'mock', 'tdd', 'bdd'],
      performance: ['performance', 'optimize', 'cache', 'index', 'scale', 'latency', 'throughput', 'memory'],
      api: ['api', 'rest', 'graphql', 'endpoint', 'http', 'request', 'response', 'contract'],
      database: ['database', 'sql', 'nosql', 'query', 'transaction', 'migration', 'schema', 'table'],
      frontend: ['ui', 'component', 'view', 'page', 'css', 'style', 'button', 'form'],
      backend: ['service', 'business logic', 'workflow', 'server', 'backend'],
      documentation: ['documentation', 'document', 'readme', 'spec', 'diagram'],
      logging: ['log', 'logging', 'audit', 'trace', 'debug'],
      'error-handling': ['error', 'exception', 'fault', 'failure', 'retry']
    };

    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(keyword => fullText.includes(keyword))) {
        topics.add(topic);
      }
    }

    // Extract architectural layers
    const layerKeywords = {
      '1-Presentation': ['ui', 'component', 'page', 'view', 'frontend', 'css', 'react', 'angular', 'vue'],
      '2-Application': ['service', 'business logic', 'workflow', 'orchestration', 'application'],
      '3-Domain': ['entity', 'aggregate', 'domain model', 'business rule', 'domain'],
      '4-Persistence': ['database', 'repository', 'dao', 'sql', 'query', 'storage', 'persistence'],
      '5-Tests': ['test', 'testing', 'spec', 'jest', 'mocha', 'vitest', 'unit', 'integration'],
      '6-Tests': ['test', 'testing', 'unit test', 'integration test', 'e2e'],
      '7-Infrastructure': ['deploy', 'infrastructure', 'ci/cd', 'monitoring', 'docker', 'kubernetes']
    };

    for (const [layer, keywords] of Object.entries(layerKeywords)) {
      if (keywords.some(keyword => fullText.includes(keyword))) {
        layers.add(layer);
      }
    }

    // Extract technologies
    const techKeywords = [
      'react', 'angular', 'vue', 'typescript', 'javascript', 'node.js', 'nodejs',
      'c#', 'csharp', '.net', 'dotnet', 'java', 'python', 'go', 'rust',
      'sql', 'postgresql', 'mysql', 'mongodb', 'redis', 'neo4j',
      'docker', 'kubernetes', 'azure', 'aws', 'gcp',
      'rest', 'graphql', 'grpc', 'http', 'https', 'jwt'
    ];

    for (const tech of techKeywords) {
      if (fullText.includes(tech)) {
        technologies.add(tech);
      }
    }

    // Use document metadata if available
    if (documentMetadata) {
      if (documentMetadata.topics) {
        const metaTopics = Array.isArray(documentMetadata.topics) 
          ? documentMetadata.topics 
          : [documentMetadata.topics];
        metaTopics.forEach((t: string) => topics.add(t.toLowerCase()));
      }
      if (documentMetadata.layer) {
        layers.add(documentMetadata.layer);
      }
      if (documentMetadata.technologies) {
        const metaTech = Array.isArray(documentMetadata.technologies)
          ? documentMetadata.technologies
          : [documentMetadata.technologies];
        metaTech.forEach((t: string) => technologies.add(t.toLowerCase()));
      }
    }

    return {
      topics: Array.from(topics),
      layers: Array.from(layers),
      technologies: Array.from(technologies)
    };
  }

  /**
   * Get context around a directive (surrounding lines)
   */
  private getContext(lines: string[], currentIndex: number): string {
    const before = Math.max(0, currentIndex - 1);
    const after = Math.min(lines.length - 1, currentIndex + 1);

    const contextLines = [];
    if (before < currentIndex) contextLines.push(lines[before]);
    if (after > currentIndex) contextLines.push(lines[after]);

    return contextLines.join(' ').trim();
  }

  /**
   * Generate a unique directive ID
   */
  private generateDirectiveId(content: string, lineNumber: number): string {
    const hash = this.simpleHash(content);
    return `dir-${hash}-${lineNumber}`;
  }

  /**
   * Simple hash function for generating IDs
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Validate directive format
   */
  validateDirective(directive: ExtractedDirective): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!directive.content || directive.content.trim().length === 0) {
      errors.push('Directive content cannot be empty');
    }

    if (!['MUST', 'SHOULD', 'MAY'].includes(directive.severity)) {
      errors.push(`Invalid severity: ${directive.severity}`);
    }

    if (directive.content.length > 500) {
      errors.push('Directive content exceeds maximum length of 500 characters');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate directives for content that lacks explicit directives
   *
   * @param content The content to generate directives for
   * @param section The section name/path
   * @param lineNumber The line number where the content starts
   * @param documentMetadata Optional document metadata
   * @param localModelManager The LocalModelManager instance for LLM calls
   * @returns Promise<ExtractedDirective[]> Generated directives
   */
  async generateDirectives(
    content: string,
    section: string,
    lineNumber: number,
    documentMetadata?: any,
    localModelManager?: LocalModelManager
  ): Promise<ExtractedDirective[]> {
    if (!localModelManager) {
      return [];
    }

    // Schema for LLM response
    const GeneratedDirectivesSchema = z.object({
      directives: z.array(z.object({
        content: z.string(),
        severity: z.enum(['MUST', 'SHOULD', 'MAY']),
        reasoning: z.string().optional()
      }))
    });

    const prompt = `Analyze the following markdown section content and generate appropriate directives ([MUST], [SHOULD], [MAY]) based on the content.

Section: ${section}
Content:
"""
${content}
"""

Please identify key rules, guidelines, or recommendations in this content and generate directives for them. Consider:

1. Security requirements or constraints (use MUST)
2. Best practices or strong recommendations (use SHOULD)
3. Optional suggestions or nice-to-haves (use MAY)

For each directive, provide:
- The directive content (what should be done)
- The severity level (MUST/SHOULD/MAY)
- Brief reasoning for why this directive is needed

Focus on actionable, specific directives rather than general statements. If the content doesn't contain any rule-worthy information, return an empty array.`;

    try {
      const response = await localModelManager.generateJson(prompt, GeneratedDirectivesSchema);
      
      if (!response.success) {
        console.error('Failed to generate directives:', response.error);
        return [];
      }

      const generatedDirectives: ExtractedDirective[] = [];
      
      for (const directive of response.data.directives) {
        // Extract metadata from the directive content
        const { topics, layers, technologies } = this.extractMetadata(
          directive.content,
          content.substring(0, 200),
          documentMetadata
        );

        generatedDirectives.push({
          id: this.generateDirectiveId(directive.content, lineNumber),
          content: directive.content,
          severity: directive.severity,
          topics,
          layers,
          technologies,
          section,
          context: content.substring(0, 200) + (content.length > 200 ? "..." : ""),
          lineNumber,
          isGenerated: true
        });
      }

      return generatedDirectives;
    } catch (error) {
      console.error('Error generating directives:', error);
      return [];
    }
  }
}
