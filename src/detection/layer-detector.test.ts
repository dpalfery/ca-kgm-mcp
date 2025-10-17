/**
 * Tests for Layer Detection
 */
import { describe, it, expect } from 'vitest';
import { detectLayer, detectMultipleLayers } from './layer-detector.js';

describe('Layer Detection', () => {
  describe('detectLayer', () => {
    it('should detect 1-Presentation layer for UI-related text', () => {
      const result = detectLayer('Create a React component with a form and button');
      expect(result.layer).toBe('1-Presentation');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should detect 2-Application layer for service text', () => {
      const result = detectLayer('Implement a service to handle business logic and orchestration');
      expect(result.layer).toBe('2-Application');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should detect 3-Domain layer for domain model text', () => {
      const result = detectLayer('Create domain entities and aggregate root for business rules');
      expect(result.layer).toBe('3-Domain');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should detect 4-Persistence layer for database text', () => {
      const result = detectLayer('Implement repository pattern with database access using Prisma ORM');
      expect(result.layer).toBe('4-Persistence');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should detect 5-Integration layer for API text', () => {
      const result = detectLayer('Build a REST API client to integrate with external service');
      expect(result.layer).toBe('5-Integration');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should detect 6-Infrastructure layer for config text', () => {
      const result = detectLayer('Configure logging and caching infrastructure with Redis');
      expect(result.layer).toBe('6-Infrastructure');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should detect 7-Deployment layer for containerization text', () => {
      const result = detectLayer('Set up Docker containerization and Kubernetes deployment pipeline');
      expect(result.layer).toBe('7-Deployment');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should return wildcard (*) for ambiguous text', () => {
      const result = detectLayer('do something');
      expect(result.layer).toBe('*');
      expect(result.confidence).toBe(0);
    });

    it('should return wildcard (*) for low confidence matches', () => {
      const result = detectLayer('the quick brown fox');
      expect(result.layer).toBe('*');
      expect(result.confidence).toBe(0);
    });

    it('should respect custom confidence threshold', () => {
      const result = detectLayer('form', { confidenceThreshold: 0.8 });
      // 'form' alone might not reach 0.8 confidence
      expect(result.confidence).toBeLessThan(0.8);
    });

    it('should return alternatives when requested', () => {
      const result = detectLayer('Create API service with database', { 
        returnAlternatives: true 
      });
      expect(result.alternatives).toBeDefined();
      expect(Array.isArray(result.alternatives)).toBe(true);
    });

    it('should handle empty text gracefully', () => {
      const result = detectLayer('');
      expect(result.layer).toBe('*');
      expect(result.confidence).toBe(0);
    });

    it('should handle case-insensitive matching', () => {
      const result = detectLayer('CREATE A REACT COMPONENT');
      expect(result.layer).toBe('1-Presentation');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should detect multi-word keyword phrases', () => {
      const result = detectLayer('user interface design with React component', { confidenceThreshold: 0.3 });
      expect(result.layer).toBe('1-Presentation');
      expect(result.confidence).toBeGreaterThan(0.3);
    });

    it('should prioritize exact phrase matches over partial matches', () => {
      const result1 = detectLayer('business logic implementation');
      const result2 = detectLayer('business');
      expect(result1.confidence).toBeGreaterThan(result2.confidence);
    });
  });

  describe('detectMultipleLayers', () => {
    it('should detect multiple applicable layers', () => {
      const results = detectMultipleLayers('Build REST API service with database and React UI component');
      expect(results.length).toBeGreaterThan(1);
      const layers = results.map(r => r.layer);
      // Should detect at least API and database layers
      expect(layers.length).toBeGreaterThan(0);
    });

    it('should return layers sorted by confidence', () => {
      const results = detectMultipleLayers('React component with form and button');
      expect(results.length).toBeGreaterThan(0);
      // First result should have highest confidence
      if (results.length > 1) {
        expect(results[0].confidence).toBeGreaterThanOrEqual(results[1].confidence);
      }
    });

    it('should respect custom confidence threshold', () => {
      const results = detectMultipleLayers('form button', { 
        confidenceThreshold: 0.5 
      });
      results.forEach(r => {
        expect(r.confidence).toBeGreaterThanOrEqual(0.5);
      });
    });

    it('should return empty array for non-matching text', () => {
      const results = detectMultipleLayers('xyz abc def', { 
        confidenceThreshold: 0.5 
      });
      expect(results.length).toBe(0);
    });

    it('should handle complex architectural descriptions', () => {
      const text = 'Microservice with REST API, domain entities, database repository, and Docker deployment';
      const results = detectMultipleLayers(text);
      expect(results.length).toBeGreaterThan(3);
    });

    it('should include confidence scores for all returned layers', () => {
      const results = detectMultipleLayers('API database service');
      results.forEach(r => {
        expect(r.confidence).toBeGreaterThan(0);
        expect(r.confidence).toBeLessThanOrEqual(1);
      });
    });
  });
});
