import { describe, it, expect, beforeEach } from 'vitest';
import { 
  DiagnosticFormatter,
  PerformanceMetrics,
  RetrievalStatistics,
  ContextDetectionStep,
  ContextDebuggingInfo,
  ErrorDiagnostics
} from '../diagnostic-formatter.js';
import { 
  QueryDiagnostics, 
  TaskContext, 
  RankedDirective,
  ErrorType,
  DirectiveSeverity 
} from '../../types.js';
import { QueryInfo } from '../../interfaces/output-formatter.js';

describe('DiagnosticFormatter', () => {
  let formatter: DiagnosticFormatter;
  let mockQueryInfo: QueryInfo;
  let mockContext: TaskContext;
  let mockDirectives: RankedDirective[];

  beforeEach(() => {
    formatter = new DiagnosticFormatter();
    
    mockQueryInfo = {
      startTime: new Date('2024-01-01T10:00:00.000Z'),
      endTime: new Date('2024-01-01T10:00:00.350Z'),
      contextDetectionTime: 100,
      rankingTime: 150,
      formattingTime: 50,
      totalDirectivesConsidered: 50,
      modelProvider: 'openai',
      fallbackUsed: false,
      cacheHit: false
    };

    mockContext = {
      layer: '2-Application',
      topics: ['security', 'validation'],
      keywords: ['authentication', 'input'],
      technologies: ['Node.js', 'Express'],
      confidence: 0.82
    };

    mockDirectives = [
      {
        id: 'dir-1',
        ruleId: 'security-auth',
        section: 'Authentication',
        severity: 'MUST' as DirectiveSeverity,
        text: 'Validate authentication tokens',
        topics: ['security'],
        whenToApply: ['API endpoints'],
        score: 95.5,
        scoreBreakdown: {
          authority: 10, layerMatch: 8, topicOverlap: 9,
          severityBoost: 10, semanticSimilarity: 7, whenToApply: 8
        }
      },
      {
        id: 'dir-2',
        ruleId: 'validation-input',
        section: 'Input Validation',
        severity: 'SHOULD' as DirectiveSeverity,
        text: 'Validate input parameters',
        topics: ['validation'],
        whenToApply: ['user input'],
        score: 78.2,
        scoreBreakdown: {
          authority: 8, layerMatch: 7, topicOverlap: 8,
          severityBoost: 6, semanticSimilarity: 6, whenToApply: 7
        }
      }
    ];
  });

  describe('createQueryDiagnostics', () => {
    it('should create comprehensive query diagnostics', () => {
      const diagnostics = formatter.createQueryDiagnostics(
        mockQueryInfo,
        mockContext,
        mockDirectives
      );

      expect(diagnostics).toEqual({
        queryTime: 350,
        contextDetectionTime: 100,
        rankingTime: 150,
        totalDirectives: 50,
        returnedDirectives: 2,
        confidence: 0.82,
        modelProvider: 'openai',
        fallbackUsed: false
      });
    });

    it('should handle fallback scenarios', () => {
      const fallbackQueryInfo = { ...mockQueryInfo, fallbackUsed: true, modelProvider: undefined };
      
      const diagnostics = formatter.createQueryDiagnostics(
        fallbackQueryInfo,
        mockContext,
        mockDirectives
      );

      expect(diagnostics.fallbackUsed).toBe(true);
      expect(diagnostics.modelProvider).toBeUndefined();
    });
  });

  describe('formatDiagnosticsAsMarkdown', () => {
    it('should format diagnostics as readable markdown', () => {
      const diagnostics: QueryDiagnostics = {
        queryTime: 350,
        contextDetectionTime: 100,
        rankingTime: 150,
        totalDirectives: 50,
        returnedDirectives: 2,
        confidence: 0.82,
        modelProvider: 'openai',
        fallbackUsed: false
      };

      const result = formatter.formatDiagnosticsAsMarkdown(diagnostics);

      expect(result).toContain('### 🔍 Query Diagnostics');
      expect(result).toContain('**Performance:**');
      expect(result).toContain('- Total Query Time: 350ms');
      expect(result).toContain('- Context Detection: 100ms');
      expect(result).toContain('- Ranking: 150ms');
      expect(result).toContain('**Retrieval:**');
      expect(result).toContain('- Directives Considered: 50');
      expect(result).toContain('- Directives Returned: 2');
      expect(result).toContain('- Selection Rate: 4%');
      expect(result).toContain('**Context:**');
      expect(result).toContain('- Detection Confidence: 82%');
      expect(result).toContain('- Model Provider: openai');
      expect(result).toContain('- Fallback Used: No');
    });

    it('should handle missing model provider', () => {
      const diagnostics: QueryDiagnostics = {
        queryTime: 200,
        contextDetectionTime: 50,
        rankingTime: 100,
        totalDirectives: 10,
        returnedDirectives: 3,
        confidence: 0.75,
        fallbackUsed: true
      };

      const result = formatter.formatDiagnosticsAsMarkdown(diagnostics);

      expect(result).toContain('- Model Provider: None');
      expect(result).toContain('- Fallback Used: Yes');
    });
  });

  describe('createPerformanceMetrics', () => {
    it('should calculate performance metrics correctly', () => {
      const diagnostics: QueryDiagnostics = {
        queryTime: 400,
        contextDetectionTime: 100,
        rankingTime: 200,
        totalDirectives: 100,
        returnedDirectives: 5,
        confidence: 0.9,
        modelProvider: 'openai',
        fallbackUsed: false
      };

      const metrics = formatter.createPerformanceMetrics(diagnostics);

      expect(metrics.totalTime).toBe(400);
      expect(metrics.contextDetectionTime).toBe(100);
      expect(metrics.rankingTime).toBe(200);
      expect(metrics.formattingTime).toBe(100); // 400 - 100 - 200
      expect(metrics.throughput).toBe(250); // (100 / 400) * 1000
      expect(metrics.efficiency).toBe(3); // (5% selection + 0% time efficiency) / 2 with new formula
    });

    it('should handle zero query time', () => {
      const diagnostics: QueryDiagnostics = {
        queryTime: 0,
        contextDetectionTime: 0,
        rankingTime: 0,
        totalDirectives: 10,
        returnedDirectives: 2,
        confidence: 0.8,
        fallbackUsed: false
      };

      const metrics = formatter.createPerformanceMetrics(diagnostics);

      expect(metrics.throughput).toBe(0);
      expect(metrics.efficiency).toBe(60); // (20% selection + 100% time efficiency) / 2
    });
  });

  describe('createRetrievalStatistics', () => {
    it('should create retrieval statistics', () => {
      const diagnostics: QueryDiagnostics = {
        queryTime: 300,
        contextDetectionTime: 80,
        rankingTime: 120,
        totalDirectives: 25,
        returnedDirectives: 5,
        confidence: 0.88,
        modelProvider: 'anthropic',
        fallbackUsed: false
      };

      const stats = formatter.createRetrievalStatistics(diagnostics);

      expect(stats).toEqual({
        totalDirectives: 25,
        returnedDirectives: 5,
        selectionRate: 20,
        confidence: 0.88,
        modelProvider: 'anthropic',
        fallbackUsed: false
      });
    });
  });

  describe('createContextDebuggingInfo', () => {
    it('should create comprehensive debugging information', () => {
      const detectionSteps: ContextDetectionStep[] = [
        {
          description: 'Keyword analysis',
          confidence: 0.7,
          evidence: ['authentication', 'API'],
          layerScores: {
            '1-Presentation': 0.2,
            '2-Application': 0.8,
            '3-Domain': 0.3
          },
          topicScores: {
            'security': 0.9,
            'validation': 0.6
          }
        },
        {
          description: 'Model-based classification',
          confidence: 0.9,
          evidence: ['Express middleware pattern'],
          layerScores: {
            '2-Application': 0.95
          }
        }
      ];

      const debugInfo = formatter.createContextDebuggingInfo(mockContext, detectionSteps);

      expect(debugInfo.detectedLayer).toBe('2-Application');
      expect(debugInfo.detectedTopics).toEqual(['security', 'validation']);
      expect(debugInfo.confidence).toBe(0.82);
      expect(debugInfo.detectionSteps).toHaveLength(2);
      expect(debugInfo.layerConfidenceBreakdown).toEqual({
        '1-Presentation': 0.2,
        '2-Application': 0.95, // Max of 0.8 and 0.95
        '3-Domain': 0.3
      });
      expect(debugInfo.topicConfidenceBreakdown).toEqual({
        'security': 0.9,
        'validation': 0.6
      });
    });
  });

  describe('formatDebuggingInfoAsMarkdown', () => {
    it('should format debugging info as markdown', () => {
      const debugInfo: ContextDebuggingInfo = {
        detectedLayer: '2-Application',
        detectedTopics: ['security', 'validation'],
        detectedKeywords: ['auth', 'token'],
        detectedTechnologies: ['Express'],
        confidence: 0.85,
        detectionSteps: [
          {
            description: 'Keyword matching',
            confidence: 0.8,
            evidence: ['auth', 'middleware']
          }
        ],
        layerConfidenceBreakdown: {
          '2-Application': 0.85,
          '1-Presentation': 0.15
        },
        topicConfidenceBreakdown: {
          'security': 0.9,
          'validation': 0.7
        }
      };

      const result = formatter.formatDebuggingInfoAsMarkdown(debugInfo);

      expect(result).toContain('### 🐛 Context Detection Debug');
      expect(result).toContain('**Detection Results:**');
      expect(result).toContain('- Layer: 2-Application (85%)');
      expect(result).toContain('- Topics: security, validation');
      expect(result).toContain('- Keywords: auth, token');
      expect(result).toContain('- Technologies: Express');
      expect(result).toContain('**Detection Steps:**');
      expect(result).toContain('1. Keyword matching (0.80)');
      expect(result).toContain('Evidence: auth, middleware');
      expect(result).toContain('**Layer Confidence Breakdown:**');
      expect(result).toContain('- 2-Application: 85.0%');
      expect(result).toContain('- 1-Presentation: 15.0%');
    });
  });

  describe('createErrorDiagnostics', () => {
    it('should create error diagnostics with suggestions', () => {
      const errorDiag = formatter.createErrorDiagnostics(
        ErrorType.MODEL_PROVIDER_UNAVAILABLE,
        'OpenAI API key not configured',
        { layer: '2-Application', topics: ['security'] },
        true
      );

      expect(errorDiag.errorType).toBe(ErrorType.MODEL_PROVIDER_UNAVAILABLE);
      expect(errorDiag.message).toBe('OpenAI API key not configured');
      expect(errorDiag.fallbackUsed).toBe(true);
      expect(errorDiag.context).toEqual({ layer: '2-Application', topics: ['security'] });
      expect(errorDiag.suggestions).toContain('Check your internet connection');
      expect(errorDiag.suggestions).toContain('Verify API keys are configured correctly');
    });

    it('should generate appropriate suggestions for different error types', () => {
      const knowledgeGraphError = formatter.createErrorDiagnostics(
        ErrorType.KNOWLEDGE_GRAPH_UNAVAILABLE,
        'Database connection failed'
      );

      expect(knowledgeGraphError.suggestions).toContain('Check database connection');
      expect(knowledgeGraphError.suggestions).toContain('Verify rule documents have been ingested');

      const timeoutError = formatter.createErrorDiagnostics(
        ErrorType.QUERY_TIMEOUT,
        'Query exceeded 400ms limit'
      );

      expect(timeoutError.suggestions).toContain('Reduce the scope of your query');
      expect(timeoutError.suggestions).toContain('Enable caching for better performance');
    });
  });

  describe('formatErrorDiagnosticsAsMarkdown', () => {
    it('should format error diagnostics as markdown', () => {
      const errorDiag: ErrorDiagnostics = {
        errorType: ErrorType.INSUFFICIENT_CONTEXT,
        message: 'Could not determine architectural layer',
        timestamp: new Date('2024-01-01T12:00:00Z'),
        context: {
          layer: '*',
          topics: [],
          keywords: ['test'],
          technologies: [],
          confidence: 0.1
        },
        fallbackUsed: true,
        suggestions: [
          'Provide more detailed task description',
          'Include specific technologies or frameworks'
        ]
      };

      const result = formatter.formatErrorDiagnosticsAsMarkdown(errorDiag);

      expect(result).toContain('### ❌ Error Diagnostics');
      expect(result).toContain('**Error Type:** insufficient_context');
      expect(result).toContain('**Message:** Could not determine architectural layer');
      expect(result).toContain('**Timestamp:** 2024-01-01T12:00:00.000Z');
      expect(result).toContain('**Fallback Used:** Yes');
      expect(result).toContain('**Context:**');
      expect(result).toContain('- Layer: *');
      expect(result).toContain('**Suggestions:**');
      expect(result).toContain('- Provide more detailed task description');
      expect(result).toContain('- Include specific technologies or frameworks');
    });
  });
});