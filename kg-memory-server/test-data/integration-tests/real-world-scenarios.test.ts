/**
 * Real-World Usage Scenarios Integration Tests
 * Tests the KG Memory Server in realistic development scenarios
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { Database } from "sqlite3";
import { RuleKnowledgeGraphImpl } from "../../src/storage/rule-knowledge-graph.js";
import { RuleDocumentParser } from "../../src/parsers/rule-document-parser.js";
import { QueryDirectivesTool } from "../../src/mcp-tools/query-directives-tool.js";
import { DetectContextTool } from "../../src/mcp-tools/detect-context-tool.js";
import { UpsertMarkdownTool } from "../../src/mcp-tools/upsert-markdown-tool.js";
import { ContextDetectionEngine } from "../../src/context-detection/context-detection-engine.js";
import { DirectiveRankingEngine } from "../../src/ranking/directive-ranking-engine.js";
import { ContextBlockFormatter } from "../../src/formatting/context-block-formatter.js";
import { DefaultModelProviderManager } from "../../src/providers/model-provider-manager.js";
import { RuleBasedProvider } from "../../src/providers/rule-based-provider.js";
import { DatabaseConnection } from "../../src/database/connection.js";

describe("Real-World Usage Scenarios Integration Tests", () => {
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
    database = new Database(":memory:");
    dbConnection = new DatabaseConnection(database);

    // Initialize components
    knowledgeGraph = new RuleKnowledgeGraphImpl(dbConnection);
    parser = new RuleDocumentParser();

    // Set up model provider with fallback
    providerManager = new DefaultModelProviderManager({
      primaryProvider: {
        provider: "rule-based",
        config: {},
      },
    });

    contextEngine = new ContextDetectionEngine(providerManager);
    rankingEngine = new DirectiveRankingEngine();
    formatter = new ContextBlockFormatter();

    // Initialize database schema
    await knowledgeGraph.initialize();

    // Initialize MCP tools
    queryDirectivesTool = new QueryDirectivesTool(
      knowledgeGraph,
      contextEngine,
      rankingEngine,
      formatter
    );

    detectContextTool = new DetectContextTool(contextEngine);

    upsertMarkdownTool = new UpsertMarkdownTool(knowledgeGraph, parser);
  });

  afterAll(async () => {
    if (database) {
      database.close();
    }
  });

  beforeEach(async () => {
    // Clear database between tests
    await knowledgeGraph.clear();
  });

  describe("Coding Assistant Integration Scenarios", () => {
    it("should handle typical React component creation workflow", async () => {
      // Simulate ingesting team's React development rules
      const reactRules = `
# React Development Rules

## Metadata
- **Layer**: 1-Presentation
- **AuthoritativeFor**: [React, components, forms, validation]
- **Topics**: [React, TypeScript, forms, validation, accessibility, testing]

## When to Apply
- Creating React components
- Building user interfaces
- Handling user input and forms

## Directives

### Component Structure
**MUST** Use functional components with TypeScript interfaces for props.

**Rationale**: Functional components with hooks are the modern React standard and TypeScript provides better type safety.

**Example**: 
\`\`\`typescript
interface ButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
}

const Button: React.FC<ButtonProps> = ({ onClick, children, variant = 'primary' }) => {
  return <button className={\`btn btn-\${variant}\`} onClick={onClick}>{children}</button>;
};
\`\`\`

### Form Validation
**MUST** Implement both client-side and server-side validation for all form inputs.

**Rationale**: Client-side validation provides immediate feedback while server-side validation ensures security.

### Accessibility
**MUST** Ensure all interactive elements have proper ARIA labels and keyboard navigation support.

**Rationale**: Accessibility is required for compliance and inclusive user experience.

### Testing
**SHOULD** Write unit tests for component logic and integration tests for user interactions.

**Rationale**: Testing ensures component reliability and prevents regressions.
      `;

      // Step 1: Ingest the rules
      const ingestResult = await upsertMarkdownTool.execute({
        documents: [{ path: "react-rules.md", content: reactRules }],
      });

      expect(ingestResult.content).toBeDefined();
      const ingestData = JSON.parse(ingestResult.content[0].text);
      expect(ingestData.upserted.rules).toBeGreaterThan(0);
      expect(ingestData.upserted.directives).toBeGreaterThan(0);

      // Step 2: Simulate coding assistant query for React component
      const taskDescription =
        "Create a React login form component with email and password fields, validation, and accessibility features";

      const queryResult = await queryDirectivesTool.execute({
        taskDescription,
        modeSlug: "code",
        options: {
          maxItems: 10,
          tokenBudget: 2000,
          includeBreadcrumbs: true,
        },
      });

      expect(queryResult.content).toBeDefined();
      const contextBlock = queryResult.content[0].text;

      // Verify the context block contains relevant guidance
      expect(contextBlock).toContain("React Development Rules");
      expect(contextBlock).toContain("MUST");
      expect(contextBlock).toContain("functional components");
      expect(contextBlock).toContain("validation");
      expect(contextBlock).toContain("accessibility");
      expect(contextBlock).toContain("ARIA labels");
      expect(contextBlock).toContain("Layer: 1-Presentation");

      // Step 3: Verify context detection worked correctly
      const contextResult = await detectContextTool.execute({
        text: taskDescription,
        options: { returnKeywords: true },
      });

      const contextData = JSON.parse(contextResult.content[0].text);
      expect(contextData.detectedLayer).toBe("1-Presentation");
      expect(contextData.topics).toContain("React");
      expect(contextData.topics).toContain("forms");
      expect(contextData.confidence).toBeGreaterThan(0.8);
      expect(contextData.keywords).toContain("login");
      expect(contextData.keywords).toContain("form");
    });

    it("should handle API development workflow with security considerations", async () => {
      const apiSecurityRules = `
# API Security Rules

## Metadata
- **Layer**: 2-Application
- **AuthoritativeFor**: [API, security, authentication, authorization]
- **Topics**: [REST, GraphQL, authentication, JWT, validation, CORS, rate-limiting]

## When to Apply
- Creating REST API endpoints
- Implementing GraphQL resolvers
- Handling authentication and authorization

## Directives

### Authentication
**MUST** Implement JWT-based authentication for all protected endpoints.

**Rationale**: JWT tokens provide stateless authentication and can be validated without database lookups.

### Input Validation
**MUST** Validate and sanitize all input parameters using a schema validation library.

**Rationale**: Input validation prevents injection attacks and ensures data integrity.

### Rate Limiting
**MUST** Implement rate limiting on all public API endpoints to prevent abuse.

**Rationale**: Rate limiting protects against DoS attacks and ensures fair resource usage.

### CORS Configuration
**MUST** Configure CORS headers restrictively, only allowing necessary origins.

**Rationale**: Proper CORS configuration prevents unauthorized cross-origin requests.

### Error Handling
**MUST** Never expose internal error details in API responses to prevent information leakage.

**Rationale**: Detailed error messages can reveal system architecture to attackers.
      `;

      await upsertMarkdownTool.execute({
        documents: [
          { path: "api-security-rules.md", content: apiSecurityRules },
        ],
      });

      const taskDescription =
        "Implement REST API endpoint for user registration with email validation and rate limiting";

      const queryResult = await queryDirectivesTool.execute({
        taskDescription,
        modeSlug: "code",
        options: { maxItems: 8, tokenBudget: 1500 },
      });

      const contextBlock = queryResult.content[0].text;

      // Verify security-focused guidance is provided
      expect(contextBlock).toContain("API Security Rules");
      expect(contextBlock).toContain("JWT");
      expect(contextBlock).toContain("validation");
      expect(contextBlock).toContain("rate limiting");
      expect(contextBlock).toContain("sanitize");
      expect(contextBlock).toContain("Layer: 2-Application");

      // Verify context detection for API tasks
      const contextResult = await detectContextTool.execute({
        text: taskDescription,
      });

      const contextData = JSON.parse(contextResult.content[0].text);
      expect(contextData.detectedLayer).toBe("2-Application");
      expect(contextData.topics).toContain("API");
      expect(contextData.topics).toContain("validation");
    });

    it("should handle database optimization workflow", async () => {
      const databaseRules = `
# Database Performance Rules

## Metadata
- **Layer**: 4-Persistence
- **AuthoritativeFor**: [database, performance, indexing, queries]
- **Topics**: [SQL, PostgreSQL, indexing, performance, migrations, transactions]

## When to Apply
- Writing database queries
- Creating database migrations
- Optimizing database performance

## Directives

### Query Optimization
**MUST** Use appropriate indexes for all frequently queried columns.

**Rationale**: Proper indexing dramatically improves query performance and reduces database load.

### Transaction Management
**MUST** Use database transactions for operations that modify multiple tables.

**Rationale**: Transactions ensure data consistency and prevent partial updates.

### Connection Pooling
**MUST** Implement connection pooling to manage database connections efficiently.

**Rationale**: Connection pooling prevents connection exhaustion and improves performance.

### Query Analysis
**SHOULD** Use EXPLAIN ANALYZE to review query execution plans before deploying to production.

**Rationale**: Query analysis helps identify performance bottlenecks and optimization opportunities.
      `;

      await upsertMarkdownTool.execute({
        documents: [{ path: "database-rules.md", content: databaseRules }],
      });

      const taskDescription =
        "Optimize slow database query for user search with pagination and filtering";

      const queryResult = await queryDirectivesTool.execute({
        taskDescription,
        modeSlug: "debug",
        options: { maxItems: 6 },
      });

      const contextBlock = queryResult.content[0].text;

      expect(contextBlock).toContain("Database Performance Rules");
      expect(contextBlock).toContain("indexes");
      expect(contextBlock).toContain("EXPLAIN ANALYZE");
      expect(contextBlock).toContain("performance");
      expect(contextBlock).toContain("Layer: 4-Persistence");

      const contextResult = await detectContextTool.execute({
        text: taskDescription,
      });

      const contextData = JSON.parse(contextResult.content[0].text);
      expect(contextData.detectedLayer).toBe("4-Persistence");
      expect(contextData.topics).toContain("database");
      expect(contextData.topics).toContain("performance");
    });

    it("should handle cross-layer architecture decisions", async () => {
      // Ingest rules for multiple layers
      const architectureRules = `
# System Architecture Rules

## Metadata
- **Layer**: *
- **AuthoritativeFor**: [architecture, patterns, design]
- **Topics**: [microservices, API, database, caching, monitoring]

## When to Apply
- Making architectural decisions
- Designing system components
- Planning system integrations

## Directives

### Service Boundaries
**MUST** Define clear service boundaries based on business domains, not technical layers.

**Rationale**: Domain-driven service boundaries improve maintainability and team autonomy.

### Data Consistency
**MUST** Choose appropriate consistency models (eventual vs strong) based on business requirements.

**Rationale**: Different data has different consistency requirements that affect system design.

### Monitoring
**MUST** Implement comprehensive logging and monitoring for all system components.

**Rationale**: Observability is essential for maintaining distributed systems in production.
      `;

      const frontendRules = `
# Frontend Architecture Rules

## Metadata
- **Layer**: 1-Presentation
- **AuthoritativeFor**: [frontend, state-management, routing]
- **Topics**: [React, Redux, routing, performance]

## Directives

### State Management
**MUST** Use centralized state management for shared application state.

**Rationale**: Centralized state prevents prop drilling and makes state changes predictable.
      `;

      await upsertMarkdownTool.execute({
        documents: [
          { path: "architecture-rules.md", content: architectureRules },
          { path: "frontend-rules.md", content: frontendRules },
        ],
      });

      const taskDescription =
        "Design user authentication system with React frontend, API backend, and session management";

      const queryResult = await queryDirectivesTool.execute({
        taskDescription,
        modeSlug: "architect",
        options: { maxItems: 12, tokenBudget: 3000 },
      });

      const contextBlock = queryResult.content[0].text;

      // Should include guidance from multiple layers
      expect(contextBlock).toContain("System Architecture Rules");
      expect(contextBlock).toContain("Frontend Architecture Rules");
      expect(contextBlock).toContain("service boundaries");
      expect(contextBlock).toContain("state management");
      expect(contextBlock).toContain("monitoring");

      // Verify cross-layer context detection
      const contextResult = await detectContextTool.execute({
        text: taskDescription,
      });

      const contextData = JSON.parse(contextResult.content[0].text);
      expect(contextData.topics).toContain("authentication");
      expect(contextData.topics).toContain("React");
      expect(contextData.topics).toContain("API");
    });
  });

  describe("Performance and Scalability Scenarios", () => {
    it("should handle large rule sets efficiently", async () => {
      // Create a large set of rules to test scalability
      const ruleDocuments = [];

      for (let i = 0; i < 20; i++) {
        const layerIndex = (i % 5) + 1;
        const layerName = [
          "Presentation",
          "Application",
          "Domain",
          "Persistence",
          "Infrastructure",
        ][layerIndex - 1];

        ruleDocuments.push({
          path: `rules-${i}.md`,
          content: `
# ${layerName} Rules ${i}

## Metadata
- **Layer**: ${layerIndex}-${layerName}
- **AuthoritativeFor**: [topic${i}, common, performance]
- **Topics**: [framework${i}, security, testing, performance]

## When to Apply
- Working with ${layerName.toLowerCase()} layer
- Implementing feature ${i}
- Performance optimization

## Directives

### Performance Rule ${i}
**MUST** Optimize ${layerName.toLowerCase()} performance for feature ${i}.

**Rationale**: Performance is critical for user experience.

### Security Rule ${i}
**MUST** Implement security measures for ${layerName.toLowerCase()} in feature ${i}.

**Rationale**: Security cannot be compromised.

### Testing Rule ${i}
**SHOULD** Write comprehensive tests for ${layerName.toLowerCase()} feature ${i}.

**Rationale**: Testing ensures reliability.
          `,
        });
      }

      // Measure ingestion performance
      const startIngestion = Date.now();

      const ingestResult = await upsertMarkdownTool.execute({
        documents: ruleDocuments,
      });

      const ingestionTime = Date.now() - startIngestion;

      expect(ingestResult.content).toBeDefined();
      const ingestData = JSON.parse(ingestResult.content[0].text);
      expect(ingestData.upserted.rules).toBe(20);
      expect(ingestionTime).toBeLessThan(10000); // Should complete within 10 seconds

      // Test query performance with large rule set
      const queries = [
        "Optimize React component performance",
        "Implement secure API authentication",
        "Design domain entity relationships",
        "Optimize database query performance",
        "Set up monitoring infrastructure",
      ];

      const queryTimes: number[] = [];

      for (const query of queries) {
        const startQuery = Date.now();

        const result = await queryDirectivesTool.execute({
          taskDescription: query,
          options: { maxItems: 10, tokenBudget: 2000 },
        });

        const queryTime = Date.now() - startQuery;
        queryTimes.push(queryTime);

        expect(result.content).toBeDefined();
        expect(queryTime).toBeLessThan(400); // Meet performance requirement
      }

      const avgQueryTime =
        queryTimes.reduce((sum, time) => sum + time, 0) / queryTimes.length;
      expect(avgQueryTime).toBeLessThan(200); // Average should be well under limit
    });

    it("should demonstrate token usage reduction effectiveness", async () => {
      // Ingest comprehensive rule set
      const comprehensiveRules = `
# Comprehensive Development Rules

## Metadata
- **Layer**: *
- **AuthoritativeFor**: [security, performance, testing, accessibility, documentation]
- **Topics**: [React, API, database, deployment, monitoring, security, testing, performance]

## When to Apply
- All development activities
- Code reviews
- Architecture decisions

## Directives

### Security
**MUST** Validate all user inputs to prevent injection attacks.
**MUST** Use HTTPS for all API communications.
**MUST** Implement proper authentication and authorization.
**MUST** Store sensitive data encrypted at rest.
**MUST** Log security events for audit purposes.

### Performance
**MUST** Optimize database queries with proper indexing.
**MUST** Implement caching for frequently accessed data.
**MUST** Minimize bundle sizes for frontend applications.
**MUST** Use CDN for static asset delivery.
**SHOULD** Implement lazy loading for large components.

### Testing
**MUST** Write unit tests for all business logic.
**MUST** Implement integration tests for API endpoints.
**SHOULD** Write end-to-end tests for critical user flows.
**SHOULD** Maintain test coverage above 80%.
**MAY** Use property-based testing for complex algorithms.

### Accessibility
**MUST** Ensure keyboard navigation for all interactive elements.
**MUST** Provide alt text for all images.
**MUST** Use semantic HTML elements.
**SHOULD** Test with screen readers.
**SHOULD** Maintain color contrast ratios above 4.5:1.

### Documentation
**MUST** Document all public API endpoints.
**MUST** Maintain up-to-date README files.
**SHOULD** Write inline code comments for complex logic.
**SHOULD** Create architecture decision records (ADRs).
**MAY** Generate API documentation automatically.

### Code Quality
**MUST** Follow consistent code formatting standards.
**MUST** Use meaningful variable and function names.
**MUST** Keep functions small and focused.
**SHOULD** Avoid deep nesting in conditional logic.
**SHOULD** Use design patterns appropriately.
      `;

      await upsertMarkdownTool.execute({
        documents: [
          { path: "comprehensive-rules.md", content: comprehensiveRules },
        ],
      });

      // Get baseline token count (all directives)
      const allDirectives = await knowledgeGraph.getAllDirectives();
      const baselineTokens = allDirectives.reduce(
        (sum, directive) => sum + directive.text.split(" ").length,
        0
      );

      // Test intelligent retrieval for specific task
      const taskDescription =
        "Create React component for user profile form with validation";

      const queryResult = await queryDirectivesTool.execute({
        taskDescription,
        options: { maxItems: 8, tokenBudget: 1000 },
      });

      const contextBlock = queryResult.content[0].text;
      const intelligentTokens = contextBlock.split(" ").length;

      // Calculate token reduction
      const reduction = (baselineTokens - intelligentTokens) / baselineTokens;

      // Should achieve significant token reduction (70-85% requirement)
      expect(reduction).toBeGreaterThan(0.7);
      expect(reduction).toBeLessThan(0.95); // Sanity check

      // Should still provide relevant guidance
      expect(contextBlock).toContain("validation");
      expect(contextBlock).toContain("React");
      expect(contextBlock).toContain("accessibility");
      expect(contextBlock).toContain("testing");

      console.log(
        `Token reduction: ${(reduction * 100).toFixed(
          1
        )}% (${baselineTokens} -> ${intelligentTokens} tokens)`
      );
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle malformed rule documents gracefully", async () => {
      const malformedRules = [
        {
          path: "incomplete.md",
          content: `
# Incomplete Rule
This rule is missing metadata and proper structure.
          `,
        },
        {
          path: "invalid-metadata.md",
          content: `
# Invalid Metadata Rule

## Metadata
- **InvalidField**: value
- **Layer**: InvalidLayer

## Directives
### Test
**INVALID** This is not a valid severity.
          `,
        },
      ];

      // Should handle parsing errors gracefully
      await expect(
        upsertMarkdownTool.execute({
          documents: malformedRules,
        })
      ).rejects.toThrow();

      // System should still work for valid queries
      const result = await detectContextTool.execute({
        text: "Create component",
      });

      expect(result.content).toBeDefined();
    });

    it("should provide fallback behavior when no rules match", async () => {
      // Test with empty knowledge graph
      const taskDescription = "Implement quantum computing algorithm";

      const queryResult = await queryDirectivesTool.execute({
        taskDescription,
        options: { maxItems: 5 },
      });

      expect(queryResult.content).toBeDefined();
      const contextBlock = queryResult.content[0].text;

      // Should provide some guidance even with no matching rules
      expect(contextBlock).toBeDefined();
      expect(typeof contextBlock).toBe("string");

      // Context detection should still work
      const contextResult = await detectContextTool.execute({
        text: taskDescription,
      });

      const contextData = JSON.parse(contextResult.content[0].text);
      expect(contextData.detectedLayer).toBeDefined();
      expect(contextData.confidence).toBeLessThan(0.5); // Low confidence expected
    });

    it("should handle concurrent requests safely", async () => {
      // Ingest some rules first
      const testRules = `
# Concurrent Test Rules

## Metadata
- **Layer**: 2-Application
- **Topics**: [testing, concurrency]

## Directives

### Concurrency
**MUST** Handle concurrent requests safely.
      `;

      await upsertMarkdownTool.execute({
        documents: [{ path: "concurrent-rules.md", content: testRules }],
      });

      // Make multiple concurrent requests
      const concurrentQueries = Array.from({ length: 10 }, (_, i) =>
        queryDirectivesTool.execute({
          taskDescription: `Test concurrent query ${i}`,
          options: { maxItems: 3 },
        })
      );

      const results = await Promise.all(concurrentQueries);

      // All requests should complete successfully
      results.forEach((result, index) => {
        expect(result.content).toBeDefined();
        expect(result.content[0].text).toBeDefined();
      });
    });

    it("should handle extremely long input gracefully", async () => {
      const longTaskDescription = "Create component ".repeat(10000);

      const result = await queryDirectivesTool.execute({
        taskDescription: longTaskDescription,
        options: { maxItems: 5, tokenBudget: 1000 },
      });

      expect(result.content).toBeDefined();

      // Should not crash and should respect token budget
      const contextBlock = result.content[0].text;
      expect(contextBlock.split(" ").length).toBeLessThanOrEqual(1000);
    });
  });

  describe("Integration with Different Coding Assistant Modes", () => {
    it("should adapt responses for architect mode", async () => {
      const architectureRules = `
# Architecture Guidelines

## Metadata
- **Layer**: *
- **AuthoritativeFor**: [architecture, patterns, design]
- **Topics**: [microservices, patterns, scalability, maintainability]

## Directives

### Design Patterns
**MUST** Choose appropriate design patterns based on problem context.

### Scalability
**MUST** Design systems to handle expected load with room for growth.

### Maintainability
**MUST** Prioritize code readability and maintainability over premature optimization.
      `;

      await upsertMarkdownTool.execute({
        documents: [
          { path: "architecture-rules.md", content: architectureRules },
        ],
      });

      const result = await queryDirectivesTool.execute({
        taskDescription: "Design user management system",
        modeSlug: "architect",
        options: { maxItems: 10 },
      });

      const contextBlock = result.content[0].text;

      // Should focus on architectural concerns
      expect(contextBlock).toContain("design patterns");
      expect(contextBlock).toContain("scalability");
      expect(contextBlock).toContain("maintainability");
    });

    it("should adapt responses for debug mode", async () => {
      const debugRules = `
# Debugging Guidelines

## Metadata
- **Layer**: *
- **AuthoritativeFor**: [debugging, troubleshooting, monitoring]
- **Topics**: [logging, monitoring, error-handling, performance]

## Directives

### Logging
**MUST** Include contextual information in all log messages.

### Error Handling
**MUST** Provide meaningful error messages for debugging.

### Performance Monitoring
**SHOULD** Use profiling tools to identify performance bottlenecks.
      `;

      await upsertMarkdownTool.execute({
        documents: [{ path: "debug-rules.md", content: debugRules }],
      });

      const result = await queryDirectivesTool.execute({
        taskDescription: "Fix slow API response times",
        modeSlug: "debug",
        options: { maxItems: 8 },
      });

      const contextBlock = result.content[0].text;

      // Should focus on debugging and troubleshooting
      expect(contextBlock).toContain("logging");
      expect(contextBlock).toContain("error");
      expect(contextBlock).toContain("performance");
      expect(contextBlock).toContain("profiling");
    });
  });
});
