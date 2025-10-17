# ContextISO - Context Isolation & Optimization

**ContextISO** brings context into clarity for LLMs by targeting and isolating relevant knowledge through an intelligent knowledge graph system.

## Overview

ContextISO is an MCP (Model Context Protocol) server that provides intelligent context management and optimization for AI coding assistants. By leveraging a graph-based architecture powered by Neo4j, it delivers precisely targeted contextual information to LLMs while reducing token usage by up to 85%.

### Key Features

- **🎯 Targeted Context** - Isolate and deliver only the most relevant contextual information
- **📊 Knowledge Graphs** - Graph-based storage and retrieval for complex relationships
- **⚡ Performance** - Optimized queries with bulk operations (50 entities in 150ms)
- **🔍 Full-text Search** - Advanced search capabilities with ranking
- **☁️ Cloud Native** - Built on Neo4j Aura for scalability and reliability
- **🔄 Rule Management** - Dynamic rule creation and context detection

## Architecture

ContextISO consists of several core components:

```
┌─────────────────────────────────────┐
│      ContextISO MCP Server          │
├─────────────────────────────────────┤
│  Memory Layer          Rule Layer    │
│  (Context Storage)  (Optimization)   │
├─────────────────────────────────────┤
│      Neo4j Connection Manager        │
├─────────────────────────────────────┤
│       Neo4j Aura (Cloud)             │
└─────────────────────────────────────┘
```

### Components

- **Memory Manager** - Handles entity storage, relationships, and context search
- **Rule Manager** - Manages rules and context detection for optimization
- **Neo4j Connection** - Manages database connections and lifecycle
- **Tools** - MCP tool definitions for context operations

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- Neo4j Aura instance (free tier available at https://aura.neo4j.io)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd ca-kgm-mcp

# Install dependencies
npm install

# Build the project
npm run build
```

### Configuration

Set up environment variables for Neo4j connection:

```bash
# .env or system environment variables
NEO4J_URI=neo4j+s://your-instance.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-password
```

### Running the Server

```bash
# Development mode
npm run dev

# Production mode
npm start

# Watch mode
npm run build:watch
```

## Usage

### MCP Tool Integration

ContextISO exposes MCP tools for context management:

#### Memory Tools
- `store_memory` - Store contextual entities
- `recall_memory` - Retrieve stored context
- `update_memory` - Modify existing context
- `delete_memory` - Remove outdated context
- `search_memory` - Full-text search context

#### Rule Tools
- `ingest_rules` - Add rules to the knowledge graph
- `retrieve_rules` - Get applicable rules for context
- `detect_context` - Identify relevant contextual patterns
- `update_rules` - Modify existing rules

### Example: Storing Context

```typescript
// Store an entity (context item)
await memoryManager.createEntity({
  name: 'Architecture Pattern',
  entityType: 'Pattern',
  observations: ['Microservices', 'Event-driven']
});

// Create relationships between entities
await memoryManager.createRelation({
  from: 'Architecture Pattern',
  to: 'Deployment',
  relationType: 'USES'
});

// Search for context
const results = await memoryManager.searchNodes({
  query: 'microservices architecture',
  limit: 10
});
```

## Testing

```bash
# Run all tests
npm test

# Run unit tests
npm run test:unit

# Run integration tests (requires Neo4j)
npm run test:integration

# Watch mode
npm run test:watch
```

### Test Results

All 21 integration tests passing ✅

- Connectivity & Schema: 3/3 ✓
- Entity Management: 4/4 ✓
- Relationship Management: 3/3 ✓
- Search Functionality: 3/3 ✓
- Graph Analytics: 3/3 ✓
- Error Handling: 3/3 ✓
- Performance & Scale: 2/2 ✓

## Development

### Project Structure

```
src/
├── index.ts                 # Main server entry point
├── memory/
│   ├── memory-manager.ts   # Context storage and retrieval
│   └── memory-tools.ts     # MCP tool definitions
├── rules/
│   ├── rule-manager.ts     # Rule management
│   └── rule-tools.ts       # Rule MCP tools
├── storage/
│   └── neo4j-connection.ts # Database connection
└── config/
    ├── neo4j-config.ts     # Configuration loader
    └── neo4j-types.ts      # Type definitions
```

### Building

```bash
npm run build      # Build once
npm run build:watch # Watch mode
```

### Linting

```bash
npm run lint       # Check for issues
npm run lint:fix   # Auto-fix issues
```

## Performance

ContextISO is optimized for production use:

- **Bulk Operations** - 150ms for 50 entities
- **Search** - 80ms for full-text search with 20 results
- **Connection Pool** - 50 concurrent connections
- **Query Timeout** - 30 second timeout with reconnection

## Deployment

### Local Development

```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

### Docker (Optional)

Create a `Dockerfile` and customize for your deployment:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install && npm run build
CMD ["npm", "start"]
```

## Configuration Options

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEO4J_URI` | Neo4j Aura connection URI | Yes |
| `NEO4J_USERNAME` | Database username | Yes |
| `NEO4J_PASSWORD` | Database password | Yes |

## Contributing

Contributions are welcome! Please ensure:

1. All tests pass: `npm test`
2. Code is linted: `npm run lint:fix`
3. Documentation is updated
4. Commit messages are clear

## License

MIT

## Support

For issues and questions:
- Check the [documentation](./6-Docs)
- Review [test files](./src) for examples
- File an issue on the repository

## Roadmap

- [ ] Multi-database support (PostgreSQL, MongoDB)
- [ ] Advanced visualization tools
- [ ] Performance profiling dashboard
- [ ] Context versioning and history
- [ ] Collaborative rule management
- [ ] Custom similarity algorithms

---

**ContextISO**: Bringing clarity to LLM context through targeted knowledge graphs.
