// Output formatting system exports

export { 
  ContextBlockFormatter, 
  DefaultBreadcrumbGenerator 
} from './context-block-formatter.js';

export { 
  DiagnosticFormatter,
  type PerformanceMetrics,
  type RetrievalStatistics,
  type ContextDetectionStep,
  type ContextDebuggingInfo,
  type ErrorDiagnostics
} from './diagnostic-formatter.js';

export { 
  SimpleTemplateEngine, 
  TemplateEngineFactory 
} from './template-engine.js';

// Re-export interfaces for convenience
export type {
  OutputFormatter,
  FormattingOptions,
  DirectiveFormattingOptions,
  QueryInfo,
  BreadcrumbGenerator,
  NavigationNode,
  TemplateEngine,
  TemplateData
} from '../interfaces/output-formatter.js';