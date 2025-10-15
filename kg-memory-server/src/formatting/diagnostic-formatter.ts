import { 
  QueryDiagnostics, 
  TaskContext, 
  RankedDirective,
  ErrorType 
} from '../types.js';
import { QueryInfo } from '../interfaces/output-formatter.js';

/**
 * Formats diagnostic information for query performance and debugging
 */
export class DiagnosticFormatter {
  
  /**
   * Create comprehensive diagnostics for a query execution
   */
  createQueryDiagnostics(
    queryInfo: QueryInfo,
    context: TaskContext,
    directives: RankedDirective[]
  ): QueryDiagnostics {
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
   * Format diagnostics as a readable markdown section
   */
  formatDiagnosticsAsMarkdown(diagnostics: QueryDiagnostics): string {
    const sections: string[] = [];
    
    sections.push('### 🔍 Query Diagnostics\n');
    
    // Performance metrics
    sections.push('**Performance:**');
    sections.push(`- Total Query Time: ${diagnostics.queryTime}ms`);
    sections.push(`- Context Detection: ${diagnostics.contextDetectionTime}ms`);
    sections.push(`- Ranking: ${diagnostics.rankingTime}ms`);
    
    // Retrieval statistics
    sections.push('\n**Retrieval:**');
    sections.push(`- Directives Considered: ${diagnostics.totalDirectives}`);
    sections.push(`- Directives Returned: ${diagnostics.returnedDirectives}`);
    sections.push(`- Selection Rate: ${this.calculateSelectionRate(diagnostics)}%`);
    
    // Context information
    sections.push('\n**Context:**');
    sections.push(`- Detection Confidence: ${Math.round(diagnostics.confidence * 100)}%`);
    sections.push(`- Model Provider: ${diagnostics.modelProvider || 'None'}`);
    sections.push(`- Fallback Used: ${diagnostics.fallbackUsed ? 'Yes' : 'No'}`);
    
    return sections.join('\n');
  }

  /**
   * Create performance metrics summary
   */
  createPerformanceMetrics(diagnostics: QueryDiagnostics): PerformanceMetrics {
    return {
      totalTime: diagnostics.queryTime,
      contextDetectionTime: diagnostics.contextDetectionTime,
      rankingTime: diagnostics.rankingTime,
      formattingTime: diagnostics.queryTime - diagnostics.contextDetectionTime - diagnostics.rankingTime,
      throughput: this.calculateThroughput(diagnostics),
      efficiency: this.calculateEfficiency(diagnostics)
    };
  }

  /**
   * Create retrieval statistics
   */
  createRetrievalStatistics(diagnostics: QueryDiagnostics): RetrievalStatistics {
    return {
      totalDirectives: diagnostics.totalDirectives,
      returnedDirectives: diagnostics.returnedDirectives,
      selectionRate: this.calculateSelectionRate(diagnostics),
      confidence: diagnostics.confidence,
      modelProvider: diagnostics.modelProvider,
      fallbackUsed: diagnostics.fallbackUsed
    };
  }

  /**
   * Create debugging information for context detection
   */
  createContextDebuggingInfo(
    context: TaskContext,
    detectionSteps: ContextDetectionStep[]
  ): ContextDebuggingInfo {
    return {
      detectedLayer: context.layer,
      detectedTopics: context.topics,
      detectedKeywords: context.keywords,
      detectedTechnologies: context.technologies,
      confidence: context.confidence,
      detectionSteps,
      layerConfidenceBreakdown: this.createLayerConfidenceBreakdown(detectionSteps),
      topicConfidenceBreakdown: this.createTopicConfidenceBreakdown(detectionSteps)
    };
  }

  /**
   * Format debugging information as markdown
   */
  formatDebuggingInfoAsMarkdown(debugInfo: ContextDebuggingInfo): string {
    const sections: string[] = [];
    
    sections.push('### 🐛 Context Detection Debug\n');
    
    // Detection results
    sections.push('**Detection Results:**');
    sections.push(`- Layer: ${debugInfo.detectedLayer} (${Math.round(debugInfo.confidence * 100)}%)`);
    sections.push(`- Topics: ${debugInfo.detectedTopics.join(', ')}`);
    sections.push(`- Keywords: ${debugInfo.detectedKeywords.join(', ')}`);
    sections.push(`- Technologies: ${debugInfo.detectedTechnologies.join(', ')}`);
    
    // Detection steps
    if (debugInfo.detectionSteps.length > 0) {
      sections.push('\n**Detection Steps:**');
      debugInfo.detectionSteps.forEach((step, index) => {
        sections.push(`${index + 1}. ${step.description} (${step.confidence.toFixed(2)})`);
        if (step.evidence.length > 0) {
          sections.push(`   Evidence: ${step.evidence.join(', ')}`);
        }
      });
    }
    
    // Confidence breakdowns
    if (Object.keys(debugInfo.layerConfidenceBreakdown).length > 0) {
      sections.push('\n**Layer Confidence Breakdown:**');
      Object.entries(debugInfo.layerConfidenceBreakdown)
        .sort(([,a], [,b]) => b - a)
        .forEach(([layer, confidence]) => {
          sections.push(`- ${layer}: ${(confidence * 100).toFixed(1)}%`);
        });
    }
    
    return sections.join('\n');
  }

  /**
   * Create error diagnostics for failed queries
   */
  createErrorDiagnostics(
    error: ErrorType,
    message: string,
    context?: Partial<TaskContext>,
    fallbackUsed: boolean = false
  ): ErrorDiagnostics {
    return {
      errorType: error,
      message,
      timestamp: new Date(),
      context,
      fallbackUsed,
      suggestions: this.generateErrorSuggestions(error)
    };
  }

  /**
   * Format error diagnostics as markdown
   */
  formatErrorDiagnosticsAsMarkdown(errorDiag: ErrorDiagnostics): string {
    const sections: string[] = [];
    
    sections.push('### ❌ Error Diagnostics\n');
    
    sections.push(`**Error Type:** ${errorDiag.errorType}`);
    sections.push(`**Message:** ${errorDiag.message}`);
    sections.push(`**Timestamp:** ${errorDiag.timestamp.toISOString()}`);
    sections.push(`**Fallback Used:** ${errorDiag.fallbackUsed ? 'Yes' : 'No'}`);
    
    if (errorDiag.context) {
      sections.push('\n**Context:**');
      if (errorDiag.context.layer) {
        sections.push(`- Layer: ${errorDiag.context.layer}`);
      }
      if (errorDiag.context.topics && errorDiag.context.topics.length > 0) {
        sections.push(`- Topics: ${errorDiag.context.topics.join(', ')}`);
      }
    }
    
    if (errorDiag.suggestions.length > 0) {
      sections.push('\n**Suggestions:**');
      errorDiag.suggestions.forEach(suggestion => {
        sections.push(`- ${suggestion}`);
      });
    }
    
    return sections.join('\n');
  }

  private calculateSelectionRate(diagnostics: QueryDiagnostics): number {
    if (diagnostics.totalDirectives === 0) return 0;
    return Math.round((diagnostics.returnedDirectives / diagnostics.totalDirectives) * 100);
  }

  private calculateThroughput(diagnostics: QueryDiagnostics): number {
    if (diagnostics.queryTime === 0) return 0;
    return Math.round((diagnostics.totalDirectives / diagnostics.queryTime) * 1000); // directives per second
  }

  private calculateEfficiency(diagnostics: QueryDiagnostics): number {
    const selectionRate = this.calculateSelectionRate(diagnostics);
    const timeEfficiency = Math.max(0, 100 - (diagnostics.queryTime / 4)); // Penalty for slow queries (400ms = 0% efficiency)
    return Math.round((selectionRate + timeEfficiency) / 2);
  }

  private createLayerConfidenceBreakdown(steps: ContextDetectionStep[]): Record<string, number> {
    const breakdown: Record<string, number> = {};
    
    steps.forEach(step => {
      if (step.layerScores) {
        Object.entries(step.layerScores).forEach(([layer, score]) => {
          breakdown[layer] = Math.max(breakdown[layer] || 0, score);
        });
      }
    });
    
    return breakdown;
  }

  private createTopicConfidenceBreakdown(steps: ContextDetectionStep[]): Record<string, number> {
    const breakdown: Record<string, number> = {};
    
    steps.forEach(step => {
      if (step.topicScores) {
        Object.entries(step.topicScores).forEach(([topic, score]) => {
          breakdown[topic] = Math.max(breakdown[topic] || 0, score);
        });
      }
    });
    
    return breakdown;
  }

  private generateErrorSuggestions(errorType: ErrorType): string[] {
    switch (errorType) {
      case ErrorType.MODEL_PROVIDER_UNAVAILABLE:
        return [
          'Check your internet connection',
          'Verify API keys are configured correctly',
          'Try switching to a different model provider',
          'Enable rule-based fallback for offline operation'
        ];
      
      case ErrorType.KNOWLEDGE_GRAPH_UNAVAILABLE:
        return [
          'Check database connection',
          'Verify rule documents have been ingested',
          'Try re-initializing the knowledge graph',
          'Check file permissions for the database'
        ];
      
      case ErrorType.INVALID_RULE_FORMAT:
        return [
          'Validate rule document markdown format',
          'Check required metadata sections are present',
          'Verify directive syntax follows MUST/SHOULD/MAY pattern',
          'Review rule document examples'
        ];
      
      case ErrorType.QUERY_TIMEOUT:
        return [
          'Reduce the scope of your query',
          'Enable caching for better performance',
          'Consider using a faster model provider',
          'Increase the query timeout limit'
        ];
      
      case ErrorType.INSUFFICIENT_CONTEXT:
        return [
          'Provide more detailed task description',
          'Include specific technologies or frameworks',
          'Mention the architectural layer explicitly',
          'Add relevant keywords to improve detection'
        ];
      
      default:
        return ['Contact support for assistance'];
    }
  }
}

// Supporting interfaces for diagnostic information

export interface PerformanceMetrics {
  totalTime: number;
  contextDetectionTime: number;
  rankingTime: number;
  formattingTime: number;
  throughput: number; // directives per second
  efficiency: number; // 0-100 score
}

export interface RetrievalStatistics {
  totalDirectives: number;
  returnedDirectives: number;
  selectionRate: number; // percentage
  confidence: number;
  modelProvider?: string;
  fallbackUsed: boolean;
}

export interface ContextDetectionStep {
  description: string;
  confidence: number;
  evidence: string[];
  layerScores?: Record<string, number>;
  topicScores?: Record<string, number>;
}

export interface ContextDebuggingInfo {
  detectedLayer: string;
  detectedTopics: string[];
  detectedKeywords: string[];
  detectedTechnologies: string[];
  confidence: number;
  detectionSteps: ContextDetectionStep[];
  layerConfidenceBreakdown: Record<string, number>;
  topicConfidenceBreakdown: Record<string, number>;
}

export interface ErrorDiagnostics {
  errorType: ErrorType;
  message: string;
  timestamp: Date;
  context?: Partial<TaskContext>;
  fallbackUsed: boolean;
  suggestions: string[];
}