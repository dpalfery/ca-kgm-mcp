import { 
  ErrorType, 
  ErrorResponse, 
  QueryDirectivesOutput, 
  DetectContextOutput, 
  UpsertMarkdownOutput 
} from '../types.js';

/**
 * Centralized error handling and fallback mechanisms for MCP tools
 * Implements graceful degradation strategies
 */
export class MCPErrorHandler {
  private static readonly FALLBACK_TIMEOUT = 5000; // 5 seconds
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY = 1000; // 1 second

  /**
   * Handle errors with appropriate fallback strategies
   */
  static async handleError<T>(
    error: any,
    operation: string,
    fallbackFn?: () => Promise<T> | T
  ): Promise<T | ErrorResponse> {
    const errorType = this.classifyError(error);
    const errorMessage = this.extractErrorMessage(error);

    console.error(`Error in ${operation}:`, {
      type: errorType,
      message: errorMessage,
      stack: error?.stack
    });

    // Try fallback if available
    if (fallbackFn) {
      try {
        const result = await this.executeWithTimeout(fallbackFn, this.FALLBACK_TIMEOUT);
        return result;
      } catch (fallbackError) {
        console.error(`Fallback failed for ${operation}:`, fallbackError);
      }
    }

    // Return error response
    return this.createErrorResponse(errorType, errorMessage, operation);
  }

  /**
   * Execute operation with retry logic
   */
  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = this.MAX_RETRIES,
    delay: number = this.RETRY_DELAY
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        // Don't retry on certain error types
        if (this.isNonRetryableError(error)) {
          throw error;
        }

        if (attempt < maxRetries) {
          console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms:`, error);
          await this.sleep(delay);
          delay *= 2; // Exponential backoff
        }
      }
    }

    throw lastError;
  }

  /**
   * Execute operation with timeout
   */
  static async executeWithTimeout<T>(
    operation: () => Promise<T> | T,
    timeoutMs: number
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      Promise.resolve(operation())
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Create fallback response for query_directives
   */
  static createQueryDirectivesFallback(
    taskDescription: string,
    errorType: ErrorType
  ): QueryDirectivesOutput {
    const fallbackContext = this.createFallbackContextBlock(taskDescription, errorType);
    
    return {
      context_block: fallbackContext,
      citations: [],
      diagnostics: {
        queryTime: 0,
        contextDetectionTime: 0,
        rankingTime: 0,
        totalDirectives: 0,
        returnedDirectives: 0,
        confidence: 0.1,
        modelProvider: undefined,
        fallbackUsed: true
      }
    };
  }

  /**
   * Create fallback response for detect_context
   */
  static createDetectContextFallback(
    text: string,
    includeKeywords?: boolean
  ): DetectContextOutput {
    const basicDetection = this.performBasicContextDetection(text);
    
    return {
      detectedLayer: basicDetection.layer,
      topics: basicDetection.topics,
      keywords: includeKeywords ? basicDetection.keywords : undefined,
      confidence: 0.1
    };
  }

  /**
   * Create fallback response for upsert_markdown
   */
  static createUpsertMarkdownFallback(
    errorMessage: string
  ): UpsertMarkdownOutput {
    return {
      upserted: {
        rulesProcessed: 0,
        directivesExtracted: 0,
        entitiesCreated: 0,
        relationsCreated: 0,
        warnings: [errorMessage]
      },
      relations: 0,
      warnings: [errorMessage]
    };
  }

  /**
   * Classify error type for appropriate handling
   */
  private static classifyError(error: any): ErrorType {
    const message = this.extractErrorMessage(error).toLowerCase();

    if (message.includes('timeout') || message.includes('timed out')) {
      return ErrorType.QUERY_TIMEOUT;
    }

    if (message.includes('model') || message.includes('provider') || message.includes('api')) {
      return ErrorType.MODEL_PROVIDER_UNAVAILABLE;
    }

    if (message.includes('database') || message.includes('knowledge graph') || message.includes('storage')) {
      return ErrorType.KNOWLEDGE_GRAPH_UNAVAILABLE;
    }

    if (message.includes('format') || message.includes('parse') || message.includes('invalid')) {
      return ErrorType.INVALID_RULE_FORMAT;
    }

    return ErrorType.INSUFFICIENT_CONTEXT;
  }

  /**
   * Extract meaningful error message
   */
  private static extractErrorMessage(error: any): string {
    if (typeof error === 'string') {
      return error;
    }

    if (error instanceof Error) {
      return error.message;
    }

    if (error?.message) {
      return error.message;
    }

    return 'Unknown error occurred';
  }

  /**
   * Check if error should not be retried
   */
  private static isNonRetryableError(error: any): boolean {
    const message = this.extractErrorMessage(error).toLowerCase();
    
    // Don't retry validation errors, format errors, etc.
    const nonRetryablePatterns = [
      'validation',
      'invalid',
      'format',
      'parse',
      'unauthorized',
      'forbidden',
      'not found'
    ];

    return nonRetryablePatterns.some(pattern => message.includes(pattern));
  }

  /**
   * Create error response object
   */
  private static createErrorResponse(
    errorType: ErrorType,
    message: string,
    operation: string
  ): ErrorResponse {
    const suggestions = this.getSuggestions(errorType, operation);

    return {
      error: errorType,
      message: `${operation}: ${message}`,
      fallbackUsed: true,
      suggestions
    };
  }

  /**
   * Get suggestions based on error type
   */
  private static getSuggestions(errorType: ErrorType, operation: string): string[] {
    switch (errorType) {
      case ErrorType.MODEL_PROVIDER_UNAVAILABLE:
        return [
          'Check model provider configuration',
          'Verify API keys and network connectivity',
          'Consider using rule-based fallback mode'
        ];

      case ErrorType.KNOWLEDGE_GRAPH_UNAVAILABLE:
        return [
          'Check database connection and permissions',
          'Verify knowledge graph initialization',
          'Consider rebuilding the knowledge graph'
        ];

      case ErrorType.QUERY_TIMEOUT:
        return [
          'Reduce query complexity or scope',
          'Check system performance and load',
          'Consider increasing timeout limits'
        ];

      case ErrorType.INVALID_RULE_FORMAT:
        return [
          'Validate rule document format',
          'Check markdown syntax and structure',
          'Review rule document schema requirements'
        ];

      case ErrorType.INSUFFICIENT_CONTEXT:
        return [
          'Provide more detailed task description',
          'Check input parameters and format',
          'Consider using detect_context tool first'
        ];

      default:
        return [
          'Check system logs for detailed error information',
          'Verify system configuration and dependencies',
          'Contact system administrator if problem persists'
        ];
    }
  }

  /**
   * Create fallback context block for query_directives
   */
  private static createFallbackContextBlock(
    taskDescription: string,
    errorType: ErrorType
  ): string {
    const baseRules = this.getBaselineRules(taskDescription);
    const statusMessage = this.getStatusMessage(errorType);
    
    return `## 📋 Project Context (Fallback Mode)\n\n` +
           `**Status**: ${statusMessage}\n` +
           `**Task**: ${taskDescription}\n\n` +
           `### 🔴 Essential Guidelines\n\n` +
           baseRules.map((rule, index) => `${index + 1}. ${rule}`).join('\n\n') +
           `\n\n*Note: This is a fallback response. Full context detection and rule retrieval are temporarily unavailable.*`;
  }

  /**
   * Get status message based on error type
   */
  private static getStatusMessage(errorType: ErrorType): string {
    switch (errorType) {
      case ErrorType.MODEL_PROVIDER_UNAVAILABLE:
        return 'Model provider unavailable, using rule-based fallback';
      case ErrorType.KNOWLEDGE_GRAPH_UNAVAILABLE:
        return 'Knowledge graph unavailable, using baseline rules';
      case ErrorType.QUERY_TIMEOUT:
        return 'Query timed out, providing essential guidelines';
      default:
        return 'Limited context available due to system limitations';
    }
  }

  /**
   * Get baseline rules for fallback scenarios
   */
  private static getBaselineRules(taskDescription: string): string[] {
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
   * Perform basic context detection as fallback
   */
  private static performBasicContextDetection(text: string): {
    layer: any;
    topics: string[];
    keywords: string[];
  } {
    const lowerText = text.toLowerCase();
    const words = lowerText.split(/\s+/);
    
    // Basic layer detection using keywords
    let layer: any = "*";
    
    const layerKeywords = {
      "1-Presentation": ["ui", "component", "react", "vue", "angular", "frontend", "css", "html", "interface", "view"],
      "2-Application": ["service", "controller", "api", "endpoint", "route", "middleware", "business", "logic"],
      "3-Domain": ["model", "entity", "domain", "business", "rule", "validation", "aggregate", "value"],
      "4-Persistence": ["database", "repository", "sql", "query", "storage", "data", "orm", "migration"],
      "5-Infrastructure": ["deploy", "config", "docker", "kubernetes", "aws", "cloud", "infrastructure", "devops"]
    };

    let maxMatches = 0;
    for (const [layerName, keywords] of Object.entries(layerKeywords)) {
      const matches = keywords.filter(keyword => lowerText.includes(keyword)).length;
      if (matches > maxMatches) {
        maxMatches = matches;
        layer = layerName;
      }
    }

    // Basic topic extraction
    const topicKeywords = {
      "security": ["auth", "security", "login", "password", "token", "jwt", "oauth", "permission"],
      "api": ["api", "rest", "graphql", "endpoint", "request", "response", "http"],
      "database": ["database", "sql", "query", "table", "index", "migration", "schema"],
      "testing": ["test", "spec", "mock", "unit", "integration", "e2e", "jest", "vitest"],
      "performance": ["performance", "optimize", "cache", "speed", "latency", "memory"],
      "error-handling": ["error", "exception", "try", "catch", "throw", "handle", "fail"],
      "logging": ["log", "debug", "trace", "monitor", "audit", "event"],
      "validation": ["validate", "check", "verify", "sanitize", "clean", "format"]
    };

    const topics: string[] = [];
    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        topics.push(topic);
      }
    }

    // Extract potential keywords (simple approach)
    const technicalWords = words.filter(word => 
      word.length > 3 && 
      /^[a-z]+$/.test(word) &&
      !['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use'].includes(word)
    );

    const keywords = [...new Set(technicalWords)].slice(0, 10); // Limit to 10 unique keywords

    return {
      layer,
      topics,
      keywords
    };
  }

  /**
   * Sleep utility for retry delays
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Circuit breaker for preventing cascade failures
   */
  static createCircuitBreaker<T>(
    operation: () => Promise<T>,
    options: {
      failureThreshold: number;
      resetTimeout: number;
      monitoringPeriod: number;
    } = {
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      monitoringPeriod: 300000 // 5 minutes
    }
  ): () => Promise<T> {
    let failures = 0;
    let lastFailureTime = 0;
    let state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

    return async (): Promise<T> => {
      const now = Date.now();

      // Reset failure count if monitoring period has passed
      if (now - lastFailureTime > options.monitoringPeriod) {
        failures = 0;
        state = 'CLOSED';
      }

      // Check circuit breaker state
      if (state === 'OPEN') {
        if (now - lastFailureTime > options.resetTimeout) {
          state = 'HALF_OPEN';
        } else {
          throw new Error('Circuit breaker is OPEN - operation temporarily unavailable');
        }
      }

      try {
        const result = await operation();
        
        // Success - reset circuit breaker
        if (state === 'HALF_OPEN') {
          state = 'CLOSED';
          failures = 0;
        }
        
        return result;

      } catch (error) {
        failures++;
        lastFailureTime = now;

        if (failures >= options.failureThreshold) {
          state = 'OPEN';
        }

        throw error;
      }
    };
  }
}