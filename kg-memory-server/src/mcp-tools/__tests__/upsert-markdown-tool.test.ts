import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UpsertMarkdownTool } from '../upsert-markdown-tool.js';
import { UpsertMarkdownInput } from '../../types.js';
import { RuleKnowledgeGraphImpl } from '../../storage/rule-knowledge-graph.js';
import { RuleDocumentParser } from '../../parsers/rule-document-parser.js';

/**
 * Unit tests for UpsertMarkdownTool
 */
describe('UpsertMarkdownTool', () => {
  let tool: UpsertMarkdownTool;
  let mockParser: RuleDocumentParser;
  let mockKnowledgeGraph: RuleKnowledgeGraphImpl;

  const sampleRuleDocument = `# Security Guidelines

## Metadata
- **Layer**: *
- **AuthoritativeFor**: [security, authentication]
- **Topics**: [API, validation, authentication]

## When to Apply
- Creating new API endpoints
- Handling user input

## Directives

### Input Validation
**MUST** Validate all user inputs before processing

**Rationale**: Prevents injection attacks and data corruption

### Authentication
**SHOULD** Use JWT tokens for stateless authentication
`;

  beforeEach(() => {
    // Create mocks
    mockParser = {
      parseRuleDocument: vi.fn(),
      validateRuleDocument: vi.fn(),
      extractMetadata: vi.fn()
    } as any;

    mockKnowledgeGraph = {
      batchUpsert: vi.fn(),
      incrementalUpdate: vi.fn(),
      getRules: vi.fn(),
      getRuleStats: vi.fn()
    } as any;

    tool = new UpsertMarkdownTool(mockParser, mockKnowledgeGraph);
  });

  describe('Input Validation', () => {
    it('should reject empty documents array', async () => {
      const input: UpsertMarkdownInput = {
        documents: []
      };

      const result = await tool.execute(input);

      expect(result.upserted.rulesProcessed).toBe(0);
      expect(result.warnings).toContain('documents array cannot be empty');
    });

    it('should reject non-array documents', async () => {
      const input: UpsertMarkdownInput = {
        documents: null as any
      };

      const result = await tool.execute(input);

      expect(result.upserted.rulesProcessed).toBe(0);
      expect(result.warnings.some(w => w.includes('must be an array'))).toBe(true);
    });

    it('should reject too many documents', async () => {
      const input: UpsertMarkdownInput = {
        documents: Array.from({ length: 101 }, (_, i) => ({ path: `doc${i}.md` }))
      };

      const result = await tool.execute(input);

      expect(result.upserted.rulesProcessed).toBe(0);
      expect(result.warnings.some(w => w.includes('more than 100 documents'))).toBe(true);
    });

    it('should reject documents without path', async () => {
      const input: UpsertMarkdownInput = {
        documents: [{ path: null as any }]
      };

      const result = await tool.execute(input);

      expect(result.upserted.rulesProcessed).toBe(0);
      expect(result.warnings.some(w => w.includes('valid path string'))).toBe(true);
    });

    it('should reject non-markdown files', async () => {
      const input: UpsertMarkdownInput = {
        documents: [{ path: 'document.txt' }]
      };

      const result = await tool.execute(input);

      expect(result.upserted.rulesProcessed).toBe(0);
      expect(result.warnings.some(w => w.includes('markdown files (.md)'))).toBe(true);
    });

    it('should accept valid input', async () => {
      const input: UpsertMarkdownInput = {
        documents: [{ path: 'valid-rule.md' }],
        options: { overwrite: true }
      };

      // Mock file system and parser
      vi.spyOn(require('fs').promises, 'readFile').mockResolvedValue(sampleRuleDocument);
      vi.mocked(mockParser.validateRuleDocument).mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        suggestions: []
      });
      vi.mocked(mockParser.parseRuleDocument).mockResolvedValue({
        rule: {
          id: 'rule-1',
          name: 'Security Guidelines',
          layer: '*',
          authoritativeFor: ['security'],
          topics: ['API'],
          sourcePath: 'valid-rule.md',
          lastUpdated: new Date()
        },
        directives: [],
        relationships: [],
        warnings: []
      });
      vi.mocked(mockKnowledgeGraph.batchUpsert).mockResolvedValue({
        rulesProcessed: 1,
        directivesExtracted: 0,
        entitiesCreated: 1,
        relationsCreated: 0,
        warnings: []
      });

      const result = await tool.execute(input);

      expect(result.upserted.rulesProcessed).toBe(1);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('Document Processing', () => {
    beforeEach(() => {
      // Mock file system
      vi.spyOn(require('fs').promises, 'readFile').mockResolvedValue(sampleRuleDocument);
    });

    it('should validate document format before parsing', async () => {
      const input: UpsertMarkdownInput = {
        documents: [{ path: 'test-rule.md' }]
      };

      vi.mocked(mockParser.validateRuleDocument).mockResolvedValue({
        isValid: false,
        errors: ['Missing Metadata section'],
        warnings: [],
        suggestions: []
      });

      const result = await tool.execute(input);

      expect(mockParser.validateRuleDocument).toHaveBeenCalledWith(sampleRuleDocument);
      expect(result.upserted.rulesProcessed).toBe(0);
      expect(result.warnings.some(w => w.includes('Invalid rule document format'))).toBe(true);
    });

    it('should parse valid documents', async () => {
      const input: UpsertMarkdownInput = {
        documents: [{ path: 'test-rule.md' }]
      };

      vi.mocked(mockParser.validateRuleDocument).mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        suggestions: []
      });

      const mockParsedDocument = {
        rule: {
          id: 'rule-1',
          name: 'Security Guidelines',
          layer: '*' as const,
          authoritativeFor: ['security'],
          topics: ['API'],
          sourcePath: 'test-rule.md',
          lastUpdated: new Date()
        },
        directives: [
          {
            id: 'dir-1',
            ruleId: 'rule-1',
            section: 'Input Validation',
            severity: 'MUST' as const,
            text: 'Validate all user inputs',
            topics: ['validation'],
            whenToApply: ['creating endpoints']
          }
        ],
        relationships: [],
        warnings: []
      };

      vi.mocked(mockParser.parseRuleDocument).mockResolvedValue(mockParsedDocument);
      vi.mocked(mockKnowledgeGraph.batchUpsert).mockResolvedValue({
        rulesProcessed: 1,
        directivesExtracted: 1,
        entitiesCreated: 2,
        relationsCreated: 0,
        warnings: []
      });

      const result = await tool.execute(input);

      expect(mockParser.parseRuleDocument).toHaveBeenCalledWith(sampleRuleDocument, 'test-rule.md');
      expect(result.upserted.rulesProcessed).toBe(1);
      expect(result.upserted.directivesExtracted).toBe(1);
    });

    it('should handle file read errors', async () => {
      const input: UpsertMarkdownInput = {
        documents: [{ path: 'nonexistent.md' }]
      };

      vi.spyOn(require('fs').promises, 'readFile').mockRejectedValue(new Error('File not found'));

      const result = await tool.execute(input);

      expect(result.upserted.rulesProcessed).toBe(0);
      expect(result.warnings.some(w => w.includes('File not found'))).toBe(true);
    });

    it('should handle empty files', async () => {
      const input: UpsertMarkdownInput = {
        documents: [{ path: 'empty.md' }]
      };

      vi.spyOn(require('fs').promises, 'readFile').mockResolvedValue('   '); // Empty/whitespace only

      const result = await tool.execute(input);

      expect(result.upserted.rulesProcessed).toBe(0);
      expect(result.warnings.some(w => w.includes('empty'))).toBe(true);
    });

    it('should process multiple documents', async () => {
      const input: UpsertMarkdownInput = {
        documents: [
          { path: 'rule1.md' },
          { path: 'rule2.md' }
        ]
      };

      vi.mocked(mockParser.validateRuleDocument).mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        suggestions: []
      });

      vi.mocked(mockParser.parseRuleDocument)
        .mockResolvedValueOnce({
          rule: { id: 'rule-1', name: 'Rule 1', layer: '*', authoritativeFor: [], topics: [], sourcePath: 'rule1.md', lastUpdated: new Date() },
          directives: [],
          relationships: [],
          warnings: []
        })
        .mockResolvedValueOnce({
          rule: { id: 'rule-2', name: 'Rule 2', layer: '*', authoritativeFor: [], topics: [], sourcePath: 'rule2.md', lastUpdated: new Date() },
          directives: [],
          relationships: [],
          warnings: []
        });

      vi.mocked(mockKnowledgeGraph.batchUpsert).mockResolvedValue({
        rulesProcessed: 2,
        directivesExtracted: 0,
        entitiesCreated: 2,
        relationsCreated: 0,
        warnings: []
      });

      const result = await tool.execute(input);

      expect(result.upserted.rulesProcessed).toBe(2);
      expect(mockParser.parseRuleDocument).toHaveBeenCalledTimes(2);
    });
  });

  describe('Incremental Updates', () => {
    beforeEach(() => {
      vi.spyOn(require('fs').promises, 'readFile').mockResolvedValue(sampleRuleDocument);
      vi.mocked(mockParser.validateRuleDocument).mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        suggestions: []
      });
    });

    it('should perform incremental update when overwrite is false', async () => {
      const input: UpsertMarkdownInput = {
        documents: [{ path: 'existing-rule.md' }],
        options: { overwrite: false }
      };

      // Mock existing rule
      vi.mocked(mockKnowledgeGraph.getRules).mockResolvedValue([
        {
          id: 'existing-rule',
          name: 'Existing Rule',
          layer: '*',
          authoritativeFor: [],
          topics: [],
          sourcePath: 'existing-rule.md',
          lastUpdated: new Date()
        }
      ]);

      const mockParsedDocument = {
        rule: {
          id: 'existing-rule',
          name: 'Updated Rule',
          layer: '*' as const,
          authoritativeFor: [],
          topics: [],
          sourcePath: 'existing-rule.md',
          lastUpdated: new Date()
        },
        directives: [],
        relationships: [],
        warnings: []
      };

      vi.mocked(mockParser.parseRuleDocument).mockResolvedValue(mockParsedDocument);
      vi.mocked(mockKnowledgeGraph.incrementalUpdate).mockResolvedValue({
        rulesProcessed: 1,
        directivesExtracted: 0,
        entitiesCreated: 0,
        relationsCreated: 0,
        warnings: ['Incremental update completed']
      });

      const result = await tool.execute(input);

      expect(mockKnowledgeGraph.incrementalUpdate).toHaveBeenCalledWith(
        'existing-rule.md',
        [mockParsedDocument.rule],
        mockParsedDocument.directives
      );
      expect(result.warnings).toContain('Incremental update completed');
    });

    it('should fallback to full replacement if incremental update fails', async () => {
      const input: UpsertMarkdownInput = {
        documents: [{ path: 'existing-rule.md' }],
        options: { overwrite: false }
      };

      vi.mocked(mockKnowledgeGraph.getRules).mockResolvedValue([
        {
          id: 'existing-rule',
          name: 'Existing Rule',
          layer: '*',
          authoritativeFor: [],
          topics: [],
          sourcePath: 'existing-rule.md',
          lastUpdated: new Date()
        }
      ]);

      const mockParsedDocument = {
        rule: {
          id: 'existing-rule',
          name: 'Updated Rule',
          layer: '*' as const,
          authoritativeFor: [],
          topics: [],
          sourcePath: 'existing-rule.md',
          lastUpdated: new Date()
        },
        directives: [],
        relationships: [],
        warnings: []
      };

      vi.mocked(mockParser.parseRuleDocument).mockResolvedValue(mockParsedDocument);
      vi.mocked(mockKnowledgeGraph.incrementalUpdate).mockRejectedValue(new Error('Incremental update failed'));
      vi.mocked(mockKnowledgeGraph.batchUpsert).mockResolvedValue({
        rulesProcessed: 1,
        directivesExtracted: 0,
        entitiesCreated: 1,
        relationsCreated: 0,
        warnings: []
      });

      const result = await tool.execute(input);

      expect(result.warnings.some(w => w.includes('Incremental update failed'))).toBe(true);
      expect(result.upserted.rulesProcessed).toBe(1);
    });

    it('should perform full replacement when overwrite is true', async () => {
      const input: UpsertMarkdownInput = {
        documents: [{ path: 'rule.md' }],
        options: { overwrite: true }
      };

      const mockParsedDocument = {
        rule: {
          id: 'rule-1',
          name: 'Rule',
          layer: '*' as const,
          authoritativeFor: [],
          topics: [],
          sourcePath: 'rule.md',
          lastUpdated: new Date()
        },
        directives: [],
        relationships: [],
        warnings: []
      };

      vi.mocked(mockParser.parseRuleDocument).mockResolvedValue(mockParsedDocument);
      vi.mocked(mockKnowledgeGraph.batchUpsert).mockResolvedValue({
        rulesProcessed: 1,
        directivesExtracted: 0,
        entitiesCreated: 1,
        relationsCreated: 0,
        warnings: []
      });

      const result = await tool.execute(input);

      expect(mockKnowledgeGraph.batchUpsert).toHaveBeenCalledWith({
        rules: [mockParsedDocument.rule],
        directives: mockParsedDocument.directives,
        relationships: mockParsedDocument.relationships,
        deleteExisting: true
      });
      expect(result.upserted.rulesProcessed).toBe(1);
    });
  });

  describe('Document Validation', () => {
    it('should validate multiple documents', async () => {
      const filePaths = ['rule1.md', 'rule2.md', 'invalid.md'];

      vi.spyOn(require('fs').promises, 'access').mockImplementation((path) => {
        if (path === 'invalid.md') {
          throw new Error('File not found');
        }
        return Promise.resolve();
      });

      vi.spyOn(require('fs').promises, 'readFile')
        .mockImplementation((path) => {
          if (path === 'rule1.md' || path === 'rule2.md') {
            return Promise.resolve(sampleRuleDocument);
          }
          throw new Error('File not found');
        });

      vi.mocked(mockParser.validateRuleDocument).mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        suggestions: []
      });

      const result = await tool.validateDocuments(filePaths);

      expect(result.valid).toContain('rule1.md');
      expect(result.valid).toContain('rule2.md');
      expect(result.invalid.some(item => item.path === 'invalid.md')).toBe(true);
    });

    it('should identify format validation errors', async () => {
      const filePaths = ['invalid-format.md'];

      vi.spyOn(require('fs').promises, 'access').mockResolvedValue(undefined);
      vi.spyOn(require('fs').promises, 'readFile').mockResolvedValue('# Invalid\n\nNo metadata');

      vi.mocked(mockParser.validateRuleDocument).mockResolvedValue({
        isValid: false,
        errors: ['Missing Metadata section'],
        warnings: [],
        suggestions: []
      });

      const result = await tool.validateDocuments(filePaths);

      expect(result.valid).toHaveLength(0);
      expect(result.invalid).toHaveLength(1);
      expect(result.invalid[0].errors).toContain('Missing Metadata section');
    });
  });

  describe('Directory Processing', () => {
    it('should process markdown files in directory', async () => {
      const directoryPath = '/test/rules';

      // Mock directory scanning
      vi.spyOn(require('fs').promises, 'readdir').mockResolvedValue([
        { name: 'rule1.md', isFile: () => true, isDirectory: () => false },
        { name: 'rule2.md', isFile: () => true, isDirectory: () => false },
        { name: 'readme.txt', isFile: () => true, isDirectory: () => false },
        { name: 'subdir', isFile: () => false, isDirectory: () => true }
      ]);

      vi.spyOn(require('fs').promises, 'readFile').mockResolvedValue(sampleRuleDocument);
      vi.mocked(mockParser.validateRuleDocument).mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        suggestions: []
      });
      vi.mocked(mockParser.parseRuleDocument).mockResolvedValue({
        rule: {
          id: 'rule-1',
          name: 'Rule',
          layer: '*',
          authoritativeFor: [],
          topics: [],
          sourcePath: 'rule1.md',
          lastUpdated: new Date()
        },
        directives: [],
        relationships: [],
        warnings: []
      });
      vi.mocked(mockKnowledgeGraph.batchUpsert).mockResolvedValue({
        rulesProcessed: 2,
        directivesExtracted: 0,
        entitiesCreated: 2,
        relationsCreated: 0,
        warnings: []
      });

      const result = await tool.processDirectory(directoryPath);

      expect(result.upserted.rulesProcessed).toBe(2); // Only .md files processed
    });

    it('should handle empty directories', async () => {
      const directoryPath = '/empty/rules';

      vi.spyOn(require('fs').promises, 'readdir').mockResolvedValue([]);

      const result = await tool.processDirectory(directoryPath);

      expect(result.upserted.rulesProcessed).toBe(0);
      expect(result.warnings).toContain('No markdown files found in /empty/rules');
    });

    it('should handle directory access errors', async () => {
      const directoryPath = '/nonexistent/rules';

      vi.spyOn(require('fs').promises, 'readdir').mockRejectedValue(new Error('Directory not found'));

      await expect(tool.processDirectory(directoryPath)).rejects.toThrow('Directory not found');
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should provide ingestion statistics', async () => {
      vi.mocked(mockKnowledgeGraph.getRuleStats).mockResolvedValue({
        totalRules: 10,
        totalDirectives: 50,
        totalRelationships: 20,
        rulesByLayer: { '*': 5, '2-Application': 3, '4-Persistence': 2 },
        directivesBySeverity: { 'MUST': 20, 'SHOULD': 25, 'MAY': 5 },
        topicDistribution: { 'security': 15, 'api': 10, 'database': 8 },
        lastUpdated: new Date(),
        storageSize: 1024000
      });

      vi.mocked(mockKnowledgeGraph.getRules).mockResolvedValue([
        {
          id: 'rule-1',
          name: 'Recent Rule',
          layer: '*',
          authoritativeFor: [],
          topics: [],
          sourcePath: 'recent.md',
          lastUpdated: new Date()
        }
      ]);

      const stats = await tool.getIngestionStats();

      expect(stats.totalRules).toBe(10);
      expect(stats.totalDirectives).toBe(50);
      expect(stats.recentIngestions).toHaveLength(1);
      expect(stats.recentIngestions[0].sourcePath).toBe('recent.md');
    });
  });

  describe('Tool Schema', () => {
    it('should provide valid MCP tool schema', () => {
      const schema = UpsertMarkdownTool.getToolSchema();

      expect(schema.name).toBe('upsert_markdown');
      expect(schema.description).toContain('Ingest rule documents');
      expect(schema.inputSchema.type).toBe('object');
      expect(schema.inputSchema.properties.documents).toBeDefined();
      expect(schema.inputSchema.required).toContain('documents');
    });

    it('should define document array constraints', () => {
      const schema = UpsertMarkdownTool.getToolSchema();
      const documentsProperty = schema.inputSchema.properties.documents;

      expect(documentsProperty.type).toBe('array');
      expect(documentsProperty.maxItems).toBe(100);
      expect(documentsProperty.items.properties.path).toBeDefined();
    });

    it('should define options properties', () => {
      const schema = UpsertMarkdownTool.getToolSchema();
      const optionsProperty = schema.inputSchema.properties.options;

      expect(optionsProperty).toBeDefined();
      expect(optionsProperty.properties.overwrite).toBeDefined();
      expect(optionsProperty.properties.overwrite.type).toBe('boolean');
    });
  });
});