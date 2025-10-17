---
# Rule Document Metadata
# This YAML front matter provides context for the ContextISO rule ingestion system
# All fields are optional but recommended for better rule matching and retrieval

title: "Your Rule Document Title"
author: "Your Name or Team"
version: "1.0.0"
layer: "2-Application"  # Options: 1-Presentation, 2-Application, 3-Domain, 4-Persistence, 5-Integration, 6-Docs, 7-Deployment, or * for all layers
authoritativeFor:
  - "topic1"  # Topics this rule document is authoritative for (e.g., security, testing, performance)
  - "topic2"
topics:
  - "security"  # Relevant topics (security, testing, performance, api, database, frontend, backend, etc.)
  - "validation"
technologies:
  - "TypeScript"  # Technologies covered (React, TypeScript, Node.js, SQL, Neo4j, etc.)
  - "Node.js"
severity: "MUST"  # Default severity if not specified per directive (MUST, SHOULD, MAY)
whenToApply:
  - "Creating new API endpoints"  # When these rules should be applied
  - "Handling user authentication"
tags:
  - "api-design"
  - "best-practices"
lastUpdated: "2025-01-17"
---

# Rule Document Title

Brief description of what this rule document covers and when it should be applied.

## Purpose

Explain the purpose of these rules and the problems they solve.

## Scope

Define what is covered by this document:
- Architectural layers affected
- Technologies involved
- Types of tasks or scenarios where these rules apply

---

## Critical Requirements

Rules in this section are mandatory and must be followed.

### Security

[MUST] Validate all user inputs before processing to prevent injection attacks.

[MUST] Use HTTPS for all API endpoints to protect data in transit.

[MUST] Implement authentication and authorization for all protected resources.

### Data Integrity

[MUST] Use transactions when performing multiple related database operations.

[MUST] Validate data types and constraints at the application layer before persistence.

---

## Recommended Practices

Rules in this section are strongly recommended for quality and maintainability.

### Code Quality

[SHOULD] Write unit tests for all business logic with minimum 80% code coverage.

[SHOULD] Use meaningful variable and function names that clearly convey intent.

[SHOULD] Keep functions focused on a single responsibility (SRP principle).

### Performance

[SHOULD] Use caching for frequently accessed, read-heavy data.

[SHOULD] Index database fields that are commonly used in queries or joins.

[SHOULD] Implement pagination for endpoints that return large data sets.

### Error Handling

[SHOULD] Provide meaningful error messages that help with debugging without exposing sensitive information.

[SHOULD] Log errors with appropriate context (timestamp, user, operation, stack trace).

---

## Optional Considerations

Rules in this section are optional enhancements or alternatives to consider.

### Developer Experience

[MAY] Consider using TypeDoc or JSDoc comments for public APIs to improve code documentation.

[MAY] Add inline comments for complex algorithms or non-obvious business logic.

### Advanced Features

[MAY] Implement rate limiting to protect against abuse and ensure fair resource usage.

[MAY] Add OpenAPI/Swagger documentation for REST APIs to facilitate integration.

[MAY] Consider implementing circuit breakers for external service calls to improve resilience.

---

## Code Examples

### Good Example: Input Validation

\`\`\`typescript
// ✅ GOOD: Comprehensive input validation
function createUser(input: unknown): User {
  const schema = z.object({
    email: z.string().email(),
    age: z.number().min(18).max(120),
    username: z.string().min(3).max(50)
  });
  
  const validatedInput = schema.parse(input);
  return userRepository.create(validatedInput);
}
\`\`\`

### Bad Example: No Validation

\`\`\`typescript
// ❌ BAD: No input validation
function createUser(input: any): User {
  // Directly using unvalidated input
  return userRepository.create(input);
}
\`\`\`

---

## Anti-Patterns to Avoid

### Anti-Pattern: Catching and Ignoring Errors

\`\`\`typescript
// ❌ AVOID: Silently catching errors
try {
  await riskyOperation();
} catch (error) {
  // Error silently ignored - debugging nightmare
}
\`\`\`

**Why to avoid:** Silent failures make debugging extremely difficult and can hide critical issues.

**Better approach:**

\`\`\`typescript
// ✅ BETTER: Log and handle appropriately
try {
  await riskyOperation();
} catch (error) {
  logger.error('Risky operation failed:', error);
  throw new ApplicationError('Operation failed', { cause: error });
}
\`\`\`

---

## Context and Rationale

### Why These Rules Matter

Explain the business or technical reasons behind these rules:

1. **Security rules** protect user data and prevent breaches that could damage trust and violate regulations
2. **Performance rules** ensure the application remains responsive as it scales
3. **Testing rules** reduce bugs and make refactoring safer

### When to Deviate

Sometimes rules need to be bent or broken. Guidelines for exceptions:

- **Emergency fixes**: In production emergencies, temporarily skip non-critical rules but create follow-up tickets
- **Prototypes**: For proof-of-concept work, MAY rules can often be skipped
- **Legacy integration**: When working with legacy systems, pragmatic compromises may be needed

Document any deviations in code comments or ADRs (Architecture Decision Records).

---

## Related Documents

Link to other relevant documentation:

- [Architecture Overview](../6-Docs/ARCHITECTURE.md)
- [Security Guidelines](./security-rules.md)
- [Testing Standards](./testing-rules.md)
- [API Design Principles](./api-design-rules.md)

---

## Maintenance

### Review Schedule

This document should be reviewed and updated:
- Quarterly by the architecture team
- When new technologies are adopted
- After significant incidents or lessons learned

### Change Process

To propose changes to this rule document:
1. Open a pull request with proposed changes
2. Tag relevant stakeholders for review
3. Discuss in architecture review meeting if significant
4. Update the `lastUpdated` field and `version` number

---

## Notes for ContextISO Integration

This document is designed to work with the ContextISO rule management system:

- **Severity levels** ([MUST], [SHOULD], [MAY]) are automatically extracted
- **Topics and layers** from the YAML front matter enable smart context detection
- **Technologies** help match rules to the current development stack
- **WhenToApply** conditions assist in automatic rule retrieval

For best results:
- Use consistent severity markers: `[MUST]`, `[SHOULD]`, `[MAY]`
- Keep directives focused and specific
- Tag topics accurately in the front matter
- Provide concrete code examples
- Document anti-patterns to avoid
