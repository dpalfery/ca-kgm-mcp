/**
 * Comprehensive Integration Tests for Task 10.4
 * 
 * This test suite covers:
 * - System integration with coding assistants
 * - MCP protocol compliance validation
 * - Real-world usage scenarios
 * 
 * Requirements: 5.1-5.4
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
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

describe('Comprehensive Integration Tests - Task 10.4', () => {
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
    // Initialize test database
    database = new Database(':memory:');
    dbConnection = new DatabaseConnection(':memory:');
    
    // Initialize database schema
    await dbConnection.initialize();
    
    // Initialize components
    knowledgeGraph = new RuleKnowledgeGraphImpl(dbConnection);
    parser = new RuleDocumentParser();
    
    // Set up model provider with fallback
    providerManager = new DefaultModelProviderManager({
      primaryProvider: {
        provider: 'rule-based',
        config: {}
      }
    });
    
    contextEngine = new ContextDetectionEngine(providerManager);
    rankingEngine = new DirectiveRankingEngine();
    formatter = new ContextBlockFormatter();

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
    // Clear database between tests by deleting all rules
    const allRules = await knowledgeGraph.getRules({});
    if (allRules.length > 0) {
      await knowledgeGraph.deleteRules(allRules.map(r => r.id));
    }
  });

  describe('System Integration with Coding Assistants (Requirement 5.1)', () => {
    it('should integrate seamlessly with MCP-compatible coding assistants', async () => {
      // Test MCP tool registration and discovery
      const tools = [queryDirectivesTool, detectContextTool, upsertMarkdownTool];
      
      // Verify all tools implement MCP interface
      tools.forEach(tool => {
        expect(tool.name).toBeDefined();
        expect(typeof tool.name).toBe('string');
        expect(tool.description).toBeDefined();
        expect(typeof tool.description).toBe('string');
        expect(tool.inputSchema).toBeDefined();
        expect(typeof tool.inputSchema).toBe('object');
        expect(typeof tool.execute).toBe('function');
      });

      // Test tool names follow MCP naming conventions
      expect(queryDirectivesTool.name).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(detectContextTool.name).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(upsertMarkdownTool.name).toMatch(/^[a-z][a-z0-9_]*$/);
    });

    it('should provide contextual guidance without changing developer workflow', async () => {
      // Simulate typical coding assistant workflow
      const developmentRules = `
# Development Workflow Rules

## Metadata
- **Layer**: *
- **AuthoritativeFor**: [workflow, standards, quality]
- **Topics**: [git, testing, code-review, documentation]

## When to Apply
- All development activities
- Code reviews
- Pull request creation

## Directives

### Version Control
**MUST** Write descriptive commit messages following conventional commit format.

**Rationale**: Clear commit messages improve project history and enable automated tooling.

### Code Quality
**MUST** Run linting and formatting tools before committing code.

**Rationale**: Consistent code style improves readability and maintainability.

### Testing
**MUST** Write tests for new functionality before marking pull request as ready for review.

**Rationale**: Tests prevent regressions and document expected behavior.

### Documentation
**SHOULD** Update relevant documentation when changing public APIs or behavior.

**Rationale**: Up-to-date documentation helps other developers understand and use the code.
      `;

      // Step 1: Ingest team rules (one-time setup)
      const ingestResult = await upsertMarkdownTool.execute({
        documents: [{ path: 'workflow-rules.md', content: developmentRules }]
      });

      expect(ingestResult.content).toBeDefined();
      const ingestData = JSON.parse(ingestResult.content[0].text);
      expect(ingestData.upserted.rules).toBeGreaterThan(0);

      // Step 2: Developer starts coding task - assistant queries for context
      const taskDescription = 'Implement user authentication API endpoint with JWT tokens';
      
      const queryResult = await queryDirectivesTool.execute({
        taskDescription,
        options: {
          maxItems: 8,
          tokenBudget: 1500,
          includeBreadcrumbs: true
        }
      });

      expect(queryResult.content).toBeDefined();
      const contextBlock = queryResult.content[0].text;

      // Verify contextual guidance is provided
      expect(contextBlock).toContain('Development Workflow Rules');
      expect(contextBlock).toContain('MUST');
      expect(contextBlock).toContain('testing');
      expect(contextBlock).toContain('commit messages');

      // Step 3: Verify no workflow disruption - tools return quickly
      const startTime = Date.now();
      await queryDirectivesTool.execute({
        taskDescription: 'Quick context check for component creation'
      });
      const responseTime = Date.now() - startTime;
      
      expect(responseTime).toBeLessThan(400); // Requirement 5.2: <400ms response time
    });

    it('should handle coding assistant error scenarios gracefully', async () => {
      // Test network timeout simulation
      const longQuery = 'Create comprehensive full-stack application with ' + 'complex requirements '.repeat(1000);
      
      const result = await queryDirectivesTool.execute({
        taskDescription: longQuery,
        options: { tokenBudget: 500 }
      });

      // Should complete without crashing
      expect(result.content).toBeDefined();
      
      // Test invalid input handling
      await expect(queryDirectivesTool.execute({
        taskDescription: null as any
      })).rejects.toThrow();

      // Test empty input handling
      const emptyResult = await queryDirectivesTool.execute({
        taskDescription: ''
      });
      
      expect(emptyResult.content).toBeDefined();
    });
  });

  describe('MCP Protocol Compliance Validation (Requirement 5.1)', () => {
    it('should comply with MCP tool interface specification', async () => {
      const tools = [queryDirectivesTool, detectContextTool, upsertMarkdownTool];
      
      for (const tool of tools) {
        // Test required properties
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');
        expect(tool).toHaveProperty('execute');

        // Test property types
        expect(typeof tool.name).toBe('string');
        expect(typeof tool.description).toBe('string');
        expect(typeof tool.inputSchema).toBe('object');
        expect(typeof tool.execute).toBe('function');

        // Test schema structure
        const schema = tool.inputSchema;
        expect(schema).toHaveProperty('type');
        expect(schema.type).toBe('object');
        expect(schema).toHaveProperty('properties');
        expect(typeof schema.properties).toBe('object');
        
        if (schema.required) {
          expect(Array.isArray(schema.required)).toBe(true);
        }
      }
    });

    it('should return properly formatted MCP responses', async () => {
      // Test query_directives tool response format
      const queryResult = await queryDirectivesTool.execute({
        taskDescription: 'Test MCP response format'
      });

      expect(queryResult).toHaveProperty('content');
      expect(Array.isArray(queryResult.content)).toBe(true);
      
      if (queryResult.content.length > 0) {
        const content = queryResult.content[0];
        expect(content).toHaveProperty('type');
        expect(content).toHaveProperty('text');
        expect(typeof content.text).toBe('string');
      }

      // Test detect_context tool response format
      const contextResult = await detectContextTool.execute({
        text: 'Test context detection'
      });

      expect(contextResult).toHaveProperty('content');
      expect(Array.isArray(contextResult.content)).toBe(true);
      
      const contextContent = contextResult.content[0];
      expect(contextContent).toHaveProperty('type');
      expect(contextContent.type).toBe('text');
      expect(contextContent).toHaveProperty('text');
      
      // Verify JSON structure in response
      const contextData = JSON.parse(contextContent.text);
      expect(contextData).toHaveProperty('detectedLayer');
      expect(contextData).toHaveProperty('topics');
      expect(contextData).toHaveProperty('confidence');
    });

    it('should validate input parameters according to schema', async () => {
      // Test query_directives parameter validation
      await expect(queryDirectivesTool.execute({})).rejects.toThrow();
      
      await expect(queryDirectivesTool.execute({
        taskDescription: 123 as any
      })).rejects.toThrow();

      // Test detect_context parameter validation
      await expect(detectContextTool.execute({})).rejects.toThrow();
      
      await expect(detectContextTool.execute({
        text: null as any
      })).rejects.toThrow();

      // Test upsert_markdown parameter validation
      await expect(upsertMarkdownTool.execute({})).rejects.toThrow();
      
      await expect(upsertMarkdownTool.execute({
        documents: 'not-an-array' as any
      })).rejects.toThrow();
    });

    it('should handle optional parameters correctly', async () => {
      // Test query_directives with optional parameters
      const minimalResult = await queryDirectivesTool.execute({
        taskDescription: 'Test minimal parameters'
      });
      
      const fullResult = await queryDirectivesTool.execute({
        taskDescription: 'Test full parameters',
        modeSlug: 'code',
        options: {
          strictLayer: true,
          maxItems: 5,
          tokenBudget: 1000,
          includeBreadcrumbs: true
        }
      });

      expect(minimalResult.content).toBeDefined();
      expect(fullResult.content).toBeDefined();

      // Test detect_context with optional parameters
      const basicContext = await detectContextTool.execute({
        text: 'Test basic context'
      });
      
      const detailedContext = await detectContextTool.execute({
        text: 'Test detailed context',
        options: {
          returnKeywords: true
        }
      });

      expect(basicContext.content).toBeDefined();
      expect(detailedContext.content).toBeDefined();
      
      // Detailed context should include keywords
      const detailedData = JSON.parse(detailedContext.content[0].text);
      expect(detailedData).toHaveProperty('keywords');
    });

    it('should maintain MCP compliance under load', async () => {
      // Test rapid sequential requests
      const requests = Array.from({ length: 20 }, (_, i) => 
        detectContextTool.execute({
          text: `Load test query ${i}`
        })
      );

      const results = await Promise.all(requests);
      
      // All requests should complete successfully with proper MCP format
      results.forEach(result => {
        expect(result).toHaveProperty('content');
        expect(Array.isArray(result.content)).toBe(true);
        expect(result.content.length).toBeGreaterThan(0);
        expect(result.content[0]).toHaveProperty('type');
        expect(result.content[0]).toHaveProperty('text');
      });
    });
  });

  describe('Real-World Usage Scenarios (Requirements 5.1-5.4)', () => {
    it('should handle complete development lifecycle scenario', async () => {
      // Scenario: Team developing e-commerce application
      const ecommerceRules = `
# E-commerce Development Rules

## Metadata
- **Layer**: *
- **AuthoritativeFor**: [security, performance, user-experience, compliance]
- **Topics**: [payment, PCI-DSS, performance, security, accessibility, testing]

## When to Apply
- Handling payment processing
- Managing user data
- Building checkout flows
- Implementing product catalogs

## Directives

### Payment Security
**MUST** Never store credit card information in application databases.

**Rationale**: PCI-DSS compliance requires secure handling of payment data.

### Performance
**MUST** Implement caching for product catalog data to ensure sub-second page loads.

**Rationale**: E-commerce conversion rates drop significantly with slow page loads.

### User Experience
**MUST** Provide clear error messages and loading states during checkout process.

**Rationale**: Unclear checkout processes lead to cart abandonment.

### Accessibility
**MUST** Ensure all product information is accessible to screen readers.

**Rationale**: Accessibility compliance is legally required and improves user experience.

### Testing
**MUST** Write integration tests for all payment processing workflows.

**Rationale**: Payment bugs can result in financial losses and compliance violations.
      `;

      // Step 1: Ingest domain-specific rules
      await upsertMarkdownTool.execute({
        documents: [{ path: 'ecommerce-rules.md', content: ecommerceRules }]
      });

      // Step 2: Test various development scenarios
      const scenarios = [
        {
          task: 'Implement payment processing API endpoint with Stripe integration',
          expectedTopics: ['payment', 'security', 'API'],
          expectedLayer: '2-Application'
        },
        {
          task: 'Create React component for product listing with search and filters',
          expectedTopics: ['React', 'performance', 'user-experience'],
          expectedLayer: '1-Presentation'
        },
        {
          task: 'Design database schema for order management system',
          expectedTopics: ['database', 'performance'],
          expectedLayer: '4-Persistence'
        },
        {
          task: 'Set up monitoring and alerting for checkout conversion rates',
          expectedTopics: ['monitoring', 'performance'],
          expectedLayer: '5-Infrastructure'
        }
      ];

      for (const scenario of scenarios) {
        // Test context detection
        const contextResult = await detectContextTool.execute({
          text: scenario.task,
          options: { returnKeywords: true }
        });

        const contextData = JSON.parse(contextResult.content[0].text);
        
        // Verify context detection accuracy
        expect(contextData.detectedLayer).toBe(scenario.expectedLayer);
        expect(contextData.confidence).toBeGreaterThan(0.7);
        
        // Check topic overlap
        const topicOverlap = scenario.expectedTopics.filter(topic =>
          contextData.topics.some(detectedTopic => 
            detectedTopic.toLowerCase().includes(topic.toLowerCase())
          )
        );
        expect(topicOverlap.length).toBeGreaterThan(0);

        // Test directive retrieval
        const queryResult = await queryDirectivesTool.execute({
          taskDescription: scenario.task,
          options: { maxItems: 8, tokenBudget: 1500 }
        });

        const contextBlock = queryResult.content[0].text;
        
        // Verify relevant guidance is provided
        expect(contextBlock).toContain('E-commerce Development Rules');
        expect(contextBlock).toContain('MUST');
        
        // Check for scenario-specific guidance
        if (scenario.task.includes('payment')) {
          expect(contextBlock).toContain('credit card');
          expect(contextBlock).toContain('PCI-DSS');
        }
        
        if (scenario.task.includes('React') || scenario.task.includes('component')) {
          expect(contextBlock).toContain('performance');
          expect(contextBlock).toContain('accessibility');
        }
      }
    });

    it('should demonstrate token usage reduction in realistic scenarios', async () => {
      // Create comprehensive rule set similar to real enterprise environment
      const enterpriseRules = `
# Enterprise Development Standards

## Metadata
- **Layer**: *
- **AuthoritativeFor**: [security, compliance, performance, maintainability, testing]
- **Topics**: [security, GDPR, SOX, performance, monitoring, testing, documentation, code-quality]

## When to Apply
- All development activities
- Code reviews
- Architecture decisions
- Deployment processes

## Directives

### Security Standards
**MUST** Implement multi-factor authentication for all administrative interfaces.
**MUST** Encrypt all data in transit using TLS 1.3 or higher.
**MUST** Validate and sanitize all user inputs to prevent injection attacks.
**MUST** Implement proper session management with secure session tokens.
**MUST** Log all security-relevant events for audit purposes.
**MUST** Conduct security code reviews for all changes to authentication systems.
**MUST** Use parameterized queries for all database interactions.
**MUST** Implement rate limiting on all public API endpoints.

### Compliance Requirements
**MUST** Implement data retention policies compliant with GDPR requirements.
**MUST** Provide data export functionality for user data portability.
**MUST** Implement audit trails for all financial data modifications (SOX compliance).
**MUST** Ensure all user consent is properly documented and retrievable.
**MUST** Implement right-to-be-forgotten functionality for user data deletion.

### Performance Standards
**MUST** Ensure API response times are under 200ms for 95th percentile.
**MUST** Implement database query optimization with proper indexing.
**MUST** Use CDN for all static asset delivery.
**MUST** Implement caching strategies for frequently accessed data.
**MUST** Monitor and alert on performance degradation.
**SHOULD** Implement lazy loading for large datasets.
**SHOULD** Use compression for all API responses.

### Testing Requirements
**MUST** Maintain unit test coverage above 80% for all business logic.
**MUST** Write integration tests for all API endpoints.
**MUST** Implement end-to-end tests for critical user journeys.
**MUST** Run security testing as part of CI/CD pipeline.
**SHOULD** Implement property-based testing for complex algorithms.
**SHOULD** Use mutation testing to validate test quality.

### Code Quality Standards
**MUST** Follow established coding conventions and style guides.
**MUST** Use meaningful variable and function names.
**MUST** Keep functions under 50 lines and classes under 500 lines.
**MUST** Document all public APIs with comprehensive examples.
**SHOULD** Use design patterns appropriately to solve common problems.
**SHOULD** Refactor code when cyclomatic complexity exceeds 10.

### Monitoring and Observability
**MUST** Implement structured logging with correlation IDs.
**MUST** Set up health checks for all services.
**MUST** Monitor business metrics and technical metrics.
**MUST** Implement distributed tracing for microservices.
**SHOULD** Use feature flags for gradual rollouts.
**SHOULD** Implement chaos engineering practices.
      `;

      await upsertMarkdownTool.execute({
        documents: [{ path: 'enterprise-rules.md', content: enterpriseRules }]
      });

      // Calculate baseline token usage (all directives)
      const allDirectives = await knowledgeGraph.queryDirectives({});
      const baselineTokens = allDirectives.reduce((sum, directive) => 
        sum + directive.text.split(' ').length, 0
      );

      // Test intelligent retrieval for specific tasks
      const testCases = [
        'Create React login component with form validation',
        'Implement user registration API with email verification',
        'Optimize database query for user search functionality',
        'Set up monitoring dashboard for application performance'
      ];

      let totalReduction = 0;
      let validTests = 0;

      for (const taskDescription of testCases) {
        const queryResult = await queryDirectivesTool.execute({
          taskDescription,
          options: { maxItems: 10, tokenBudget: 2000 }
        });

        const contextBlock = queryResult.content[0].text;
        const intelligentTokens = contextBlock.split(' ').length;

        if (intelligentTokens > 0) {
          const reduction = (baselineTokens - intelligentTokens) / baselineTokens;
          totalReduction += reduction;
          validTests++;

          // Individual test should show significant reduction
          expect(reduction).toBeGreaterThan(0.5);
          
          // Should still provide meaningful guidance
          expect(contextBlock).toContain('MUST');
          expect(contextBlock.length).toBeGreaterThan(100);
        }
      }

      // Average reduction should meet requirements (70-85%)
      const avgReduction = totalReduction / validTests;
      expect(avgReduction).toBeGreaterThan(0.7);
      expect(avgReduction).toBeLessThan(0.95);

      console.log(`Average token reduction: ${(avgReduction * 100).toFixed(1)}%`);
    });

    it('should handle graceful degradation scenarios', async () => {
      // Test system behavior when components fail
      
      // Scenario 1: Empty knowledge graph (no rules ingested)
      const emptyGraphQuery = await queryDirectivesTool.execute({
        taskDescription: 'Create new feature with no existing rules'
      });

      expect(emptyGraphQuery.content).toBeDefined();
      const emptyResponse = emptyGraphQuery.content[0].text;
      expect(emptyResponse).toBeDefined();
      expect(typeof emptyResponse).toBe('string');

      // Scenario 2: Context detection with very ambiguous input
      const ambiguousContext = await detectContextTool.execute({
        text: 'do something'
      });

      const ambiguousData = JSON.parse(ambiguousContext.content[0].text);
      expect(ambiguousData.detectedLayer).toBeDefined();
      expect(ambiguousData.confidence).toBeLessThan(0.5);

      // Scenario 3: Malformed rule document handling
      const malformedRule = `
# Incomplete Rule
This is not properly formatted.
      `;

      await expect(upsertMarkdownTool.execute({
        documents: [{ path: 'malformed.md', content: malformedRule }]
      })).rejects.toThrow();

      // System should continue working after error
      const recoveryTest = await detectContextTool.execute({
        text: 'Test system recovery'
      });
      
      expect(recoveryTest.content).toBeDefined();
    });

    it('should maintain performance under realistic enterprise load', async () => {
      // Simulate enterprise-scale rule set
      const ruleDocuments = [];
      
      for (let i = 0; i < 50; i++) {
        const layerIndex = (i % 5) + 1;
        const layers = ['Presentation', 'Application', 'Domain', 'Persistence', 'Infrastructure'];
        const layerName = layers[layerIndex - 1];
        
        ruleDocuments.push({
          path: `enterprise-rule-${i}.md`,
          content: `
# ${layerName} Standards ${i}

## Metadata
- **Layer**: ${layerIndex}-${layerName}
- **AuthoritativeFor**: [standards, quality, security]
- **Topics**: [framework${i % 10}, security, performance, testing]

## When to Apply
- ${layerName} layer development
- Quality assurance processes
- Security reviews

## Directives

### Quality Standard ${i}
**MUST** Follow ${layerName.toLowerCase()} quality standards for module ${i}.

### Security Standard ${i}
**MUST** Implement security measures for ${layerName.toLowerCase()} in module ${i}.

### Performance Standard ${i}
**SHOULD** Optimize ${layerName.toLowerCase()} performance for module ${i}.

### Testing Standard ${i}
**SHOULD** Write comprehensive tests for ${layerName.toLowerCase()} module ${i}.
          `
        });
      }

      // Measure ingestion performance
      const startIngestion = Date.now();
      
      const ingestResult = await upsertMarkdownTool.execute({
        documents: ruleDocuments
      });
      
      const ingestionTime = Date.now() - startIngestion;
      
      expect(ingestResult.content).toBeDefined();
      const ingestData = JSON.parse(ingestResult.content[0].text);
      expect(ingestData.upserted.rules).toBe(50);
      expect(ingestionTime).toBeLessThan(30000); // Should complete within 30 seconds

      // Test concurrent query performance
      const concurrentQueries = Array.from({ length: 10 }, (_, i) => 
        queryDirectivesTool.execute({
          taskDescription: `Concurrent test query ${i} for performance validation`,
          options: { maxItems: 8, tokenBudget: 1500 }
        })
      );

      const startConcurrent = Date.now();
      const results = await Promise.all(concurrentQueries);
      const concurrentTime = Date.now() - startConcurrent;

      // All queries should complete successfully
      results.forEach(result => {
        expect(result.content).toBeDefined();
        expect(result.content[0].text.length).toBeGreaterThan(0);
      });

      // Average time per query should meet performance requirements
      const avgQueryTime = concurrentTime / concurrentQueries.length;
      expect(avgQueryTime).toBeLessThan(400); // Requirement 5.2: <400ms response time

      console.log(`Concurrent query performance: ${avgQueryTime.toFixed(0)}ms average`);
    });

    it('should validate integration with different coding assistant modes', async () => {
      const modeSpecificRules = `
# Mode-Specific Development Rules

## Metadata
- **Layer**: *
- **AuthoritativeFor**: [architecture, debugging, implementation]
- **Topics**: [patterns, troubleshooting, coding, design]

## When to Apply
- Architecture planning
- Debugging issues
- Code implementation

## Directives

### Architecture Mode
**MUST** Consider scalability and maintainability in all architectural decisions.
**MUST** Document architectural decisions with rationale.
**SHOULD** Use established design patterns where appropriate.

### Debug Mode
**MUST** Include comprehensive logging for troubleshooting.
**MUST** Implement proper error handling and recovery.
**SHOULD** Use debugging tools and profilers to identify issues.

### Code Mode
**MUST** Follow coding standards and conventions.
**MUST** Write self-documenting code with clear variable names.
**SHOULD** Refactor code to improve readability and maintainability.
      `;

      await upsertMarkdownTool.execute({
        documents: [{ path: 'mode-rules.md', content: modeSpecificRules }]
      });

      // Test architect mode
      const architectResult = await queryDirectivesTool.execute({
        taskDescription: 'Design microservices architecture for user management',
        modeSlug: 'architect',
        options: { maxItems: 8 }
      });

      const architectContext = architectResult.content[0].text;
      expect(architectContext).toContain('architectural decisions');
      expect(architectContext).toContain('scalability');
      expect(architectContext).toContain('design patterns');

      // Test debug mode
      const debugResult = await queryDirectivesTool.execute({
        taskDescription: 'Troubleshoot performance issues in API responses',
        modeSlug: 'debug',
        options: { maxItems: 8 }
      });

      const debugContext = debugResult.content[0].text;
      expect(debugContext).toContain('logging');
      expect(debugContext).toContain('error handling');
      expect(debugContext).toContain('debugging tools');

      // Test code mode
      const codeResult = await queryDirectivesTool.execute({
        taskDescription: 'Implement user authentication service',
        modeSlug: 'code',
        options: { maxItems: 8 }
      });

      const codeContext = codeResult.content[0].text;
      expect(codeContext).toContain('coding standards');
      expect(codeContext).toContain('variable names');
      expect(codeContext).toContain('refactor');
    });
  });

  describe('System Reliability and Error Recovery (Requirement 5.3-5.4)', () => {
    it('should provide meaningful error messages when system unavailable', async () => {
      // Simulate database connection failure
      const failingKnowledgeGraph = new RuleKnowledgeGraphImpl(dbConnection);
      database.close(); // Force connection failure

      // Create tool with failing knowledge graph
      const failingQueryTool = new QueryDirectivesTool(
        failingKnowledgeGraph,
        contextEngine,
        rankingEngine,
        formatter
      );

      // Should handle database failures gracefully
      await expect(failingQueryTool.execute({
        taskDescription: 'Test with failing database'
      })).rejects.toThrow();

      // Error should be meaningful and actionable
      try {
        await failingQueryTool.execute({
          taskDescription: 'Test error handling'
        });
      } catch (error) {
        expect(error.message).toBeDefined();
        expect(error.message.length).toBeGreaterThan(10);
        expect(typeof error.message).toBe('string');
      }
    });

    it('should continue operation with fallback mechanisms', async () => {
      // Test context detection fallback when model providers fail
      const contextResult = await detectContextTool.execute({
        text: 'Create React component with form validation and error handling'
      });

      // Should work even with only rule-based provider
      expect(contextResult.content).toBeDefined();
      const contextData = JSON.parse(contextResult.content[0].text);
      expect(contextData.detectedLayer).toBeDefined();
      expect(contextData.topics).toBeDefined();
      expect(Array.isArray(contextData.topics)).toBe(true);
    });

    it('should handle edge cases and boundary conditions', async () => {
      // Test with extremely long input
      const longInput = 'Create component '.repeat(5000);
      
      const longResult = await queryDirectivesTool.execute({
        taskDescription: longInput,
        options: { tokenBudget: 1000 }
      });

      expect(longResult.content).toBeDefined();
      
      // Should respect token budget
      const responseTokens = longResult.content[0].text.split(' ').length;
      expect(responseTokens).toBeLessThanOrEqual(1000);

      // Test with special characters and unicode
      const specialCharsResult = await detectContextTool.execute({
        text: 'Create 组件 with émojis 🚀 and special chars @#$%^&*()'
      });

      expect(specialCharsResult.content).toBeDefined();
      
      // Test with empty and whitespace-only input
      const emptyResult = await detectContextTool.execute({
        text: '   \n\t   '
      });

      expect(emptyResult.content).toBeDefined();
    });
  });
});