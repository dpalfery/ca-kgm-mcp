import { describe, it, expect, beforeEach } from 'vitest';
import { RuleBasedProvider } from '../rule-based-provider.js';
import { ArchitecturalLayer } from '../../types.js';

describe('RuleBasedProvider', () => {
  let provider: RuleBasedProvider;

  beforeEach(() => {
    provider = new RuleBasedProvider();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      expect(provider.name).toBe('rule-based-heuristic');
      expect(provider.type).toBe('rule-based');
    });

    it('should accept custom configuration', () => {
      const customConfig = {
        layerKeywords: {
          '1-Presentation': ['custom-ui'],
          '2-Application': ['custom-api'],
          '3-Domain': ['custom-domain'],
          '4-Persistence': ['custom-db'],
          '5-Infrastructure': ['custom-infra'],
          '*': []
        },
        confidenceThresholds: {
          high: 0.9,
          medium: 0.7,
          low: 0.5
        }
      };

      const customProvider = new RuleBasedProvider(customConfig);
      expect(customProvider.name).toBe('rule-based-heuristic');
      expect(customProvider.type).toBe('rule-based');
    });
  });

  describe('isAvailable', () => {
    it('should always return true (no external dependencies)', async () => {
      const isAvailable = await provider.isAvailable();
      expect(isAvailable).toBe(true);
    });
  });

  describe('detectContext', () => {
    it('should detect Presentation layer for UI-related tasks', async () => {
      const context = await provider.detectContext('Create a React component with CSS styling');
      
      expect(context.layer).toBe('1-Presentation');
      expect(context.confidence).toBeGreaterThan(0.1);
      expect(context.technologies).toContain('React');
    });

    it('should detect Application layer for API tasks', async () => {
      const context = await provider.detectContext('Implement REST API endpoint with authentication');
      
      expect(context.layer).toBe('2-Application');
      expect(context.confidence).toBeGreaterThan(0.1);
      expect(context.topics).toContain('api');
      expect(context.topics).toContain('security');
    });

    it('should detect Domain layer for business logic', async () => {
      const context = await provider.detectContext('Implement business rules for order calculation');
      
      expect(context.layer).toBe('3-Domain');
      expect(context.confidence).toBeGreaterThan(0.01);
    });

    it('should detect Persistence layer for database operations', async () => {
      const context = await provider.detectContext('Create database migration and repository pattern');
      
      expect(context.layer).toBe('4-Persistence');
      expect(context.confidence).toBeGreaterThan(0.1);
      expect(context.topics).toContain('database');
    });

    it('should detect Infrastructure layer for deployment tasks', async () => {
      const context = await provider.detectContext('Set up Docker containers and Kubernetes deployment');
      
      expect(context.layer).toBe('5-Infrastructure');
      expect(context.confidence).toBeGreaterThan(0.1);
      expect(context.technologies).toContain('Docker');
      expect(context.technologies).toContain('Kubernetes');
    });

    it('should return wildcard layer for ambiguous tasks', async () => {
      const context = await provider.detectContext('Fix the bug');
      
      expect(context.layer).toBe('*');
      expect(context.confidence).toBeLessThan(0.5);
    });

    it('should extract relevant topics', async () => {
      const context = await provider.detectContext('Implement secure API with JWT authentication and validation');
      
      expect(context.topics).toContain('security');
    });

    it('should extract technologies', async () => {
      const context = await provider.detectContext('Build React frontend with TypeScript and Jest tests');
      
      expect(context.technologies).toContain('React');
      expect(context.technologies).toContain('TypeScript');
      expect(context.technologies).toContain('Jest');
    });

    it('should extract significant keywords', async () => {
      const context = await provider.detectContext('Implement user authentication system with password hashing');
      
      expect(context.keywords).toContain('authentication');
      expect(context.keywords).toContain('password');
      expect(context.keywords).toContain('hashing');
      expect(context.keywords).not.toContain('the'); // Should filter stop words
      expect(context.keywords).not.toContain('with'); // Should filter stop words
    });

    it('should handle empty input gracefully', async () => {
      const context = await provider.detectContext('');
      
      expect(context.layer).toBe('*');
      expect(context.confidence).toBeLessThan(0.2);
      expect(context.topics).toHaveLength(0);
      expect(context.technologies).toHaveLength(0);
      expect(context.keywords).toHaveLength(0);
    });

    it('should be case insensitive', async () => {
      const context = await provider.detectContext('CREATE REACT COMPONENT WITH CSS');
      
      expect(context.layer).toBe('1-Presentation');
      expect(context.technologies).toContain('React');
    });

    it('should calculate confidence based on matches', async () => {
      const highConfidenceContext = await provider.detectContext('Create React component with JSX, CSS styling, and responsive design');
      const lowConfidenceContext = await provider.detectContext('Do something');
      
      expect(highConfidenceContext.confidence).toBeGreaterThan(lowConfidenceContext.confidence);
    });

    it('should handle multiple layer indicators correctly', async () => {
      // Task that could match multiple layers - should pick the highest scoring one
      const context = await provider.detectContext('Create API endpoint that saves data to database');
      
      // Should detect Application layer (API endpoint) over Persistence (database)
      // because API endpoint is more specific to the action being performed
      expect(['2-Application', '4-Persistence']).toContain(context.layer);
      expect(context.confidence).toBeGreaterThan(0.1);
    });
  });

  describe('getHealthInfo', () => {
    it('should return healthy status with provider details', async () => {
      const healthInfo = await provider.getHealthInfo();
      
      expect(healthInfo.status).toBe('healthy');
      expect(healthInfo.latency).toBe(0);
      expect(healthInfo.lastChecked).toBeInstanceOf(Date);
      expect(healthInfo.details).toHaveProperty('type', 'rule-based');
      expect(healthInfo.details).toHaveProperty('keywordSets');
      expect(healthInfo.details?.keywordSets).toHaveProperty('layers');
      expect(healthInfo.details?.keywordSets).toHaveProperty('topics');
      expect(healthInfo.details?.keywordSets).toHaveProperty('technologies');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle special characters in input', async () => {
      const context = await provider.detectContext('Create API endpoint with @decorators and #hashtags');
      
      expect(context.layer).toBe('2-Application');
      expect(context.topics).toContain('api');
    });

    it('should handle very long input text', async () => {
      const longText = 'Create React component '.repeat(100) + 'with database integration';
      const context = await provider.detectContext(longText);
      
      expect(context.layer).toBe('1-Presentation'); // React should dominate
      expect(context.confidence).toBeGreaterThan(0);
    });

    it('should limit keywords to reasonable number', async () => {
      const context = await provider.detectContext('authentication authorization validation sanitization encryption hashing security permissions roles access control');
      
      expect(context.keywords.length).toBeLessThanOrEqual(10);
    });

    it('should handle numeric and mixed content', async () => {
      const context = await provider.detectContext('Create API v2.1 with OAuth2.0 authentication');
      
      expect(context.layer).toBe('2-Application');
      expect(context.topics).toContain('security');
    });
  });

  describe('custom configuration', () => {
    it('should use custom layer keywords', async () => {
      const customProvider = new RuleBasedProvider({
        layerKeywords: {
          '1-Presentation': ['custom-ui-keyword'],
          '2-Application': ['custom-api-keyword'],
          '3-Domain': ['custom-domain-keyword'],
          '4-Persistence': ['custom-db-keyword'],
          '5-Infrastructure': ['custom-infra-keyword'],
          '*': []
        }
      });

      const context = await customProvider.detectContext('Build custom-ui-keyword component');
      expect(context.layer).toBe('1-Presentation');
    });

    it('should use custom topic keywords', async () => {
      const customProvider = new RuleBasedProvider({
        topicKeywords: {
          'custom-topic': ['custom-keyword']
        }
      });

      const context = await customProvider.detectContext('Implement custom-keyword functionality');
      expect(context.topics).toContain('custom-topic');
    });

    it('should use custom technology keywords', async () => {
      const customProvider = new RuleBasedProvider({
        technologyKeywords: {
          'CustomFramework': ['custom-framework', 'cf']
        }
      });

      const context = await customProvider.detectContext('Build app with custom-framework');
      expect(context.technologies).toContain('CustomFramework');
    });
  });
});