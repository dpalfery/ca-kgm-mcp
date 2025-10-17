```
Neo4j Integration Testing Architecture
=====================================

┌─────────────────────────────────────────────────────────────────┐
│                    Your Neo4j Aura Instance                      │
│         (neo4j+s://your-instance.databases.neo4j.io)            │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │   Entities   │  │ Relationships │  │  Constraints │           │
│  │              │  │  (RELATES_TO) │  │   & Indexes  │           │
│  │ - person     │  │               │  │              │           │
│  │ - project    │  │ - works_for   │  │ - unique     │           │
│  │ - org        │  │ - leads       │  │ - type idx   │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ (Cypher Queries)
                              │
┌─────────────────────────────────────────────────────────────────┐
│              Neo4j JavaScript Driver (5.15.0)                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  neo4j.driver() → session() → run(cypher_query)          │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ (Cypher Execution)
                              │
┌─────────────────────────────────────────────────────────────────┐
│           MCP Managers (TypeScript Implementation)               │
│                                                                   │
│  ┌──────────────────────┐    ┌──────────────────────┐           │
│  │  MemoryManager       │    │   RuleManager        │           │
│  │                      │    │                      │           │
│  │ - createEntities()   │    │ - queryDirectives()  │           │
│  │ - createRelations()  │    │ - detectContext()    │           │
│  │ - searchNodes()      │    │ - upsertMarkdown()   │           │
│  │ - readGraph()        │    │ (Phase 6-7)          │           │
│  └──────────────────────┘    └──────────────────────┘           │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │      Neo4jConnection (Driver Lifecycle)                  │   │
│  │                                                            │   │
│  │ - connect()        → Verify connectivity                 │   │
│  │ - createSchema()   → Setup constraints & indexes         │   │
│  │ - getSession()     → Get connection for queries          │   │
│  │ - close()          → Cleanup resources                   │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ (Configuration)
                              │
┌─────────────────────────────────────────────────────────────────┐
│           Configuration Layer (Environment Variables)            │
│                                                                   │
│  .env File (Git-ignored for security):                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ NEO4J_URI=neo4j+s://xxxxx.databases.neo4j.io             │   │
│  │ NEO4J_USERNAME=neo4j                                     │   │
│  │ NEO4J_PASSWORD=secure-password                           │   │
│  │ NEO4J_DATABASE=neo4j                                     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  loadNeo4jConfig() → Reads & validates environment              │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │
┌─────────────────────────────────────────────────────────────────┐
│              Integration Test Suite (22 Tests)                   │
│                                                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────┐ │
│  │ Connectivity    │  │  Entity Mgmt    │  │ Relationship     │ │
│  │ & Schema (3)    │  │  (5)            │  │ Mgmt (3)         │ │
│  └─────────────────┘  └─────────────────┘  └──────────────────┘ │
│                                                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────┐ │
│  │ Search (3)      │  │ Analytics (3)   │  │ Error Handling   │ │
│  │                 │  │                 │  │ (3)              │ │
│  └─────────────────┘  └─────────────────┘  └──────────────────┘ │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Performance Testing (2)                                 │   │
│  │  - Bulk create (50 entities)                             │   │
│  │  - Search efficiency                                     │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              Test Execution Flow                                  │
│                                                                   │
│  1. beforeAll()                                                  │
│     └─ Load config from .env                                     │
│     └─ Connect to Neo4j Aura                                     │
│     └─ Create schema (constraints & indexes)                     │
│     └─ Clean previous test data                                  │
│                                                                   │
│  2. Run Test Suite (22 tests)                                    │
│     └─ Each test:                                                │
│        ├─ Initialize managers                                    │
│        ├─ Execute operation (CRUD, search, etc.)                 │
│        ├─ Validate results                                       │
│        └─ Assert expectations                                    │
│                                                                   │
│  3. afterAll()                                                   │
│     └─ Delete test data                                          │
│     └─ Close connections                                         │
│     └─ Display summary                                           │
│                                                                   │
│  4. Output                                                       │
│     └─ Test results (22/22 passed)                               │
│     └─ Performance metrics                                       │
│     └─ Database cleanup verified                                 │
└─────────────────────────────────────────────────────────────────┘


Test Categories & Coverage
===========================

CONNECTIVITY & SCHEMA (3 tests)
┌─────────────────────────────────┐
│ 1. connects to Neo4j Aura       │  Verify driver connectivity
│ 2. validates schema constraints │  Check unique constraints
│ 3. validates search indexes     │  Confirm full-text indexes
└─────────────────────────────────┘

ENTITY MANAGEMENT (5 tests)
┌─────────────────────────────────┐
│ 1. creates multiple entities    │  Bulk UNWIND + MERGE
│ 2. retrieves entities           │  MATCH all entities
│ 3. updates existing entities    │  MERGE with updates
│ 4. deletes entities             │  DETACH DELETE
│ 5. validates entity structure   │  Type checking
└─────────────────────────────────┘

RELATIONSHIP MANAGEMENT (3 tests)
┌─────────────────────────────────┐
│ 1. creates relationships        │  MATCH + CREATE RELATES_TO
│ 2. reads complete graph         │  MATCH all paths
│ 3. traverses entity paths       │  Path finding
└─────────────────────────────────┘

SEARCH FUNCTIONALITY (3 tests)
┌─────────────────────────────────┐
│ 1. searches by name             │  Pattern matching
│ 2. searches by type             │  Property filtering
│ 3. full-text search             │  CALL db.index.fulltext
└─────────────────────────────────┘

GRAPH ANALYTICS (3 tests)
┌─────────────────────────────────┐
│ 1. entity statistics            │  COUNT, DISTINCT
│ 2. relationship statistics      │  Relationship metrics
│ 3. connectivity analysis        │  Most connected nodes
└─────────────────────────────────┘

ERROR HANDLING (3 tests)
┌─────────────────────────────────┐
│ 1. duplicate creation           │  Graceful MERGE
│ 2. missing endpoints            │  No orphan relations
│ 3. empty results                │  Empty array handling
└─────────────────────────────────┘

PERFORMANCE & SCALE (2 tests)
┌─────────────────────────────────┐
│ 1. bulk operations (50 entities)│  < 2 seconds
│ 2. search efficiency            │  < 1 second
└─────────────────────────────────┘


Data Flow Examples
==================

CREATING ENTITIES
┌────────────────────────────────────────────┐
│ Test Input                                 │
├────────────────────────────────────────────┤
│ {                                          │
│   entities: [                              │
│     { name: "Alice", entityType: "person" },
│     { name: "Bob", entityType: "person" }  │
│   ]                                        │
│ }                                          │
└────────────────────────────────────────────┘
                    ▼
┌────────────────────────────────────────────┐
│ Cypher Query (UNWIND + MERGE)              │
├────────────────────────────────────────────┤
│ UNWIND $entities AS entity                 │
│ MERGE (e:Entity { name: entity.name })     │
│ SET e += entity, e.updatedAt = $now        │
│ RETURN e                                   │
└────────────────────────────────────────────┘
                    ▼
┌────────────────────────────────────────────┐
│ Neo4j Execution                            │
├────────────────────────────────────────────┤
│ ✓ Constraint check (unique name)           │
│ ✓ Merge or update nodes                    │
│ ✓ Return created/updated records           │
└────────────────────────────────────────────┘
                    ▼
┌────────────────────────────────────────────┐
│ Test Validation                            │
├────────────────────────────────────────────┤
│ expect(result.created).toBeGreaterThan(0)  │
│ expect(result.entities.length).toBe(2)     │
│ ✓ Test passes                              │
└────────────────────────────────────────────┘


Deployment Pipeline
===================

┌──────────────┐
│  Local Dev   │  npm run test:integration
│   Testing    │  (Mocked or real Aura)
└──────┬───────┘
       │
       ▼
┌──────────────────────┐
│  CI/CD Pipeline      │  GitHub Actions
│  (Future)            │  - Run tests
└──────┬───────────────┘  - Build Docker
       │                  - Push registry
       ▼
┌──────────────────────┐
│  Staging Env         │  Neo4j instance
│  (Real DB)           │  with test data
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  Production Deploy   │  Neo4j Aura
│  (High Availability) │  cluster instance
└──────────────────────┘


Summary
=======
Total Tests:        22
Pass Rate Target:   100%
Estimated Duration: ~15 seconds
Database Cleanup:   Automatic
Data Persistence:   None (cleaned after tests)
```
