# ContextISO AI Copilot Instructions

**Project:** ContextISO - Context Isolation & Optimization MCP Server  
**Purpose:** Guide AI coding agents in developing Neo4j-backed knowledge graph system for intelligent context management

## 🎯 Project Overview

ContextISO is an MCP (Model Context Protocol) server that delivers precisely targeted contextual information to LLMs using a Neo4j-powered knowledge graph. The system reduces token usage by 70-85% while improving context quality through intelligent rule ingestion, context detection, scoring, and retrieval.

**Core Architecture:**
```
MCP Server (Node.js/TypeScript)
    ↓
├─ Memory Layer: Entity/relationship storage via Neo4j
├─ Rule Layer: Document ingestion + intelligent ranking
└─ Detection Layer: Auto-detect architectural context (layers 1-7, topics, tech)
    ↓
Neo4j Aura (Cloud Database)
```

## 🔧 Development Setup & Conventions

### Build & Test Commands
```bash
npm run build          # TypeScript compilation to dist/
npm run dev            # Development mode with tsx (hot reload)
npm run test:unit      # Unit tests only
npm run test:integration # Requires Neo4j connection
npm run lint:fix       # ESLint auto-fix
```

**Key Files:**
- `src/index.ts` - MCP server entry point, tool routing
- `package.json` - v1.0.0, Node 18+, ESM modules
- `vitest.config.ts` - Test runner config (globals: true, environment: node)
- `tsconfig.json` - Strict mode enabled, ES2022 target

### Environment Configuration
**CRITICAL:** Never hardcode secrets. Use environment variables only:
- `NEO4J_URI` - Connection string (neo4j+s:// for Aura, neo4j:// for local)
- `NEO4J_USERNAME` - Database user
- `NEO4J_PASSWORD` - Database password

See `src/config/neo4j-config.ts` for validation and fallback to defaults.

## 🏗️ Architecture & Data Flow

### Four-Phase Implementation (Phases 1-4)

**Phase 1: Rule Ingestion** → Parse markdown documents into graph structure
- `src/parsing/markdown-parser.ts` - Extract sections, code blocks, metadata
- `src/parsing/directive-extractor.ts` - Find [MUST]/[SHOULD]/[MAY] directives with severity
- `src/parsing/graph-builder.ts` - Convert to Neo4j nodes/relationships
- Creates: Rule → Section → Directive → Layer/Topic/Technology relationships

**Phase 2: Context Detection** → Identify which architectural layer/topics a task belongs to
- `src/detection/layer-detector.ts` - Detect 7 layers (Presentation→Deployment) via keyword matching
- `src/detection/tech-detector.ts` - Extract technologies (React, Docker, PostgreSQL, etc.)
- `src/detection/topic-detector.ts` - Identify topics (security, performance, API, etc.)
- Returns: `{ layer, topics, technologies, confidence: 0-1 }`

**Phase 3: Intelligent Ranking** → Score and prioritize rules by relevance
- `src/ranking/scoring-engine.ts` - Multi-factor scoring: severity weight, topic match, layer compatibility
- Applies token budget constraint, severity filtering, and result limits
- Returns: Ranked array of directives sorted by relevance score

**Phase 4: Smart Retrieval** → Format context blocks for LLM consumption
- `src/formatting/context-formatter.ts` - Convert directives to markdown grouped by severity
- `src/formatting/citation-generator.ts` - Add breadcrumbs and source references
- Primary entry: `RuleManager.queryDirectives()` - End-to-end query pipeline

### Tool Routing Pattern
All tools follow naming convention: `memory.*` or `memory.rules.*`
- `ContextISOServer.setupToolHandlers()` routes tool calls to appropriate manager
- Handlers validate schemas (Zod validation), then delegate to manager methods
- Errors wrapped in `McpError` with standardized error codes

### Neo4j Schema
Key nodes created in `src/storage/neo4j-connection.ts`:
- `RuleDocument` - Source markdown file with path, content
- `Section` - Header levels (h1→h3), hierarchical
- `Directive` - Extracted rules with severity [MUST|SHOULD|MAY]
- `Layer`, `Topic`, `Technology` - Metadata nodes for relationships
- Relationships: `CONTAINS`, `HAS_DIRECTIVE`, `APPLIES_TO_*`, etc.
- Bulk operations use `UNWIND` for performance (50 entities in 150ms)

## 📝 Code Patterns & Conventions

### Schema Validation (Zod)
All tool inputs validated before execution:
```typescript
const MySchema = z.object({
  field: z.string(),
  number: z.number().int().optional().default(10)
});
export type MyInput = z.infer<typeof MySchema>;

// In handler:
const parsed = MySchema.parse(args);
```
See `RuleManager.constructor` for all tool input schemas.

### Async Neo4j Queries
Pattern: Get session → Run query with parameters → Close session
```typescript
const session = this.connection.getSession();
try {
  const result = await session.run('MATCH...', { params });
  const records = result.records.map(r => r.get('field'));
} finally {
  await session.close();
}
```

### Test Mocking Pattern (Vitest)
- Mock neo4j-driver at module level (see `memory-manager.test.ts`)
- Create FakeRecord/FakeSession/FakeDriver classes matching neo4j API
- Unit tests don't require real Neo4j; integration tests do
- Use `beforeEach/afterEach` for setup/cleanup

### Error Handling
- Constructor errors: wrap with context, throw early
- Tool handlers: throw standard errors, caught and wrapped in McpError
- Always include error message context with operation details

## 🔄 Important Workflows

### Adding a New Tool
1. Define Zod schema in appropriate manager (e.g., `RuleManager`)
2. Add handler method to manager class (e.g., `async queryDirectives()`)
3. Add tool definition to `*-tools.ts` file with description, input schema
4. Add case to `handleTool()` switch statement in manager
5. Add unit + integration tests
6. No hardcoded strings for error messages; include context

### Running Integration Tests
Requires Neo4j running (Aura or local instance):
```bash
export NEO4J_URI=neo4j+s://...
export NEO4J_USERNAME=neo4j
export NEO4J_PASSWORD=...
npm run test:integration
```
See `src/integration.test.ts` for example patterns.

### Performance Optimization
- Use `UNWIND` in Cypher for bulk operations (not N queries)
- Connection pooling: default 50 connections, configurable in `Neo4jConnection`
- Query timeout: 30 seconds with auto-reconnect
- Scoring bottleneck: Pre-compute weights, use Neo4j for graph traversal
- Token counting: Approximate via character count (see `TokenCounter.estimate()`)

## 🎯 Project-Specific Patterns

### Directive Severity & Prioritization
`[MUST]` directives are non-negotiable (score multiplier: 3x)  
`[SHOULD]` directives are recommended (score multiplier: 2x)  
`[MAY]` directives are optional (score multiplier: 1x)

Ranking also considers:
- Topic match confidence (keyword overlap)
- Architectural layer alignment
- Token budget constraint (truncate if needed)

### 7-Layer Architectural Model
Used throughout for context detection:
- **1-Presentation** - UI, frontend, rendering
- **2-Application** - Controllers, services, business logic
- **3-Domain** - Entities, models, domain objects
- **4-Persistence** - Database, repositories, data access
- **5-Integration** - APIs, external services, messaging
- **6-Infrastructure** - DevOps, deployment, configuration
- **7-Deployment** - Cloud platforms, containerization

### Mode-Based Adjustments (query modes)
`architect`, `code`, `debug` modes adjust scoring weights:
- **architect** - Emphasize design patterns, layer relationships
- **code** - Prioritize implementation details, examples
- **debug** - Focus on troubleshooting, error handling

## 🧪 Testing Standards

### Test Coverage Targets
- Unit tests: >90% for all new code
- Integration tests: ≥2 per major feature
- Performance tests: Query response time <400ms for typical operations

### Test File Naming
- Feature implementation: `feature.ts`
- Unit tests: `feature.test.ts` (same directory)
- Integration tests: `src/integration.test.ts`
- Phase-specific: `src/phase4.test.ts` (for Phase 4)

### Vitest Globals
Tests use globals (no import needed):
```typescript
describe('Module', () => {
  it('does X', () => { expect(result).toBe(true); });
});
```

## 📁 File Organization

```
src/
├── index.ts                      # MCP server entry, tool routing
├── memory/
│   ├── memory-manager.ts         # Entity/relationship CRUD
│   ├── memory-tools.ts           # Tool definitions for memory ops
│   └── memory-manager.test.ts    # Unit tests
├── rules/
│   ├── rule-manager.ts           # Orchestrates all 4 phases
│   ├── rule-tools.ts             # Tool definitions for rule ops
│   └── rule-tools.test.ts
├── parsing/
│   ├── markdown-parser.ts        # Phase 1.1
│   ├── directive-extractor.ts    # Phase 1.2
│   ├── graph-builder.ts          # Phase 1.3
│   └── *.test.ts                 # Unit tests for each
├── detection/
│   ├── layer-detector.ts         # Phase 2.1
│   ├── tech-detector.ts          # Phase 2.2
│   ├── topic-detector.ts         # Phase 2.3
│   └── *.test.ts
├── ranking/
│   ├── scoring-engine.ts         # Phase 3 (includes TokenCounter)
│   └── scoring-engine.test.ts
├── formatting/
│   ├── context-formatter.ts      # Phase 4.1
│   ├── citation-generator.ts     # Phase 4.2
│   └── *.test.ts
├── storage/
│   ├── neo4j-connection.ts       # Driver management & schema
│   └── neo4j-connection.test.ts
└── config/
    ├── neo4j-config.ts           # Environment loading
    └── neo4j-types.ts            # TypeScript interfaces
```

## ⚡ Quick Reference

| Task | Command |
|------|---------|
| Develop with hot reload | `npm run dev` |
| Build for production | `npm run build` |
| Run unit tests | `npm run test:unit` |
| Run integration tests | `npm run test:integration` |
| Fix linting issues | `npm run lint:fix` |
| Check for security issues | Review `.github/instructions/security.instructions.md` |

## 🔐 Security Constraints

**Critical:** See `.github/instructions/security.instructions.md`
- NEVER hardcode secrets, connection strings, or passwords
- NEVER use `.env` files; always use environment variables
- ALWAYS validate/sanitize user inputs
- ALWAYS use parameterized queries with Neo4j driver
- Secrets in source control = instant rejection

## 📊 Key Metrics

| Metric | Target | Method |
|--------|--------|--------|
| Rule query response | <400ms | Cypher optimization, caching |
| Token reduction | 70-85% | Intelligent ranking, filtering |
| Context relevance | 85-95% | Multi-factor scoring |
| Test coverage | >90% | Vitest coverage reports |
| Build time | <15s | TypeScript incremental build |

---

**Last Updated:** October 17, 2025  
**Status:** Active for Phases 1-4 implementation  
**Related Docs:** `PHASES-1-4-ROADMAP.md`, `PHASES-1-4-TODO.md`, `src/` examples
