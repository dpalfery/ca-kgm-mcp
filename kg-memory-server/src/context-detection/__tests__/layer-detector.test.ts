import { describe, it, expect, beforeEach } from 'vitest';
import { LayerDetector } from '../layer-detector.js';

describe('LayerDetector', () => {
  let detector: LayerDetector;

  beforeEach(() => {
    detector = new LayerDetector();
  });

  describe('detectLayer', () => {
    it('should detect Presentation layer for UI-related tasks', () => {
      const result = detector.detectLayer('Create a React component with CSS styling and form validation');
      
      expect(result.layer).toBe('1-Presentation');
      expect(result.confidence).toBeGreaterThan(0.3);
      expect(result.indicators).toContain('react');
      expect(result.indicators).toContain('css');
    });

    it('should detect Application layer for API and service tasks', () => {
      const result = detector.detectLayer('Implement REST API endpoint with middleware and authentication');
      
      expect(result.layer).toBe('2-Application');
      expect(result.confidence).toBeGreaterThan(0.3);
      expect(result.indicators).toContain('api');
      expect(result.indicators).toContain('middleware');
    });

    it('should detect Domain layer for business logic tasks', () => {
      const result = detector.detectLayer('Implement business rules for order calculation and validation');
      
      expect(result.layer).toBe('3-Domain');
      expect(result.confidence).toBeGreaterThan(0.3);
      expect(result.indicators).toContain('business rule');
    });

    it('should detect Persistence layer for database tasks', () => {
      const result = detector.detectLayer('Create database migration and repository for user data');
      
      expect(result.layer).toBe('4-Persistence');
      expect(result.confidence).toBeGreaterThan(0.3);
      expect(result.indicators).toContain('database');
      expect(result.indicators).toContain('repository');
    });

    it('should detect Infrastructure layer for deployment tasks', () => {
      const result = detector.detectLayer('Set up Docker containers and Kubernetes deployment');
      
      expect(result.layer).toBe('5-Infrastructure');
      expect(result.confidence).toBeGreaterThan(0.3);
      expect(result.indicators).toContain('docker');
      expect(result.indicators).toContain('kubernetes');
    });

    it('should return wildcard for ambiguous tasks', () => {
      const result = detector.detectLayer('Fix the bug');
      
      expect(result.layer).toBe('*');
      expect(result.confidence).toBeLessThan(0.3);
    });

    it('should handle empty input gracefully', () => {
      const result = detector.detectLayer('');
      
      expect(result.layer).toBe('*');
      expect(result.confidence).toBe(0.1);
      expect(result.indicators).toHaveLength(0);
    });

    it('should apply contextual boosters correctly', () => {
      const uiResult = detector.detectLayer('render the user interface');
      const apiResult = detector.detectLayer('create API endpoint');
      
      expect(uiResult.layer).toBe('1-Presentation');
      expect(apiResult.layer).toBe('2-Application');
    });

    it('should handle multi-word keywords', () => {
      const result = detector.detectLayer('Create user interface component with styling');
      
      // Should detect presentation layer due to "user interface" and "component"
      expect(result.layer).toBe('1-Presentation');
      expect(result.indicators).toContain('user interface');
    });

    it('should be case insensitive', () => {
      const result = detector.detectLayer('CREATE REACT COMPONENT WITH CSS');
      
      expect(result.layer).toBe('1-Presentation');
      expect(result.indicators).toContain('react');
      expect(result.indicators).toContain('css');
    });
  });

  describe('addLayerKeywords', () => {
    it('should allow adding custom keywords', () => {
      detector.addLayerKeywords('1-Presentation', ['custom-ui', 'special-component']);
      
      const result = detector.detectLayer('Build custom-ui with special-component');
      
      expect(result.layer).toBe('1-Presentation');
      expect(result.confidence).toBeGreaterThan(0.3);
    });

    it('should not add keywords to wildcard layer', () => {
      const originalKeywords = detector.getLayerKeywords();
      detector.addLayerKeywords('*', ['test']);
      const newKeywords = detector.getLayerKeywords();
      
      expect(newKeywords).toEqual(originalKeywords);
    });
  });

  describe('getLayerKeywords', () => {
    it('should return all layer keywords', () => {
      const keywords = detector.getLayerKeywords();
      
      expect(keywords).toHaveProperty('1-Presentation');
      expect(keywords).toHaveProperty('2-Application');
      expect(keywords).toHaveProperty('3-Domain');
      expect(keywords).toHaveProperty('4-Persistence');
      expect(keywords).toHaveProperty('5-Infrastructure');
      
      expect(keywords['1-Presentation']).toContain('react');
      expect(keywords['2-Application']).toContain('api');
      expect(keywords['4-Persistence']).toContain('database');
    });
  });
});