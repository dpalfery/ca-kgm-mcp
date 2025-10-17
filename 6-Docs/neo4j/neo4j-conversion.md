# Migration Plan: SQLite → Neo4j Aura Cloud

## Overview
This plan converts the current SQLite-based implementation to use Neo4j Aura's free tier, eliminating local installation requirements while gaining native graph database capabilities for the knowledge graph memory system.

---

## Phase 1: Architecture Changes

### 1.1 Remove Components No Longer Needed
- ❌ **Remove**: `better-sqlite3` dependency (native module causing build issues)
- ❌ **Remove**: `sqlite3` dependency
- ❌ **Remove**: Local model detection (Ollama, LM Studio, LocalAI)
- ❌ **Remove**: Cross-platform adapters (`windows-adapter.ts`, `macos-adapter.ts`)
- ❌ **Remove**: Binary download/installation scripts
- ✅ **Keep**: Rule-based context detection as fallback

### 1.2 Add Neo4j Dependencies
```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.5.0",
    "neo4j-driver": "^5.15.0",      // Official Neo4j driver
    "zod": "^3.22.4",
    "node-fetch": "^3.3.2"
  }
}
```

### 1.3 Configuration Management
Create environment-based configuration for Neo4j Aura credentials:

```typescript
interface Neo4jConfig {
  uri: string;              // Neo4j Aura instance URI
  username: string;         // Database username
  password: string;         // Database password
  database?: string;        // Database name (default: 'neo4j')
  encrypted: boolean;       // Always true for Aura
  maxConnectionPoolSize?: number;
  connectionTimeout?: number;
}
```

---

## Phase 2: Data Model Conversion

### 2.1 SQLite → Neo4j Graph Schema

**Current SQLite Tables:**
```sql
-- Entities (Memory MCP)
entities (id, name, entity_type, observations, created_at, updated_at)

-- Relations (Memory MCP)
relations (id, from_entity, to_entity, relation_type, created_at)

-- Rules (New)
rules (id, name, layer, authoritative_for, topics, severity, when_to_apply, source_path)

-- Sections (New)
sections (id, rule_id, name, content)

-- Directives (New)
directives (id, section_id, text, severity, topics, layer, when_to_apply, rationale, examples, embedding)
```

**New Neo4j Graph Schema:**

```cypher
// Node Labels
(:Entity {
  name: string,              // Primary identifier
  entityType: string,
  observations: [string],
  createdAt: datetime,
  updatedAt: datetime
})

(:Rule {
  id: string,
  name: string,
  layer: string,             // '1-Presentation', '2-Application', etc.
  authoritativeFor: [string],
  topics: [string],
  severity: string,          // 'MUST', 'SHOULD', 'MAY'
  whenToApply: [string],
  sourcePath: string,
  createdAt: datetime,
  updatedAt: datetime
})

(:Section {
  id: string,
  name: string,
  content: string
})

(:Directive {
  id: string,
  text: string,
  severity: string,
  topics: [string],
  layer: string,
  whenToApply: [string],
  rationale: string,
  examples: string,          // JSON stringified
  antiPatterns: string,      // JSON stringified
  sourceRuleName: string,
  sourceSectionName: string,
  sourcePath: string,
  embedding: [float]         // Vector embedding for semantic search
})

// Relationship Types
(:Entity)-[:RELATES_TO {type: string, createdAt: datetime}]->(:Entity)
(:Rule)-[:HAS_SECTION]->(:Section)
(:Section)-[:HAS_DIRECTIVE]->(:Directive)
(:Rule)-[:AUTHORITATIVE_FOR {topic: string}]->(:Topic)
(:Directive)-[:APPLIES_TO {layer: string}]->(:Layer)
(:Directive)-[:COVERS {topic: string}]->(:Topic)
```

### 2.2 Indexes and Constraints

```cypher
// Unique constraints
CREATE CONSTRAINT entity_name_unique IF NOT EXISTS
FOR (e:Entity) REQUIRE e.name IS UNIQUE;

CREATE CONSTRAINT rule_id_unique IF NOT EXISTS
FOR (r:Rule) REQUIRE r.id IS UNIQUE;

CREATE CONSTRAINT section_id_unique IF NOT EXISTS
FOR (s:Section) REQUIRE s.id IS UNIQUE;

CREATE CONSTRAINT directive_id_unique IF NOT EXISTS
FOR (d:Directive) REQUIRE d.id IS UNIQUE;

// Performance indexes
CREATE INDEX entity_type_idx IF NOT EXISTS
FOR (e:Entity) ON (e.entityType);

CREATE INDEX rule_layer_idx IF NOT EXISTS
FOR (r:Rule) ON (r.layer);

CREATE INDEX directive_severity_idx IF NOT EXISTS
FOR (d:Directive) ON (d.severity);

CREATE INDEX directive_layer_idx IF NOT EXISTS
FOR (d:Directive) ON (d.layer);

// Full-text search indexes
CREATE FULLTEXT INDEX entity_search IF NOT EXISTS
FOR (e:Entity) ON EACH [e.name, e.observations];

CREATE FULLTEXT INDEX directive_search IF NOT EXISTS
FOR (d:Directive) ON EACH [d.text, d.rationale, d.topics];

// Vector index for semantic search (Neo4j 5.11+)
CREATE VECTOR INDEX directive_embedding_idx IF NOT EXISTS
FOR (d:Directive) ON (d.embedding)
OPTIONS {indexConfig: {
  `vector.dimensions`: 1536,        // Adjust based on embedding model
  `vector.similarity_function`: 'cosine'
}};
```

---

## Phase 3: Implementation Changes

### 3.1 Create Neo4j Connection Manager

```typescript
// src/storage/neo4j-connection.ts
import neo4j, { Driver, Session, Transaction } from 'neo4j-driver';

export class Neo4jConnection {
  private driver: Driver | null = null;
  private config: Neo4jConfig;

  constructor(config: Neo4jConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    this.driver = neo4j.driver(
      this.config.uri,
      neo4j.auth.basic(this.config.username, this.config.password),
      {
        encrypted: 'ENCRYPTION_ON',
        maxConnectionPoolSize: this.config.maxConnectionPoolSize || 50,
        connectionTimeout: this.config.connectionTimeout || 30000
      }
    );

    // Verify connection
    await this.driver.verifyConnectivity();
  }

  getSession(): Session {
    if (!this.driver) {
      throw new Error('Driver not initialized');
    }
    return this.driver.session({
      database: this.config.database || 'neo4j'
    });
  }

  async close(): Promise<void> {
    if (this.driver) {
      await this.driver.close();
      this.driver = null;
    }
  }
}
```

### 3.2 Replace MemoryManager Implementation

```typescript
// src/memory/memory-manager.ts
import { Neo4jConnection } from '../storage/neo4j-connection.js';

export class MemoryManager {
  private connection: Neo4jConnection;

  constructor(config: Neo4jConfig) {
    this.connection = new Neo4jConnection(config);
  }

  async initialize(): Promise<void> {
    await this.connection.connect();
    await this.createSchema();
  }

  private async createSchema(): Promise<void> {
    const session = this.connection.getSession();
    try {
      // Create constraints and indexes (from Phase 2.2)
      await session.run(`
        CREATE CONSTRAINT entity_name_unique IF NOT EXISTS
        FOR (e:Entity) REQUIRE e.name IS UNIQUE
      `);
      // ... more constraints
    } finally {
      await session.close();
    }
  }

  async createEntities(args: any): Promise<any> {
    const { entities } = args;
    const session = this.connection.getSession();
    
    try {
      const result = await session.run(
        `
        UNWIND $entities AS entity
        MERGE (e:Entity {name: entity.name})
        ON CREATE SET
          e.entityType = entity.entityType,
          e.observations = entity.observations,
          e.createdAt = datetime(),
          e.updatedAt = datetime()
        ON MATCH SET
          e.entityType = entity.entityType,
          e.observations = entity.observations,
          e.updatedAt = datetime()
        RETURN e.name AS name, 
               CASE WHEN e.createdAt = e.updatedAt THEN 'created' ELSE 'updated' END AS action
        `,
        { entities }
      );

      const created = result.records.filter(r => r.get('action') === 'created');
      const updated = result.records.filter(r => r.get('action') === 'updated');

      return {
        created: created.length,
        updated: updated.length,
        entities: result.records.map(r => r.get('name'))
      };
    } finally {
      await session.close();
    }
  }

  async createRelations(args: any): Promise<any> {
    const { relations } = args;
    const session = this.connection.getSession();
    
    try {
      const result = await session.run(
        `
        UNWIND $relations AS rel
        MATCH (from:Entity {name: rel.from})
        MATCH (to:Entity {name: rel.to})
        MERGE (from)-[r:RELATES_TO {type: rel.relationType}]->(to)
        ON CREATE SET r.createdAt = datetime()
        RETURN count(r) AS created
        `,
        { relations }
      );

      return {
        created: result.records[0].get('created').toNumber(),
        total: relations.length
      };
    } finally {
      await session.close();
    }
  }

  async searchNodes(args: any): Promise<any> {
    const { query, limit = 10 } = args;
    const session = this.connection.getSession();
    
    try {
      // Use full-text search
      const result = await session.run(
        `
        CALL db.index.fulltext.queryNodes('entity_search', $query)
        YIELD node, score
        RETURN node.name AS name,
               node.entityType AS entityType,
               node.observations AS observations,
               node.createdAt AS createdAt,
               node.updatedAt AS updatedAt,
               score
        ORDER BY score DESC
        LIMIT $limit
        `,
        { query, limit }
      );

      return {
        nodes: result.records.map(record => ({
          name: record.get('name'),
          entityType: record.get('entityType'),
          observations: record.get('observations') || [],
          createdAt: record.get('createdAt'),
          updatedAt: record.get('updatedAt'),
          score: record.get('score')
        }))
      };
    } finally {
      await session.close();
    }
  }

  async readGraph(args: any): Promise<any> {
    const session = this.connection.getSession();
    
    try {
      const entitiesResult = await session.run(`
        MATCH (e:Entity)
        RETURN e.name AS name,
               e.entityType AS entityType,
               e.observations AS observations,
               e.createdAt AS createdAt,
               e.updatedAt AS updatedAt
        ORDER BY e.name
      `);

      const relationsResult = await session.run(`
        MATCH (from:Entity)-[r:RELATES_TO]->(to:Entity)
        RETURN from.name AS fromEntity,
               to.name AS toEntity,
               r.type AS relationType,
               r.createdAt AS createdAt
        ORDER BY from.name, to.name
      `);

      return {
        entities: entitiesResult.records.map(r => ({
          name: r.get('name'),
          entityType: r.get('entityType'),
          observations: r.get('observations') || [],
          createdAt: r.get('createdAt'),
          updatedAt: r.get('updatedAt')
        })),
        relations: relationsResult.records.map(r => ({
          from: r.get('fromEntity'),
          to: r.get('toEntity'),
          relationType: r.get('relationType'),
          createdAt: r.get('createdAt')
        }))
      };
    } finally {
      await session.close();
    }
  }
}
```

### 3.3 Replace RuleManager Implementation

```typescript
// src/rules/rule-manager.ts
export class RuleManager {
  private connection: Neo4jConnection;

  constructor(config: Neo4jConfig) {
    this.connection = new Neo4jConnection(config);
  }

  async queryDirectives(args: any): Promise<any> {
    const params = QueryDirectivesSchema.parse(args);
    const session = this.connection.getSession();
    
    try {
      // 1. Detect context (rule-based)
      const context = await this.detectContextRuleBased(params.taskDescription);
      
      // 2. Search using full-text + vector similarity
      const result = await session.run(
        `
        // Full-text search
        CALL db.index.fulltext.queryNodes('directive_search', $query)
        YIELD node AS directive, score AS textScore
        WHERE directive.layer = $layer OR directive.layer = '*'
        
        // Filter by topics if detected
        WITH directive, textScore
        WHERE ANY(topic IN directive.topics WHERE topic IN $topics)
           OR size($topics) = 0
        
        // Rank by severity and relevance
        WITH directive, textScore,
             CASE directive.severity
               WHEN 'MUST' THEN 3
               WHEN 'SHOULD' THEN 2
               WHEN 'MAY' THEN 1
               ELSE 0
             END AS severityScore
        
        // Calculate final score
        WITH directive,
             (textScore * 3 + severityScore * 4) AS finalScore
        
        ORDER BY finalScore DESC
        LIMIT $maxItems
        
        RETURN directive.text AS text,
               directive.severity AS severity,
               directive.topics AS topics,
               directive.sourceRuleName AS sourceRuleName,
               directive.sourceSectionName AS sourceSectionName,
               finalScore
        `,
        {
          query: params.taskDescription,
          layer: context.layer,
          topics: context.topics,
          maxItems: params.options.maxItems || 8
        }
      );

      // 3. Format results
      return this.formatContextBlock(result, context, params.options);
    } finally {
      await session.close();
    }
  }

  // Vector similarity search (if embeddings are available)
  async searchBySemantic(embedding: number[], limit: number): Promise<any> {
    const session = this.connection.getSession();
    
    try {
      const result = await session.run(
        `
        CALL db.index.vector.queryNodes('directive_embedding_idx', $limit, $embedding)
        YIELD node, score
        RETURN node.text AS text,
               node.severity AS severity,
               node.topics AS topics,
               score
        ORDER BY score DESC
        `,
        { embedding, limit }
      );

      return result.records.map(r => ({
        text: r.get('text'),
        severity: r.get('severity'),
        topics: r.get('topics'),
        score: r.get('score')
      }));
    } finally {
      await session.close();
    }
  }
}
```

---

## Phase 4: Configuration & Environment Setup

### 4.1 Environment Variables

```env
# .env.example
NEO4J_URI=neo4j+s://xxxxx.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-secure-password
NEO4J_DATABASE=neo4j
```

### 4.2 Configuration Loader

```typescript
// src/config/neo4j-config.ts
export function loadNeo4jConfig(): Neo4jConfig {
  const uri = process.env.NEO4J_URI;
  const username = process.env.NEO4J_USERNAME;
  const password = process.env.NEO4J_PASSWORD;

  if (!uri || !username || !password) {
    throw new Error(
      'Missing required Neo4j configuration. Please set NEO4J_URI, NEO4J_USERNAME, and NEO4J_PASSWORD environment variables.'
    );
  }

  return {
    uri,
    username,
    password,
    database: process.env.NEO4J_DATABASE || 'neo4j',
    encrypted: true,
    maxConnectionPoolSize: 50,
    connectionTimeout: 30000
  };
}
```

### 4.3 Update Server Initialization

```typescript
// src/index.ts
import { loadNeo4jConfig } from './config/neo4j-config.js';

class KnowledgeGraphMemoryServer {
  constructor() {
    const config = loadNeo4jConfig();
    
    this.memoryManager = new MemoryManager(config);
    this.ruleManager = new RuleManager(config);
  }
}
```

---

## Phase 5: Testing Strategy

### 5.1 Update Unit Tests

```typescript
// src/memory/memory-manager.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// Use real Neo4j test instance or Testcontainers
describe('MemoryManager (Neo4j)', () => {
  let mm: MemoryManager;
  let testConfig: Neo4jConfig;

  beforeAll(async () => {
    testConfig = {
      uri: process.env.TEST_NEO4J_URI || 'neo4j://localhost:7687',
      username: 'neo4j',
      password: 'testpassword',
      database: 'test',
      encrypted: false
    };
    
    mm = new MemoryManager(testConfig);
    await mm.initialize();
  });

  afterAll(async () => {
    await mm.close();
  });

  it('creates entities in Neo4j', async () => {
    const result = await mm.handleTool('memory.create_entities', {
      entities: [
        { name: 'Alice', entityType: 'person', observations: ['test'] }
      ]
    });

    expect(result.created).toBe(1);
  });
});
```

---

## Phase 6: Migration & Deployment

### 6.1 Data Migration Script

```typescript
// scripts/migrate-sqlite-to-neo4j.ts
async function migrateSQLiteToNeo4j(
  sqlitePath: string,
  neo4jConfig: Neo4jConfig
): Promise<void> {
  // 1. Read from SQLite
  const db = new Database(sqlitePath);
  
  // 2. Connect to Neo4j
  const neo4j = new Neo4jConnection(neo4jConfig);
  await neo4j.connect();
  
  // 3. Migrate entities
  const entities = db.prepare('SELECT * FROM entities').all();
  // ... migrate to Neo4j
  
  // 4. Migrate relations
  const relations = db.prepare('SELECT * FROM relations').all();
  // ... migrate to Neo4j
  
  // 5. Migrate rules, sections, directives
  // ... migrate to Neo4j
  
  await neo4j.close();
  db.close();
}
```

### 6.2 Neo4j Aura Setup Steps

1. **Create free Neo4j Aura account** at https://neo4j.com/cloud/aura/
2. **Create a new instance** (Free tier: 200MB storage)
3. **Save credentials** (username, password, connection URI)
4. **Set environment variables** in your deployment
5. **Run schema creation** on first startup
6. **(Optional) Import existing data** using migration script

---

## Phase 7: Benefits & Trade-offs

### Benefits ✅
- **No native builds**: Eliminates `better-sqlite3` and node-gyp issues
- **Cloud-hosted**: No local installation required
- **Native graph queries**: Cypher is optimized for graph traversals
- **Vector search**: Built-in support for semantic search
- **Full-text search**: Native full-text indexing
- **Cross-platform**: Works identically on Windows, Mac, Linux
- **Scalability**: Can upgrade from free tier as needed
- **Visualizations**: Neo4j Browser for exploring graph structure
- **Backups**: Automatic backups in Aura

### Trade-offs ⚠️
- **Network dependency**: Requires internet connection
- **Free tier limits**: 200MB storage, limited concurrent connections
- **Latency**: Cloud round-trip adds ~50-200ms per query
- **Cost**: Free tier sufficient for development, paid plans for production
- **Data privacy**: Data stored in cloud (use encryption for sensitive data)

---

## Implementation Timeline

### Week 1: Setup & Core Migration
- Day 1-2: Add neo4j-driver, remove SQLite deps
- Day 3-4: Implement Neo4jConnection and basic MemoryManager
- Day 5: Update configuration and environment handling

### Week 2: Rules & Search
- Day 1-2: Implement RuleManager with Cypher queries
- Day 3-4: Add full-text and vector search
- Day 5: Context detection (rule-based only)

### Week 3: Testing & Documentation
- Day 1-2: Update unit tests for Neo4j
- Day 3-4: Integration testing
- Day 5: Documentation and migration guide

---

## File Structure Changes

```
src/
├── config/
│   └── neo4j-config.ts          [NEW] Configuration loader
├── storage/
│   └── neo4j-connection.ts      [NEW] Neo4j driver wrapper
├── memory/
│   ├── memory-manager.ts        [MODIFY] Replace SQLite with Neo4j
│   ├── memory-manager.test.ts   [MODIFY] Update tests
│   └── memory-tools.ts          [KEEP] No changes
├── rules/
│   ├── rule-manager.ts          [MODIFY] Replace SQLite with Neo4j
│   ├── rule-tools.ts            [KEEP] No changes
│   └── local-model-manager.ts   [DELETE] No longer needed
├── platform/                    [DELETE] Entire directory
│   ├── cross-platform-detector.ts
│   ├── interfaces.ts
│   ├── macos-adapter.ts
│   └── windows-adapter.ts
└── index.ts                     [MODIFY] Update initialization

package.json                     [MODIFY] Replace dependencies
.env.example                     [NEW] Environment template
README.md                        [MODIFY] Update setup instructions
```

---

## Next Steps

1. **Create Neo4j Aura account** and obtain credentials
2. **Set up environment variables** locally
3. **Begin Phase 1** implementation: dependency updates
4. **Implement Phase 3.1**: Neo4j connection manager
5. **Test connection** to Neo4j Aura instance
6. **Proceed with remaining phases** systematically

---

## References

- [Neo4j Aura Free Tier](https://neo4j.com/cloud/aura-free/)
- [Neo4j JavaScript Driver Documentation](https://neo4j.com/docs/javascript-manual/current/)
- [Cypher Query Language](https://neo4j.com/docs/cypher-manual/current/)
- [Neo4j Vector Search](https://neo4j.com/docs/cypher-manual/current/indexes-for-vector-search/)
- [Neo4j Full-Text Search](https://neo4j.com/docs/cypher-manual/current/indexes-for-full-text-search/)
