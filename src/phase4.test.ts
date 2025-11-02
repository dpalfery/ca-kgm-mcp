/**
 * Phase 4 - Smart Context Retrieval Tests
 * 
 * Tests for context detection, ranking, and formatting modules
 */

import { describe, it, expect } from 'vitest';
import { LayerDetector } from '../src/detection/layer-detector';
import { TechDetector } from '../src/detection/tech-detector';
import { TopicDetector } from '../src/detection/topic-detector';
import { ScoringEngine, TokenCounter } from '../src/ranking/scoring-engine';
import { ContextFormatter } from '../src/formatting/context-formatter';
import { CitationGenerator } from '../src/formatting/citation-generator';

describe('Phase 4: Smart Context Retrieval', () => {
  describe('Layer Detection', () => {
    it('detects presentation layer from UI keywords', () => {
      const text = 'Build a React component with buttons and responsive layout';
      const result = LayerDetector.detect(text);
      
      expect(result.layer).toBe('1-Presentation');
      expect(result.confidence).toBeGreaterThan(0.1);
      expect(result.indicators).toContain('react');
    });

    it('detects application layer from service keywords', () => {
      const text = 'Create an Express middleware handler for business logic';
      const result = LayerDetector.detect(text);
      
      expect(result.layer).toBe('2-Application');
      expect(result.confidence).toBeGreaterThan(0.1);
    });

    it('detects domain layer from entity keywords', () => {
      const text = 'Design a domain entity with business rules and validation';
      const result = LayerDetector.detect(text);
      
      expect(result.layer).toBe('3-Domain');
      expect(result.confidence).toBeGreaterThan(0.05);
    });

    it('detects persistence layer from database keywords', () => {
      const text = 'Create a repository pattern for database queries and transactions';
      const result = LayerDetector.detect(text);
      
      expect(result.layer).toBe('4-Persistence');
      expect(result.confidence).toBeGreaterThan(0.05);
    });

    it('detects integration layer from API keywords', () => {
      const text = 'Build a REST API client adapter for external services';
      const result = LayerDetector.detect(text);
      
      expect(result.layer).toBe('5-Tests');
      expect(result.confidence).toBeGreaterThan(0.1);
    });

    it('returns wildcard when no keywords match', () => {
      const text = 'This is random text with no technical keywords';
      const result = LayerDetector.detect(text);
      
      expect(result.layer).toBe('*');
      expect(result.confidence).toBe(0);
    });

    it('provides alternative layers when available', () => {
      const text = 'Build a React component with database queries';
      const result = LayerDetector.detect(text);
      
      expect(result.alternatives.length).toBeGreaterThan(0);
      expect(result.alternatives[0].layer).toBeDefined();
    });
  });

  describe('Technology Detection', () => {
    it('detects exact technology matches', () => {
      const text = 'Building with React and Node.js';
      const result = TechDetector.extract(text);
      
      const names = result.map(t => t.name);
      expect(names).toContain('React');
      expect(names).toContain('Node.js');
    });

    it('detects technology aliases', () => {
      const text = 'Using postgres and nodejs for the backend';
      const result = TechDetector.extract(text);
      
      const names = result.map(t => t.name);
      expect(names).toContain('PostgreSQL');
      expect(names).toContain('Node.js');
    });

    it('categorizes technologies correctly', () => {
      const text = 'React frontend with Django backend and PostgreSQL database';
      const result = TechDetector.extract(text);
      
      const frontend = result.find(t => t.name === 'React');
      expect(frontend?.category).toBe('frontend');
      
      const backend = result.find(t => t.name === 'Django');
      expect(backend?.category).toBe('backend');
      
      const db = result.find(t => t.name === 'PostgreSQL');
      expect(db?.category).toBe('database');
    });

    it('returns empty array for no matches', () => {
      const text = 'Some random text without any technology mentions';
      const result = TechDetector.extract(text);
      
      expect(result.length).toBe(0);
    });

    it('provides confidence scores', () => {
      const text = 'React';
      const result = TechDetector.extract(text);
      
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].confidence).toBeLessThanOrEqual(1.0);
      expect(result[0].confidence).toBeGreaterThan(0);
    });
  });

  describe('Topic Detection', () => {
    it('detects security topics', () => {
      const text = 'Implement authentication and encryption for sensitive data';
      const result = TopicDetector.detect(text);
      
      const topics = result.map(t => t.name);
      expect(topics).toContain('security');
    });

    it('detects testing topics', () => {
      const text = 'Write unit tests with Jest and add coverage reports';
      const result = TopicDetector.detect(text);
      
      const topics = result.map(t => t.name);
      expect(topics).toContain('testing');
    });

    it('detects performance topics', () => {
      const text = 'Optimize latency with caching and improve throughput';
      const result = TopicDetector.detect(text);
      
      const topics = result.map(t => t.name);
      expect(topics).toContain('performance');
    });

    it('detects API topics', () => {
      const text = 'Design REST endpoints with proper versioning';
      const result = TopicDetector.detect(text);
      
      const topics = result.map(t => t.name);
      expect(topics).toContain('api');
    });

    it('returns multiple topics when relevant', () => {
      const text = 'Write secure tests for REST APIs with performance optimization';
      const result = TopicDetector.detect(text);
      
      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    it('provides confidence scores for topics', () => {
      const text = 'Security is important for authentication';
      const result = TopicDetector.detect(text);
      
      expect(result[0].confidence).toBeGreaterThan(0);
      expect(result[0].confidence).toBeLessThanOrEqual(1.0);
    });
  });

  describe('Scoring Engine', () => {
    it('scores MUST directives highest', () => {
      const mustDirective = {
        id: '1',
        content: 'Always validate input',
        severity: 'MUST' as const,
        topics: ['security'],
        layers: ['3-Domain'],
        technologies: [],
        section: 'Security',
        sourcePath: 'guidelines.md'
      };

      const shouldDirective = { ...mustDirective, id: '2', severity: 'SHOULD' as const };
      const mayDirective = { ...mustDirective, id: '3', severity: 'MAY' as const };

      const context = {
        detectedLayer: '3-Domain',
        detectedTopics: ['security'],
        detectedTechnologies: []
      };

      const mustScore = ScoringEngine.scoreDirective(mustDirective, context);
      const shouldScore = ScoringEngine.scoreDirective(shouldDirective, context);
      const mayScore = ScoringEngine.scoreDirective(mayDirective, context);

      expect(mustScore.totalScore).toBeGreaterThan(shouldScore.totalScore);
      expect(shouldScore.totalScore).toBeGreaterThan(mayScore.totalScore);
    });

    it('scores layer matches higher', () => {
      const directive = {
        id: '1',
        content: 'Validate domain rules',
        severity: 'SHOULD' as const,
        topics: [],
        layers: ['3-Domain'],
        technologies: [],
        section: 'Domain',
        sourcePath: 'guidelines.md'
      };

      const contextMatch = {
        detectedLayer: '3-Domain',
        detectedTopics: [],
        detectedTechnologies: []
      };

      const contextMismatch = {
        detectedLayer: '1-Presentation',
        detectedTopics: [],
        detectedTechnologies: []
      };

      const matchScore = ScoringEngine.scoreDirective(directive, contextMatch);
      const mismatchScore = ScoringEngine.scoreDirective(directive, contextMismatch);

      expect(matchScore.totalScore).toBeGreaterThan(mismatchScore.totalScore);
    });

    it('applies mode adjustments', () => {
      const directive = {
        id: '1',
        content: 'Implement testing for components',
        severity: 'SHOULD' as const,
        topics: ['testing'],
        layers: ['1-Presentation'],
        technologies: ['React'],
        section: 'Testing',
        sourcePath: 'guidelines.md'
      };

      const context = {
        detectedLayer: '1-Presentation',
        detectedTopics: ['testing'],
        detectedTechnologies: ['React']
      };

      const archScore = ScoringEngine.scoreDirective(directive, {
        ...context,
        mode: 'architect'
      });

      const codeScore = ScoringEngine.scoreDirective(directive, {
        ...context,
        mode: 'code'
      });

      // Code mode should prioritize testing higher than architect
      expect(codeScore.totalScore).toBeGreaterThan(archScore.totalScore);
    });
  });

  describe('Token Counter', () => {
    it('estimates tokens correctly', () => {
      const text = 'Hello world';
      const tokens = TokenCounter.estimateTokens(text);
      
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThanOrEqual(text.length);
    });

    it('selects directives within budget', () => {
      const directives = Array(10).fill(null).map((_, i) => ({
        id: String(i),
        content: 'Directive ' + i,
        severity: 'SHOULD' as const,
        topics: [],
        layers: [],
        technologies: [],
        section: '',
        sourcePath: '',
        severityScore: 50,
        relevanceScore: 50,
        layerScore: 50,
        topicScore: 50,
        authorityScore: 50,
        totalScore: 0.5
      }));

      const { selected, totalTokens } = TokenCounter.selectWithinBudget(directives, 100);
      
      expect(selected.length).toBeGreaterThan(0);
      expect(selected.length).toBeLessThanOrEqual(directives.length);
      expect(totalTokens).toBeLessThanOrEqual(100);
    });

    it('stops adding directives when budget exceeded', () => {
      const directives = Array(5).fill(null).map((_, i) => ({
        id: String(i),
        content: 'X'.repeat(100), // Large content
        severity: 'SHOULD' as const,
        topics: [],
        layers: [],
        technologies: [],
        section: '',
        sourcePath: '',
        severityScore: 50,
        relevanceScore: 50,
        layerScore: 50,
        topicScore: 50,
        authorityScore: 50,
        totalScore: 0.5
      }));

      const { selected } = TokenCounter.selectWithinBudget(directives, 100);
      
      // With small budget, should select fewer items
      expect(selected.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Context Formatter', () => {
    it('formats directives into markdown', () => {
      const directives = [
        {
          id: '1',
          content: 'Always validate input',
          severity: 'MUST' as const,
          topics: ['security'],
          layers: ['3-Domain'],
          technologies: [],
          section: 'Security',
          sourcePath: 'guidelines.md'
        }
      ];

      const result = ContextFormatter.format({
        directives,
        detectedLayer: '3-Domain',
        detectedTopics: ['security'],
        detectedTechnologies: [],
        includeBreadcrumbs: true
      });

      expect(result.contextBlock).toContain('# Contextual Rules');
      expect(result.contextBlock).toContain('Always validate input');
      expect(result.contextBlock).toContain('[MUST]');
      expect(result.tokenEstimate).toBeGreaterThan(0);
    });

    it('groups directives by severity', () => {
      const directives = [
        {
          id: '1',
          content: 'MUST do this',
          severity: 'MUST' as const,
          topics: [],
          layers: [],
          technologies: [],
          section: 'General',
          sourcePath: 'guidelines.md'
        },
        {
          id: '2',
          content: 'SHOULD do this',
          severity: 'SHOULD' as const,
          topics: [],
          layers: [],
          technologies: [],
          section: 'General',
          sourcePath: 'guidelines.md'
        }
      ];

      const result = ContextFormatter.format({
        directives,
        detectedLayer: '*',
        detectedTopics: [],
        detectedTechnologies: [],
        includeBreadcrumbs: false
      });

      expect(result.contextBlock).toContain('Critical (MUST)');
      expect(result.contextBlock).toContain('Recommended (SHOULD)');
      expect(result.groupCount.must).toBe(1);
      expect(result.groupCount.should).toBe(1);
    });

    it('estimates token count', () => {
      const directives = Array(3).fill(null).map((_, i) => ({
        id: String(i),
        content: 'Directive content',
        severity: 'SHOULD' as const,
        topics: [],
        layers: [],
        technologies: [],
        section: 'Section',
        sourcePath: 'file.md'
      }));

      const result = ContextFormatter.format({
        directives,
        detectedLayer: '*',
        detectedTopics: [],
        detectedTechnologies: [],
        includeBreadcrumbs: true
      });

      expect(result.tokenEstimate).toBeGreaterThan(0);
      expect(result.tokenEstimate).toBeLessThanOrEqual(result.contextBlock.length);
    });
  });

  describe('Citation Generator', () => {
    it('generates citations', () => {
      const citation = CitationGenerator.generateCitation(
        'guidelines.md',
        'Security',
        'Authentication',
        42
      );

      expect(citation.source).toBe('guidelines.md');
      expect(citation.section).toBe('Security');
      expect(citation.subsection).toBe('Authentication');
      expect(citation.lineNumber).toBe(42);
      expect(citation.full).toContain('guidelines.md');
      expect(citation.full).toContain('Security');
    });

    it('generates inline citations', () => {
      const citation = CitationGenerator.generateCitation(
        'api.md',
        'REST',
        undefined,
        10
      );

      const inline = CitationGenerator.generateInlineCitation(citation);
      expect(inline).toContain('*Source:');
      expect(inline).toContain('api.md');
    });

    it('extracts breadcrumbs', () => {
      const breadcrumbs = CitationGenerator.extractBreadcrumbs(
        'path/to/guidelines.md',
        'Security',
        'Authentication'
      );

      expect(breadcrumbs).toContain('guidelines');
      expect(breadcrumbs).toContain('Security');
      expect(breadcrumbs).toContain('Authentication');
    });

    it('generates abbreviated citations', () => {
      const abbreviated = CitationGenerator.generateAbbreviatedCitation(
        'path/to/api-guidelines.md',
        'REST',
        'Versioning'
      );

      expect(abbreviated).toContain('api-guidelines');
      expect(abbreviated).toContain('REST');
      expect(abbreviated).toContain('Versioning');
    });

    it('handles missing line numbers', () => {
      const citation = CitationGenerator.generateCitation(
        'rules.md',
        'Section'
      );

      expect(citation.lineNumber).toBeUndefined();
      expect(citation.full).not.toContain('Line');
    });
  });
});
