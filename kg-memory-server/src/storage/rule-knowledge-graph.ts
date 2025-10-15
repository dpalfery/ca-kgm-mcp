import { DatabaseConnection } from '../database/connection.js';
import { 
  Rule, 
  Directive, 
  RuleRelationship, 
  IngestionStats,
  ArchitecturalLayer,
  DirectiveSeverity 
} from '../types.js';
import { 
  RuleKnowledgeGraph,
  DirectiveQueryCriteria,
  RuleFilters,
  RuleGraphStats,
  BatchUpsertData
} from '../interfaces/knowledge-graph.js';
import { randomUUID } from 'crypto';

/**
 * Implementation of rule-specific knowledge graph operations
 * Extends the base Memory MCP Server functionality with rule management
 */
export class RuleKnowledgeGraphImpl implements RuleKnowledgeGraph {
  private db: DatabaseConnection;

  constructor(db: DatabaseConnection) {
    this.db = db;
  }

  /**
   * Create or update rules in the knowledge graph
   */
  async upsertRules(rules: Rule[]): Promise<Rule[]> {
    const upsertedRules: Rule[] = [];

    for (const rule of rules) {
      // Check if rule exists
      const existing = await this.db.get<Rule>(
        'SELECT * FROM rules WHERE id = ?',
        [rule.id]
      );

      const now = new Date().toISOString();
      
      if (existing) {
        // Update existing rule
        await this.db.run(`
          UPDATE rules 
          SET name = ?, layer = ?, authoritative_for = ?, topics = ?, 
              source_path = ?, updated_at = ?
          WHERE id = ?
        `, [
          rule.name,
          rule.layer,
          JSON.stringify(rule.authoritativeFor),
          JSON.stringify(rule.topics),
          rule.sourcePath,
          now,
          rule.id
        ]);
      } else {
        // Insert new rule
        await this.db.run(`
          INSERT INTO rules (id, name, layer, authoritative_for, topics, source_path, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          rule.id,
          rule.name,
          rule.layer,
          JSON.stringify(rule.authoritativeFor),
          JSON.stringify(rule.topics),
          rule.sourcePath,
          now,
          now
        ]);
      }

      upsertedRules.push({
        ...rule,
        lastUpdated: new Date(now)
      });
    }

    return upsertedRules;
  }

  /**
   * Create or update directives associated with rules
   */
  async upsertDirectives(directives: Directive[]): Promise<Directive[]> {
    const upsertedDirectives: Directive[] = [];

    for (const directive of directives) {
      // Check if directive exists
      const existing = await this.db.get<Directive>(
        'SELECT * FROM directives WHERE id = ?',
        [directive.id]
      );

      const now = new Date().toISOString();
      
      if (existing) {
        // Update existing directive
        await this.db.run(`
          UPDATE directives 
          SET rule_id = ?, section = ?, severity = ?, text = ?, rationale = ?,
              example = ?, anti_pattern = ?, topics = ?, when_to_apply = ?, embedding = ?
          WHERE id = ?
        `, [
          directive.ruleId,
          directive.section,
          directive.severity,
          directive.text,
          directive.rationale || null,
          directive.example || null,
          directive.antiPattern || null,
          JSON.stringify(directive.topics),
          JSON.stringify(directive.whenToApply),
          directive.embedding ? Buffer.from(new Float32Array(directive.embedding).buffer) : null,
          directive.id
        ]);
      } else {
        // Insert new directive
        await this.db.run(`
          INSERT INTO directives (
            id, rule_id, section, severity, text, rationale, example, 
            anti_pattern, topics, when_to_apply, embedding, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          directive.id,
          directive.ruleId,
          directive.section,
          directive.severity,
          directive.text,
          directive.rationale || null,
          directive.example || null,
          directive.antiPattern || null,
          JSON.stringify(directive.topics),
          JSON.stringify(directive.whenToApply),
          directive.embedding ? Buffer.from(new Float32Array(directive.embedding).buffer) : null,
          now
        ]);
      }

      upsertedDirectives.push(directive);
    }

    return upsertedDirectives;
  }

  /**
   * Create relationships between rules and other entities
   */
  async createRuleRelationships(relationships: RuleRelationship[]): Promise<RuleRelationship[]> {
    const createdRelationships: RuleRelationship[] = [];

    for (const relationship of relationships) {
      const id = randomUUID();
      
      await this.db.run(`
        INSERT OR IGNORE INTO rule_relationships (id, from_id, to_id, relationship_type, weight, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        id,
        relationship.from,
        relationship.to,
        relationship.type,
        relationship.weight || 1.0,
        new Date().toISOString()
      ]);

      createdRelationships.push(relationship);
    }

    return createdRelationships;
  }

  /**
   * Query directives based on criteria
   */
  async queryDirectives(criteria: DirectiveQueryCriteria): Promise<Directive[]> {
    let sql = `
      SELECT d.*, r.name as rule_name, r.layer as rule_layer, r.source_path
      FROM directives d
      JOIN rules r ON d.rule_id = r.id
      WHERE 1=1
    `;
    const params: any[] = [];

    // Apply filters
    if (criteria.ruleIds && criteria.ruleIds.length > 0) {
      sql += ` AND d.rule_id IN (${criteria.ruleIds.map(() => '?').join(',')})`;
      params.push(...criteria.ruleIds);
    }

    if (criteria.layers && criteria.layers.length > 0) {
      sql += ` AND r.layer IN (${criteria.layers.map(() => '?').join(',')})`;
      params.push(...criteria.layers);
    }

    if (criteria.severities && criteria.severities.length > 0) {
      sql += ` AND d.severity IN (${criteria.severities.map(() => '?').join(',')})`;
      params.push(...criteria.severities);
    }

    if (criteria.textSearch) {
      sql += ` AND (d.text LIKE ? OR d.rationale LIKE ? OR d.example LIKE ?)`;
      const searchTerm = `%${criteria.textSearch}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // Topic filtering (JSON array contains)
    if (criteria.topics && criteria.topics.length > 0) {
      const topicConditions = criteria.topics.map(() => 
        `(d.topics LIKE ? OR r.topics LIKE ?)`
      ).join(' OR ');
      sql += ` AND (${topicConditions})`;
      
      for (const topic of criteria.topics) {
        const topicPattern = `%"${topic}"%`;
        params.push(topicPattern, topicPattern);
      }
    }

    // Ordering and pagination
    sql += ` ORDER BY d.severity DESC, r.layer, d.section`;
    
    if (criteria.limit) {
      sql += ` LIMIT ?`;
      params.push(criteria.limit);
      
      if (criteria.offset) {
        sql += ` OFFSET ?`;
        params.push(criteria.offset);
      }
    }

    const rows = await this.db.all<any>(sql, params);
    
    return rows.map(row => this.mapRowToDirective(row));
  }

  /**
   * Get rules by various filters
   */
  async getRules(filters: RuleFilters): Promise<Rule[]> {
    let sql = 'SELECT * FROM rules WHERE 1=1';
    const params: any[] = [];

    // Apply filters
    if (filters.layers && filters.layers.length > 0) {
      sql += ` AND layer IN (${filters.layers.map(() => '?').join(',')})`;
      params.push(...filters.layers);
    }

    if (filters.sourcePaths && filters.sourcePaths.length > 0) {
      sql += ` AND source_path IN (${filters.sourcePaths.map(() => '?').join(',')})`;
      params.push(...filters.sourcePaths);
    }

    if (filters.updatedAfter) {
      sql += ` AND updated_at > ?`;
      params.push(filters.updatedAfter.toISOString());
    }

    // Topic filtering (JSON array contains)
    if (filters.topics && filters.topics.length > 0) {
      const topicConditions = filters.topics.map(() => 'topics LIKE ?').join(' OR ');
      sql += ` AND (${topicConditions})`;
      
      for (const topic of filters.topics) {
        params.push(`%"${topic}"%`);
      }
    }

    // AuthoritativeFor filtering
    if (filters.authoritativeFor && filters.authoritativeFor.length > 0) {
      const authConditions = filters.authoritativeFor.map(() => 'authoritative_for LIKE ?').join(' OR ');
      sql += ` AND (${authConditions})`;
      
      for (const domain of filters.authoritativeFor) {
        params.push(`%"${domain}"%`);
      }
    }

    // Ordering and pagination
    sql += ` ORDER BY layer, name`;
    
    if (filters.limit) {
      sql += ` LIMIT ?`;
      params.push(filters.limit);
      
      if (filters.offset) {
        sql += ` OFFSET ?`;
        params.push(filters.offset);
      }
    }

    const rows = await this.db.all<any>(sql, params);
    
    return rows.map(row => this.mapRowToRule(row));
  }

  /**
   * Delete rules and cascade to related directives
   */
  async deleteRules(ruleIds: string[]): Promise<void> {
    if (ruleIds.length === 0) return;

    const placeholders = ruleIds.map(() => '?').join(',');
    
    await this.db.transaction([
      // Delete relationships
      {
        sql: `DELETE FROM rule_relationships WHERE from_id IN (${placeholders}) OR to_id IN (${placeholders})`,
        params: [...ruleIds, ...ruleIds]
      },
      // Delete directives (will cascade due to foreign key)
      {
        sql: `DELETE FROM directives WHERE rule_id IN (${placeholders})`,
        params: ruleIds
      },
      // Delete rules
      {
        sql: `DELETE FROM rules WHERE id IN (${placeholders})`,
        params: ruleIds
      }
    ]);
  }

  /**
   * Get rule statistics and health information
   */
  async getRuleStats(): Promise<RuleGraphStats> {
    const [
      totalRules,
      totalDirectives,
      totalRelationships,
      rulesByLayer,
      directivesBySeverity,
      topicStats,
      lastUpdated
    ] = await Promise.all([
      this.db.get<{ count: number }>('SELECT COUNT(*) as count FROM rules'),
      this.db.get<{ count: number }>('SELECT COUNT(*) as count FROM directives'),
      this.db.get<{ count: number }>('SELECT COUNT(*) as count FROM rule_relationships'),
      this.db.all<{ layer: string; count: number }>('SELECT layer, COUNT(*) as count FROM rules GROUP BY layer'),
      this.db.all<{ severity: string; count: number }>('SELECT severity, COUNT(*) as count FROM directives GROUP BY severity'),
      this.getTopicDistribution(),
      this.db.get<{ max_updated: string }>('SELECT MAX(updated_at) as max_updated FROM rules')
    ]);

    const dbStats = await this.db.getStats();

    return {
      totalRules: totalRules?.count || 0,
      totalDirectives: totalDirectives?.count || 0,
      totalRelationships: totalRelationships?.count || 0,
      rulesByLayer: Object.fromEntries(rulesByLayer.map(r => [r.layer, r.count])),
      directivesBySeverity: Object.fromEntries(directivesBySeverity.map(d => [d.severity, d.count])),
      topicDistribution: topicStats,
      lastUpdated: lastUpdated?.max_updated ? new Date(lastUpdated.max_updated) : new Date(),
      storageSize: dbStats.dbSize
    };
  }

  /**
   * Batch upsert operation for rules and directives
   */
  async batchUpsert(batch: BatchUpsertData): Promise<IngestionStats> {
    const stats: IngestionStats = {
      rulesProcessed: 0,
      directivesExtracted: 0,
      entitiesCreated: 0,
      relationsCreated: 0,
      warnings: []
    };

    try {
      // Delete existing if requested
      if (batch.deleteExisting && batch.rules.length > 0) {
        const ruleIds = batch.rules.map(r => r.id);
        await this.deleteRules(ruleIds);
      }

      // Upsert rules
      const upsertedRules = await this.upsertRules(batch.rules);
      stats.rulesProcessed = upsertedRules.length;
      stats.entitiesCreated += upsertedRules.length;

      // Upsert directives
      const upsertedDirectives = await this.upsertDirectives(batch.directives);
      stats.directivesExtracted = upsertedDirectives.length;
      stats.entitiesCreated += upsertedDirectives.length;

      // Create relationships
      const createdRelationships = await this.createRuleRelationships(batch.relationships);
      stats.relationsCreated = createdRelationships.length;

      return stats;

    } catch (error) {
      stats.warnings.push(`Batch upsert failed: ${error}`);
      throw error;
    }
  }

  /**
   * Incremental update based on source file changes
   */
  async incrementalUpdate(sourcePath: string, rules: Rule[], directives: Directive[]): Promise<IngestionStats> {
    const stats: IngestionStats = {
      rulesProcessed: 0,
      directivesExtracted: 0,
      entitiesCreated: 0,
      relationsCreated: 0,
      warnings: []
    };

    try {
      // Find existing rules for this source path
      const existingRules = await this.getRules({ sourcePaths: [sourcePath] });
      const existingRuleIds = existingRules.map(r => r.id);
      const newRuleIds = rules.map(r => r.id);

      // Delete rules that are no longer in the source
      const rulesToDelete = existingRuleIds.filter(id => !newRuleIds.includes(id));
      if (rulesToDelete.length > 0) {
        await this.deleteRules(rulesToDelete);
        stats.warnings.push(`Deleted ${rulesToDelete.length} rules no longer in source`);
      }

      // Upsert new/updated rules and directives
      const batchData: BatchUpsertData = {
        rules,
        directives,
        relationships: [], // Will be generated during upsert
        deleteExisting: false
      };

      const batchStats = await this.batchUpsert(batchData);
      
      return {
        rulesProcessed: batchStats.rulesProcessed,
        directivesExtracted: batchStats.directivesExtracted,
        entitiesCreated: batchStats.entitiesCreated,
        relationsCreated: batchStats.relationsCreated,
        warnings: [...stats.warnings, ...batchStats.warnings]
      };

    } catch (error) {
      stats.warnings.push(`Incremental update failed: ${error}`);
      throw error;
    }
  }

  /**
   * Map database row to Rule object
   */
  private mapRowToRule(row: any): Rule {
    return {
      id: row.id,
      name: row.name,
      layer: row.layer as ArchitecturalLayer,
      authoritativeFor: JSON.parse(row.authoritative_for || '[]'),
      topics: JSON.parse(row.topics || '[]'),
      sourcePath: row.source_path,
      lastUpdated: new Date(row.updated_at)
    };
  }

  /**
   * Map database row to Directive object
   */
  private mapRowToDirective(row: any): Directive {
    let embedding: number[] | undefined;
    if (row.embedding) {
      const buffer = Buffer.from(row.embedding);
      embedding = Array.from(new Float32Array(buffer.buffer));
    }

    return {
      id: row.id,
      ruleId: row.rule_id,
      section: row.section,
      severity: row.severity as DirectiveSeverity,
      text: row.text,
      rationale: row.rationale || undefined,
      example: row.example || undefined,
      antiPattern: row.anti_pattern || undefined,
      topics: JSON.parse(row.topics || '[]'),
      whenToApply: JSON.parse(row.when_to_apply || '[]'),
      embedding
    };
  }

  /**
   * Get topic distribution across all rules and directives
   */
  private async getTopicDistribution(): Promise<Record<string, number>> {
    const [ruleTopics, directiveTopics] = await Promise.all([
      this.db.all<{ topics: string }>('SELECT topics FROM rules WHERE topics IS NOT NULL'),
      this.db.all<{ topics: string }>('SELECT topics FROM directives WHERE topics IS NOT NULL')
    ]);

    const topicCounts: Record<string, number> = {};

    // Count topics from rules
    for (const row of ruleTopics) {
      try {
        const topics = JSON.parse(row.topics);
        for (const topic of topics) {
          topicCounts[topic] = (topicCounts[topic] || 0) + 1;
        }
      } catch {
        // Ignore invalid JSON
      }
    }

    // Count topics from directives
    for (const row of directiveTopics) {
      try {
        const topics = JSON.parse(row.topics);
        for (const topic of topics) {
          topicCounts[topic] = (topicCounts[topic] || 0) + 1;
        }
      } catch {
        // Ignore invalid JSON
      }
    }

    return topicCounts;
  }
}