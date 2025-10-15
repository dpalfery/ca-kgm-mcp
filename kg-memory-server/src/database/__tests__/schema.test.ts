import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseConnection } from '../connection.js';
import { promises as fs } from 'fs';
import path from 'path';

describe('Database Schema', () => {
  let db: DatabaseConnection;
  let tempDbPath: string;

  beforeEach(async () => {
    // Create temporary database for testing
    tempDbPath = path.join(process.cwd(), `test-schema-${Date.now()}.db`);
    db = new DatabaseConnection(tempDbPath);
    await db.initialize();
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

  describe('Base Tables Creation', () => {
    it('should create entities table with correct schema', async () => {
      const tableInfo = await db.all("PRAGMA table_info(entities)");
      
      expect(tableInfo).toBeDefined();
      expect(tableInfo.length).toBeGreaterThan(0);
      
      const columns = tableInfo.map((col: any) => col.name);
      expect(columns).toContain('id');
      expect(columns).toContain('name');
      expect(columns).toContain('entity_type');
      expect(columns).toContain('created_at');
      expect(columns).toContain('updated_at');
    });

    it('should create relations table with correct schema', async () => {
      const tableInfo = await db.all("PRAGMA table_info(relations)");
      
      expect(tableInfo).toBeDefined();
      expect(tableInfo.length).toBeGreaterThan(0);
      
      const columns = tableInfo.map((col: any) => col.name);
      expect(columns).toContain('id');
      expect(columns).toContain('from_entity');
      expect(columns).toContain('to_entity');
      expect(columns).toContain('relation_type');
      expect(columns).toContain('created_at');
    });

    it('should create observations table with correct schema', async () => {
      const tableInfo = await db.all("PRAGMA table_info(observations)");
      
      expect(tableInfo).toBeDefined();
      expect(tableInfo.length).toBeGreaterThan(0);
      
      const columns = tableInfo.map((col: any) => col.name);
      expect(columns).toContain('id');
      expect(columns).toContain('entity_name');
      expect(columns).toContain('content');
      expect(columns).toContain('created_at');
    });
  });

  describe('Rule-Specific Tables Creation', () => {
    it('should create rules table with correct schema and constraints', async () => {
      const tableInfo = await db.all("PRAGMA table_info(rules)");
      
      expect(tableInfo).toBeDefined();
      expect(tableInfo.length).toBeGreaterThan(0);
      
      const columns = tableInfo.map((col: any) => col.name);
      expect(columns).toContain('id');
      expect(columns).toContain('name');
      expect(columns).toContain('layer');
      expect(columns).toContain('authoritative_for');
      expect(columns).toContain('topics');
      expect(columns).toContain('source_path');
      expect(columns).toContain('created_at');
      expect(columns).toContain('updated_at');

      // Test layer constraint
      await expect(
        db.run('INSERT INTO rules (id, name, layer) VALUES (?, ?, ?)', 
               ['test-id', 'Test Rule', 'invalid-layer'])
      ).rejects.toThrow();
    });

    it('should create directives table with correct schema and constraints', async () => {
      const tableInfo = await db.all("PRAGMA table_info(directives)");
      
      expect(tableInfo).toBeDefined();
      expect(tableInfo.length).toBeGreaterThan(0);
      
      const columns = tableInfo.map((col: any) => col.name);
      expect(columns).toContain('id');
      expect(columns).toContain('rule_id');
      expect(columns).toContain('section');
      expect(columns).toContain('severity');
      expect(columns).toContain('text');
      expect(columns).toContain('rationale');
      expect(columns).toContain('example');
      expect(columns).toContain('anti_pattern');
      expect(columns).toContain('topics');
      expect(columns).toContain('when_to_apply');
      expect(columns).toContain('embedding');
      expect(columns).toContain('created_at');

      // Test severity constraint
      await expect(
        db.run('INSERT INTO directives (id, rule_id, section, severity, text) VALUES (?, ?, ?, ?, ?)', 
               ['test-id', 'rule-id', 'Test Section', 'INVALID', 'Test text'])
      ).rejects.toThrow();
    });

    it('should create rule_relationships table with correct schema', async () => {
      const tableInfo = await db.all("PRAGMA table_info(rule_relationships)");
      
      expect(tableInfo).toBeDefined();
      expect(tableInfo.length).toBeGreaterThan(0);
      
      const columns = tableInfo.map((col: any) => col.name);
      expect(columns).toContain('id');
      expect(columns).toContain('from_id');
      expect(columns).toContain('to_id');
      expect(columns).toContain('relationship_type');
      expect(columns).toContain('weight');
      expect(columns).toContain('created_at');

      // Test relationship_type constraint
      await expect(
        db.run('INSERT INTO rule_relationships (id, from_id, to_id, relationship_type) VALUES (?, ?, ?, ?)', 
               ['test-id', 'from-id', 'to-id', 'INVALID_TYPE'])
      ).rejects.toThrow();
    });
  });

  describe('Indexes Creation', () => {
    it('should create all required indexes', async () => {
      const indexes = await db.all("SELECT name FROM sqlite_master WHERE type='index' AND sql IS NOT NULL");
      const indexNames = indexes.map((idx: any) => idx.name);
      
      // Check for key indexes
      expect(indexNames).toContain('idx_entities_name');
      expect(indexNames).toContain('idx_entities_type');
      expect(indexNames).toContain('idx_relations_from');
      expect(indexNames).toContain('idx_relations_to');
      expect(indexNames).toContain('idx_rules_layer');
      expect(indexNames).toContain('idx_directives_rule_id');
      expect(indexNames).toContain('idx_directives_severity');
      expect(indexNames).toContain('idx_rule_relationships_from');
      expect(indexNames).toContain('idx_rule_relationships_to');
    });
  });

  describe('FTS (Full-Text Search) Setup', () => {
    it('should create directives_fts virtual table', async () => {
      const ftsTable = await db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='directives_fts'"
      );
      
      expect(ftsTable).toBeDefined();
      expect(ftsTable?.name).toBe('directives_fts');
    });

    it('should create FTS triggers', async () => {
      const triggers = await db.all(
        "SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE 'directives_fts_%'"
      );
      
      const triggerNames = triggers.map((t: any) => t.name);
      expect(triggerNames).toContain('directives_fts_insert');
      expect(triggerNames).toContain('directives_fts_delete');
      expect(triggerNames).toContain('directives_fts_update');
    });
  });

  describe('Triggers for Timestamps', () => {
    it('should create timestamp update triggers', async () => {
      const triggers = await db.all(
        "SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE '%_updated_at'"
      );
      
      const triggerNames = triggers.map((t: any) => t.name);
      expect(triggerNames).toContain('rules_updated_at');
      expect(triggerNames).toContain('entities_updated_at');
    });

    it('should automatically update timestamps on rule updates', async () => {
      // Insert a rule
      const ruleId = 'test-rule-id';
      await db.run(`
        INSERT INTO rules (id, name, layer, authoritative_for, topics, source_path)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [ruleId, 'Test Rule', '1-Presentation', '[]', '[]', '/test/path']);

      // Get initial timestamp
      const initial = await db.get('SELECT updated_at FROM rules WHERE id = ?', [ruleId]);
      
      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Update the rule
      await db.run('UPDATE rules SET name = ? WHERE id = ?', ['Updated Rule', ruleId]);
      
      // Get updated timestamp
      const updated = await db.get('SELECT updated_at FROM rules WHERE id = ?', [ruleId]);
      
      expect(updated?.updated_at).not.toBe(initial?.updated_at);
    });
  });

  describe('Foreign Key Constraints', () => {
    it('should enforce foreign key constraint between directives and rules', async () => {
      // Try to insert directive with non-existent rule_id
      await expect(
        db.run(`
          INSERT INTO directives (id, rule_id, section, severity, text)
          VALUES (?, ?, ?, ?, ?)
        `, ['directive-id', 'non-existent-rule', 'Test Section', 'MUST', 'Test text'])
      ).rejects.toThrow();
    });

    it('should cascade delete directives when rule is deleted', async () => {
      // Insert a rule
      const ruleId = 'test-rule-cascade';
      await db.run(`
        INSERT INTO rules (id, name, layer, authoritative_for, topics, source_path)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [ruleId, 'Test Rule', '1-Presentation', '[]', '[]', '/test/path']);

      // Insert a directive
      const directiveId = 'test-directive-cascade';
      await db.run(`
        INSERT INTO directives (id, rule_id, section, severity, text)
        VALUES (?, ?, ?, ?, ?)
      `, [directiveId, ruleId, 'Test Section', 'MUST', 'Test text']);

      // Verify directive exists
      const directiveBefore = await db.get('SELECT * FROM directives WHERE id = ?', [directiveId]);
      expect(directiveBefore).toBeDefined();

      // Delete the rule
      await db.run('DELETE FROM rules WHERE id = ?', [ruleId]);

      // Verify directive was cascaded deleted
      const directiveAfter = await db.get('SELECT * FROM directives WHERE id = ?', [directiveId]);
      expect(directiveAfter).toBeUndefined();
    });
  });

  describe('Data Validation', () => {
    it('should accept valid layer values', async () => {
      const validLayers = ['1-Presentation', '2-Application', '3-Domain', '4-Persistence', '5-Infrastructure', '*'];
      
      for (const layer of validLayers) {
        const ruleId = `test-rule-${layer}`;
        await expect(
          db.run(`
            INSERT INTO rules (id, name, layer, authoritative_for, topics, source_path)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [ruleId, 'Test Rule', layer, '[]', '[]', '/test/path'])
        ).resolves.not.toThrow();
      }
    });

    it('should accept valid severity values', async () => {
      // First insert a rule
      const ruleId = 'test-rule-severity';
      await db.run(`
        INSERT INTO rules (id, name, layer, authoritative_for, topics, source_path)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [ruleId, 'Test Rule', '1-Presentation', '[]', '[]', '/test/path']);

      const validSeverities = ['MUST', 'SHOULD', 'MAY'];
      
      for (const severity of validSeverities) {
        const directiveId = `test-directive-${severity}`;
        await expect(
          db.run(`
            INSERT INTO directives (id, rule_id, section, severity, text)
            VALUES (?, ?, ?, ?, ?)
          `, [directiveId, ruleId, 'Test Section', severity, 'Test text'])
        ).resolves.not.toThrow();
      }
    });

    it('should accept valid relationship types', async () => {
      const validTypes = ['CONTAINS', 'AUTHORITATIVE_FOR', 'APPLIES_TO', 'RELATED_TO'];
      
      for (const type of validTypes) {
        const relationshipId = `test-relationship-${type}`;
        await expect(
          db.run(`
            INSERT INTO rule_relationships (id, from_id, to_id, relationship_type)
            VALUES (?, ?, ?, ?)
          `, [relationshipId, 'from-id', 'to-id', type])
        ).resolves.not.toThrow();
      }
    });
  });
});