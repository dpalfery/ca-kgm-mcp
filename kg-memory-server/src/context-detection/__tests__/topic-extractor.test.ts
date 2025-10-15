import { describe, it, expect, beforeEach } from 'vitest';
import { TopicExtractor } from '../topic-extractor.js';

describe('TopicExtractor', () => {
  let extractor: TopicExtractor;

  beforeEach(() => {
    extractor = new TopicExtractor();
  });

  describe('extractTopics', () => {
    it('should extract security-related topics', () => {
      const result = extractor.extractTopics('Implement JWT authentication with bcrypt password hashing');
      
      expect(result.topics).toContain('security');
      expect(result.technologies).toContain('bcrypt');
      expect(result.keywords).toContain('jwt');
      expect(result.keywords).toContain('authentication');
      expect(result.confidence).toBeGreaterThan(0.1);
    });

    it('should extract API-related topics', () => {
      const result = extractor.extractTopics('Create REST endpoint with Express middleware and JSON response');
      
      expect(result.topics).toContain('api');
      expect(result.technologies).toContain('express');
      expect(result.keywords).toContain('rest');
      expect(result.keywords).toContain('middleware');
    });

    it('should extract database-related topics', () => {
      const result = extractor.extractTopics('Write PostgreSQL migration with Prisma ORM for user table');
      
      expect(result.topics).toContain('database');
      expect(result.technologies).toContain('postgresql');
      expect(result.technologies).toContain('prisma');
      expect(result.keywords).toContain('migration');
    });

    it('should extract testing-related topics', () => {
      const result = extractor.extractTopics('Write unit tests with Jest and mock the database calls');
      
      expect(result.topics).toContain('testing');
      expect(result.technologies).toContain('jest');
      expect(result.keywords).toContain('unit test');
      expect(result.keywords).toContain('mock');
    });

    it('should extract frontend-related topics', () => {
      const result = extractor.extractTopics('Build React component with Redux state management and responsive CSS');
      
      expect(result.topics).toContain('frontend');
      expect(result.technologies).toContain('react');
      expect(result.technologies).toContain('redux');
      expect(result.keywords).toContain('component');
      expect(result.keywords).toContain('responsive');
    });

    it('should extract multiple topics from complex text', () => {
      const result = extractor.extractTopics(
        'Create secure REST API endpoint with JWT authentication, PostgreSQL database, and comprehensive Jest testing'
      );
      
      expect(result.topics).toContain('security');
      expect(result.topics).toContain('api');
      expect(result.topics).toContain('database');
      expect(result.topics).toContain('testing');
      expect(result.technologies).toContain('postgresql');
      expect(result.technologies).toContain('jest');
    });

    it('should handle synonyms correctly', () => {
      const result = extractor.extractTopics('Implement auth and login functionality');
      
      expect(result.keywords).toContain('authentication'); // Should resolve 'auth' synonym
    });

    it('should extract technologies using patterns', () => {
      const result = extractor.extractTopics('npm install express and import React from "react"');
      
      expect(result.technologies).toContain('express');
      expect(result.technologies).toContain('react');
    });

    it('should handle empty input gracefully', () => {
      const result = extractor.extractTopics('');
      
      expect(result.topics).toHaveLength(0);
      expect(result.keywords).toHaveLength(0);
      expect(result.technologies).toHaveLength(0);
      expect(result.confidence).toBe(0);
    });

    it('should extract technical keywords', () => {
      const result = extractor.extractTopics('Create async function with promise and callback handler');
      
      expect(result.keywords).toContain('async');
      expect(result.keywords).toContain('promise');
      expect(result.keywords).toContain('callback');
    });

    it('should be case insensitive', () => {
      const result = extractor.extractTopics('IMPLEMENT JWT AUTHENTICATION WITH BCRYPT');
      
      expect(result.topics).toContain('security');
      expect(result.keywords).toContain('jwt');
      expect(result.keywords).toContain('authentication');
    });

    it('should calculate confidence based on matches', () => {
      const simpleResult = extractor.extractTopics('test');
      const complexResult = extractor.extractTopics(
        'Create comprehensive REST API with JWT authentication, PostgreSQL database, Redis caching, and Jest testing'
      );
      
      expect(complexResult.confidence).toBeGreaterThan(simpleResult.confidence);
    });
  });

  describe('addDomainVocabulary', () => {
    it('should allow adding custom domain vocabulary', () => {
      extractor.addDomainVocabulary('custom', {
        keywords: ['custom-keyword'],
        technologies: ['custom-tech'],
        synonyms: { 'custom-keyword': ['ck'] }
      });
      
      const result = extractor.extractTopics('Use custom-keyword with custom-tech');
      
      expect(result.topics).toContain('custom');
      expect(result.keywords).toContain('custom-keyword');
      expect(result.technologies).toContain('custom-tech');
    });

    it('should merge with existing domain vocabulary', () => {
      extractor.addDomainVocabulary('security', {
        keywords: ['custom-security'],
        technologies: ['custom-auth'],
        synonyms: {}
      });
      
      const result = extractor.extractTopics('Implement custom-security with custom-auth and jwt');
      
      expect(result.topics).toContain('security');
      expect(result.keywords).toContain('custom-security');
      expect(result.keywords).toContain('jwt'); // Original keyword should still work
      expect(result.technologies).toContain('custom-auth');
    });
  });

  describe('getDomainVocabulary', () => {
    it('should return all domain vocabulary', () => {
      const vocabulary = extractor.getDomainVocabulary();
      
      expect(vocabulary).toHaveProperty('security');
      expect(vocabulary).toHaveProperty('api');
      expect(vocabulary).toHaveProperty('database');
      expect(vocabulary).toHaveProperty('testing');
      expect(vocabulary).toHaveProperty('frontend');
      
      expect(vocabulary.security.keywords).toContain('authentication');
      expect(vocabulary.api.technologies).toContain('express');
    });
  });
});