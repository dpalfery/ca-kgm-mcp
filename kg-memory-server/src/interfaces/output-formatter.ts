import { RankedDirective, Citation, QueryDiagnostics, TaskContext } from '../types.js';

/**
 * Interface for formatting query results into structured output
 * for consumption by AI coding assistants
 */
export interface OutputFormatter {
  /**
   * Format ranked directives into a structured context block
   */
  formatContextBlock(
    directives: RankedDirective[],
    context: TaskContext,
    options: FormattingOptions
  ): Promise<string>;
  
  /**
   * Generate citations for the returned directives
   */
  generateCitations(directives: RankedDirective[]): Promise<Citation[]>;
  
  /**
   * Create diagnostic information about the query
   */
  createDiagnostics(
    queryInfo: QueryInfo,
    context: TaskContext,
    directives: RankedDirective[]
  ): Promise<QueryDiagnostics>;
  
  /**
   * Format individual directive for display
   */
  formatDirective(directive: RankedDirective, options: DirectiveFormattingOptions): string;
}

/**
 * Options for controlling output formatting
 */
export interface FormattingOptions {
  includeBreadcrumbs?: boolean;
  includeExamples?: boolean;
  includeAntiPatterns?: boolean;
  includeRationale?: boolean;
  maxLineLength?: number;
  indentLevel?: number;
  groupBySeverity?: boolean;
  showScores?: boolean;
}

/**
 * Options for formatting individual directives
 */
export interface DirectiveFormattingOptions {
  showSeverity?: boolean;
  showSource?: boolean;
  showTopics?: boolean;
  showScore?: boolean;
  includeExample?: boolean;
  includeAntiPattern?: boolean;
  includeRationale?: boolean;
}

/**
 * Information about the query execution for diagnostics
 */
export interface QueryInfo {
  startTime: Date;
  endTime: Date;
  contextDetectionTime: number;
  rankingTime: number;
  formattingTime: number;
  totalDirectivesConsidered: number;
  modelProvider?: string;
  fallbackUsed: boolean;
  cacheHit?: boolean;
}

/**
 * Interface for creating breadcrumb navigation in context blocks
 */
export interface BreadcrumbGenerator {
  /**
   * Generate breadcrumb path for a directive
   */
  generateBreadcrumb(directive: RankedDirective): string;
  
  /**
   * Create hierarchical navigation structure
   */
  createNavigationStructure(directives: RankedDirective[]): NavigationNode[];
}

/**
 * Navigation node for hierarchical structure
 */
export interface NavigationNode {
  name: string;
  path: string;
  children: NavigationNode[];
  directiveCount: number;
}

/**
 * Template engine for customizable output formats
 */
export interface TemplateEngine {
  /**
   * Render context block using a template
   */
  renderTemplate(
    templateName: string,
    data: TemplateData
  ): Promise<string>;
  
  /**
   * Register a custom template
   */
  registerTemplate(name: string, template: string): void;
  
  /**
   * Get available templates
   */
  getAvailableTemplates(): string[];
}

/**
 * Data passed to templates for rendering
 */
export interface TemplateData {
  directives: RankedDirective[];
  context: TaskContext;
  citations: Citation[];
  diagnostics: QueryDiagnostics;
  metadata: Record<string, any>;
}