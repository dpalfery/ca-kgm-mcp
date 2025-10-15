import { 
  OutputFormatter, 
  FormattingOptions, 
  DirectiveFormattingOptions,
  QueryInfo,
  BreadcrumbGenerator,
  NavigationNode
} from '../interfaces/output-formatter.js';
import { 
  RankedDirective, 
  Citation, 
  QueryDiagnostics, 
  TaskContext,
  DirectiveSeverity 
} from '../types.js';

/**
 * Main implementation of the output formatter for creating structured
 * markdown context blocks for AI coding assistants
 */
export class ContextBlockFormatter implements OutputFormatter {
  private breadcrumbGenerator: BreadcrumbGenerator;

  constructor(breadcrumbGenerator?: BreadcrumbGenerator) {
    this.breadcrumbGenerator = breadcrumbGenerator || new DefaultBreadcrumbGenerator();
  }

  /**
   * Format ranked directives into a structured markdown context block
   */
  async formatContextBlock(
    directives: RankedDirective[],
    context: TaskContext,
    options: FormattingOptions = {}
  ): Promise<string> {
    if (directives.length === 0) {
      return this.formatEmptyContext(context);
    }

    const sections: string[] = [];
    
    // Add header with context information
    sections.push(this.formatHeader(context, directives.length));
    
    // Group directives by severity if requested
    if (options.groupBySeverity) {
      sections.push(this.formatDirectivesBySeverity(directives, options));
    } else {
      sections.push(this.formatDirectivesByRank(directives, options));
    }
    
    // Add breadcrumbs if requested
    if (options.includeBreadcrumbs) {
      sections.push(this.formatBreadcrumbs(directives));
    }

    return sections.filter(section => section.trim()).join('\n\n');
  }

  /**
   * Generate citations for the returned directives
   */
  async generateCitations(directives: RankedDirective[]): Promise<Citation[]> {
    const citationMap = new Map<string, Citation>();
    
    for (const directive of directives) {
      const key = `${directive.ruleId}-${directive.section}`;
      if (!citationMap.has(key)) {
        citationMap.set(key, {
          ruleId: directive.ruleId,
          ruleName: this.extractRuleName(directive.ruleId),
          section: directive.section,
          sourcePath: this.extractSourcePath(directive.ruleId),
          layer: this.extractLayer(directive.ruleId),
          topics: directive.topics
        });
      }
    }
    
    return Array.from(citationMap.values());
  }

  /**
   * Create diagnostic information about the query
   */
  async createDiagnostics(
    queryInfo: QueryInfo,
    context: TaskContext,
    directives: RankedDirective[]
  ): Promise<QueryDiagnostics> {
    const queryTime = queryInfo.endTime.getTime() - queryInfo.startTime.getTime();
    
    return {
      queryTime,
      contextDetectionTime: queryInfo.contextDetectionTime,
      rankingTime: queryInfo.rankingTime,
      totalDirectives: queryInfo.totalDirectivesConsidered,
      returnedDirectives: directives.length,
      confidence: context.confidence,
      modelProvider: queryInfo.modelProvider,
      fallbackUsed: queryInfo.fallbackUsed
    };
  }

  /**
   * Format individual directive for display
   */
  formatDirective(directive: RankedDirective, options: DirectiveFormattingOptions = {}): string {
    const parts: string[] = [];
    
    // Severity indicator
    if (options.showSeverity !== false) {
      const severityIcon = this.getSeverityIcon(directive.severity);
      parts.push(`${severityIcon} **${directive.severity}**`);
    }
    
    // Main directive text
    parts.push(directive.text);
    
    // Additional information sections
    const additionalSections: string[] = [];
    
    if (options.includeRationale && directive.rationale) {
      additionalSections.push(`*Rationale*: ${directive.rationale}`);
    }
    
    if (options.includeExample && directive.example) {
      additionalSections.push(`*Example*:\n\`\`\`\n${directive.example}\n\`\`\``);
    }
    
    if (options.includeAntiPattern && directive.antiPattern) {
      additionalSections.push(`*Anti-pattern*:\n\`\`\`\n${directive.antiPattern}\n\`\`\``);
    }
    
    if (options.showSource !== false) {
      const source = `${this.extractRuleName(directive.ruleId)} → ${directive.section}`;
      additionalSections.push(`*Source*: ${source}`);
    }
    
    if (options.showTopics && directive.topics.length > 0) {
      additionalSections.push(`*Topics*: ${directive.topics.join(', ')}`);
    }
    
    if (options.showScore) {
      additionalSections.push(`*Score*: ${directive.score.toFixed(2)}`);
    }
    
    if (additionalSections.length > 0) {
      parts.push('\n' + additionalSections.join('\n'));
    }
    
    return parts.join(' ');
  }

  private formatHeader(context: TaskContext, directiveCount: number): string {
    const layerName = context.layer === '*' ? 'Cross-layer' : context.layer;
    const topicsText = context.topics.length > 0 ? ` | Topics: ${context.topics.join(', ')}` : '';
    const confidenceText = `${Math.round(context.confidence * 100)}%`;
    
    return `## 📋 Project Context\n\n` +
           `**Layer**: ${layerName}${topicsText}\n` +
           `**Confidence**: ${confidenceText} | **Directives**: ${directiveCount}`;
  }

  private formatEmptyContext(context: TaskContext): string {
    return `## 📋 Project Context\n\n` +
           `**Layer**: ${context.layer}\n` +
           `**Status**: No specific directives found for this context.\n\n` +
           `*Consider following general best practices for ${context.layer} layer development.*`;
  }

  private formatDirectivesBySeverity(directives: RankedDirective[], options: FormattingOptions): string {
    const sections: string[] = [];
    const severityGroups = this.groupBySeverity(directives);
    
    for (const severity of ['MUST', 'SHOULD', 'MAY'] as DirectiveSeverity[]) {
      const group = severityGroups.get(severity);
      if (group && group.length > 0) {
        sections.push(this.formatSeveritySection(severity, group, options));
      }
    }
    
    return sections.join('\n\n');
  }

  private formatDirectivesByRank(directives: RankedDirective[], options: FormattingOptions): string {
    const sections: string[] = [];
    
    sections.push('### 🎯 Relevant Directives\n');
    
    directives.forEach((directive, index) => {
      const formattedDirective = this.formatDirective(directive, {
        showSeverity: true,
        showSource: true,
        includeRationale: options.includeRationale,
        includeExample: options.includeExamples,
        includeAntiPattern: options.includeAntiPatterns,
        showScore: options.showScores
      });
      
      sections.push(`${index + 1}. ${formattedDirective}`);
    });
    
    return sections.join('\n\n');
  }

  private formatSeveritySection(
    severity: DirectiveSeverity, 
    directives: RankedDirective[], 
    options: FormattingOptions
  ): string {
    const icon = this.getSeverityIcon(severity);
    const title = `### ${icon} ${severity} Requirements`;
    const items: string[] = [title, ''];
    
    directives.forEach((directive, index) => {
      const formattedDirective = this.formatDirective(directive, {
        showSeverity: false, // Already shown in section header
        showSource: true,
        includeRationale: options.includeRationale,
        includeExample: options.includeExamples,
        includeAntiPattern: options.includeAntiPatterns,
        showScore: options.showScores
      });
      
      items.push(`${index + 1}. ${formattedDirective}`);
    });
    
    return items.join('\n');
  }

  private formatBreadcrumbs(directives: RankedDirective[]): string {
    const navigation = this.breadcrumbGenerator.createNavigationStructure(directives);
    
    if (navigation.length === 0) {
      return '';
    }
    
    const sections: string[] = ['### 🗂️ Source Navigation\n'];
    
    navigation.forEach(node => {
      sections.push(this.formatNavigationNode(node, 0));
    });
    
    return sections.join('\n');
  }

  private formatNavigationNode(node: NavigationNode, depth: number): string {
    const indent = '  '.repeat(depth);
    const bullet = depth === 0 ? '-' : '*';
    let result = `${indent}${bullet} **${node.name}** (${node.directiveCount})\n`;
    
    node.children.forEach(child => {
      result += this.formatNavigationNode(child, depth + 1);
    });
    
    return result;
  }

  private groupBySeverity(directives: RankedDirective[]): Map<DirectiveSeverity, RankedDirective[]> {
    const groups = new Map<DirectiveSeverity, RankedDirective[]>();
    
    for (const directive of directives) {
      if (!groups.has(directive.severity)) {
        groups.set(directive.severity, []);
      }
      groups.get(directive.severity)!.push(directive);
    }
    
    return groups;
  }

  private getSeverityIcon(severity: DirectiveSeverity): string {
    switch (severity) {
      case 'MUST': return '🔴';
      case 'SHOULD': return '🟡';
      case 'MAY': return '🟢';
      default: return '⚪';
    }
  }

  private extractRuleName(ruleId: string): string {
    // Extract rule name from ID (implementation depends on ID format)
    return ruleId.split('-').map(part => 
      part.charAt(0).toUpperCase() + part.slice(1)
    ).join(' ');
  }

  private extractSourcePath(ruleId: string): string {
    // This would typically come from the rule metadata
    return `rules/${ruleId}.md`;
  }

  private extractLayer(ruleId: string): any {
    // This would typically come from the rule metadata
    return '*'; // Default to cross-layer
  }
}

/**
 * Default implementation of breadcrumb generator
 */
export class DefaultBreadcrumbGenerator implements BreadcrumbGenerator {
  generateBreadcrumb(directive: RankedDirective): string {
    const ruleName = this.extractRuleName(directive.ruleId);
    return `${ruleName} → ${directive.section}`;
  }

  createNavigationStructure(directives: RankedDirective[]): NavigationNode[] {
    const ruleGroups = new Map<string, RankedDirective[]>();
    
    // Group directives by rule
    for (const directive of directives) {
      if (!ruleGroups.has(directive.ruleId)) {
        ruleGroups.set(directive.ruleId, []);
      }
      ruleGroups.get(directive.ruleId)!.push(directive);
    }
    
    // Create navigation nodes
    const nodes: NavigationNode[] = [];
    
    for (const [ruleId, ruleDirectives] of ruleGroups) {
      const ruleName = this.extractRuleName(ruleId);
      const sectionGroups = new Map<string, RankedDirective[]>();
      
      // Group by section within rule
      for (const directive of ruleDirectives) {
        if (!sectionGroups.has(directive.section)) {
          sectionGroups.set(directive.section, []);
        }
        sectionGroups.get(directive.section)!.push(directive);
      }
      
      // Create section children
      const children: NavigationNode[] = [];
      for (const [section, sectionDirectives] of sectionGroups) {
        children.push({
          name: section,
          path: `${ruleId}#${section}`,
          children: [],
          directiveCount: sectionDirectives.length
        });
      }
      
      nodes.push({
        name: ruleName,
        path: ruleId,
        children,
        directiveCount: ruleDirectives.length
      });
    }
    
    return nodes;
  }

  private extractRuleName(ruleId: string): string {
    return ruleId.split('-').map(part => 
      part.charAt(0).toUpperCase() + part.slice(1)
    ).join(' ');
  }
}