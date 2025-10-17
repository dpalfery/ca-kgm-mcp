/**
 * Tests for Topic Detection
 */
import { describe, it, expect } from 'vitest';
import { 
  detectTopics, 
  hasTopic,
  getPrimaryTopic,
  getTopicsAboveThreshold
} from './topic-detector.js';

describe('Topic Detection', () => {
  describe('detectTopics', () => {
    it('should detect security topic', () => {
      const results = detectTopics('Implement authentication with JWT tokens and encryption');
      const securityTopic = results.find(t => t.topic === 'security');
      expect(securityTopic).toBeDefined();
      expect(securityTopic?.confidence).toBeGreaterThan(0.3);
    });

    it('should detect testing topic', () => {
      const results = detectTopics('Write unit tests with assertions and mocks');
      const testingTopic = results.find(t => t.topic === 'testing');
      expect(testingTopic).toBeDefined();
      expect(testingTopic?.confidence).toBeGreaterThan(0.3);
    });

    it('should detect performance topic', () => {
      const results = detectTopics('Optimize performance with caching and reduce latency');
      const perfTopic = results.find(t => t.topic === 'performance');
      expect(perfTopic).toBeDefined();
      expect(perfTopic?.confidence).toBeGreaterThan(0.3);
    });

    it('should detect API topic', () => {
      const results = detectTopics('Build REST API with GET and POST endpoints');
      const apiTopic = results.find(t => t.topic === 'api');
      expect(apiTopic).toBeDefined();
      expect(apiTopic?.confidence).toBeGreaterThan(0.3);
    });

    it('should detect database topic', () => {
      const results = detectTopics('Design database schema with tables and migrations');
      const dbTopic = results.find(t => t.topic === 'database');
      expect(dbTopic).toBeDefined();
      expect(dbTopic?.confidence).toBeGreaterThan(0.3);
    });

    it('should detect deployment topic', () => {
      const results = detectTopics('Setup CI/CD pipeline with Docker and Kubernetes deployment');
      const deployTopic = results.find(t => t.topic === 'deployment');
      expect(deployTopic).toBeDefined();
      expect(deployTopic?.confidence).toBeGreaterThan(0.3);
    });

    it('should detect documentation topic', () => {
      const results = detectTopics('Write API documentation with examples and swagger');
      const docTopic = results.find(t => t.topic === 'documentation');
      expect(docTopic).toBeDefined();
      expect(docTopic?.confidence).toBeGreaterThan(0.3);
    });

    it('should detect accessibility topic', () => {
      const results = detectTopics('Ensure WCAG compliance with screen reader support and ARIA');
      const a11yTopic = results.find(t => t.topic === 'accessibility');
      expect(a11yTopic).toBeDefined();
      expect(a11yTopic?.confidence).toBeGreaterThan(0.3);
    });

    it('should detect error-handling topic', () => {
      const results = detectTopics('Implement error handling with try-catch and fallback');
      const errorTopic = results.find(t => t.topic === 'error-handling');
      expect(errorTopic).toBeDefined();
      expect(errorTopic?.confidence).toBeGreaterThan(0.3);
    });

    it('should detect logging topic', () => {
      const results = detectTopics('Add logging with debug and error levels for monitoring');
      const logTopic = results.find(t => t.topic === 'logging');
      expect(logTopic).toBeDefined();
      expect(logTopic?.confidence).toBeGreaterThan(0.3);
    });

    it('should detect architecture topic', () => {
      const results = detectTopics('Design clean architecture with layered pattern and SOLID principles');
      const archTopic = results.find(t => t.topic === 'architecture');
      expect(archTopic).toBeDefined();
      expect(archTopic?.confidence).toBeGreaterThan(0.3);
    });

    it('should detect data-validation topic', () => {
      const results = detectTopics('Add input validation and sanitization with schema constraints');
      const validationTopic = results.find(t => t.topic === 'data-validation');
      expect(validationTopic).toBeDefined();
      expect(validationTopic?.confidence).toBeGreaterThan(0.3);
    });

    it('should detect state-management topic', () => {
      const results = detectTopics('Implement state management with Redux store and actions');
      const stateTopic = results.find(t => t.topic === 'state-management');
      expect(stateTopic).toBeDefined();
      expect(stateTopic?.confidence).toBeGreaterThan(0.3);
    });

    it('should detect async-programming topic', () => {
      const results = detectTopics('Use async/await with promises for asynchronous operations');
      const asyncTopic = results.find(t => t.topic === 'async-programming');
      expect(asyncTopic).toBeDefined();
      expect(asyncTopic?.confidence).toBeGreaterThan(0.3);
    });

    it('should detect multiple topics', () => {
      const results = detectTopics('Build secure REST API with authentication, testing, and documentation');
      expect(results.length).toBeGreaterThan(2);
      expect(results.some(t => t.topic === 'security')).toBe(true);
      expect(results.some(t => t.topic === 'api')).toBe(true);
      expect(results.some(t => t.topic === 'testing')).toBe(true);
    });

    it('should sort topics by confidence', () => {
      const results = detectTopics('API security testing');
      if (results.length > 1) {
        expect(results[0].confidence).toBeGreaterThanOrEqual(results[1].confidence);
      }
    });

    it('should handle case insensitive matching', () => {
      const results = detectTopics('AUTHENTICATION AND AUTHORIZATION');
      const securityTopic = results.find(t => t.topic === 'security');
      expect(securityTopic).toBeDefined();
    });

    it('should return empty array for non-topic text', () => {
      const results = detectTopics('xyz abc def ghi jkl');
      expect(results.length).toBe(0);
    });

    it('should handle multi-word keyword matching', () => {
      const results = detectTopics('unit test coverage');
      const testingTopic = results.find(t => t.topic === 'testing');
      expect(testingTopic).toBeDefined();
    });

    it('should boost confidence with phrase matches', () => {
      const results1 = detectTopics('test');
      const results2 = detectTopics('unit test integration test e2e test');
      
      const topic1 = results1.find(t => t.topic === 'testing');
      const topic2 = results2.find(t => t.topic === 'testing');
      
      if (topic1 && topic2) {
        expect(topic2.confidence).toBeGreaterThan(topic1.confidence);
      }
    });
  });

  describe('hasTopic', () => {
    it('should return true when topic is present', () => {
      expect(hasTopic('Add authentication', 'security')).toBe(true);
    });

    it('should return false when topic is not present', () => {
      expect(hasTopic('Build UI component', 'security')).toBe(false);
    });

    it('should work with various topics', () => {
      const text = 'Write unit tests with coverage';
      expect(hasTopic(text, 'testing')).toBe(true);
      expect(hasTopic(text, 'database')).toBe(false);
    });
  });

  describe('getPrimaryTopic', () => {
    it('should return highest confidence topic', () => {
      const primary = getPrimaryTopic('Implement JWT authentication with encryption');
      expect(primary).not.toBeNull();
      expect(primary?.topic).toBe('security');
    });

    it('should return null for non-topic text', () => {
      const primary = getPrimaryTopic('xyz abc def');
      expect(primary).toBeNull();
    });

    it('should return most relevant topic for mixed text', () => {
      const primary = getPrimaryTopic('REST API endpoint');
      expect(primary).not.toBeNull();
      expect(primary?.topic).toBe('api');
    });
  });

  describe('getTopicsAboveThreshold', () => {
    it('should filter topics by threshold', () => {
      const topics = getTopicsAboveThreshold(
        'Security testing with authentication', 
        0.5
      );
      topics.forEach(t => {
        expect(t.confidence).toBeGreaterThanOrEqual(0.5);
      });
    });

    it('should use default threshold of 0.5', () => {
      const topics = getTopicsAboveThreshold('API testing documentation');
      topics.forEach(t => {
        expect(t.confidence).toBeGreaterThanOrEqual(0.5);
      });
    });

    it('should return empty array when no topics meet threshold', () => {
      const topics = getTopicsAboveThreshold('test', 0.9);
      expect(topics.length).toBe(0);
    });

    it('should return all topics with low threshold', () => {
      const topics = getTopicsAboveThreshold('API security testing', 0.1);
      expect(topics.length).toBeGreaterThan(0);
    });
  });
});
