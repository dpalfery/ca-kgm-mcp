/**
 * Test Data Validator for Integration Tests
 * 
 * Ensures all required test data files exist and creates missing ones
 * for comprehensive integration testing
 */

import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface TestDataFile {
  path: string;
  content: string;
  description: string;
}

class TestDataValidator {
  private requiredFiles: TestDataFile[] = [
    {
      path: '../sample-rules/presentation-layer-rules.md',
      description: 'Presentation layer development rules',
      content: `# Presentation Layer Rules

## Metadata
- **Layer**: 1-Presentation
- **AuthoritativeFor**: [UI, components, forms, accessibility]
- **Topics**: [React, Vue, Angular, CSS, HTML, accessibility, forms, validation]

## When to Apply
- Creating user interface components
- Building forms and input handling
- Implementing client-side validation
- Ensuring accessibility compliance

## Directives

### Component Structure
**MUST** Use semantic HTML elements for better accessibility and SEO.

**Rationale**: Semantic HTML provides meaning to content and improves screen reader compatibility.

### Form Validation
**MUST** Implement client-side validation with immediate feedback for user inputs.

**Rationale**: Immediate feedback improves user experience and reduces form abandonment.

### Accessibility
**MUST** Ensure all interactive elements are keyboard accessible and have proper ARIA labels.

**Rationale**: Accessibility is required for compliance and inclusive user experience.

### Performance
**SHOULD** Implement lazy loading for components not immediately visible.

**Rationale**: Lazy loading improves initial page load performance.

### State Management
**SHOULD** Use centralized state management for complex application state.

**Rationale**: Centralized state prevents prop drilling and makes state changes predictable.`
    },
    {
      path: '../sample-rules/application-layer-rules.md',
      description: 'Application layer business logic rules',
      content: `# Application Layer Rules

## Metadata
- **Layer**: 2-Application
- **AuthoritativeFor**: [business-logic, services, API, authentication]
- **Topics**: [REST, GraphQL, authentication, authorization, validation, caching]

## When to Apply
- Implementing business logic
- Creating API endpoints
- Handling authentication and authorization
- Managing application services

## Directives

### API Design
**MUST** Follow RESTful principles for API endpoint design and use appropriate HTTP methods.

**Rationale**: RESTful APIs are predictable and follow established conventions.

### Authentication
**MUST** Implement JWT-based authentication with proper token expiration and refresh mechanisms.

**Rationale**: JWT tokens provide stateless authentication suitable for distributed systems.

### Input Validation
**MUST** Validate all input parameters using schema validation libraries.

**Rationale**: Input validation prevents injection attacks and ensures data integrity.

### Error Handling
**MUST** Return consistent error response format with appropriate HTTP status codes.

**Rationale**: Consistent error handling improves API usability and debugging.

### Caching
**SHOULD** Implement caching strategies for frequently accessed data.

**Rationale**: Caching improves performance and reduces database load.`
    },
    {
      path: '../sample-rules/domain-layer-rules.md',
      description: 'Domain layer business rules',
      content: `# Domain Layer Rules

## Metadata
- **Layer**: 3-Domain
- **AuthoritativeFor**: [business-rules, entities, domain-logic]
- **Topics**: [DDD, entities, value-objects, aggregates, business-rules]

## When to Apply
- Defining business entities and rules
- Implementing domain logic
- Creating value objects and aggregates
- Enforcing business constraints

## Directives

### Entity Design
**MUST** Encapsulate business rules within domain entities and prevent invalid state.

**Rationale**: Domain entities should enforce business invariants and maintain consistency.

### Value Objects
**MUST** Use value objects for concepts that have no identity but have important characteristics.

**Rationale**: Value objects improve type safety and express domain concepts clearly.

### Business Rules
**MUST** Implement business rules in the domain layer, not in application services.

**Rationale**: Business rules belong in the domain layer to maintain separation of concerns.

### Aggregates
**SHOULD** Design aggregates to maintain consistency boundaries and minimize dependencies.

**Rationale**: Well-designed aggregates improve performance and maintainability.`
    },
    {
      path: '../sample-rules/persistence-layer-rules.md',
      description: 'Persistence layer data access rules',
      content: `# Persistence Layer Rules

## Metadata
- **Layer**: 4-Persistence
- **AuthoritativeFor**: [database, queries, transactions, performance]
- **Topics**: [SQL, NoSQL, indexing, transactions, migrations, performance]

## When to Apply
- Writing database queries
- Creating database migrations
- Optimizing database performance
- Managing transactions

## Directives

### Query Optimization
**MUST** Use appropriate indexes for all frequently queried columns.

**Rationale**: Proper indexing dramatically improves query performance.

### Transactions
**MUST** Use database transactions for operations that modify multiple tables.

**Rationale**: Transactions ensure data consistency and prevent partial updates.

### Migrations
**MUST** Create reversible database migrations with proper rollback procedures.

**Rationale**: Reversible migrations enable safe deployment and rollback procedures.

### Connection Management
**MUST** Use connection pooling to manage database connections efficiently.

**Rationale**: Connection pooling prevents connection exhaustion and improves performance.`
    },
    {
      path: '../sample-rules/infrastructure-layer-rules.md',
      description: 'Infrastructure layer deployment and operations rules',
      content: `# Infrastructure Layer Rules

## Metadata
- **Layer**: 5-Infrastructure
- **AuthoritativeFor**: [deployment, monitoring, security, scalability]
- **Topics**: [Docker, Kubernetes, CI/CD, monitoring, logging, security]

## When to Apply
- Setting up deployment pipelines
- Configuring monitoring and logging
- Implementing security measures
- Managing infrastructure as code

## Directives

### Containerization
**MUST** Use Docker containers for consistent deployment across environments.

**Rationale**: Containers ensure consistency between development and production environments.

### Monitoring
**MUST** Implement comprehensive monitoring with alerts for critical system metrics.

**Rationale**: Monitoring enables proactive issue detection and resolution.

### Security
**MUST** Implement security scanning in CI/CD pipelines for vulnerabilities.

**Rationale**: Automated security scanning prevents vulnerable code from reaching production.

### Scalability
**SHOULD** Design infrastructure to handle expected load with auto-scaling capabilities.

**Rationale**: Auto-scaling ensures system availability during traffic spikes.`
    },
    {
      path: '../test-datasets/context-detection-test-cases.json',
      description: 'Test cases for context detection accuracy validation',
      content: JSON.stringify({
        testCases: [
          {
            taskDescription: "Create React component for user login form",
            expectedLayer: "1-Presentation",
            expectedTopics: ["React", "forms", "authentication"],
            confidence: "high"
          },
          {
            taskDescription: "Implement REST API endpoint for user registration",
            expectedLayer: "2-Application",
            expectedTopics: ["API", "REST", "authentication"],
            confidence: "high"
          },
          {
            taskDescription: "Design User entity with validation rules",
            expectedLayer: "3-Domain",
            expectedTopics: ["entities", "validation", "business-rules"],
            confidence: "high"
          },
          {
            taskDescription: "Optimize database query for user search",
            expectedLayer: "4-Persistence",
            expectedTopics: ["database", "queries", "performance"],
            confidence: "high"
          },
          {
            taskDescription: "Set up Kubernetes deployment for microservice",
            expectedLayer: "5-Infrastructure",
            expectedTopics: ["Kubernetes", "deployment", "containers"],
            confidence: "high"
          },
          {
            taskDescription: "Add button to page",
            expectedLayer: "1-Presentation",
            expectedTopics: ["UI", "components"],
            confidence: "medium"
          },
          {
            taskDescription: "Fix bug in system",
            expectedLayer: "*",
            expectedTopics: ["debugging"],
            confidence: "low"
          }
        ]
      }, null, 2)
    }
  ];

  async validateAndCreateTestData(): Promise<void> {
    console.log('🔍 Validating test data files...\n');

    let missingFiles = 0;
    let createdFiles = 0;

    for (const file of this.requiredFiles) {
      const fullPath = join(__dirname, file.path);
      
      if (!existsSync(fullPath)) {
        console.log(`❌ Missing: ${file.path} - ${file.description}`);
        missingFiles++;
        
        // Create directory if it doesn't exist
        const dir = dirname(fullPath);
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
        
        // Create the file
        writeFileSync(fullPath, file.content);
        console.log(`✅ Created: ${file.path}`);
        createdFiles++;
      } else {
        console.log(`✅ Found: ${file.path} - ${file.description}`);
      }
    }

    console.log('\n📊 VALIDATION SUMMARY');
    console.log('=' .repeat(30));
    console.log(`Total files checked: ${this.requiredFiles.length}`);
    console.log(`Missing files: ${missingFiles}`);
    console.log(`Created files: ${createdFiles}`);
    console.log(`Existing files: ${this.requiredFiles.length - missingFiles}`);

    if (createdFiles > 0) {
      console.log(`\n🎉 Created ${createdFiles} missing test data files.`);
    }

    console.log('\n✅ Test data validation complete. All required files are now available.');
  }

  async validateTestEnvironment(): Promise<boolean> {
    console.log('🔧 Validating test environment...\n');

    const checks = [
      {
        name: 'Node.js version',
        check: () => {
          const version = process.version;
          const major = parseInt(version.slice(1).split('.')[0]);
          return major >= 16;
        },
        requirement: 'Node.js 16 or higher'
      },
      {
        name: 'SQLite3 module',
        check: () => {
          const sqlite3Path = join(__dirname, '../../node_modules/sqlite3');
          return existsSync(sqlite3Path);
        },
        requirement: 'sqlite3 npm package'
      },
      {
        name: 'Vitest framework',
        check: () => {
          const vitestPath = join(__dirname, '../../node_modules/vitest');
          return existsSync(vitestPath);
        },
        requirement: 'vitest npm package'
      },
      {
        name: 'Source files',
        check: () => {
          const srcPath = join(__dirname, '../../src');
          return existsSync(srcPath);
        },
        requirement: 'Source code directory'
      }
    ];

    let allPassed = true;

    for (const check of checks) {
      const passed = check.check();
      console.log(`${passed ? '✅' : '❌'} ${check.name}: ${passed ? 'OK' : `MISSING (${check.requirement})`}`);
      
      if (!passed) {
        allPassed = false;
      }
    }

    console.log(`\n🎯 Environment validation: ${allPassed ? '✅ PASSED' : '❌ FAILED'}`);
    
    if (!allPassed) {
      console.log('\n⚠️  Some environment requirements are not met.');
      console.log('Please install missing dependencies before running integration tests.');
    }

    return allPassed;
  }
}

// CLI execution
async function main() {
  const validator = new TestDataValidator();
  
  try {
    const envValid = await validator.validateTestEnvironment();
    if (!envValid) {
      console.log('\n❌ Environment validation failed. Please fix issues before proceeding.');
      process.exit(1);
    }
    
    await validator.validateAndCreateTestData();
    console.log('\n🚀 Ready to run integration tests!');
    console.log('Run: npm run test:integration');
  } catch (error) {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  }
}

// Always run when executed directly
main();

export { TestDataValidator };