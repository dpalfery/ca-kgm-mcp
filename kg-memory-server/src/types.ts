// Core types for the Knowledge Graph Memory system

export type ArchitecturalLayer = 
  | "1-Presentation" 
  | "2-Application" 
  | "3-Domain" 
  | "4-Persistence" 
  | "5-Infrastructure" 
  | "*";

export type DirectiveSeverity = "MUST" | "SHOULD" | "MAY";

export interface TaskContext {
  layer: ArchitecturalLayer;
  topics: string[];
  keywords: string[];
  technologies: string[];
  confidence: number;
}

export interface DetectionOptions {
  returnKeywords?: boolean;
  strictLayer?: boolean;
}

export interface RankingOptions {
  maxItems?: number;
  tokenBudget?: number;
  includeBreadcrumbs?: boolean;
}

export interface QueryDiagnostics {
  queryTime: number;
  contextDetectionTime: number;
  rankingTime: number;
  totalDirectives: number;
  returnedDirectives: number;
  confidence: number;
  modelProvider?: string;
  fallbackUsed: boolean;
  cacheHit?: boolean;
}

export interface Citation {
  ruleId: string;
  ruleName: string;
  section: string;
  sourcePath: string;
  layer: ArchitecturalLayer;
  topics: string[];
}

export interface IngestionStats {
  rulesProcessed: number;
  directivesExtracted: number;
  entitiesCreated: number;
  relationsCreated: number;
  warnings: string[];
}

// Rule-specific entities extending the base knowledge graph
export interface Rule {
  id: string;
  name: string;
  layer: ArchitecturalLayer;
  authoritativeFor: string[];
  topics: string[];
  sourcePath: string;
  lastUpdated: Date;
}

export interface Directive {
  id: string;
  ruleId: string;
  section: string;
  severity: DirectiveSeverity;
  text: string;
  rationale?: string;
  example?: string;
  antiPattern?: string;
  topics: string[];
  whenToApply: string[];
  embedding?: number[];
}

export interface RuleRelationship {
  from: string;
  to: string;
  type: "CONTAINS" | "AUTHORITATIVE_FOR" | "APPLIES_TO" | "RELATED_TO";
  weight?: number;
}

export interface RankedDirective extends Directive {
  score: number;
  scoreBreakdown: {
    authority: number;
    layerMatch: number;
    topicOverlap: number;
    severityBoost: number;
    semanticSimilarity: number;
    whenToApply: number;
  };
}

// MCP Tool interfaces
export interface QueryDirectivesInput {
  taskDescription: string;
  modeSlug?: "architect" | "code" | "debug";
  options?: RankingOptions;
}

export interface QueryDirectivesOutput {
  context_block: string;
  citations: Citation[];
  diagnostics: QueryDiagnostics;
}

export interface DetectContextInput {
  text: string;
  options?: DetectionOptions;
}

export interface DetectContextOutput {
  detectedLayer: ArchitecturalLayer;
  topics: string[];
  keywords?: string[];
  confidence: number;
}

export interface UpsertMarkdownInput {
  documents: { path: string }[];
  options?: { overwrite?: boolean };
}

export interface UpsertMarkdownOutput {
  upserted: IngestionStats;
  relations: number;
  warnings: string[];
}

// Model Provider interfaces
export interface ModelProvider {
  name: string;
  type: "local" | "cloud" | "rule-based";
  isAvailable(): Promise<boolean>;
  detectContext(text: string): Promise<TaskContext>;
  generateEmbedding?(text: string): Promise<number[]>;
}

export interface ModelProviderConfig {
  type: "local" | "cloud" | "rule-based";
  provider: string;
  config: Record<string, any>;
}

// Error handling
export enum ErrorType {
  MODEL_PROVIDER_UNAVAILABLE = "model_provider_unavailable",
  KNOWLEDGE_GRAPH_UNAVAILABLE = "knowledge_graph_unavailable", 
  INVALID_RULE_FORMAT = "invalid_rule_format",
  QUERY_TIMEOUT = "query_timeout",
  INSUFFICIENT_CONTEXT = "insufficient_context"
}

export interface ErrorResponse {
  error: ErrorType;
  message: string;
  fallbackUsed: boolean;
  suggestions?: string[];
}