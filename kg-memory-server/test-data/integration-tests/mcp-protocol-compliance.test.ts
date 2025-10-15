/**
 * MCP Protocol Compliance Tests
 * Validates that the KG Memory Server correctly implements the Model Context Protocol
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Database } from 'sqlite3';
import { RuleKnowledgeGraphImpl } from '../../src/storage/rule-knowledge-graph.js';
import { RuleDocumentParser } from '../../src/parsers/rule-document-parser.js';
import { QueryDirectivesTool } from '../../src/mcp-tools/query-directives-tool.js';
import { DetectContextTool } from '../../src/mcp-tools/detect-context-tool.js';
import { UpsertMarkdownTool } from '../../src/mcp-tools/upsert-markdown-tool.js';
import { ContextDetectionEngine } from '../../src/context-detection/context-detection-engine.js';
import { DirectiveRankingEngine } from '../../src/ranking/directive-ranking-engine.js';
import { ContextBlockFormatter } from '../../src/formatting/context-block-formatter.js';
import { DefaultModelProviderManager } from '../../src/providers/model-provider-manager.js';
import { RuleBasedProvider } from '../../src/providers/rule-based-provider.js';
import { DatabaseConnection } from '../../src/database/connection.js';

describe('MCP Protocol Compliance Tests', () => {
  let database: Database;
  let dbConnection: DatabaseConnection;
  let knowledgeGraph: RuleKnowledgeGraphImpl;
  let parser: RuleDocumentParser;
  let contextEngine: ContextDetectionEngine;
  let rankingEngine: DirectiveRankingEngine;
  let formatter: ContextBlockFormatter;
  let providerManager: DefaultModelProviderManager;
  
  let queryDirectivesTool: QueryDirectivesTool;
  let detectContextTool: DetectContextTool;
  let upsertMarkdownTool: UpsertMarkdownTool;

  beforeAll(async () => {
    // Initialize components
    database = new Database(':memory:');
    dbConnection = new DatabaseConnection(database);
    knowledgeGraph = new RuleKnowledgeGraphImpl(dbConnection);
    parser = new RuleDocumentParser();
    
    providerManager = new DefaultModelProviderManager({
      primaryProvider: {
        provider: 'rule-based',
        config: {}
      }
    });
    
    contextEngine = new ContextDetectionEngine(providerManager);
    rankingEngine = new DirectiveRankingEngine();
    formatter = new ContextBlockFormatter();

    await knowledgeGraph.initialize();

    // Initialize MCP tools
    queryDirectivesTool = new QueryDirectivesTool(
      knowledgeGraph,
      contextEngine,
      rankingEngine,
      formatter
    );
    
    detectContextTool = new DetectContextTool(contextEngine);
    
    upsertMarkdownTool = new UpsertMarkdownTool(
      knowledgeGraph,
      parser
    );
  });

  afterAll(async () => {
    if (database) {
      database.close();
    }
  });

  beforeEach(async () => {
    await knowledgeGraph.clear();
  });

  describe('MCP Tool Interface Compliance', () => {
    it('should implement required MCP tool interface methods', () => {
      const tools = [queryDirectivesTool, detectContextTool, upsertMarkdownTool];
      
      tools.forEach(tool => {
        // Each tool should have required MCP methods
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');
        expect(tool).toHaveProperty('execute');
        
        // Methods should be functions
        expect(typeof tool.execute).toBe('function');
        
        // Name should be a string
        expect(typeof tool.name).toBe('string');
        expect(tool.name.length).toBeGreaterThan(0);
        
        // Description should be a string
        expect(typeof tool.description).toBe('string');
        expect(tool.description.length).toBeGreaterThan(0);
        
        // Input schema should be an object
        expect(typeof tool.inputSchema).toBe('object');
        expect(tool.inputSchema).not.toBeNull();
      });
    });

    it('should have valid JSON schemas for input validation', () => {
      const tools = [queryDirectivesTool, detectContextTool, upsertMarkdownTool];
      
      tools.forEach(tool => {
        const schema = tool.inputSchema;
        
        // Schema should have required properties
        expect(schema).toHaveProperty('type');
        expect(schema.type).toBe('object');
        
        // Should have properties definition
        expect(schema).toHaveProperty('properties');
        expect(typeof schema.properties).toBe('object');
        
        // Should have required fields array
        expect(schema).toHaveProperty('required');
        expect(Array.isArray(schema.required)).toBe(true);
      });
    });

    it('should return properly formatted MCP responses', async () => {
      // Test query_directives tool
      const queryResult = await queryDirectivesTool.execute({
        taskDescription: 'Create React component with validation'
      });
      
      expect(queryResult).toHaveProperty('content');
      expect(Array.isArray(queryResult.content)).toBe(true);
      
      if (queryResult.content.length > 0) {
        const content = queryResult.content[0];
        expect(content).toHaveProperty('type');
        expect(content).toHaveProperty('text');
      }

      // Test detect_context tool
      const contextResult = await detectContextTool.execute({
        text: 'Implement REST API endpoint'
      });
      
      expect(contextResult).toHaveProperty('content');
      expect(Array.isArray(contextResult.content)).toBe(true);
      
      if (contextResult.content.length > 0) {
        const content = contextResult.content[0];
        expect(content).toHaveProperty('type');
        expect(content.type).toBe('text');
        expect(content).toHaveProperty('text');
      }
    });
  });

  describe('Query Directives Tool MCP Compliance', () => {
    it('should validate input parameters according to schema', async () => {
      // Test with missing required parameter
      await expect(queryDirectivesTool.execute({})).rejects.toThrow();
      
      // Test with invalid parameter types
      await expect(queryDirectivesTool.execute({
        taskDescription: 123  // Should be string
      })).rejects.toThrow();
      
      // Test with valid parameters
      const result = await queryDirectivesTool.execute({
        taskDescription: 'Create component'
      });
      
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    });

    it('should handle optional parameters correctly', async () => {
      // Test with minimal parameters
      const minimalResult = await queryDirectivesTool.execute({
        taskDescription: 'Create component'
      });
      
      expect(minimalResult).toBeDefined();
      
      // Test with all optional parameters
      const fullResult = await queryDirectivesTool.execute({
        taskDescription: 'Create component',
        modeSlug: 'code',
        options: {
          strictLayer: true,
          maxItems: 5,
          tokenBudget: 1000,
          includeBreadcrumbs: true
        }
      });
      
      expect(fullResult).toBeDefined();
      
      // Both should return valid responses
      expect(minimalResult.content).toBeDefined();
      expect(fullResult.content).toBeDefined();
    });

    it('should return structured MCP response format', async () => {
      const result = await queryDirectivesTool.execute({
        taskDescription: 'Create React component with form validation'
      });
      
      // Should follow MCP response format
      expect(result).toHaveProperty('content');
      expect(Array.isArray(result.content)).toBe(true);
      
      // Content should have proper structure
      result.content.forEach(item => {
        expect(item).toHaveProperty('type');
        expect(item).toHaveProperty('text');
        expect(typeof item.text).toBe('string');
      });
      
      // Should include metadata if available
      if (result.meta) {
        expect(typeof result.meta).toBe('object');
      }
    });

    it('should handle error cases gracefully', async () => {
      // Test with extremely long input
      const longInput = 'a'.repeat(100000);
      
      const result = await queryDirectivesTool.execute({
        taskDescription: longInput
      });
      
      // Should not crash and return valid response
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      
      // Test with special characters
      const specialCharsResult = await queryDirectivesTool.execute({
        taskDescription: 'Create component with @#$%^&*()[]{}|\\:";\'<>?,./`~'
      });
      
      expect(specialCharsResult).toBeDefined();
      expect(specialCharsResult.content).toBeDefined();
    });
  });

  describe('Detect Context Tool MCP Compliance', () => {
    it('should validate input according to schema', async () => {
      // Test with missing required parameter
      await expect(detectContextTool.execute({})).rejects.toThrow();
      
      // Test with invalid parameter type
      await expect(detectContextTool.execute({
        text: 123  // Should be string
      })).rejects.toThrow();
      
      // Test with valid parameters
      const result = await detectContextTool.execute({
        text: 'Create React component'
      });
      
      expect(result).toBeDefined();
    });

    it('should return consistent response format', async () => {
      const result = await detectContextTool.execute({
        text: 'Implement REST API authentication'
      });
      
      // Should follow MCP response format
      expect(result).toHaveProperty('content');
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content.length).toBeGreaterThan(0);
      
      const content = result.content[0];
      expect(content).toHaveProperty('type');
      expect(content.type).toBe('text');
      expect(content).toHaveProperty('text');
      
      // Parse the JSON response
      const contextData = JSON.parse(content.text);
      expect(contextData).toHaveProperty('detectedLayer');
      expect(contextData).toHaveProperty('topics');
      expect(contextData).toHaveProperty('confidence');
      expect(Array.isArray(contextData.topics)).toBe(true);
      expect(typeof contextData.confidence).toBe('number');
    });

    it('should handle optional parameters', async () => {
      // Test with returnKeywords option
      const result = await detectContextTool.execute({
        text: 'Create database migration',
        options: {
          returnKeywords: true
        }
      });
      
      expect(result).toBeDefined();
      
      const content = result.content[0];
      const contextData = JSON.parse(content.text);
      
      // Should include keywords when requested
      expect(contextData).toHaveProperty('keywords');
      expect(Array.isArray(contextData.keywords)).toBe(true);
    });
  });

  describe('Upsert Markdown Tool MCP Compliance', () => {
    it('should validate input according to schema', async () => {
      // Test with missing required parameter
      await expect(upsertMarkdownTool.execute({})).rejects.toThrow();
      
      // Test with invalid parameter structure
      await expect(upsertMarkdownTool.execute({
        documents: 'not-an-array'
      })).rejects.toThrow();
      
      // Test with invalid document structure
      await expect(upsertMarkdownTool.execute({
        documents: [{ invalidProperty: 'test' }]
      })).rejects.toThrow();
    });

    it('should handle valid document ingestion', async () => {
      const sampleRule = `
# Test Rule

## Metadata
- **Layer**: 1-Presentation
- **AuthoritativeFor**: [testing]
- **Topics**: [React, testing]

## When to Apply
- When testing components

## Directives

### Testing
**MUST** Write comprehensive tests for all components.
      `;

      const result = await upsertMarkdownTool.execute({
        documents: [{ path: 'test-rule.md', content: sampleRule }]
      });
      
      // Should follow MCP response format
      expect(result).toHaveProperty('content');
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content.length).toBeGreaterThan(0);
      
      const content = result.content[0];
      expect(content).toHaveProperty('type');
      expect(content).toHaveProperty('text');
      
      // Parse the response
      const responseData = JSON.parse(content.text);
      expect(responseData).toHaveProperty('upserted');
      expect(responseData.upserted).toHaveProperty('rules');
      expect(responseData.upserted).toHaveProperty('directives');
    });

    it('should handle batch document processing', async () => {
      const documents = [
        {
          path: 'rule1.md',
          content: `
# Rule 1
## Metadata
- **Layer**: 1-Presentation
- **Topics**: [React]
## Directives
### Testing
**MUST** Test components.
          `
        },
        {
          path: 'rule2.md',
          content: `
# Rule 2
## Metadata
- **Layer**: 2-Application
- **Topics**: [API]
## Directives
### Validation
**SHOULD** Validate inputs.
          `
        }
      ];

      const result = await upsertMarkdownTool.execute({
        documents
      });
      
      expect(result).toBeDefined();
      
      const content = result.content[0];
      const responseData = JSON.parse(content.text);
      
      // Should process multiple documents
      expect(responseData.upserted.rules).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Real-World Integration Scenarios', () => {
    it('should handle complete workflow: ingest -> detect -> query', async () => {
      // Step 1: Ingest rules
      const ruleDocument = `
# Frontend Development Rules

## Metadata
- **Layer**: 1-Presentation
- **AuthoritativeFor**: [security, validation, accessibility]
- **Topics**: [React, forms, validation, XSS, accessibility]

## When to Apply
- Creating React components
- Building user interfaces
- Handling user input and forms

## Directives

### Input Validation
**MUST** Sanitize all user input before displaying it in the UI to prevent XSS attacks.

**Rationale**: Cross-site scripting vulnerabilities can allow attackers to execute malicious scripts.

### Form Validation
**MUST** Validate form inputs on both client and server sides.

**Rationale**: Client-side validation provides immediate feedback while server-side validation ensures security.

### Accessibility
**MUST** Ensure all interactive elements are keyboard accessible.

**Rationale**: Users with motor disabilities must be able to access all functionality.
      `;

      const ingestResult = await upsertMarkdownTool.execute({
        documents: [{ path: 'frontend-rules.md', content: ruleDocument }]
      });
      
      expect(ingestResult).toBeDefined();
      
      // Step 2: Detect context
      const contextResult = await detectContextTool.execute({
        text: 'Create React component for user login form with validation'
      });
      
      expect(contextResult).toBeDefined();
      
      const contextData = JSON.parse(contextResult.content[0].text);
      expect(contextData.detectedLayer).toBe('1-Presentation');
      expect(contextData.topics).toContain('React');
      
      // Step 3: Query relevant directives
      const queryResult = await queryDirectivesTool.execute({
        taskDescription: 'Create React component for user login form with validation',
        options: {
          maxItems: 10,
          includeBreadcrumbs: true
        }
      });
      
      expect(queryResult).toBeDefined();
      expect(queryResult.content.length).toBeGreaterThan(0);
      
      const contextBlock = queryResult.content[0].text;
      expect(contextBlock).toContain('MUST');
      expect(contextBlock).toContain('validation');
      expect(contextBlock).toContain('Layer: 1-Presentation');
    });

    it('should handle cross-layer queries correctly', async () => {
      // Ingest rules for multiple layers
      const presentationRule = `
# Presentation Rules
## Metadata
- **Layer**: 1-Presentation
- **Topics**: [React, forms]
## Directives
### UI
**MUST** Create accessible forms.
      `;

      const applicationRule = `
# Application Rules
## Metadata
- **Layer**: 2-Application
- **Topics**: [authentication, API]
## Directives
### Auth
**MUST** Implement proper authentication.
      `;

      await upsertMarkdownTool.execute({
        documents: [
          { path: 'presentation.md', content: presentationRule },
          { path: 'application.md', content: applicationRule }
        ]
      });

      // Query for authentication-related task
      const result = await queryDirectivesTool.execute({
        taskDescription: 'Implement user authentication with login form'
      });
      
      expect(result).toBeDefined();
      
      const contextBlock = result.content[0].text;
      
      // Should include directives from both layers
      expect(contextBlock).toContain('authentication');
      expect(contextBlock).toContain('forms');
    });

    it('should maintain performance under realistic load', async () => {
      // Ingest multiple rule documents
      const rules = Array.from({ length: 10 }, (_, i) => ({
        path: `rule-${i}.md`,
        content: `
# Rule ${i}
## Metadata
- **Layer**: ${(i % 5) + 1}-Layer${i % 5}
- **Topics**: [topic${i}, common]
## Directives
### Section${i}
**MUST** Follow rule ${i}.
        `
      }));

      await upsertMarkdownTool.execute({ documents: rules });

      // Perform multiple queries and measure performance
      const queries = [
        'Create component with validation',
        'Implement API endpoint',
        'Design domain entity',
        'Optimize database queries',
        'Set up deployment'
      ];

      const startTime = Date.now();
      
      for (const query of queries) {
        const result = await queryDirectivesTool.execute({
          taskDescription: query,
          options: { maxItems: 5 }
        });
        
        expect(result).toBeDefined();
        expect(result.content.length).toBeGreaterThan(0);
      }
      
      const totalTime = Date.now() - startTime;
      const avgTime = totalTime / queries.length;
      
      // Should complete within performance requirements
      expect(avgTime).toBeLessThan(400); // < 400ms per query
    });

    it('should handle error recovery gracefully', async () => {
      // Test with malformed rule document
      const malformedRule = `
# Incomplete Rule
This is not a properly formatted rule document.
      `;

      // Should handle parsing errors gracefully
      await expect(upsertMarkdownTool.execute({
        documents: [{ path: 'malformed.md', content: malformedRule }]
      })).rejects.toThrow();

      // System should still work for valid queries
      const result = await detectContextTool.execute({
        text: 'Create component'
      });
      
      expect(result).toBeDefined();
    });
  });

  describe('MCP Protocol Error Handling', () => {
    it('should return proper error responses for invalid inputs', async () => {
      // Test various invalid inputs and ensure proper error handling
      const invalidInputs = [
        null,
        undefined,
        '',
        123,
        [],
        { invalid: 'structure' }
      ];

      for (const input of invalidInputs) {
        try {
          await queryDirectivesTool.execute(input as any);
          // Should not reach here
          expect(false).toBe(true);
        } catch (error) {
          // Should throw proper error
          expect(error).toBeDefined();
          expect(error.message).toBeDefined();
        }
      }
    });

    it('should handle timeout scenarios', async () => {
      // Test with very complex query that might timeout
      const complexQuery = 'Create a comprehensive full-stack application with React frontend, Node.js backend, PostgreSQL database, Redis caching, Docker containerization, Kubernetes deployment, CI/CD pipeline, monitoring, logging, security, testing, documentation, and performance optimization across all architectural layers with proper error handling, validation, authentication, authorization, and scalability considerations.';

      const result = await queryDirectivesTool.execute({
        taskDescription: complexQuery,
        options: { tokenBudget: 10000 }
      });
      
      // Should complete even with complex queries
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    });

    it('should maintain MCP compliance under stress', async () => {
      // Rapid-fire requests to test stability
      const promises = Array.from({ length: 20 }, (_, i) => 
        detectContextTool.execute({
          text: `Test query ${i} for stress testing`
        })
      );

      const results = await Promise.all(promises);
      
      // All requests should complete successfully
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.content).toBeDefined();
        expect(Array.isArray(result.content)).toBe(true);
      });
    });
  });
});