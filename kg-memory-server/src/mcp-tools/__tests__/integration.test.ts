import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  QueryDirectivesTool, 
  DetectContextTool, 
  UpsertMarkdownTool, 
  MCPErrorHandler 
} from '../index.js';
import { 
  QueryDirectivesInput, 
  DetectContextInput, 
  UpsertMarkdownInput,
  ErrorType 
} from '../../types.js';
import { DefaultModelProviderManager } from '../../providers/model-provider-manager.js';
import { RuleKnowledgeGraphImpl } from '../../storage/rule-knowledge-graph.js';
import { RuleDocumentParser } from '../../parsers/rule-document-parser.js';
import { DatabaseConnection } from '../../database/connection.js';

/**
 * Integration tests for MCP tools
 * Tests end-to-end functionality and error handling scenarios
 */
describe('MCP Tools Integration', () => {
  let modelProviderManager: DefaultModelProviderManager;
  let ruleKnowledgeGraph: RuleKnowledgeGraphImpl;
  let ruleDocumentParser: RuleDocumentParser;
  let queryDirectivesTool: QueryDirectivesTool;
  let detectContextTool: DetectContextTool;
  let upsertMarkdownTool: UpsertMarkdownTool;
  let dbConnection: DatabaseConnection;

  beforeEach(async () => {
    // Initialize test database
    dbConnection = new DatabaseConnection(':memory:'); // In-memory database for tests
    
    // Initialize components
    modelProviderManager = new DefaultModelProviderManager();
    ruleKnowledgeGraph = new RuleKnowledgeGraphImpl(dbConnection);
    ruleDocumentParser = new RuleDocumentParser();
    
    // Initialize MCP tools
    queryDirectivesTool = new QueryDirectivesTool(modelProviderManager, ruleKnowledgeGraph);
    detectContextTool = new DetectContextTool(modelProviderManager);
    upsertMarkdownTool = new UpsertMarkdownTool(ruleDocumentParser, ruleKnowledgeGraph);
  });

  afterEach(async () => {
    // Cleanup
    if (dbConnection) {
      await dbConnection.close();
    }
  });

  describe('QueryDirectivesTool', () => {
    it('should return fallback context when knowledge graph is empty', async () => {
      const input: QueryDirectivesInput = {
        taskDescription: 'Create a new API endpoint for user authentication',
        options: {
          maxItems: 10
        }
      };

      const result = await queryDirectivesTool.execute(input);

      expect(result).toBeDefined();
      expect(result.context_block).toContain('Project Context');
      expect(result.context_block).toContain('authentication');
      expect(result.diagnostics.fallbackUsed).toBe(true);
      expect(result.diagnostics.returnedDirectives).toBe(0);
      expect(result.citations).toHaveLength(0);
    });

    it('should handle invalid input gracefully', async () => {
      const input: QueryDirectivesInput = {
        taskDescription: '', // Empty task description
      };

      const result = await queryDirectivesTool.execute(input);

      expect(result).toBeDefined();
      expect(result.context_block).toContain('Fallback Mode');
      expect(result.diagnostics.fallbackUsed).toBe(true);
    });

    it('should respect token budget limits', async () => {
      const input: QueryDirectivesInput = {
        taskDescription: 'Implement database operations with proper error handling',
        options: {
          tokenBudget: 500 // Small budget
        }
      };

      const result = await queryDirectivesTool.execute(input);

      expect(result).toBeDefined();
      expect(result.context_block.length).toBeLessThan(2000); // Rough token estimation
      expect(result.diagnostics.tokenBudget).toBeLessThanOrEqual(500);
    });

    it('should provide different context for different modes', async () => {
      const baseInput: QueryDirectivesInput = {
        taskDescription: 'Design a new microservice architecture'
      };

      const architectResult = await queryDirectivesTool.execute({
        ...baseInput,
        modeSlug: 'architect'
      });

      const codeResult = await queryDirectivesTool.execute({
        ...baseInput,
        modeSlug: 'code'
      });

      const debugResult = await queryDirectivesTool.execute({
        ...baseInput,
        modeSlug: 'debug'
      });

      expect(architectResult.context_block).toBeDefined();
      expect(codeResult.context_block).toBeDefined();
      expect(debugResult.context_block).toBeDefined();
      
      // Results should be different for different modes
      expect(architectResult.context_block).not.toBe(codeResult.context_block);
    });
  });

  describe('DetectContextTool', () => {
    it('should detect context from task descriptions', async () => {
      const input: DetectContextInput = {
        text: 'Create a React component for user profile display with responsive design',
        options: {
          returnKeywords: true
        }
      };

      const result = await detectContextTool.execute(input);

      expect(result).toBeDefined();
      expect(result.detectedLayer).toBe('1-Presentation');
      expect(result.topics).toContain('ui');
      expect(result.keywords).toContain('react');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should handle database-related tasks', async () => {
      const input: DetectContextInput = {
        text: 'Implement repository pattern with SQL queries and transaction management',
        options: {
          returnKeywords: true
        }
      };

      const result = await detectContextTool.execute(input);

      expect(result).toBeDefined();
      expect(result.detectedLayer).toBe('4-Persistence');
      expect(result.topics).toContain('database');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should work without keywords when not requested', async () => {
      const input: DetectContextInput = {
        text: 'Deploy application to cloud infrastructure with monitoring',
        options: {
          returnKeywords: false
        }
      };

      const result = await detectContextTool.execute(input);

      expect(result).toBeDefined();
      expect(result.detectedLayer).toBe('5-Infrastructure');
      expect(result.keywords).toBeUndefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should handle empty or invalid input', async () => {
      const input: DetectContextInput = {
        text: ''
      };

      const result = await detectContextTool.execute(input);

      expect(result).toBeDefined();
      expect(result.detectedLayer).toBe('*');
      expect(result.confidence).toBeLessThan(0.5);
    });

    it('should provide batch detection capability', async () => {
      const texts = [
        'Create API endpoint',
        'Design database schema',
        'Build UI component'
      ];

      const results = await detectContextTool.batchDetect(texts, { returnKeywords: true });

      expect(results).toHaveLength(3);
      expect(results[0].detectedLayer).toBe('2-Application');
      expect(results[1].detectedLayer).toBe('4-Persistence');
      expect(results[2].detectedLayer).toBe('1-Presentation');
    });
  });

  describe('UpsertMarkdownTool', () => {
    const sampleRuleDocument = `# Security Guidelines

## Metadata
- **Layer**: *
- **AuthoritativeFor**: [security, authentication]
- **Topics**: [API, validation, authentication]

## When to Apply
- Creating new API endpoints
- Handling user input
- Implementing authentication flows

## Directives

### Input Validation
**MUST** Validate all user inputs before processing

**Rationale**: Prevents injection attacks and data corruption

**Example**: 
\`\`\`javascript
function validateEmail(email) {
  return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email);
}
\`\`\`

### Authentication
**SHOULD** Use JWT tokens for stateless authentication

**Rationale**: Provides scalable authentication mechanism
`;

    it('should handle empty document list', async () => {
      const input: UpsertMarkdownInput = {
        documents: []
      };

      const result = await upsertMarkdownTool.execute(input);

      expect(result).toBeDefined();
      expect(result.upserted.rulesProcessed).toBe(0);
      expect(result.warnings).toContain('documents array cannot be empty');
    });

    it('should validate document format', async () => {
      // Mock file system to return invalid document
      const invalidDocument = '# Invalid Document\n\nNo metadata section';
      
      vi.spyOn(require('fs').promises, 'readFile').mockResolvedValue(invalidDocument);

      const input: UpsertMarkdownInput = {
        documents: [{ path: 'invalid.md' }]
      };

      const result = await upsertMarkdownTool.execute(input);

      expect(result).toBeDefined();
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('Invalid rule document format'))).toBe(true);
    });

    it('should process valid documents', async () => {
      // Mock file system to return valid document
      vi.spyOn(require('fs').promises, 'readFile').mockResolvedValue(sampleRuleDocument);

      const input: UpsertMarkdownInput = {
        documents: [{ path: 'security-guidelines.md' }]
      };

      const result = await upsertMarkdownTool.execute(input);

      expect(result).toBeDefined();
      expect(result.upserted.rulesProcessed).toBe(1);
      expect(result.upserted.directivesExtracted).toBeGreaterThan(0);
      expect(result.warnings.length).toBe(0);
    });

    it('should handle file access errors', async () => {
      // Mock file system to throw error
      vi.spyOn(require('fs').promises, 'readFile').mockRejectedValue(new Error('File not found'));

      const input: UpsertMarkdownInput = {
        documents: [{ path: 'nonexistent.md' }]
      };

      const result = await upsertMarkdownTool.execute(input);

      expect(result).toBeDefined();
      expect(result.upserted.rulesProcessed).toBe(0);
      expect(result.warnings.some(w => w.includes('File not found'))).toBe(true);
    });

    it('should support incremental updates', async () => {
      // Mock file system
      vi.spyOn(require('fs').promises, 'readFile').mockResolvedValue(sampleRuleDocument);

      const input: UpsertMarkdownInput = {
        documents: [{ path: 'security-guidelines.md' }],
        options: {
          overwrite: false // Incremental update
        }
      };

      // First upsert
      const result1 = await upsertMarkdownTool.execute(input);
      expect(result1.upserted.rulesProcessed).toBe(1);

      // Second upsert (should be incremental)
      const result2 = await upsertMarkdownTool.execute(input);
      expect(result2.upserted.rulesProcessed).toBe(1);
    });
  });

  describe('Error Handling and Fallback', () => {
    it('should handle model provider unavailable', async () => {
      // Mock model provider to be unavailable
      vi.spyOn(modelProviderManager, 'getPrimaryProvider').mockRejectedValue(new Error('Provider unavailable'));

      const input: QueryDirectivesInput = {
        taskDescription: 'Test task with unavailable provider'
      };

      const result = await queryDirectivesTool.execute(input);

      expect(result).toBeDefined();
      expect(result.context_block).toContain('Fallback Mode');
      expect(result.diagnostics.fallbackUsed).toBe(true);
      expect(result.diagnostics.modelProvider).toBeUndefined();
    });

    it('should handle knowledge graph unavailable', async () => {
      // Mock knowledge graph to throw error
      vi.spyOn(ruleKnowledgeGraph, 'queryDirectives').mockRejectedValue(new Error('Database unavailable'));

      const input: QueryDirectivesInput = {
        taskDescription: 'Test task with unavailable database'
      };

      const result = await queryDirectivesTool.execute(input);

      expect(result).toBeDefined();
      expect(result.context_block).toContain('Fallback Mode');
      expect(result.diagnostics.fallbackUsed).toBe(true);
    });

    it('should handle timeout scenarios', async () => {
      // Mock slow operation
      vi.spyOn(ruleKnowledgeGraph, 'queryDirectives').mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 10000)) // 10 second delay
      );

      const input: QueryDirectivesInput = {
        taskDescription: 'Test task with timeout'
      };

      const result = await queryDirectivesTool.execute(input);

      expect(result).toBeDefined();
      expect(result.context_block).toContain('Fallback Mode');
      expect(result.diagnostics.fallbackUsed).toBe(true);
    });

    it('should provide appropriate error responses', async () => {
      const errorResponse = MCPErrorHandler.createQueryDirectivesFallback(
        'Test task',
        ErrorType.MODEL_PROVIDER_UNAVAILABLE
      );

      expect(errorResponse.context_block).toContain('Model provider unavailable');
      expect(errorResponse.diagnostics.fallbackUsed).toBe(true);
      expect(errorResponse.citations).toHaveLength(0);
    });
  });

  describe('End-to-End Query Pipeline', () => {
    it('should complete full pipeline with mocked data', async () => {
      // Setup: Add some test data to knowledge graph
      vi.spyOn(require('fs').promises, 'readFile').mockResolvedValue(`# Test Rule

## Metadata
- **Layer**: 2-Application
- **AuthoritativeFor**: [testing]
- **Topics**: [API, testing]

## When to Apply
- Writing unit tests

## Directives

### Testing
**MUST** Write unit tests for all public methods

**Rationale**: Ensures code quality and prevents regressions
`);

      // First, upsert a rule document
      const upsertResult = await upsertMarkdownTool.execute({
        documents: [{ path: 'test-rule.md' }]
      });

      expect(upsertResult.upserted.rulesProcessed).toBe(1);

      // Then query for directives
      const queryResult = await queryDirectivesTool.execute({
        taskDescription: 'Write unit tests for the user service API',
        options: {
          maxItems: 5
        }
      });

      expect(queryResult).toBeDefined();
      expect(queryResult.context_block).toContain('Project Context');
      
      // Should detect context properly
      const contextResult = await detectContextTool.execute({
        text: 'Write unit tests for the user service API',
        options: { returnKeywords: true }
      });

      expect(contextResult.detectedLayer).toBe('2-Application');
      expect(contextResult.topics).toContain('testing');
    });

    it('should handle complex multi-layer scenarios', async () => {
      const tasks = [
        'Design database schema for user management',
        'Create REST API endpoints for user operations', 
        'Build React components for user interface',
        'Deploy application to AWS with monitoring'
      ];

      for (const task of tasks) {
        const contextResult = await detectContextTool.execute({
          text: task,
          options: { returnKeywords: true }
        });

        const queryResult = await queryDirectivesTool.execute({
          taskDescription: task,
          options: { maxItems: 3 }
        });

        expect(contextResult).toBeDefined();
        expect(queryResult).toBeDefined();
        expect(queryResult.context_block).toContain('Project Context');
      }
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle large numbers of directives efficiently', async () => {
      const startTime = Date.now();

      const result = await queryDirectivesTool.execute({
        taskDescription: 'Complex task requiring many directives',
        options: {
          maxItems: 100
        }
      });

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(result).toBeDefined();
      expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should maintain consistency across multiple calls', async () => {
      const input: DetectContextInput = {
        text: 'Create API endpoint for user authentication',
        options: { returnKeywords: true }
      };

      const results = await Promise.all([
        detectContextTool.execute(input),
        detectContextTool.execute(input),
        detectContextTool.execute(input)
      ]);

      // All results should be identical
      expect(results[0].detectedLayer).toBe(results[1].detectedLayer);
      expect(results[1].detectedLayer).toBe(results[2].detectedLayer);
      expect(results[0].topics).toEqual(results[1].topics);
      expect(results[1].topics).toEqual(results[2].topics);
    });

    it('should handle concurrent requests safely', async () => {
      const tasks = Array.from({ length: 10 }, (_, i) => 
        `Task ${i}: Create component for feature ${i}`
      );

      const promises = tasks.map(task => 
        queryDirectivesTool.execute({
          taskDescription: task,
          options: { maxItems: 5 }
        })
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.context_block).toContain('Project Context');
      });
    });
  });
});