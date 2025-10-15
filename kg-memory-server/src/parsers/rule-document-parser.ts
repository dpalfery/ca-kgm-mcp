import { 
  Rule, 
  Directive, 
  RuleRelationship, 
  ArchitecturalLayer, 
  DirectiveSeverity 
} from '../types.js';
import { 
  ParsedRuleDocument, 
  ValidationResult, 
  RuleMetadata 
} from '../interfaces/knowledge-graph.js';
import { randomUUID } from 'crypto';

/**
 * Parser for structured rule documents in markdown format
 * 
 * Expected document structure:
 * # [Rule Name]
 * 
 * ## Metadata
 * - **Layer**: 1-Presentation | 2-Application | 3-Domain | 4-Persistence | 5-Infrastructure | *
 * - **AuthoritativeFor**: [security, testing, architecture]
 * - **Topics**: [API, validation, authentication, performance]
 * 
 * ## When to Apply
 * - Creating new API endpoints
 * - Handling user input
 * 
 * ## Directives
 * 
 * ### [Section Name]
 * **[MUST|SHOULD|MAY]** [Directive text]
 * 
 * **Rationale**: [Why this directive exists]
 * **Example**: [Code example]
 * **Anti-pattern**: [What to avoid]
 */
export class RuleDocumentParser {
  
  /**
   * Parse a complete rule document from markdown content
   */
  async parseRuleDocument(content: string, sourcePath: string): Promise<ParsedRuleDocument> {
    const warnings: string[] = [];
    
    try {
      // Extract metadata first
      const metadata = await this.extractMetadata(content);
      
      // Create the rule entity
      const rule: Rule = {
        id: this.generateRuleId(metadata.name, sourcePath),
        name: metadata.name,
        layer: metadata.layer as ArchitecturalLayer,
        authoritativeFor: metadata.authoritativeFor,
        topics: metadata.topics,
        sourcePath,
        lastUpdated: new Date()
      };

      // Parse directives from the document
      const directives = this.parseDirectives(content, rule.id, metadata.whenToApply);
      
      // Generate relationships
      const relationships = this.generateRelationships(rule, directives);

      return {
        rule,
        directives,
        relationships,
        warnings
      };
      
    } catch (error) {
      throw new Error(`Failed to parse rule document ${sourcePath}: ${error}`);
    }
  }

  /**
   * Validate rule document format and structure
   */
  async validateRuleDocument(content: string): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    try {
      // Check for required sections
      if (!this.hasSection(content, 'Metadata')) {
        errors.push('Missing required "Metadata" section');
      }

      if (!this.hasSection(content, 'Directives')) {
        errors.push('Missing required "Directives" section');
      }

      // Validate metadata format
      const metadataValidation = this.validateMetadata(content);
      errors.push(...metadataValidation.errors);
      warnings.push(...metadataValidation.warnings);

      // Validate directives format
      const directivesValidation = this.validateDirectives(content);
      errors.push(...directivesValidation.errors);
      warnings.push(...directivesValidation.warnings);

      // Check for title
      if (!content.trim().startsWith('#')) {
        errors.push('Document must start with a title (# Rule Name)');
      }

      // Suggestions for improvement
      if (!this.hasSection(content, 'When to Apply')) {
        suggestions.push('Consider adding a "When to Apply" section for better context detection');
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        suggestions
      };

    } catch (error) {
      return {
        isValid: false,
        errors: [`Validation failed: ${error}`],
        warnings: [],
        suggestions: []
      };
    }
  }

  /**
   * Extract metadata from rule document
   */
  async extractMetadata(content: string): Promise<RuleMetadata> {
    // Extract title
    const titleMatch = content.match(/^#\s+(.+)$/m);
    if (!titleMatch) {
      throw new Error('No title found in document');
    }
    const name = titleMatch[1].trim();

    // Extract metadata section
    const metadataSection = this.extractSection(content, 'Metadata');
    if (!metadataSection) {
      throw new Error('No Metadata section found');
    }

    // Parse metadata fields
    const layer = this.extractMetadataField(metadataSection, 'Layer');
    const authoritativeFor = this.extractMetadataArray(metadataSection, 'AuthoritativeFor');
    const topics = this.extractMetadataArray(metadataSection, 'Topics');

    // Extract when to apply conditions
    const whenToApplySection = this.extractSection(content, 'When to Apply');
    const whenToApply = whenToApplySection 
      ? this.extractListItems(whenToApplySection)
      : [];

    // Validate layer
    const validLayers = ['1-Presentation', '2-Application', '3-Domain', '4-Persistence', '5-Infrastructure', '*'];
    if (!validLayers.includes(layer)) {
      throw new Error(`Invalid layer: ${layer}. Must be one of: ${validLayers.join(', ')}`);
    }

    return {
      name,
      layer,
      authoritativeFor,
      topics,
      whenToApply
    };
  }

  /**
   * Parse directives from the document content
   */
  private parseDirectives(content: string, ruleId: string, whenToApply: string[]): Directive[] {
    const directivesSection = this.extractSection(content, 'Directives');
    if (!directivesSection) {
      return [];
    }

    const directives: Directive[] = [];
    const sections = this.splitIntoSubsections(directivesSection);

    for (const section of sections) {
      const sectionDirectives = this.parseDirectivesFromSection(section, ruleId, whenToApply);
      directives.push(...sectionDirectives);
    }

    return directives;
  }

  /**
   * Parse directives from a single section
   */
  private parseDirectivesFromSection(sectionContent: string, ruleId: string, whenToApply: string[]): Directive[] {
    const directives: Directive[] = [];
    
    // Extract section name
    const sectionMatch = sectionContent.match(/^###\s+(.+)$/m);
    const sectionName = sectionMatch ? sectionMatch[1].trim() : 'General';

    // Find all directive statements (MUST, SHOULD, MAY)
    const directiveRegex = /\*\*(MUST|SHOULD|MAY)\*\*\s+(.+?)(?=\n\n|\*\*(?:Rationale|Example|Anti-pattern)|\*\*(MUST|SHOULD|MAY)\*\*|$)/gs;
    
    let match;
    while ((match = directiveRegex.exec(sectionContent)) !== null) {
      const severity = match[1] as DirectiveSeverity;
      const text = match[2].trim();
      
      // Extract additional fields that might follow
      const directiveBlock = this.extractDirectiveBlock(sectionContent, match.index);
      
      const directive: Directive = {
        id: randomUUID(),
        ruleId,
        section: sectionName,
        severity,
        text,
        rationale: this.extractDirectiveField(directiveBlock, 'Rationale'),
        example: this.extractDirectiveField(directiveBlock, 'Example'),
        antiPattern: this.extractDirectiveField(directiveBlock, 'Anti-pattern'),
        topics: this.extractTopicsFromText(text),
        whenToApply: [...whenToApply] // Copy from rule level
      };

      directives.push(directive);
    }

    return directives;
  }

  /**
   * Generate relationships between rules and directives
   */
  private generateRelationships(rule: Rule, directives: Directive[]): RuleRelationship[] {
    const relationships: RuleRelationship[] = [];

    // Create CONTAINS relationships for each directive
    for (const directive of directives) {
      relationships.push({
        from: rule.id,
        to: directive.id,
        type: 'CONTAINS',
        weight: this.getSeverityWeight(directive.severity)
      });
    }

    // Create AUTHORITATIVE_FOR relationships
    for (const domain of rule.authoritativeFor) {
      relationships.push({
        from: rule.id,
        to: domain,
        type: 'AUTHORITATIVE_FOR',
        weight: 1.0
      });
    }

    return relationships;
  }

  /**
   * Extract a section from the document
   */
  private extractSection(content: string, sectionName: string): string | null {
    const regex = new RegExp(`^##\\s+${sectionName}\\s*$([\\s\\S]*?)(?=^##\\s|$)`, 'gm');
    const match = content.match(regex);
    return match ? match[1].trim() : null;
  }

  /**
   * Check if document has a specific section
   */
  private hasSection(content: string, sectionName: string): boolean {
    const regex = new RegExp(`^##\\s+${sectionName}\\s*$`, 'm');
    return regex.test(content);
  }

  /**
   * Extract metadata field value
   */
  private extractMetadataField(metadataSection: string, fieldName: string): string {
    const regex = new RegExp(`^-\\s+\\*\\*${fieldName}\\*\\*:\\s*(.+)$`, 'm');
    const match = metadataSection.match(regex);
    if (!match) {
      throw new Error(`Missing required metadata field: ${fieldName}`);
    }
    return match[1].trim();
  }

  /**
   * Extract metadata array field (e.g., [item1, item2, item3])
   */
  private extractMetadataArray(metadataSection: string, fieldName: string): string[] {
    const fieldValue = this.extractMetadataField(metadataSection, fieldName);
    
    // Handle array format [item1, item2, item3]
    if (fieldValue.startsWith('[') && fieldValue.endsWith(']')) {
      const arrayContent = fieldValue.slice(1, -1);
      return arrayContent
        .split(',')
        .map(item => item.trim())
        .filter(item => item.length > 0);
    }
    
    // Handle single value
    return [fieldValue];
  }

  /**
   * Extract list items from a section
   */
  private extractListItems(sectionContent: string): string[] {
    const items: string[] = [];
    const lines = sectionContent.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ')) {
        items.push(trimmed.substring(2).trim());
      }
    }
    
    return items;
  }

  /**
   * Split directives section into subsections
   */
  private splitIntoSubsections(directivesSection: string): string[] {
    const sections: string[] = [];
    const lines = directivesSection.split('\n');
    let currentSection = '';
    
    for (const line of lines) {
      if (line.trim().startsWith('### ')) {
        if (currentSection.trim()) {
          sections.push(currentSection.trim());
        }
        currentSection = line + '\n';
      } else {
        currentSection += line + '\n';
      }
    }
    
    if (currentSection.trim()) {
      sections.push(currentSection.trim());
    }
    
    return sections;
  }

  /**
   * Extract the complete block for a directive including rationale, example, etc.
   */
  private extractDirectiveBlock(sectionContent: string, startIndex: number): string {
    // Find the next directive or end of section
    const remainingContent = sectionContent.substring(startIndex);
    const nextDirectiveMatch = remainingContent.match(/\*\*(MUST|SHOULD|MAY)\*\*/g);
    
    if (nextDirectiveMatch && nextDirectiveMatch.length > 1) {
      const nextDirectiveIndex = remainingContent.indexOf(nextDirectiveMatch[1]);
      return remainingContent.substring(0, nextDirectiveIndex);
    }
    
    return remainingContent;
  }

  /**
   * Extract a specific field from a directive block
   */
  private extractDirectiveField(directiveBlock: string, fieldName: string): string | undefined {
    const regex = new RegExp(`\\*\\*${fieldName}\\*\\*:\\s*(.+?)(?=\\n\\n|\\*\\*\\w+\\*\\*:|$)`, 's');
    const match = directiveBlock.match(regex);
    return match ? match[1].trim() : undefined;
  }

  /**
   * Extract topics from directive text using simple keyword matching
   */
  private extractTopicsFromText(text: string): string[] {
    const topics: string[] = [];
    const topicKeywords = [
      'API', 'security', 'authentication', 'authorization', 'validation', 
      'database', 'performance', 'testing', 'error handling', 'logging',
      'caching', 'monitoring', 'deployment', 'configuration', 'documentation'
    ];
    
    const lowerText = text.toLowerCase();
    for (const keyword of topicKeywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        topics.push(keyword);
      }
    }
    
    return [...new Set(topics)]; // Remove duplicates
  }

  /**
   * Validate metadata section format
   */
  private validateMetadata(content: string): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    const metadataSection = this.extractSection(content, 'Metadata');
    if (!metadataSection) {
      return { errors: ['No Metadata section found'], warnings: [] };
    }

    // Check required fields
    const requiredFields = ['Layer', 'AuthoritativeFor', 'Topics'];
    for (const field of requiredFields) {
      if (!metadataSection.includes(`**${field}**:`)) {
        errors.push(`Missing required metadata field: ${field}`);
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate directives section format
   */
  private validateDirectives(content: string): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    const directivesSection = this.extractSection(content, 'Directives');
    if (!directivesSection) {
      return { errors: ['No Directives section found'], warnings: [] };
    }

    // Check for at least one directive
    const directiveCount = (directivesSection.match(/\*\*(MUST|SHOULD|MAY)\*\*/g) || []).length;
    if (directiveCount === 0) {
      warnings.push('No directives found in Directives section');
    }

    return { errors, warnings };
  }

  /**
   * Generate a consistent rule ID based on name and source
   */
  private generateRuleId(name: string, sourcePath: string): string {
    const normalizedName = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const pathHash = sourcePath.split('/').pop()?.replace(/\.[^.]+$/, '') || 'unknown';
    return `rule-${normalizedName}-${pathHash}`;
  }

  /**
   * Get numeric weight for directive severity
   */
  private getSeverityWeight(severity: DirectiveSeverity): number {
    switch (severity) {
      case 'MUST': return 1.0;
      case 'SHOULD': return 0.7;
      case 'MAY': return 0.3;
      default: return 0.5;
    }
  }
}