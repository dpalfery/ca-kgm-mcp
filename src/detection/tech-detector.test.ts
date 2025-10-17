/**
 * Tests for Technology Detection
 */
import { describe, it, expect } from 'vitest';
import { 
  detectTechnologies, 
  getTechnologiesByCategory,
  hasTechnology 
} from './tech-detector.js';

describe('Technology Detection', () => {
  describe('detectTechnologies', () => {
    it('should detect React in text', () => {
      const results = detectTechnologies('Build a React application');
      const reactTech = results.find(t => t.name === 'React');
      expect(reactTech).toBeDefined();
      expect(reactTech?.category).toBe('frontend');
      expect(reactTech?.confidence).toBeGreaterThan(0.5);
    });

    it('should detect React with alias ReactJS', () => {
      const results = detectTechnologies('Build a ReactJS component');
      const reactTech = results.find(t => t.name === 'React');
      expect(reactTech).toBeDefined();
    });

    it('should detect multiple technologies', () => {
      const results = detectTechnologies('Build REST API with Express and PostgreSQL');
      expect(results.length).toBeGreaterThanOrEqual(3);
      expect(results.some(t => t.name === 'REST')).toBe(true);
      expect(results.some(t => t.name === 'Express')).toBe(true);
      expect(results.some(t => t.name === 'PostgreSQL')).toBe(true);
    });

    it('should detect TypeScript', () => {
      const results = detectTechnologies('Write TypeScript code with interfaces');
      const tsTech = results.find(t => t.name === 'TypeScript');
      expect(tsTech).toBeDefined();
      expect(tsTech?.category).toBe('language');
    });

    it('should detect Docker and Kubernetes', () => {
      const results = detectTechnologies('Deploy using Docker and Kubernetes');
      expect(results.some(t => t.name === 'Docker')).toBe(true);
      expect(results.some(t => t.name === 'Kubernetes')).toBe(true);
    });

    it('should detect database technologies', () => {
      const results = detectTechnologies('Use MongoDB and Redis for storage');
      expect(results.some(t => t.name === 'MongoDB')).toBe(true);
      expect(results.some(t => t.name === 'Redis')).toBe(true);
    });

    it('should handle case insensitive matching', () => {
      const results = detectTechnologies('REACT COMPONENT WITH TYPESCRIPT');
      expect(results.some(t => t.name === 'React')).toBe(true);
      expect(results.some(t => t.name === 'TypeScript')).toBe(true);
    });

    it('should return empty array for non-tech text', () => {
      const results = detectTechnologies('the quick brown fox jumps');
      expect(results.length).toBe(0);
    });

    it('should detect ORM technologies', () => {
      const results = detectTechnologies('Use Prisma ORM for database access');
      const prismaTech = results.find(t => t.name === 'Prisma');
      expect(prismaTech).toBeDefined();
      expect(prismaTech?.category).toBe('orm');
    });

    it('should sort results by confidence', () => {
      const results = detectTechnologies('React component with hooks and useState');
      if (results.length > 1) {
        expect(results[0].confidence).toBeGreaterThanOrEqual(results[1].confidence);
      }
    });

    it('should detect cloud platforms', () => {
      const results = detectTechnologies('Deploy to AWS Lambda');
      const awsTech = results.find(t => t.name === 'AWS');
      expect(awsTech).toBeDefined();
      expect(awsTech?.category).toBe('cloud');
    });

    it('should handle multi-word technology names', () => {
      const results = detectTechnologies('Using Spring Boot for backend');
      const springTech = results.find(t => t.name === 'Spring Boot');
      expect(springTech).toBeDefined();
    });

    it('should detect GraphQL', () => {
      const results = detectTechnologies('Build GraphQL API with resolvers');
      const gqlTech = results.find(t => t.name === 'GraphQL');
      expect(gqlTech).toBeDefined();
      expect(gqlTech?.category).toBe('api');
    });

    it('should detect testing frameworks', () => {
      const results = detectTechnologies('Write tests using Jest');
      const jestTech = results.find(t => t.name === 'Jest');
      expect(jestTech).toBeDefined();
      expect(jestTech?.category).toBe('testing');
    });

    it('should boost confidence with keyword matches', () => {
      const results1 = detectTechnologies('React');
      const results2 = detectTechnologies('React component with hooks and useState');
      
      const react1 = results1.find(t => t.name === 'React');
      const react2 = results2.find(t => t.name === 'React');
      
      // Both should detect React
      expect(react1).toBeDefined();
      expect(react2).toBeDefined();
      
      // Second should have higher or equal confidence
      if (react1 && react2) {
        expect(react2.confidence).toBeGreaterThanOrEqual(react1.confidence);
      }
    });
  });

  describe('getTechnologiesByCategory', () => {
    it('should group technologies by category', () => {
      const detected = detectTechnologies('React frontend with Express backend and PostgreSQL database');
      const grouped = getTechnologiesByCategory(detected);
      
      expect(grouped.frontend).toBeDefined();
      expect(grouped.backend).toBeDefined();
      expect(grouped.database).toBeDefined();
    });

    it('should handle empty input', () => {
      const grouped = getTechnologiesByCategory([]);
      expect(Object.keys(grouped).length).toBe(0);
    });

    it('should maintain technologies in groups', () => {
      const detected = detectTechnologies('Docker and Kubernetes deployment');
      const grouped = getTechnologiesByCategory(detected);
      
      if (grouped.container) {
        expect(grouped.container.some(t => t.name === 'Docker')).toBe(true);
      }
      if (grouped.orchestration) {
        expect(grouped.orchestration.some(t => t.name === 'Kubernetes')).toBe(true);
      }
    });
  });

  describe('hasTechnology', () => {
    it('should return true when technology is present', () => {
      expect(hasTechnology('Build React app', 'React')).toBe(true);
    });

    it('should return false when technology is not present', () => {
      expect(hasTechnology('Build Vue app', 'React')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(hasTechnology('Build React app', 'react')).toBe(true);
    });

    it('should work with aliases', () => {
      expect(hasTechnology('Build ReactJS app', 'React')).toBe(true);
    });
  });
});
