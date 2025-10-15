import { describe, it, expect, beforeEach } from 'vitest';
import { ContextBlockFormatter, DefaultBreadcrumbGenerator } from '../context-block-formatter.js';
import { 
  RankedDirective, 
  TaskContext, 
  DirectiveSeverity,
  Citation,
  QueryDiagnostics 
} from '../../types.js';
import { QueryInfo, FormattingOptions } from '../../interfaces/output-formatter.js';

describe('ContextBlockFormatter', () => {
  let formatter: ContextBlockFormatter;
  let mockContext: TaskContext;
  let mockDirectives: RankedDirective[];
  let mockQueryInfo: QueryInfo;

  beforeEach(() => {
    formatter = new ContextBlockFormatter();
    
    mockContext = {
      layer: '2-Application',
      topics: ['security', 'validation'],
      keywords: ['authentication', 'input'],
      technologies: ['Node.js', 'Express'],
      confidence: 0.85
    };

    mockDirectives = [
      {
        id: 'dir-1',
        ruleId: 'security-auth',
        section: 'Authentication',
        severity: 'MUST' as DirectiveSeverity,
        text: 'All API endpoints must validate authentication tokens',
        rationale: 'Prevents unauthorized access to protected resources',
        example: 'app.use(authenticateToken);',
        antiPattern: 'app.get("/api/data", (req, res) => { /* no auth */ });',
        topics: ['security', 'authentication'],
        whenToApply: ['API endpoints', 'protected routes'],
        score: 95.5,
        scoreBreakdown: {
          authority: 10,
          layerMatch: 8,
          topicOverlap: 9,
          severityBoost: 10,
          semanticSimilarity: 7,
          whenToApply: 8
        }
      },
      {
        id: 'dir-2',
        ruleId: 'validation-input',
        section: 'Input Validation',
        severity: 'SHOULD' as DirectiveSeverity,
        text: 'Input parameters should be validated using a schema',
        rationale: 'Improves data quality and prevents injection attacks',
        topics: ['validation', 'security'],
        whenToApply: ['user input', 'API parameters'],
        score: 78.2,
        scoreBreakdown: {
          authority: 8,
          layerMatch: 7,
          topicOverlap: 8,
          severityBoost: 6,
          semanticSimilarity: 6,
          whenToApply: 7
        }
      },
      {
        id: 'dir-3',
        ruleId: 'logging-debug',
        section: 'Debugging',
        severity: 'MAY' as DirectiveSeverity,
        text: 'Consider adding debug logging for troubleshooting',
        topics: ['logging', 'debugging'],
        whenToApply: ['complex operations', 'error handling'],
        score: 45.1,
        scoreBreakdown: {
          authority: 5,
          layerMatch: 6,
          topicOverlap: 3,
          severityBoost: 2,
          semanticSimilarity: 4,
          whenToApply: 5
        }
      }
    ];

    mockQueryInfo = {
      startTime: new Date('2024-01-01T10:00:00Z'),
      endTime: new Date('2024-01-01T10:00:00.250Z'),
      contextDetectionTime: 50,
      rankingTime: 100,
      formattingTime: 25,
      totalDirectivesConsidered: 25,
      modelProvider: 'openai',
      fallbackUsed: false,
      cacheHit: false
    };
  });

  describe('formatContextBlock', () => {
    it('should format a complete context block with directives', async () => {
      const result = await formatter.formatContextBlock(mockDirectives, mockContext);
      
      expect(result).toContain('## 📋 Project Context');
      expect(result).toContain('**Layer**: 2-Application');
      expect(result).toContain('Topics: security, validation');
      expect(result).toContain('**Confidence**: 85%');
      expect(result).toContain('**Directives**: 3');
      expect(result).toContain('### 🎯 Relevant Directives');
      expect(result).toContain('🔴 **MUST**');
      expect(result).toContain('🟡 **SHOULD**');
      expect(result).toContain('🟢 **MAY**');
    });

    it('should handle empty directives list', async () => {
      const result = await formatter.formatContextBlock([], mockContext);
      
      expect(result).toContain('## 📋 Project Context');
      expect(result).toContain('**Status**: No specific directives found');
      expect(result).toContain('Consider following general best practices');
    });

    it('should group by severity when requested', async () => {
      const options: FormattingOptions = { groupBySeverity: true };
      const result = await formatter.formatContextBlock(mockDirectives, mockContext, options);
      
      expect(result).toContain('### 🔴 MUST Requirements');
      expect(result).toContain('### 🟡 SHOULD Requirements');
      expect(result).toContain('### 🟢 MAY Requirements');
    });

    it('should include breadcrumbs when requested', async () => {
      const options: FormattingOptions = { includeBreadcrumbs: true };
      const result = await formatter.formatContextBlock(mockDirectives, mockContext, options);
      
      expect(result).toContain('### 🗂️ Source Navigation');
    });

    it('should include examples and rationale when requested', async () => {
      const options: FormattingOptions = { 
        includeExamples: true, 
        includeRationale: true,
        includeAntiPatterns: true
      };
      const result = await formatter.formatContextBlock(mockDirectives, mockContext, options);
      
      expect(result).toContain('*Rationale*: Prevents unauthorized access');
      expect(result).toContain('*Example*:');
      expect(result).toContain('app.use(authenticateToken);');
      expect(result).toContain('*Anti-pattern*:');
    });

    it('should show scores when requested', async () => {
      const options: FormattingOptions = { showScores: true };
      const result = await formatter.formatContextBlock(mockDirectives, mockContext, options);
      
      expect(result).toContain('*Score*: 95.50');
      expect(result).toContain('*Score*: 78.20');
    });
  });

  describe('formatDirective', () => {
    it('should format a basic directive', () => {
      const result = formatter.formatDirective(mockDirectives[0]);
      
      expect(result).toContain('🔴 **MUST**');
      expect(result).toContain('All API endpoints must validate authentication tokens');
      expect(result).toContain('*Source*: Security Auth → Authentication');
    });

    it('should include optional sections when requested', () => {
      const options = {
        includeRationale: true,
        includeExample: true,
        includeAntiPattern: true,
        showTopics: true,
        showScore: true
      };
      
      const result = formatter.formatDirective(mockDirectives[0], options);
      
      expect(result).toContain('*Rationale*: Prevents unauthorized access');
      expect(result).toContain('*Example*:');
      expect(result).toContain('*Anti-pattern*:');
      expect(result).toContain('*Topics*: security, authentication');
      expect(result).toContain('*Score*: 95.50');
    });

    it('should hide severity when requested', () => {
      const options = { showSeverity: false };
      const result = formatter.formatDirective(mockDirectives[0], options);
      
      expect(result).not.toContain('🔴 **MUST**');
      expect(result).toContain('All API endpoints must validate authentication tokens');
    });
  });

  describe('generateCitations', () => {
    it('should generate unique citations for directives', async () => {
      const citations = await formatter.generateCitations(mockDirectives);
      
      expect(citations).toHaveLength(3);
      expect(citations[0]).toMatchObject({
        ruleId: 'security-auth',
        section: 'Authentication',
        topics: ['security', 'authentication']
      });
    });

    it('should deduplicate citations from same rule and section', async () => {
      const duplicateDirectives = [
        mockDirectives[0],
        { ...mockDirectives[0], id: 'dir-1-duplicate' }
      ];
      
      const citations = await formatter.generateCitations(duplicateDirectives);
      
      expect(citations).toHaveLength(1);
    });
  });

  describe('createDiagnostics', () => {
    it('should create comprehensive diagnostics', async () => {
      const diagnostics = await formatter.createDiagnostics(
        mockQueryInfo, 
        mockContext, 
        mockDirectives
      );
      
      expect(diagnostics).toMatchObject({
        queryTime: 250,
        contextDetectionTime: 50,
        rankingTime: 100,
        totalDirectives: 25,
        returnedDirectives: 3,
        confidence: 0.85,
        modelProvider: 'openai',
        fallbackUsed: false
      });
    });
  });
});

describe('DefaultBreadcrumbGenerator', () => {
  let generator: DefaultBreadcrumbGenerator;
  let mockDirectives: RankedDirective[];

  beforeEach(() => {
    generator = new DefaultBreadcrumbGenerator();
    
    mockDirectives = [
      {
        id: 'dir-1',
        ruleId: 'security-auth',
        section: 'Authentication',
        severity: 'MUST' as DirectiveSeverity,
        text: 'Validate tokens',
        topics: [],
        whenToApply: [],
        score: 95,
        scoreBreakdown: {
          authority: 10, layerMatch: 8, topicOverlap: 9,
          severityBoost: 10, semanticSimilarity: 7, whenToApply: 8
        }
      },
      {
        id: 'dir-2',
        ruleId: 'security-auth',
        section: 'Authorization',
        severity: 'MUST' as DirectiveSeverity,
        text: 'Check permissions',
        topics: [],
        whenToApply: [],
        score: 90,
        scoreBreakdown: {
          authority: 9, layerMatch: 8, topicOverlap: 8,
          severityBoost: 10, semanticSimilarity: 6, whenToApply: 7
        }
      },
      {
        id: 'dir-3',
        ruleId: 'validation-input',
        section: 'Sanitization',
        severity: 'SHOULD' as DirectiveSeverity,
        text: 'Sanitize input',
        topics: [],
        whenToApply: [],
        score: 75,
        scoreBreakdown: {
          authority: 8, layerMatch: 7, topicOverlap: 7,
          severityBoost: 6, semanticSimilarity: 5, whenToApply: 6
        }
      }
    ];
  });

  describe('generateBreadcrumb', () => {
    it('should generate a breadcrumb for a directive', () => {
      const breadcrumb = generator.generateBreadcrumb(mockDirectives[0]);
      
      expect(breadcrumb).toBe('Security Auth → Authentication');
    });
  });

  describe('createNavigationStructure', () => {
    it('should create hierarchical navigation structure', () => {
      const navigation = generator.createNavigationStructure(mockDirectives);
      
      expect(navigation).toHaveLength(2); // Two rules
      
      const securityRule = navigation.find(n => n.name === 'Security Auth');
      expect(securityRule).toBeDefined();
      expect(securityRule!.children).toHaveLength(2); // Two sections
      expect(securityRule!.directiveCount).toBe(2);
      
      const validationRule = navigation.find(n => n.name === 'Validation Input');
      expect(validationRule).toBeDefined();
      expect(validationRule!.children).toHaveLength(1); // One section
      expect(validationRule!.directiveCount).toBe(1);
    });

    it('should handle empty directives list', () => {
      const navigation = generator.createNavigationStructure([]);
      
      expect(navigation).toHaveLength(0);
    });
  });
});