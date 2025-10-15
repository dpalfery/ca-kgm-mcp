import { 
  QueryDirectivesInput, 
  QueryDirectivesOutput, 
  TaskContext, 
  RankedDirective,
  QueryDiagnostics,
  ErrorType
} from '../types.js';
import { ContextDetectionEngine } from '../context-detection/context-detection-engine.js';
import { DirectiveRankingEngine } from '../ranking/directive-ranking-engine.js';
import { ContextBlockFormatter } from '../formatting/context-block-formatter.js';
import { RuleKnowledgeGraph } from '../interfaces/knowledge-graph.js';
import { ModelProviderManager } from '../interfaces/model-provider.js';
import { CacheManager } from '../cache/cache-manager.js';
import { PerformanceMonitor } from '../performance/performance-monitor.js';

/**
 * MCP tool for querying relevant directives based on task context
 * Integrates context detection, ranking, and formatting pipeline
 */
export class QueryDirectivesTool {
  private contextDetectionEngine: ContextDetectionEngine;
  private rankingEngine: DirectiveRankingEngine;
  private formatter: ContextBlockFormatter;
  private knowledgeGraph: RuleKnowledgeGraph;
  private cacheManager: CacheManager;
  private performanceMonitor: PerformanceMonitor;

  constructor(
    modelProviderManager: ModelProviderManager,
    knowledgeGraph: RuleKnowledgeGraph,
    cacheManager?: CacheManager,
    performanceMonitor?: PerformanceMonitor
  ) {
    this.contextDetectionEngine = new ContextDetectionEngine(modelProviderManager);
    this.rankingEngine = new DirectiveRankingEngine();
    this.formatter = new ContextBlockFormatter();
    this.knowledgeGraph = knowledgeGraph;
    this.cacheManager = cacheManager || new CacheManager();
    this.performanceMonitor = performanceMonitor || new PerformanceMonitor();
  }

  /**
   * Execute the query_directives tool
   */
  async execute(input: QueryDirectivesInput): Promise<QueryDirectivesOutput> {
    const queryId = this.performanceMonitor.startQuery('query_directives', {
      taskDescription: input.taskDescription,
      modeSlug: input.modeSlug,
      options: input.options
    });

    const startTime = new Date();
    let contextDetectionTime = 0;
    let rankingTime = 0;
    let fallbackUsed = false;
    let modelProvider: string | undefined;
    let cacheHit = false;

    try {
      // Validate input
      this.validateInput(input);

      // Check cache first
      const cachedResult = this.cacheManager.getCachedDirectiveQuery(
        input.taskDescription,
        input.modeSlug,
        input.options
      );

      if (cachedResult) {
        cacheHit = true;
        this.performanceMonitor.recordCacheAccess(true, 'directives');
        this.performanceMonitor.endQuery(queryId, true);
        
        // Update diagnostics to indicate cache hit
        cachedResult.diagnostics.queryTime = Date.now() - startTime.getTime();
        cachedResult.diagnostics.cacheHit = true;
        return cachedResult;
      }

      this.performanceMonitor.recordCacheAccess(false, 'directives');

      // Step 1: Detect context from task description
      const contextStart = Date.now();
      const contextResult = await this.contextDetectionEngine.detectContext(
        input.taskDescription,
        {
          returnKeywords: true
        }
      );
      contextDetectionTime = Date.now() - contextStart;
      
      const context: TaskContext = {
        layer: contextResult.layer,
        topics: contextResult.topics,
        keywords: contextResult.keywords,
        technologies: contextResult.technologies,
        confidence: contextResult.confidence
      };

      fallbackUsed = contextResult.diagnostics.fallbackUsed;
      modelProvider = contextResult.diagnostics.modelProvider;

      // Step 2: Query candidate directives from knowledge graph
      const candidates = await this.queryCandidateDirectives(context, input.modeSlug);

      // Step 3: Rank directives based on context
      const rankingStart = Date.now();
      const rankedDirectives = await this.rankingEngine.rankDirectives(
        candidates,
        context,
        {
          maxItems: input.options?.maxItems,
          tokenBudget: input.options?.tokenBudget,
          includeBreadcrumbs: input.options?.includeBreadcrumbs
        }
      );
      rankingTime = Date.now() - rankingStart;

      // Step 4: Format output
      const contextBlock = await this.formatter.formatContextBlock(
        rankedDirectives,
        context,
        {
          groupBySeverity: true,
          includeRationale: true,
          includeExamples: false,
          includeBreadcrumbs: input.options?.includeBreadcrumbs
        }
      );

      // Step 5: Generate citations
      const citations = await this.formatter.generateCitations(rankedDirectives);

      // Step 6: Create diagnostics
      const endTime = new Date();
      const diagnostics: QueryDiagnostics = {
        queryTime: endTime.getTime() - startTime.getTime(),
        contextDetectionTime,
        rankingTime,
        totalDirectives: candidates.length,
        returnedDirectives: rankedDirectives.length,
        confidence: context.confidence,
        modelProvider,
        fallbackUsed,
        cacheHit
      };

      const result = {
        context_block: contextBlock,
        citations,
        diagnostics
      };

      // Cache the result for future queries
      this.cacheManager.cacheDirectiveQuery(
        input.taskDescription,
        input.modeSlug,
        input.options,
        result
      );

      this.performanceMonitor.endQuery(queryId, true);
      return result;

    } catch (error) {
      // Handle errors gracefully with fallback
      this.performanceMonitor.endQuery(queryId, false, error instanceof Error ? error.message : 'Unknown error');
      return this.handleError(error, input, startTime);
    }
  }

  /**
   * Validate input parameters
   */
  private validateInput(input: QueryDirectivesInput): void {
    if (!input.taskDescription || typeof input.taskDescription !== 'string') {
      throw new Error('taskDescription is required and must be a string');
    }

    if (input.taskDescription.trim().length === 0) {
      throw new Error('taskDescription cannot be empty');
    }

    if (input.modeSlug && !['architect', 'code', 'debug'].includes(input.modeSlug)) {
      throw new Error('modeSlug must be one of: architect, code, debug');
    }

    if (input.options?.maxItems && (input.options.maxItems < 1 || input.options.maxItems > 100)) {
      throw new Error('maxItems must be between 1 and 100');
    }

    if (input.options?.tokenBudget && (input.options.tokenBudget < 100 || input.options.tokenBudget > 10000)) {
      throw new Error('tokenBudget must be between 100 and 10000');
    }
  }

  /**
   * Query candidate directives from the knowledge graph
   */
  private async queryCandidateDirectives(
    context: TaskContext, 
    modeSlug?: string
  ): Promise<RankedDirective[]> {
    const criteria = {
      layers: context.layer === '*' ? undefined : [context.layer],
      topics: context.topics.length > 0 ? context.topics : undefined,
      limit: 500 // Reasonable limit for ranking performance
    };

    // Adjust criteria based on mode
    if (modeSlug === 'architect') {
      // Focus on architectural and design directives
      criteria.topics = [...(criteria.topics || []), 'architecture', 'design', 'patterns'];
    } else if (modeSlug === 'debug') {
      // Focus on debugging, testing, and error handling
      criteria.topics = [...(criteria.topics || []), 'debugging', 'testing', 'error-handling', 'logging'];
    }

    const directives = await this.knowledgeGraph.queryDirectives(criteria);
    
    // Convert to RankedDirective format (score will be set by ranking engine)
    return directives.map(directive => ({
      ...directive,
      score: 0,
      scoreBreakdown: {
        authority: 0,
        layerMatch: 0,
        topicOverlap: 0,
        severityBoost: 0,
        semanticSimilarity: 0,
        whenToApply: 0
      }
    }));
  }

  /**
   * Handle errors with graceful fallback
   */
  private async handleError(
    error: any, 
    input: QueryDirectivesInput, 
    startTime: Date
  ): Promise<QueryDirectivesOutput> {
    console.error('Error in query_directives tool:', error);

    // Determine error type
    let errorType: ErrorType;
    let fallbackContext: string;

    if (error.message?.includes('model provider') || error.message?.includes('context detection')) {
      errorType = ErrorType.MODEL_PROVIDER_UNAVAILABLE;
      fallbackContext = this.createFallbackContext(input.taskDescription, 'model_unavailable');
    } else if (error.message?.includes('knowledge graph') || error.message?.includes('database')) {
      errorType = ErrorType.KNOWLEDGE_GRAPH_UNAVAILABLE;
      fallbackContext = this.createFallbackContext(input.taskDescription, 'graph_unavailable');
    } else if (error.message?.includes('timeout')) {
      errorType = ErrorType.QUERY_TIMEOUT;
      fallbackContext = this.createFallbackContext(input.taskDescription, 'timeout');
    } else {
      errorType = ErrorType.INSUFFICIENT_CONTEXT;
      fallbackContext = this.createFallbackContext(input.taskDescription, 'general_error');
    }

    const endTime = new Date();
    const diagnostics: QueryDiagnostics = {
      queryTime: endTime.getTime() - startTime.getTime(),
      contextDetectionTime: 0,
      rankingTime: 0,
      totalDirectives: 0,
      returnedDirectives: 0,
      confidence: 0.1,
      modelProvider: undefined,
      fallbackUsed: true
    };

    return {
      context_block: fallbackContext,
      citations: [],
      diagnostics
    };
  }

  /**
   * Create fallback context when system is unavailable
   */
  private createFallbackContext(taskDescription: string, errorType: string): string {
    const baseRules = this.getBaselineRules(taskDescription);
    
    return `## 📋 Project Context (Fallback Mode)\n\n` +
           `**Status**: Limited context available due to system limitations\n` +
           `**Task**: ${taskDescription}\n\n` +
           `### 🔴 Essential Guidelines\n\n` +
           baseRules.map((rule, index) => `${index + 1}. ${rule}`).join('\n\n') +
           `\n\n*Note: This is a fallback response. Full context detection and rule retrieval are temporarily unavailable.*`;
  }

  /**
   * Get baseline rules for fallback scenarios
   */
  private getBaselineRules(taskDescription: string): string[] {
    const rules: string[] = [];
    const lowerTask = taskDescription.toLowerCase();

    // Security rules (always applicable)
    rules.push('**MUST** Validate all user inputs and sanitize data before processing');
    rules.push('**MUST** Use parameterized queries for database operations to prevent SQL injection');
    rules.push('**MUST** Implement proper error handling without exposing sensitive information');

    // Layer-specific rules based on keywords
    if (lowerTask.includes('api') || lowerTask.includes('endpoint') || lowerTask.includes('route')) {
      rules.push('**MUST** Implement proper authentication and authorization for API endpoints');
      rules.push('**SHOULD** Use consistent HTTP status codes and response formats');
    }

    if (lowerTask.includes('database') || lowerTask.includes('data') || lowerTask.includes('model')) {
      rules.push('**MUST** Use transactions for multi-step database operations');
      rules.push('**SHOULD** Implement proper indexing for query performance');
    }

    if (lowerTask.includes('ui') || lowerTask.includes('component') || lowerTask.includes('interface')) {
      rules.push('**MUST** Ensure accessibility compliance (WCAG 2.1 AA)');
      rules.push('**SHOULD** Implement responsive design for multiple screen sizes');
    }

    // General quality rules
    rules.push('**SHOULD** Write unit tests for core functionality');
    rules.push('**SHOULD** Follow consistent code formatting and naming conventions');
    rules.push('**MAY** Add comprehensive documentation for complex logic');

    return rules;
  }

  /**
   * Get tool schema for MCP server registration
   */
  static getToolSchema() {
    return {
      name: "query_directives",
      description: "Query relevant project directives and guidelines based on task context. Returns structured context block with ranked directives, citations, and diagnostic information.",
      inputSchema: {
        type: "object",
        properties: {
          taskDescription: {
            type: "string",
            description: "Description of the coding task or feature being implemented"
          },
          modeSlug: {
            type: "string",
            enum: ["architect", "code", "debug"],
            description: "Optional mode to focus on specific types of directives"
          },
          options: {
            type: "object",
            properties: {
              strictLayer: {
                type: "boolean",
                description: "Whether to strictly match architectural layer (default: false)"
              },
              maxItems: {
                type: "number",
                minimum: 1,
                maximum: 100,
                description: "Maximum number of directives to return (default: 20)"
              },
              tokenBudget: {
                type: "number",
                minimum: 100,
                maximum: 10000,
                description: "Maximum token budget for the response"
              },
              includeBreadcrumbs: {
                type: "boolean",
                description: "Whether to include source navigation breadcrumbs (default: false)"
              }
            },
            additionalProperties: false
          }
        },
        required: ["taskDescription"],
        additionalProperties: false
      }
    };
  }
}