# ContextISO MCP Server - Debug Reference

## Build Status ✅

The MCP server has been successfully built and is ready for debugging.

## Quick Start

### 1. MCP Configuration
The MCP server is already configured in `.kilocode/mcp.json`:

```json
{
  "mcpServers": {
    "context-iso": {
      "command": "node",
      "args": ["c:/git/contextiso/dist/index.js"],
      "env": {
        "NEO4J_URI": "${NEO4J_URI}",
        "NEO4J_USERNAME": "${NEO4J_USERNAME}",
        "NEO4J_PASSWORD": "${NEO4J_PASSWORD}"
      }
    }
  }
}
```

### 2. Environment Variables ✅
All required environment variables are set:
- `NEO4J_URI`: neo4j+s://42b6bc30.databases.neo4j.io
- `NEO4J_USERNAME`: neo4j
- `NEO4J_PASSWORD`: [Set]

### 3. Debug Script
Use the debug script for manual testing:
```bash
node debug-mcp.js
```

## Testing Results ✅

### Integration Tests
- **Status**: All 21 tests passing
- **Performance**: 
  - Bulk create (50 entities): 168ms
  - Search (20 results): 104ms
- **Connectivity**: ✅ Connected to Neo4j Aura successfully

### Build Status
- **TypeScript Compilation**: ✅ Success
- **Output Directory**: `dist/` created with all compiled files
- **Entry Point**: `dist/index.js` ready for execution

## Available Tools

The ContextISO MCP server provides the following tools:

### Memory Tools
- `store_memory` - Store contextual entities
- `recall_memory` - Retrieve stored context
- `update_memory` - Modify existing context
- `delete_memory` - Remove outdated context
- `search_memory` - Full-text search context

### Rule Tools
- `ingest_rules` - Add rules to the knowledge graph
- `retrieve_rules` - Get applicable rules for context
- `detect_context` - Identify relevant contextual patterns
- `update_rules` - Modify existing rules

## Development Commands

```bash
# Build the project
npm run build

# Run in development mode
npm run dev

# Run integration tests
npm run test:integration

# Run all tests
npm test

# Debug with the debug script
node debug-mcp.js
```

## Architecture

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

## Troubleshooting

### Common Issues

1. **Environment Variables Not Set**
   - Ensure NEO4J_URI, NEO4J_USERNAME, and NEO4J_PASSWORD are set
   - Check with: `echo %NEO4J_URI%`

2. **Build Failures**
   - Run `npm install` to install dependencies
   - Run `npm run build` to compile TypeScript

3. **Connection Issues**
   - Verify Neo4j Aura instance is running
   - Check network connectivity
   - Run integration tests: `npm run test:integration`

### Debug Steps

1. Check environment variables
2. Verify build completion
3. Run integration tests
4. Use debug script for manual testing
5. Check MCP client configuration

## Performance Metrics

- **Bulk Operations**: 168ms for 50 entities
- **Search Performance**: 104ms for 20 results
- **Connection Pool**: 50 concurrent connections
- **Query Timeout**: 30 seconds with reconnection

## Next Steps

The MCP server is ready for:
- Integration with MCP clients
- Development of new features
- Performance optimization
- Production deployment