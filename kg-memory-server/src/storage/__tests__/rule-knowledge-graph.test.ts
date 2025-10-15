import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseConnection } from '../../database/connection.js';
import { RuleKnowledgeGraphImpl } from '../rule-knowledge-graph.js';
import { Rule, Directive, RuleRelationship, ArchitecturalLayer, DirectiveSeverity } from '../../types.js';
import { promises as fs } from 'fs';
import path from 'path';

describe('RuleKnowledgeGraphImpl', () => {
  let db: DatabaseConnection;
  let knowledgeGraph: RuleKnowledgeGraphImpl;
  let tempDbPath: string;

  beforeEach(async () => {
    // Create temporary database for testing
    tempDbPath = path.join(process.cwd(), `test-kg-${Date.now()}.db`);
    db = new DatabaseConnection(tempDbPath);
    await db.initialize();
    knowledgeGraph = new RuleKnowledgeGraphImpl(db);
  });

  afterEach(async () => {
    await db.close();
    // Clean up temporary database
    try {
      await fs.unlink(tempDbPath);
    } catch {
      // Ignore if file doesn't exist
    }
  });

  describe('upsertRules', () => {
    it('should insert new rules successfully', async () => {
      const rules: Rule[] = [
        {
          id: 'rule-1',
          name: 'API Security Rules',
          layer: '2-Application' as ArchitecturalLayer,
          authoritativeFor: ['security', 'API'],
          topics: ['authentication', 'authorization'],
          sourcePath: '/test/api-security.md',
          lastUpdated: new Date()
        },
        {
          id: 'rule-2',
          name: 'UI Component Rules',
          layer: '1-Presentation' as ArchitecturalLayer,
          authoritativeFor: ['UI', 'components'],
          topics: ['React', 'TypeScript'],
          sourcePath: '/test/ui-components.md',
          lastUpdated: new Date()
        }
      ];

      const result = await knowledgeGraph.upsertRules(rules);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('rule-1');
      expect(result[1].id).toBe('rule-2');

      // Verify rules were inserted into database
      const dbRules = await db.all('SELECT * FROM rules ORDER BY id');
      expect(dbRules).toHaveLength(2);
      expect(dbRules[0].name).toBe('API Security Rules');
      expect(dbRules[1].name).toBe('UI Component Rules');
    });

    it('should update existing rules', async () => {
      // Insert initial rule
      const initialRule: Rule = {
        id: 'rule-1',
        name: 'Initial Name',
        layer: '1-Presentation' as ArchitecturalLayer,
        authoritativeFor: ['UI'],
        topics: ['React'],
        sourcePath: '/test/initial.md',
        lastUpdated: new Date()
      };

      await knowledgeGraph.upsertRules([initialRule]);

      // Update the rule
      const updatedRule: Rule = {
        ...initialRule,
        name: 'Updated Name',
        authoritativeFor: ['UI', 'components'],
        topics: ['React', 'TypeScript']
      };

      const result = await knowledgeGraph.upsertRules([updatedRule]);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Updated Name');

      // Verify only one rule exists in database
      const dbRules = await db.all('SELECT * FROM rules');
      expect(dbRules).toHaveLength(1);
      expect(dbRules[0].name).toBe('Updated Name');
      expect(JSON.parse(dbRules[0].authoritative_for)).toEqual(['UI', 'components']);
    });

    it('should handle JSON serialization of arrays', async () => {
      const rule: Rule = {
        id: 'rule-json',
        name: 'JSON Test Rule',
        layer: '3-Domain' as ArchitecturalLayer,
        authoritativeFor: ['business-logic', 'validation', 'entities'],
        topics: ['DDD', 'aggregates', 'value-objects'],
        sourcePath: '/test/domain.md',
        lastUpdated: new Date()
      };

      await knowledgeGraph.upsertRules([rule]);

      const dbRule = await db.get('SELECT * FROM rules WHERE id = ?', ['rule-json']);
      expect(JSON.parse(dbRule.authoritative_for)).toEqual(['business-logic', 'validation', 'entities']);
      expect(JSON.parse(dbRule.topics)).toEqual(['DDD', 'aggregates', 'value-objects']);
    });
  });

  describe('upsertDirectives', () => {
    beforeEach(async () => {
      // Insert a rule first for foreign key constraint
      const rule: Rule = {
        id: 'test-rule',
        name: 'Test Rule',
        layer: '2-Application' as ArchitecturalLayer,
        authoritativeFor: ['testing'],
        topics: ['unit-tests'],
        sourcePath: '/test/test.md',
        lastUpdated: new Date()
      };
      await knowledgeGraph.upsertRules([rule]);
    });

    it('should insert new directives successfully', async () => {
      const directives: Directive[] = [
        {
          id: 'directive-1',
          ruleId: 'test-rule',
          section: 'Authentication',
          severity: 'MUST' as DirectiveSeverity,
          text: 'All endpoints must require authentication',
          rationale: 'Security requirement',
          example: 'app.use(authenticate)',
          antiPattern: 'No auth middleware',
          topics: ['security', 'authentication'],
          whenToApply: ['API endpoints', 'user data access']
        },
        {
          id: 'directive-2',
          ruleId: 'test-rule',
          section: 'Validation',
          severity: 'SHOULD' as DirectiveSeverity,
          text: 'Validate input parameters',
          topics: ['validation', 'security'],
          whenToApply: ['user input', 'API parameters']
        }
      ];

      const result = await knowledgeGraph.upsertDirectives(directives);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('directive-1');
      expect(result[1].id).toBe('directive-2');

      // Verify directives were inserted into database
      const dbDirectives = await db.all('SELECT * FROM directives ORDER BY id');
      expect(dbDirectives).toHaveLength(2);
      expect(dbDirectives[0].text).toBe('All endpoints must require authentication');
      expect(dbDirectives[1].text).toBe('Validate input parameters');
    });

    it('should update existing directives', async () => {
      // Insert initial directive
      const initialDirective: Directive = {
        id: 'directive-update',
        ruleId: 'test-rule',
        section: 'Initial Section',
        severity: 'MAY' as DirectiveSeverity,
        text: 'Initial text',
        topics: ['initial'],
        whenToApply: ['initial condition']
      };

      await knowledgeGraph.upsertDirectives([initialDirective]);

      // Update the directive
      const updatedDirective: Directive = {
        ...initialDirective,
        section: 'Updated Section',
        severity: 'MUST' as DirectiveSeverity,
        text: 'Updated text',
        rationale: 'Added rationale',
        topics: ['updated', 'enhanced']
      };

      const result = await knowledgeGraph.upsertDirectives([updatedDirective]);

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('Updated text');

      // Verify only one directive exists in database
      const dbDirectives = await db.all('SELECT * FROM directives');
      expect(dbDirectives).toHaveLength(1);
      expect(dbDirectives[0].text).toBe('Updated text');
      expect(dbDirectives[0].severity).toBe('MUST');
      expect(dbDirectives[0].rationale).toBe('Added rationale');
    });

    it('should handle embeddings correctly', async () => {
      const embedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      const directive: Directive = {
        id: 'directive-embedding',
        ruleId: 'test-rule',
        section: 'Embedding Test',
        severity: 'MUST' as DirectiveSeverity,
        text: 'Test directive with embedding',
        topics: ['embedding'],
        whenToApply: ['test'],
        embedding
      };

      await knowledgeGraph.upsertDirectives([directive]);

      const dbDirective = await db.get('SELECT * FROM directives WHERE id = ?', ['directive-embedding']);
      expect(dbDirective.embedding).toBeDefined();
      
      // Verify embedding can be reconstructed
      const buffer = Buffer.from(dbDirective.embedding);
      const reconstructedEmbedding = Array.from(new Float32Array(buffer.buffer));
      expect(reconstructedEmbedding).toEqual(embedding);
    });

    it('should handle null optional fields', async () => {
      const directive: Directive = {
        id: 'directive-minimal',
        ruleId: 'test-rule',
        section: 'Minimal',
        severity: 'MUST' as DirectiveSeverity,
        text: 'Minimal directive',
        topics: ['minimal'],
        whenToApply: ['always']
      };

      await knowledgeGraph.upsertDirectives([directive]);

      const dbDirective = await db.get('SELECT * FROM directives WHERE id = ?', ['directive-minimal']);
      expect(dbDirective.rationale).toBeNull();
      expect(dbDirective.example).toBeNull();
      expect(dbDirective.anti_pattern).toBeNull();
      expect(dbDirective.embedding).toBeNull();
    });
  });

  describe('createRuleRelationships', () => {
    beforeEach(async () => {
      // Insert test rules and directives
      const rule: Rule = {
        id: 'test-rule',
        name: 'Test Rule',
        layer: '2-Application' as ArchitecturalLayer,
        authoritativeFor: ['testing'],
        topics: ['relationships'],
        sourcePath: '/test/test.md',
        lastUpdated: new Date()
      };
      await knowledgeGraph.upsertRules([rule]);

      const directive: Directive = {
        id: 'test-directive',
        ruleId: 'test-rule',
        section: 'Test Section',
        severity: 'MUST' as DirectiveSeverity,
        text: 'Test directive',
        topics: ['testing'],
        whenToApply: ['test']
      };
      await knowledgeGraph.upsertDirectives([directive]);
    });

    it('should create relationships successfully', async () => {
      const relationships: RuleRelationship[] = [
        {
          from: 'test-rule',
          to: 'test-directive',
          type: 'CONTAINS',
          weight: 1.0
        },
        {
          from: 'test-rule',
          to: 'security',
          type: 'AUTHORITATIVE_FOR',
          weight: 0.8
        }
      ];

      const result = await knowledgeGraph.createRuleRelationships(relationships);

      expect(result).toHaveLength(2);

      // Verify relationships were inserted into database
      const dbRelationships = await db.all('SELECT * FROM rule_relationships ORDER BY relationship_type');
      expect(dbRelationships).toHaveLength(2);
      expect(dbRelationships[0].relationship_type).toBe('AUTHORITATIVE_FOR');
      expect(dbRelationships[1].relationship_type).toBe('CONTAINS');
    });

    it('should handle duplicate relationships with IGNORE', async () => {
      const relationship: RuleRelationship = {
        from: 'test-rule',
        to: 'test-directive',
        type: 'CONTAINS',
        weight: 1.0
      };

      // Insert the same relationship twice
      await knowledgeGraph.createRuleRelationships([relationship]);
      await knowledgeGraph.createRuleRelationships([relationship]);

      // Should only have one relationship in database
      const dbRelationships = await db.all('SELECT * FROM rule_relationships');
      expect(dbRelationships).toHaveLength(1);
    });

    it('should use default weight when not specified', async () => {
      const relationship: RuleRelationship = {
        from: 'test-rule',
        to: 'test-directive',
        type: 'CONTAINS'
      };

      await knowledgeGraph.createRuleRelationships([relationship]);

      const dbRelationship = await db.get('SELECT * FROM rule_relationships');
      expect(dbRelationship.weight).toBe(1.0);
    });
  });

  describe('queryDirectives', () => {
    beforeEach(async () => {
      // Set up test data
      const rules: Rule[] = [
        {
          id: 'security-rule',
          name: 'Security Rules',
          layer: '2-Application' as ArchitecturalLayer,
          authoritativeFor: ['security'],
          topics: ['authentication', 'authorization'],
          sourcePath: '/test/security.md',
          lastUpdated: new Date()
        },
        {
          id: 'ui-rule',
          name: 'UI Rules',
          layer: '1-Presentation' as ArchitecturalLayer,
          authoritativeFor: ['UI'],
          topics: ['components', 'styling'],
          sourcePath: '/test/ui.md',
          lastUpdated: new Date()
        }
      ];

      const directives: Directive[] = [
        {
          id: 'auth-directive',
          ruleId: 'security-rule',
          section: 'Authentication',
          severity: 'MUST' as DirectiveSeverity,
          text: 'Require authentication for all endpoints',
          topics: ['authentication', 'security'],
          whenToApply: ['API endpoints']
        },
        {
          id: 'validation-directive',
          ruleId: 'security-rule',
          section: 'Validation',
          severity: 'SHOULD' as DirectiveSeverity,
          text: 'Validate all input parameters',
          topics: ['validation', 'security'],
          whenToApply: ['user input']
        },
        {
          id: 'ui-directive',
          ruleId: 'ui-rule',
          section: 'Components',
          severity: 'MUST' as DirectiveSeverity,
          text: 'Use TypeScript for components',
          topics: ['TypeScript', 'components'],
          whenToApply: ['React components']
        }
      ];

      await knowledgeGraph.upsertRules(rules);
      await knowledgeGraph.upsertDirectives(directives);
    });

    it('should query all directives without filters', async () => {
      const result = await knowledgeGraph.queryDirectives({});

      expect(result).toHaveLength(3);
      expect(result.map(d => d.id)).toContain('auth-directive');
      expect(result.map(d => d.id)).toContain('validation-directive');
      expect(result.map(d => d.id)).toContain('ui-directive');
    });

    it('should filter by rule IDs', async () => {
      const result = await knowledgeGraph.queryDirectives({
        ruleIds: ['security-rule']
      });

      expect(result).toHaveLength(2);
      expect(result.every(d => d.ruleId === 'security-rule')).toBe(true);
    });

    it('should filter by layers', async () => {
      const result = await knowledgeGraph.queryDirectives({
        layers: ['1-Presentation']
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('ui-directive');
    });

    it('should filter by severities', async () => {
      const result = await knowledgeGraph.queryDirectives({
        severities: ['MUST']
      });

      expect(result).toHaveLength(2);
      expect(result.every(d => d.severity === 'MUST')).toBe(true);
    });

    it('should filter by text search', async () => {
      const result = await knowledgeGraph.queryDirectives({
        textSearch: 'authentication'
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('auth-directive');
    });

    it('should filter by topics', async () => {
      const result = await knowledgeGraph.queryDirectives({
        topics: ['security']
      });

      expect(result).toHaveLength(2);
      expect(result.every(d => d.topics.includes('security'))).toBe(true);
    });

    it('should apply limit and offset', async () => {
      const result = await knowledgeGraph.queryDirectives({
        limit: 2,
        offset: 1
      });

      expect(result).toHaveLength(2);
    });

    it('should combine multiple filters', async () => {
      const result = await knowledgeGraph.queryDirectives({
        layers: ['2-Application'],
        severities: ['MUST'],
        topics: ['authentication']
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('auth-directive');
    });

    it('should return directives with rule information', async () => {
      const result = await knowledgeGraph.queryDirectives({
        ruleIds: ['security-rule']
      });

      expect(result).toHaveLength(2);
      // The mapRowToDirective method should include rule information
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('ruleId');
      expect(result[0]).toHaveProperty('text');
    });
  });

  describe('getRules', () => {
    beforeEach(async () => {
      const rules: Rule[] = [
        {
          id: 'security-rule',
          name: 'Security Rules',
          layer: '2-Application' as ArchitecturalLayer,
          authoritativeFor: ['security', 'authentication'],
          topics: ['API', 'validation'],
          sourcePath: '/test/security.md',
          lastUpdated: new Date('2024-01-01')
        },
        {
          id: 'ui-rule',
          name: 'UI Rules',
          layer: '1-Presentation' as ArchitecturalLayer,
          authoritativeFor: ['UI', 'components'],
          topics: ['React', 'TypeScript'],
          sourcePath: '/test/ui.md',
          lastUpdated: new Date('2024-01-02')
        },
        {
          id: 'domain-rule',
          name: 'Domain Rules',
          layer: '3-Domain' as ArchitecturalLayer,
          authoritativeFor: ['business-logic'],
          topics: ['entities', 'services'],
          sourcePath: '/test/domain.md',
          lastUpdated: new Date('2024-01-03')
        }
      ];

      await knowledgeGraph.upsertRules(rules);
    });

    it('should get all rules without filters', async () => {
      const result = await knowledgeGraph.getRules({});

      expect(result).toHaveLength(3);
      expect(result.map(r => r.id)).toContain('security-rule');
      expect(result.map(r => r.id)).toContain('ui-rule');
      expect(result.map(r => r.id)).toContain('domain-rule');
    });

    it('should filter by layers', async () => {
      const result = await knowledgeGraph.getRules({
        layers: ['1-Presentation', '2-Application']
      });

      expect(result).toHaveLength(2);
      expect(result.map(r => r.id)).toContain('security-rule');
      expect(result.map(r => r.id)).toContain('ui-rule');
    });

    it('should filter by source paths', async () => {
      const result = await knowledgeGraph.getRules({
        sourcePaths: ['/test/security.md']
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('security-rule');
    });

    it('should filter by updated after date', async () => {
      const result = await knowledgeGraph.getRules({
        updatedAfter: new Date('2024-01-02')
      });

      expect(result).toHaveLength(2);
      expect(result.map(r => r.id)).toContain('ui-rule');
      expect(result.map(r => r.id)).toContain('domain-rule');
    });

    it('should filter by topics', async () => {
      const result = await knowledgeGraph.getRules({
        topics: ['API']
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('security-rule');
    });

    it('should filter by authoritative domains', async () => {
      const result = await knowledgeGraph.getRules({
        authoritativeFor: ['security']
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('security-rule');
    });

    it('should apply limit and offset', async () => {
      const result = await knowledgeGraph.getRules({
        limit: 2,
        offset: 1
      });

      expect(result).toHaveLength(2);
    });

    it('should parse JSON fields correctly', async () => {
      const result = await knowledgeGraph.getRules({
        sourcePaths: ['/test/security.md']
      });

      expect(result).toHaveLength(1);
      expect(result[0].authoritativeFor).toEqual(['security', 'authentication']);
      expect(result[0].topics).toEqual(['API', 'validation']);
    });
  });

  describe('deleteRules', () => {
    beforeEach(async () => {
      // Set up test data
      const rules: Rule[] = [
        {
          id: 'rule-to-delete',
          name: 'Rule to Delete',
          layer: '2-Application' as ArchitecturalLayer,
          authoritativeFor: ['testing'],
          topics: ['deletion'],
          sourcePath: '/test/delete.md',
          lastUpdated: new Date()
        },
        {
          id: 'rule-to-keep',
          name: 'Rule to Keep',
          layer: '1-Presentation' as ArchitecturalLayer,
          authoritativeFor: ['UI'],
          topics: ['keep'],
          sourcePath: '/test/keep.md',
          lastUpdated: new Date()
        }
      ];

      const directives: Directive[] = [
        {
          id: 'directive-to-delete',
          ruleId: 'rule-to-delete',
          section: 'Test',
          severity: 'MUST' as DirectiveSeverity,
          text: 'This directive should be deleted',
          topics: ['deletion'],
          whenToApply: ['test']
        },
        {
          id: 'directive-to-keep',
          ruleId: 'rule-to-keep',
          section: 'Test',
          severity: 'MUST' as DirectiveSeverity,
          text: 'This directive should be kept',
          topics: ['keep'],
          whenToApply: ['test']
        }
      ];

      const relationships: RuleRelationship[] = [
        {
          from: 'rule-to-delete',
          to: 'directive-to-delete',
          type: 'CONTAINS'
        },
        {
          from: 'rule-to-keep',
          to: 'directive-to-keep',
          type: 'CONTAINS'
        }
      ];

      await knowledgeGraph.upsertRules(rules);
      await knowledgeGraph.upsertDirectives(directives);
      await knowledgeGraph.createRuleRelationships(relationships);
    });

    it('should delete rules and cascade to related entities', async () => {
      await knowledgeGraph.deleteRules(['rule-to-delete']);

      // Verify rule was deleted
      const remainingRules = await db.all('SELECT * FROM rules');
      expect(remainingRules).toHaveLength(1);
      expect(remainingRules[0].id).toBe('rule-to-keep');

      // Verify directive was cascaded deleted
      const remainingDirectives = await db.all('SELECT * FROM directives');
      expect(remainingDirectives).toHaveLength(1);
      expect(remainingDirectives[0].id).toBe('directive-to-keep');

      // Verify relationships were deleted
      const remainingRelationships = await db.all('SELECT * FROM rule_relationships');
      expect(remainingRelationships).toHaveLength(1);
      expect(remainingRelationships[0].from_id).toBe('rule-to-keep');
    });

    it('should handle empty rule IDs array', async () => {
      await knowledgeGraph.deleteRules([]);

      // Verify nothing was deleted
      const rules = await db.all('SELECT * FROM rules');
      const directives = await db.all('SELECT * FROM directives');
      expect(rules).toHaveLength(2);
      expect(directives).toHaveLength(2);
    });

    it('should handle non-existent rule IDs gracefully', async () => {
      await knowledgeGraph.deleteRules(['non-existent-rule']);

      // Verify existing data is unchanged
      const rules = await db.all('SELECT * FROM rules');
      const directives = await db.all('SELECT * FROM directives');
      expect(rules).toHaveLength(2);
      expect(directives).toHaveLength(2);
    });
  });

  describe('getRuleStats', () => {
    beforeEach(async () => {
      // Set up comprehensive test data
      const rules: Rule[] = [
        {
          id: 'security-rule',
          name: 'Security Rules',
          layer: '2-Application' as ArchitecturalLayer,
          authoritativeFor: ['security'],
          topics: ['authentication', 'authorization'],
          sourcePath: '/test/security.md',
          lastUpdated: new Date()
        },
        {
          id: 'ui-rule',
          name: 'UI Rules',
          layer: '1-Presentation' as ArchitecturalLayer,
          authoritativeFor: ['UI'],
          topics: ['components', 'styling'],
          sourcePath: '/test/ui.md',
          lastUpdated: new Date()
        }
      ];

      const directives: Directive[] = [
        {
          id: 'must-directive-1',
          ruleId: 'security-rule',
          section: 'Auth',
          severity: 'MUST' as DirectiveSeverity,
          text: 'Must authenticate',
          topics: ['authentication'],
          whenToApply: ['API']
        },
        {
          id: 'must-directive-2',
          ruleId: 'ui-rule',
          section: 'Components',
          severity: 'MUST' as DirectiveSeverity,
          text: 'Must use TypeScript',
          topics: ['TypeScript'],
          whenToApply: ['components']
        },
        {
          id: 'should-directive',
          ruleId: 'security-rule',
          section: 'Validation',
          severity: 'SHOULD' as DirectiveSeverity,
          text: 'Should validate input',
          topics: ['validation'],
          whenToApply: ['input']
        },
        {
          id: 'may-directive',
          ruleId: 'ui-rule',
          section: 'Styling',
          severity: 'MAY' as DirectiveSeverity,
          text: 'May use CSS modules',
          topics: ['styling'],
          whenToApply: ['CSS']
        }
      ];

      const relationships: RuleRelationship[] = [
        { from: 'security-rule', to: 'must-directive-1', type: 'CONTAINS' },
        { from: 'security-rule', to: 'should-directive', type: 'CONTAINS' },
        { from: 'ui-rule', to: 'must-directive-2', type: 'CONTAINS' },
        { from: 'ui-rule', to: 'may-directive', type: 'CONTAINS' }
      ];

      await knowledgeGraph.upsertRules(rules);
      await knowledgeGraph.upsertDirectives(directives);
      await knowledgeGraph.createRuleRelationships(relationships);
    });

    it('should return comprehensive rule statistics', async () => {
      const stats = await knowledgeGraph.getRuleStats();

      expect(stats.totalRules).toBe(2);
      expect(stats.totalDirectives).toBe(4);
      expect(stats.totalRelationships).toBe(4);

      expect(stats.rulesByLayer['1-Presentation']).toBe(1);
      expect(stats.rulesByLayer['2-Application']).toBe(1);

      expect(stats.directivesBySeverity['MUST']).toBe(2);
      expect(stats.directivesBySeverity['SHOULD']).toBe(1);
      expect(stats.directivesBySeverity['MAY']).toBe(1);

      expect(stats.topicDistribution).toBeDefined();
      expect(stats.topicDistribution['authentication']).toBeGreaterThan(0);
      expect(stats.topicDistribution['components']).toBeGreaterThan(0);

      expect(stats.lastUpdated).toBeInstanceOf(Date);
      expect(stats.storageSize).toBeGreaterThan(0);
    });

    it('should handle empty database', async () => {
      // Clear all data
      await db.run('DELETE FROM rule_relationships');
      await db.run('DELETE FROM directives');
      await db.run('DELETE FROM rules');

      const stats = await knowledgeGraph.getRuleStats();

      expect(stats.totalRules).toBe(0);
      expect(stats.totalDirectives).toBe(0);
      expect(stats.totalRelationships).toBe(0);
      expect(Object.keys(stats.rulesByLayer)).toHaveLength(0);
      expect(Object.keys(stats.directivesBySeverity)).toHaveLength(0);
      expect(Object.keys(stats.topicDistribution)).toHaveLength(0);
    });
  });

  describe('batchUpsert', () => {
    it('should perform batch upsert operation successfully', async () => {
      const rules: Rule[] = [
        {
          id: 'batch-rule-1',
          name: 'Batch Rule 1',
          layer: '1-Presentation' as ArchitecturalLayer,
          authoritativeFor: ['UI'],
          topics: ['batch'],
          sourcePath: '/test/batch1.md',
          lastUpdated: new Date()
        }
      ];

      const directives: Directive[] = [
        {
          id: 'batch-directive-1',
          ruleId: 'batch-rule-1',
          section: 'Batch',
          severity: 'MUST' as DirectiveSeverity,
          text: 'Batch directive',
          topics: ['batch'],
          whenToApply: ['batch operations']
        }
      ];

      const relationships: RuleRelationship[] = [
        {
          from: 'batch-rule-1',
          to: 'batch-directive-1',
          type: 'CONTAINS'
        }
      ];

      const batchData = {
        rules,
        directives,
        relationships,
        deleteExisting: false
      };

      const stats = await knowledgeGraph.batchUpsert(batchData);

      expect(stats.rulesProcessed).toBe(1);
      expect(stats.directivesExtracted).toBe(1);
      expect(stats.entitiesCreated).toBe(2); // 1 rule + 1 directive
      expect(stats.relationsCreated).toBe(1);
      expect(stats.warnings).toEqual([]);

      // Verify data was inserted
      const dbRules = await db.all('SELECT * FROM rules WHERE id LIKE "batch-%"');
      const dbDirectives = await db.all('SELECT * FROM directives WHERE id LIKE "batch-%"');
      expect(dbRules).toHaveLength(1);
      expect(dbDirectives).toHaveLength(1);
    });

    it('should delete existing data when requested', async () => {
      // Insert initial data
      const initialRule: Rule = {
        id: 'initial-rule',
        name: 'Initial Rule',
        layer: '1-Presentation' as ArchitecturalLayer,
        authoritativeFor: ['initial'],
        topics: ['initial'],
        sourcePath: '/test/initial.md',
        lastUpdated: new Date()
      };

      await knowledgeGraph.upsertRules([initialRule]);

      // Batch upsert with deleteExisting
      const newRule: Rule = {
        id: 'initial-rule', // Same ID
        name: 'Updated Rule',
        layer: '2-Application' as ArchitecturalLayer,
        authoritativeFor: ['updated'],
        topics: ['updated'],
        sourcePath: '/test/updated.md',
        lastUpdated: new Date()
      };

      const batchData = {
        rules: [newRule],
        directives: [],
        relationships: [],
        deleteExisting: true
      };

      const stats = await knowledgeGraph.batchUpsert(batchData);

      expect(stats.rulesProcessed).toBe(1);

      // Verify rule was updated
      const dbRule = await db.get('SELECT * FROM rules WHERE id = ?', ['initial-rule']);
      expect(dbRule.name).toBe('Updated Rule');
      expect(dbRule.layer).toBe('2-Application');
    });
  });

  describe('incrementalUpdate', () => {
    beforeEach(async () => {
      // Set up existing data for the source path
      const existingRules: Rule[] = [
        {
          id: 'existing-rule-1',
          name: 'Existing Rule 1',
          layer: '1-Presentation' as ArchitecturalLayer,
          authoritativeFor: ['UI'],
          topics: ['existing'],
          sourcePath: '/test/incremental.md',
          lastUpdated: new Date()
        },
        {
          id: 'existing-rule-2',
          name: 'Existing Rule 2',
          layer: '2-Application' as ArchitecturalLayer,
          authoritativeFor: ['API'],
          topics: ['existing'],
          sourcePath: '/test/incremental.md',
          lastUpdated: new Date()
        }
      ];

      await knowledgeGraph.upsertRules(existingRules);
    });

    it('should update existing rules and add new ones', async () => {
      const updatedRules: Rule[] = [
        {
          id: 'existing-rule-1',
          name: 'Updated Rule 1',
          layer: '1-Presentation' as ArchitecturalLayer,
          authoritativeFor: ['UI', 'components'],
          topics: ['updated'],
          sourcePath: '/test/incremental.md',
          lastUpdated: new Date()
        },
        {
          id: 'new-rule',
          name: 'New Rule',
          layer: '3-Domain' as ArchitecturalLayer,
          authoritativeFor: ['business'],
          topics: ['new'],
          sourcePath: '/test/incremental.md',
          lastUpdated: new Date()
        }
      ];

      const directives: Directive[] = [
        {
          id: 'new-directive',
          ruleId: 'new-rule',
          section: 'New',
          severity: 'MUST' as DirectiveSeverity,
          text: 'New directive',
          topics: ['new'],
          whenToApply: ['new scenarios']
        }
      ];

      const stats = await knowledgeGraph.incrementalUpdate('/test/incremental.md', updatedRules, directives);

      expect(stats.rulesProcessed).toBe(2);
      expect(stats.directivesExtracted).toBe(1);
      expect(stats.warnings).toContain('Deleted 1 rules no longer in source');

      // Verify existing-rule-2 was deleted (not in updated rules)
      const remainingRules = await knowledgeGraph.getRules({ sourcePaths: ['/test/incremental.md'] });
      expect(remainingRules).toHaveLength(2);
      expect(remainingRules.map(r => r.id)).toContain('existing-rule-1');
      expect(remainingRules.map(r => r.id)).toContain('new-rule');
      expect(remainingRules.map(r => r.id)).not.toContain('existing-rule-2');

      // Verify existing-rule-1 was updated
      const updatedRule = remainingRules.find(r => r.id === 'existing-rule-1');
      expect(updatedRule?.name).toBe('Updated Rule 1');
      expect(updatedRule?.authoritativeFor).toEqual(['UI', 'components']);
    });

    it('should handle empty updates gracefully', async () => {
      const stats = await knowledgeGraph.incrementalUpdate('/test/incremental.md', [], []);

      expect(stats.rulesProcessed).toBe(0);
      expect(stats.directivesExtracted).toBe(0);
      expect(stats.warnings).toContain('Deleted 2 rules no longer in source');

      // Verify all existing rules were deleted
      const remainingRules = await knowledgeGraph.getRules({ sourcePaths: ['/test/incremental.md'] });
      expect(remainingRules).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      // Close the database to simulate connection error
      await db.close();

      await expect(
        knowledgeGraph.upsertRules([{
          id: 'test',
          name: 'Test',
          layer: '1-Presentation' as ArchitecturalLayer,
          authoritativeFor: [],
          topics: [],
          sourcePath: '/test',
          lastUpdated: new Date()
        }])
      ).rejects.toThrow();
    });

    it('should handle foreign key constraint violations', async () => {
      // Try to insert directive with non-existent rule
      await expect(
        knowledgeGraph.upsertDirectives([{
          id: 'orphan-directive',
          ruleId: 'non-existent-rule',
          section: 'Test',
          severity: 'MUST' as DirectiveSeverity,
          text: 'Orphan directive',
          topics: [],
          whenToApply: []
        }])
      ).rejects.toThrow();
    });
  });
});