# Development Guide

## Project Setup

This project is a fork of the Memory MCP Server with extensions for rule-based context detection and ranking.

### Prerequisites

- Node.js 18+
- TypeScript 5.6+
- npm or yarn

### Initial Setup

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode (watch for changes)
npm run watch
```

## Project Structure

```
kg-memory-server/
├── src/                          # Source code for extensions
│   ├── types.ts                  # Core type definitions
│   └── interfaces/               # Component interfaces
│       ├── context-detection.ts  # Context detection engine interface
│       ├── ranking-engine.ts     # Relevance ranking interface
│       ├── model-provider.ts     # Model provider abstraction
│       ├── knowledge-graph.ts    # Extended knowledge graph interface
│       └── output-formatter.ts   # Output formatting interface
├── index.ts                      # Main server entry point (forked)
├── package.json                  # Project configuration
├── tsconfig.json                 # TypeScript configuration
├── dev-config.json              # Development configuration
└── README.md                     # Project documentation
```

## Development Workflow

### Building

```bash
# Clean build
npm run clean && npm run build

# Watch mode for development
npm run watch

# Type checking only
npm run lint
```

### Testing the Server

```bash
# Start the server (will listen on stdio)
npm start

# Test with echo (basic connectivity test)
echo "test" | npm start
```

### Configuration

The server uses `dev-config.json` for development settings:

- **Model Provider**: Currently set to rule-based fallback
- **Ranking Weights**: Configurable scoring parameters
- **Output Options**: Default formatting preferences
- **Storage**: Database and caching settings

## Implementation Status

### ✅ Completed (Task 1)
- [x] Forked Memory MCP Server repository
- [x] Set up development environment
- [x] Defined core type interfaces
- [x] Created component interfaces for all major systems
- [x] Configured build tools and workflow
- [x] Updated project metadata and documentation

### 🚧 Next Tasks (from tasks.md)
- [ ] Task 2: Extend storage layer with rule-specific tables
- [ ] Task 3: Build model provider abstraction layer
- [ ] Task 4: Develop context detection engine
- [ ] Task 5: Build relevance ranking engine
- [ ] Task 6: Create output formatting system
- [ ] Task 7: Add new MCP tools to forked server

## Key Design Decisions

1. **Preserve Original Functionality**: All existing Memory MCP Server tools remain unchanged
2. **Type-Safe Extensions**: Comprehensive TypeScript interfaces for all new functionality
3. **Modular Architecture**: Clear separation between components for maintainability
4. **Configurable Providers**: Support for local, cloud, and rule-based model providers
5. **Graceful Degradation**: Multiple fallback levels for reliability

## Development Guidelines

### Code Style
- Use TypeScript strict mode
- Follow existing Memory MCP Server patterns
- Maintain backward compatibility
- Add comprehensive JSDoc comments

### Interface Design
- Define interfaces before implementations
- Use composition over inheritance
- Support dependency injection for testability
- Provide clear error handling contracts

### Testing Strategy
- Unit tests for individual components
- Integration tests for MCP tool workflows
- Performance tests for query latency
- Cross-platform compatibility tests

## Debugging

### Common Issues

1. **Build Errors**: Check TypeScript configuration and import paths
2. **Server Won't Start**: Verify all dependencies are installed
3. **MCP Connection Issues**: Test with basic echo command first

### Logging

The server inherits logging from the base Memory MCP Server. Additional logging will be added in future tasks for:
- Context detection performance
- Ranking algorithm decisions
- Model provider fallback chains
- Query diagnostics

## Contributing

1. Follow the existing code style and patterns
2. Add tests for new functionality
3. Update documentation for interface changes
4. Ensure backward compatibility with original Memory MCP Server
5. Test across different platforms (Windows, macOS, Linux)

## Resources

- [Memory MCP Server Source](https://github.com/modelcontextprotocol/servers/tree/main/src/memory)
- [MCP Protocol Documentation](https://modelcontextprotocol.io)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Node.js Documentation](https://nodejs.org/docs/)