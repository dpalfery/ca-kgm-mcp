import { describe, it, expect, beforeEach } from 'vitest';
import { RuleDocumentParser } from '../rule-document-parser.js';

describe('RuleDocumentParser', () => {
  let parser: RuleDocumentParser;

  beforeEach(() => {
    parser = new RuleDocumentParser();
  });

  describe('parseRuleDocument', () => {
    const validRuleDocument = `# API Security Rules

## Metadata
- **Layer**: 2-Application
- **AuthoritativeFor**: [security, API]
- **Topics**: [authentication, authorization, validation]

## When to Apply
- Creating new API endpoints
- Handling user input
- Implementing authentication flows

## Directives

### Authentication
**MUST** All API endpoints must require authentication except for public health checks.

**Rationale**: Prevents unauthorized access to sensitive data and operations.

**Example**: 
\`\`\`typescript
app.get('/api/users', authenticate, (req, res) => {
  // Handler code
});
\`\`\`

**Anti-pattern**: 
\`\`\`typescript
app.get('/api/users', (req, res) => {
  // No authentication - WRONG
});
\`\`\`

**SHOULD** Use JWT tokens for stateless authentication.

### Input Validation
**MUST** Validate all input parameters using a schema validation library.

**MAY** Log validation failures for monitoring purposes.
`;

    it('should parse a valid rule document successfully', async () => {
      const result = await parser.parseRuleDocument(validRuleDocument, '/test/api-security.md');

      expect(result.rule).toBeDefined();
      expect(result.rule.name).toBe('API Security Rules');
      expect(result.rule.layer).toBe('2-Application');
      expect(result.rule.authoritativeFor).toEqual(['security', 'API']);
      expect(result.rule.topics).toEqual(['authentication', 'authorization', 'validation']);
      expect(result.rule.sourcePath).toBe('/test/api-security.md');

      expect(result.directives).toHaveLength(4);
      expect(result.directives[0].severity).toBe('MUST');
      expect(result.directives[0].section).toBe('Authentication');
      expect(result.directives[0].text).toContain('All API endpoints must require authentication');
      expect(result.directives[0].rationale).toContain('Prevents unauthorized access');
      expect(result.directives[0].example).toContain('authenticate');
      expect(result.directives[0].antiPattern).toContain('No authentication - WRONG');

      expect(result.relationships).toBeDefined();
      expect(result.relationships.length).toBeGreaterThan(0);
    });

    it('should handle documents with minimal metadata', async () => {
      const minimalDocument = `# Simple Rule

## Metadata
- **Layer**: *
- **AuthoritativeFor**: [general]
- **Topics**: [coding]

## Directives

### General
**MUST** Follow coding standards.
`;

      const result = await parser.parseRuleDocument(minimalDocument, '/test/simple.md');

      expect(result.rule.name).toBe('Simple Rule');
      expect(result.rule.layer).toBe('*');
      expect(result.rule.authoritativeFor).toEqual(['general']);
      expect(result.rule.topics).toEqual(['coding']);
      expect(result.directives).toHaveLength(1);
    });

    it('should throw error for document without title', async () => {
      const invalidDocument = `## Metadata
- **Layer**: 1-Presentation
- **AuthoritativeFor**: [UI]
- **Topics**: [components]
`;

      await expect(
        parser.parseRuleDocument(invalidDocument, '/test/invalid.md')
      ).rejects.toThrow('No title found in document');
    });

    it('should throw error for document without metadata section', async () => {
      const invalidDocument = `# Test Rule

## Directives
**MUST** Do something.
`;

      await expect(
        parser.parseRuleDocument(invalidDocument, '/test/invalid.md')
      ).rejects.toThrow('No Metadata section found');
    });

    it('should throw error for invalid layer value', async () => {
      const invalidDocument = `# Test Rule

## Metadata
- **Layer**: InvalidLayer
- **AuthoritativeFor**: [test]
- **Topics**: [test]

## Directives
**MUST** Do something.
`;

      await expect(
        parser.parseRuleDocument(invalidDocument, '/test/invalid.md')
      ).rejects.toThrow('Invalid layer: InvalidLayer');
    });
  });

  describe('validateRuleDocument', () => {
    it('should validate a correct document', async () => {
      const validDocument = `# Test Rule

## Metadata
- **Layer**: 1-Presentation
- **AuthoritativeFor**: [UI]
- **Topics**: [components]

## Directives

### UI Components
**MUST** Use TypeScript for all components.
`;

      const result = await parser.validateRuleDocument(validDocument);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should detect missing required sections', async () => {
      const invalidDocument = `# Test Rule

## Directives
**MUST** Do something.
`;

      const result = await parser.validateRuleDocument(invalidDocument);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing required "Metadata" section');
    });

    it('should detect missing directives section', async () => {
      const invalidDocument = `# Test Rule

## Metadata
- **Layer**: 1-Presentation
- **AuthoritativeFor**: [UI]
- **Topics**: [components]
`;

      const result = await parser.validateRuleDocument(invalidDocument);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing required "Directives" section');
    });

    it('should detect missing title', async () => {
      const invalidDocument = `## Metadata
- **Layer**: 1-Presentation
- **AuthoritativeFor**: [UI]
- **Topics**: [components]

## Directives
**MUST** Do something.
`;

      const result = await parser.validateRuleDocument(invalidDocument);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Document must start with a title (# Rule Name)');
    });

    it('should provide suggestions for missing optional sections', async () => {
      const documentWithoutWhenToApply = `# Test Rule

## Metadata
- **Layer**: 1-Presentation
- **AuthoritativeFor**: [UI]
- **Topics**: [components]

## Directives

### UI Components
**MUST** Use TypeScript for all components.
`;

      const result = await parser.validateRuleDocument(documentWithoutWhenToApply);

      expect(result.isValid).toBe(true);
      expect(result.suggestions).toContain('Consider adding a "When to Apply" section for better context detection');
    });

    it('should warn about empty directives section', async () => {
      const documentWithEmptyDirectives = `# Test Rule

## Metadata
- **Layer**: 1-Presentation
- **AuthoritativeFor**: [UI]
- **Topics**: [components]

## Directives

### Empty Section
No directives here.
`;

      const result = await parser.validateRuleDocument(documentWithEmptyDirectives);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('No directives found in Directives section');
    });
  });

  describe('extractMetadata', () => {
    it('should extract metadata fields correctly', async () => {
      const document = `# Test Rule

## Metadata
- **Layer**: 3-Domain
- **AuthoritativeFor**: [business-logic, validation]
- **Topics**: [entities, services, repositories]

## When to Apply
- Implementing business rules
- Creating domain entities
- Validating business logic

## Directives
**MUST** Follow DDD principles.
`;

      const metadata = await parser.extractMetadata(document);

      expect(metadata.name).toBe('Test Rule');
      expect(metadata.layer).toBe('3-Domain');
      expect(metadata.authoritativeFor).toEqual(['business-logic', 'validation']);
      expect(metadata.topics).toEqual(['entities', 'services', 'repositories']);
      expect(metadata.whenToApply).toEqual([
        'Implementing business rules',
        'Creating domain entities',
        'Validating business logic'
      ]);
    });

    it('should handle single-value arrays', async () => {
      const document = `# Test Rule

## Metadata
- **Layer**: 1-Presentation
- **AuthoritativeFor**: UI
- **Topics**: components

## Directives
**MUST** Do something.
`;

      const metadata = await parser.extractMetadata(document);

      expect(metadata.authoritativeFor).toEqual(['UI']);
      expect(metadata.topics).toEqual(['components']);
    });

    it('should handle empty when to apply section', async () => {
      const document = `# Test Rule

## Metadata
- **Layer**: 1-Presentation
- **AuthoritativeFor**: [UI]
- **Topics**: [components]

## Directives
**MUST** Do something.
`;

      const metadata = await parser.extractMetadata(document);

      expect(metadata.whenToApply).toEqual([]);
    });

    it('should throw error for missing required metadata fields', async () => {
      const documentMissingLayer = `# Test Rule

## Metadata
- **AuthoritativeFor**: [UI]
- **Topics**: [components]

## Directives
**MUST** Do something.
`;

      await expect(
        parser.extractMetadata(documentMissingLayer)
      ).rejects.toThrow('Missing required metadata field: Layer');
    });
  });

  describe('directive parsing', () => {
    it('should parse multiple directives with different severities', async () => {
      const document = `# Test Rule

## Metadata
- **Layer**: 1-Presentation
- **AuthoritativeFor**: [UI]
- **Topics**: [components]

## Directives

### Component Rules
**MUST** Use TypeScript for all components.

**SHOULD** Include prop validation.

**MAY** Add performance optimizations.

### Styling Rules
**MUST** Use CSS modules or styled-components.
`;

      const result = await parser.parseRuleDocument(document, '/test/test.md');

      expect(result.directives).toHaveLength(4);
      
      const mustDirectives = result.directives.filter(d => d.severity === 'MUST');
      const shouldDirectives = result.directives.filter(d => d.severity === 'SHOULD');
      const mayDirectives = result.directives.filter(d => d.severity === 'MAY');
      
      expect(mustDirectives).toHaveLength(2);
      expect(shouldDirectives).toHaveLength(1);
      expect(mayDirectives).toHaveLength(1);
    });

    it('should extract directive fields correctly', async () => {
      const document = `# Test Rule

## Metadata
- **Layer**: 1-Presentation
- **AuthoritativeFor**: [UI]
- **Topics**: [components]

## Directives

### Component Rules
**MUST** Use TypeScript for all components.

**Rationale**: TypeScript provides better type safety and developer experience.

**Example**: 
\`\`\`typescript
interface Props {
  name: string;
}

const Component: React.FC<Props> = ({ name }) => {
  return <div>{name}</div>;
};
\`\`\`

**Anti-pattern**: 
\`\`\`javascript
const Component = ({ name }) => {
  return <div>{name}</div>; // No type safety
};
\`\`\`
`;

      const result = await parser.parseRuleDocument(document, '/test/test.md');

      expect(result.directives).toHaveLength(1);
      
      const directive = result.directives[0];
      expect(directive.text).toBe('Use TypeScript for all components.');
      expect(directive.rationale).toContain('TypeScript provides better type safety');
      expect(directive.example).toContain('interface Props');
      expect(directive.antiPattern).toContain('No type safety');
    });

    it('should extract topics from directive text', async () => {
      const document = `# Test Rule

## Metadata
- **Layer**: 2-Application
- **AuthoritativeFor**: [API]
- **Topics**: [security]

## Directives

### API Security
**MUST** Implement proper authentication and validation for all API endpoints.
`;

      const result = await parser.parseRuleDocument(document, '/test/test.md');

      expect(result.directives).toHaveLength(1);
      
      const directive = result.directives[0];
      expect(directive.topics).toContain('API');
      expect(directive.topics).toContain('authentication');
      expect(directive.topics).toContain('validation');
    });
  });

  describe('relationship generation', () => {
    it('should generate CONTAINS relationships for directives', async () => {
      const document = `# Test Rule

## Metadata
- **Layer**: 1-Presentation
- **AuthoritativeFor**: [UI]
- **Topics**: [components]

## Directives

### Component Rules
**MUST** Use TypeScript for all components.
**SHOULD** Include prop validation.
`;

      const result = await parser.parseRuleDocument(document, '/test/test.md');

      const containsRelationships = result.relationships.filter(r => r.type === 'CONTAINS');
      expect(containsRelationships).toHaveLength(2); // One for each directive
      
      for (const relationship of containsRelationships) {
        expect(relationship.from).toBe(result.rule.id);
        expect(result.directives.some(d => d.id === relationship.to)).toBe(true);
      }
    });

    it('should generate AUTHORITATIVE_FOR relationships', async () => {
      const document = `# Test Rule

## Metadata
- **Layer**: 1-Presentation
- **AuthoritativeFor**: [UI, components, styling]
- **Topics**: [React]

## Directives

### Component Rules
**MUST** Use TypeScript for all components.
`;

      const result = await parser.parseRuleDocument(document, '/test/test.md');

      const authoritativeRelationships = result.relationships.filter(r => r.type === 'AUTHORITATIVE_FOR');
      expect(authoritativeRelationships).toHaveLength(3); // One for each authoritative domain
      
      const authoritativeDomains = authoritativeRelationships.map(r => r.to);
      expect(authoritativeDomains).toContain('UI');
      expect(authoritativeDomains).toContain('components');
      expect(authoritativeDomains).toContain('styling');
    });

    it('should assign correct weights based on severity', async () => {
      const document = `# Test Rule

## Metadata
- **Layer**: 1-Presentation
- **AuthoritativeFor**: [UI]
- **Topics**: [components]

## Directives

### Component Rules
**MUST** Use TypeScript for all components.
**SHOULD** Include prop validation.
**MAY** Add performance optimizations.
`;

      const result = await parser.parseRuleDocument(document, '/test/test.md');

      const containsRelationships = result.relationships.filter(r => r.type === 'CONTAINS');
      
      // Find relationships for each severity level
      const mustDirective = result.directives.find(d => d.severity === 'MUST');
      const shouldDirective = result.directives.find(d => d.severity === 'SHOULD');
      const mayDirective = result.directives.find(d => d.severity === 'MAY');
      
      const mustRelationship = containsRelationships.find(r => r.to === mustDirective?.id);
      const shouldRelationship = containsRelationships.find(r => r.to === shouldDirective?.id);
      const mayRelationship = containsRelationships.find(r => r.to === mayDirective?.id);
      
      expect(mustRelationship?.weight).toBe(1.0);
      expect(shouldRelationship?.weight).toBe(0.7);
      expect(mayRelationship?.weight).toBe(0.3);
    });
  });

  describe('error handling', () => {
    it('should handle malformed markdown gracefully', async () => {
      const malformedDocument = `# Test Rule

## Metadata
- **Layer**: 1-Presentation
- **AuthoritativeFor**: [UI
- **Topics**: components]

## Directives
**MUST** Do something.
`;

      // Should not throw, but may produce warnings
      const result = await parser.parseRuleDocument(malformedDocument, '/test/malformed.md');
      expect(result.warnings).toBeDefined();
    });

    it('should provide meaningful error messages', async () => {
      const invalidDocument = `# Test Rule

## Metadata
- **Layer**: InvalidLayer
- **AuthoritativeFor**: [UI]
- **Topics**: [components]
`;

      await expect(
        parser.parseRuleDocument(invalidDocument, '/test/invalid.md')
      ).rejects.toThrow(/Invalid layer.*Must be one of/);
    });
  });
});