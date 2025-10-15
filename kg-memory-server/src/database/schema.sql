-- Knowledge Graph Memory System Database Schema
-- Extends the base Memory MCP Server with rule-specific tables

-- Base entities table (compatible with existing Memory MCP Server)
CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  entity_type TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Base relations table (compatible with existing Memory MCP Server)
CREATE TABLE IF NOT EXISTS relations (
  id TEXT PRIMARY KEY,
  from_entity TEXT NOT NULL,
  to_entity TEXT NOT NULL,
  relation_type TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (from_entity) REFERENCES entities(name),
  FOREIGN KEY (to_entity) REFERENCES entities(name)
);

-- Base observations table (compatible with existing Memory MCP Server)
CREATE TABLE IF NOT EXISTS observations (
  id TEXT PRIMARY KEY,
  entity_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (entity_name) REFERENCES entities(name)
);

-- Extended tables for rule-specific entities

-- Rules table - stores project rules and guidelines
CREATE TABLE IF NOT EXISTS rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  layer TEXT NOT NULL CHECK(layer IN ('1-Presentation', '2-Application', '3-Domain', '4-Persistence', '5-Infrastructure', '*')),
  authoritative_for TEXT, -- JSON array of domains this rule is authoritative for
  topics TEXT,           -- JSON array of topics this rule covers
  source_path TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Directives table - stores specific directives within rules
CREATE TABLE IF NOT EXISTS directives (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL,
  section TEXT NOT NULL,
  severity TEXT NOT NULL CHECK(severity IN ('MUST', 'SHOULD', 'MAY')),
  text TEXT NOT NULL,
  rationale TEXT,
  example TEXT,
  anti_pattern TEXT,
  topics TEXT,           -- JSON array of topics this directive covers
  when_to_apply TEXT,    -- JSON array of conditions when this directive applies
  embedding BLOB,        -- Vector embedding for semantic search
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (rule_id) REFERENCES rules(id) ON DELETE CASCADE
);

-- Rule relationships table - stores relationships between rules and other entities
CREATE TABLE IF NOT EXISTS rule_relationships (
  id TEXT PRIMARY KEY,
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  relationship_type TEXT NOT NULL CHECK(relationship_type IN ('CONTAINS', 'AUTHORITATIVE_FOR', 'APPLIES_TO', 'RELATED_TO')),
  weight REAL DEFAULT 1.0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance optimization

-- Base entity indexes
CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);
CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_relations_from ON relations(from_entity);
CREATE INDEX IF NOT EXISTS idx_relations_to ON relations(to_entity);
CREATE INDEX IF NOT EXISTS idx_relations_type ON relations(relation_type);
CREATE INDEX IF NOT EXISTS idx_observations_entity ON observations(entity_name);

-- Rule-specific indexes
CREATE INDEX IF NOT EXISTS idx_rules_layer ON rules(layer);
CREATE INDEX IF NOT EXISTS idx_rules_source_path ON rules(source_path);
CREATE INDEX IF NOT EXISTS idx_rules_updated_at ON rules(updated_at);

CREATE INDEX IF NOT EXISTS idx_directives_rule_id ON directives(rule_id);
CREATE INDEX IF NOT EXISTS idx_directives_severity ON directives(severity);
CREATE INDEX IF NOT EXISTS idx_directives_section ON directives(section);

CREATE INDEX IF NOT EXISTS idx_rule_relationships_from ON rule_relationships(from_id);
CREATE INDEX IF NOT EXISTS idx_rule_relationships_to ON rule_relationships(to_id);
CREATE INDEX IF NOT EXISTS idx_rule_relationships_type ON rule_relationships(relationship_type);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_rules_layer_topics ON rules(layer, topics);
CREATE INDEX IF NOT EXISTS idx_directives_severity_topics ON directives(severity, topics);
CREATE INDEX IF NOT EXISTS idx_directives_rule_severity ON directives(rule_id, severity);

-- Full-text search indexes for text content
CREATE VIRTUAL TABLE IF NOT EXISTS directives_fts USING fts5(
  directive_id UNINDEXED,
  text,
  rationale,
  example,
  content='directives',
  content_rowid='rowid'
);

-- Triggers to maintain FTS index
CREATE TRIGGER IF NOT EXISTS directives_fts_insert AFTER INSERT ON directives BEGIN
  INSERT INTO directives_fts(directive_id, text, rationale, example) 
  VALUES (new.id, new.text, new.rationale, new.example);
END;

CREATE TRIGGER IF NOT EXISTS directives_fts_delete AFTER DELETE ON directives BEGIN
  DELETE FROM directives_fts WHERE directive_id = old.id;
END;

CREATE TRIGGER IF NOT EXISTS directives_fts_update AFTER UPDATE ON directives BEGIN
  DELETE FROM directives_fts WHERE directive_id = old.id;
  INSERT INTO directives_fts(directive_id, text, rationale, example) 
  VALUES (new.id, new.text, new.rationale, new.example);
END;

-- Triggers to maintain updated_at timestamps
CREATE TRIGGER IF NOT EXISTS rules_updated_at AFTER UPDATE ON rules BEGIN
  UPDATE rules SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS entities_updated_at AFTER UPDATE ON entities BEGIN
  UPDATE entities SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;