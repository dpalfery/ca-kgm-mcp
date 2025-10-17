# Rule Document Template Guide

This directory contains the template for creating rule documents that can be ingested into the ContextISO knowledge graph system.

## Overview

The `.github/rule-template.md` file provides a comprehensive template for creating project-specific rules, guidelines, and best practices that can be automatically retrieved by AI coding assistants through the ContextISO MCP server.

## Quick Start

1. **Copy the template:**
   ```bash
   cp .github/rule-template.md .github/my-project-rules.md
   ```

2. **Edit the YAML front matter** with your project-specific metadata

3. **Add your rules** using the severity markers: `[MUST]`, `[SHOULD]`, `[MAY]`

4. **Ingest into ContextISO** using the MCP tool:
   ```typescript
   await server.handleToolCall('memory.rules.upsert_markdown', {
     documents: [{
       path: '.github/my-project-rules.md',
       content: fs.readFileSync('.github/my-project-rules.md', 'utf-8')
     }]
   });
   ```

## Template Structure

### 1. YAML Front Matter (Metadata)

The YAML front matter provides context that helps ContextISO match rules to relevant tasks:

```yaml
---
title: "Your Rule Document Title"
layer: "2-Application"
authoritativeFor:
  - "security"
  - "api-design"
topics:
  - "security"
  - "validation"
technologies:
  - "TypeScript"
  - "Node.js"
severity: "MUST"
whenToApply:
  - "Creating new API endpoints"
---
```

#### Key Fields:

- **`title`**: Human-readable name for the rule document
- **`layer`**: Architectural layer this document applies to
  - Options: `1-Presentation`, `2-Application`, `3-Domain`, `4-Persistence`, `5-Integration`, `6-Docs`, `7-Deployment`, `*` (all)
- **`authoritativeFor`**: Topics where this document is the primary reference
- **`topics`**: Relevant topics (security, testing, performance, api, database, etc.)
- **`technologies`**: Technologies covered (React, TypeScript, Node.js, SQL, Neo4j, etc.)
- **`severity`**: Default severity level for directives (MUST, SHOULD, MAY)
- **`whenToApply`**: Scenarios when these rules should be retrieved

### 2. Directive Format

Rules are written as directives with severity markers:

```markdown
[MUST] This is a mandatory requirement that must always be followed.

[SHOULD] This is a recommended practice that should normally be followed.

[MAY] This is an optional consideration that may be applied when appropriate.
```

#### Severity Levels:

| Level | Meaning | Example Use Case |
|-------|---------|------------------|
| **MUST** | Mandatory requirements | Security requirements, data integrity rules, compliance requirements |
| **SHOULD** | Strong recommendations | Code quality standards, performance optimizations, testing requirements |
| **MAY** | Optional suggestions | Optional features, advanced optimizations, alternative approaches |

### 3. Section Organization

Organize your rules into logical sections:

1. **Critical Requirements** - MUST rules for security, compliance, data integrity
2. **Recommended Practices** - SHOULD rules for quality, performance, maintainability
3. **Optional Considerations** - MAY rules for enhancements and alternatives
4. **Code Examples** - Concrete examples showing good and bad practices
5. **Anti-Patterns** - Common mistakes to avoid
6. **Context and Rationale** - Why these rules exist and when to deviate

## How ContextISO Uses This Template

### 1. Parsing and Extraction

When you ingest a rule document:

```typescript
// ContextISO automatically:
1. Parses the YAML front matter for metadata
2. Extracts [MUST]/[SHOULD]/[MAY] directives from the content
3. Identifies topics from content and metadata
4. Detects mentioned technologies
5. Determines applicable architectural layers
6. Creates a knowledge graph with relationships
```

### 2. Context Detection

When a developer asks an AI assistant to perform a task:

```typescript
// Example task: "Create a new REST API endpoint for user authentication"

// ContextISO automatically:
1. Detects layer: "5-Integration" (API)
2. Identifies topics: ["api", "security", "authentication"]
3. Extracts technologies: ["REST"]
4. Calculates confidence: 0.92
```

### 3. Rule Retrieval and Ranking

```typescript
// ContextISO then:
1. Queries the knowledge graph for relevant directives
2. Scores each directive based on:
   - Layer match (is it for the 5-Integration layer?)
   - Topic overlap (does it cover "api", "security"?)
   - Severity (MUST > SHOULD > MAY)
   - Authority (is this document authoritative for these topics?)
3. Ranks and selects the top directives within token budget
4. Formats as a context block for the AI assistant
```

### 4. Output Format

The AI assistant receives a formatted context block:

```markdown
# Contextual Rules

**Detected Context:**
- Layer: 5-Integration
- Topics: api, security, authentication
- Technologies: REST

## 🔴 Critical Requirements

- **[MUST]** Validate all user inputs before processing
  - *Topics: security, validation*
  - *Source: API Guidelines → Security*

- **[MUST]** Use HTTPS for all API endpoints
  - *Topics: security, api*
  - *Source: API Guidelines → Security*

## 🟡 Recommended Practices

- **[SHOULD]** Implement rate limiting for API endpoints
  - *Topics: api, performance*
  - *Source: API Guidelines → Performance*
```

## Best Practices for Writing Rules

### 1. Be Specific and Actionable

❌ **Bad:** "Code should be good quality"
✅ **Good:** "[SHOULD] Functions should have a single responsibility and be no longer than 50 lines"

### 2. Provide Context and Rationale

```markdown
[MUST] Use parameterized queries for all database operations.

**Rationale:** Prevents SQL injection attacks which are among the most common 
and dangerous security vulnerabilities (OWASP Top 10).
```

### 3. Include Code Examples

Show both good and bad examples:

```markdown
### Good Example: Parameterized Queries
\`\`\`typescript
// ✅ GOOD: Safe from SQL injection
const users = await db.query(
  'SELECT * FROM users WHERE email = $1',
  [userEmail]
);
\`\`\`

### Bad Example: String Concatenation
\`\`\`typescript
// ❌ BAD: Vulnerable to SQL injection
const users = await db.query(
  `SELECT * FROM users WHERE email = '${userEmail}'`
);
\`\`\`
```

### 4. Tag Appropriately

Use accurate topics and technologies:

```yaml
topics:
  - "security"      # General security practices
  - "database"      # Database-related rules
  - "sql-injection" # Specific vulnerability
technologies:
  - "SQL"           # Technology being used
  - "PostgreSQL"    # Specific implementation
```

### 5. Keep Rules Atomic

Each directive should express one clear requirement:

❌ **Bad:** "[MUST] Validate inputs and use HTTPS and implement authentication"
✅ **Good:** Three separate directives:
```markdown
[MUST] Validate all user inputs before processing.
[MUST] Use HTTPS for all API endpoints.
[MUST] Implement authentication for protected resources.
```

## Common Use Cases

### 1. Team Coding Standards

```yaml
---
title: "Team JavaScript/TypeScript Standards"
layer: "*"
topics:
  - "code-quality"
  - "testing"
technologies:
  - "TypeScript"
  - "JavaScript"
---

[MUST] Use TypeScript strict mode for all new code.
[SHOULD] Achieve minimum 80% test coverage for business logic.
[MAY] Consider using Prettier for consistent code formatting.
```

### 2. Security Requirements

```yaml
---
title: "Security Requirements"
layer: "*"
authoritativeFor:
  - "security"
topics:
  - "security"
  - "authentication"
  - "authorization"
---

[MUST] Never store passwords in plain text.
[MUST] Use HTTPS for all external communications.
[SHOULD] Implement rate limiting on authentication endpoints.
```

### 3. API Design Guidelines

```yaml
---
title: "REST API Design Guidelines"
layer: "5-Integration"
authoritativeFor:
  - "api-design"
topics:
  - "api"
  - "rest"
technologies:
  - "REST"
  - "HTTP"
---

[MUST] Use appropriate HTTP status codes (200, 201, 400, 401, 404, 500).
[SHOULD] Version APIs using URL path (e.g., /api/v1/users).
[MAY] Consider implementing HATEOAS for discoverability.
```

### 4. Database Guidelines

```yaml
---
title: "Database Standards"
layer: "4-Persistence"
topics:
  - "database"
  - "performance"
technologies:
  - "PostgreSQL"
  - "SQL"
---

[MUST] Use transactions for operations that modify multiple tables.
[SHOULD] Index foreign keys and frequently queried columns.
[MAY] Consider materialized views for complex, frequently-run queries.
```

## Ingesting Rules into ContextISO

### Using the MCP Tool

```typescript
import { readFileSync } from 'fs';

// Single document
await server.handleToolCall('memory.rules.upsert_markdown', {
  documents: [{
    path: '.github/api-guidelines.md',
    content: readFileSync('.github/api-guidelines.md', 'utf-8')
  }],
  options: {
    overwrite: false,  // Don't replace existing rules
    validateOnly: false // Actually persist to database
  }
});

// Multiple documents
await server.handleToolCall('memory.rules.upsert_markdown', {
  documents: [
    { path: '.github/api-guidelines.md', content: '...' },
    { path: '.github/security-rules.md', content: '...' },
    { path: '.github/testing-standards.md', content: '...' }
  ],
  options: {
    overwrite: true,  // Replace existing rules
    validateOnly: false
  }
});
```

### Validation Only Mode

Test your rules without persisting:

```typescript
const result = await server.handleToolCall('memory.rules.upsert_markdown', {
  documents: [{
    path: '.github/my-rules.md',
    content: ruleContent
  }],
  options: {
    validateOnly: true  // Parse and validate without storing
  }
});

console.log('Validation results:', result);
// {
//   upserted: { rules: 1, sections: 5, directives: 15, patterns: 0 },
//   warnings: [],
//   errors: []
// }
```

## Querying Rules

### Basic Query

```typescript
const result = await server.handleToolCall('memory.rules.query_directives', {
  taskDescription: 'Build a REST API endpoint for user authentication'
});

console.log(result.context_block);
// Returns formatted markdown with relevant rules
```

### Advanced Query with Options

```typescript
const result = await server.handleToolCall('memory.rules.query_directives', {
  taskDescription: 'Implement payment processing with Stripe',
  modeSlug: 'code',  // Focus on implementation
  options: {
    strictLayer: true,     // Only rules for detected layer
    maxItems: 10,          // Top 10 directives
    tokenBudget: 1500,     // Stay within token limit
    includeBreadcrumbs: true,  // Show source references
    severityFilter: ['MUST', 'SHOULD']  // Exclude MAY directives
  }
});
```

## Troubleshooting

### Common Issues

**Issue:** Directives not being extracted
- **Solution:** Ensure you use exact format: `[MUST]`, `[SHOULD]`, or `[MAY]` in square brackets

**Issue:** Rules not matching expected tasks
- **Solution:** Check topic tags and layer assignments in YAML front matter

**Issue:** Parsing errors during ingestion
- **Solution:** Validate YAML syntax and ensure all directives are properly formatted

### Getting Help

1. Check the [ContextISO documentation](../README.md)
2. Review [test files](../src/parsing/*.test.ts) for format examples
3. Use `validateOnly: true` to test without persisting
4. Check the warnings and errors in the upsert response

## Examples

See the [`rule-template.md`](./rule-template.md) file for a complete, annotated example that demonstrates:

- Comprehensive YAML front matter
- All severity levels
- Code examples (good and bad)
- Anti-patterns
- Rationale and context
- Related documentation links

## Contributing

To improve this template:

1. Fork the repository
2. Make your improvements to `.github/rule-template.md`
3. Update this README if needed
4. Submit a pull request with examples and rationale

---

**Last Updated:** 2025-01-17  
**Version:** 1.0.0  
**Maintained by:** ContextISO Team
