# ContextISO MCP Server Configuration Guide

## Basic Configuration

Add to `.kilocode/mcp.json`:

```json
{
  "mcpServers": {
    "contextiso": {
      "command": "node",
      "args": ["C:\\git\\contextiso\\build\\index.js"],
      "env": {
        "NEO4J_URI": "neo4j+s://your-instance.databases.neo4j.io",
        "NEO4J_USERNAME": "neo4j",
        "NEO4J_PASSWORD": "your-password",
        "WORKSPACE": "my-project"
      }
    }
  }
}
```

## Workspace Configuration

**Critical:** Each MCP server instance operates within an isolated workspace. All data (entities, rules, directives) is scoped to the configured workspace.

```json
{
  "env": {
    "WORKSPACE": "my-project-name"
  }
}
```

### Workspace Isolation
- **Default**: `"default"` if not specified
- **Purpose**: Multi-tenant data isolation within single Neo4j database
- **Scope**: All queries automatically filter by workspace
- **Use Cases**:
  - Separate workspaces per project/repository
  - Development vs staging environments
  - Client/tenant isolation

### Example: Multiple Projects

```json
{
  "mcpServers": {
    "contextiso-frontend": {
      "command": "node",
      "args": ["C:\\git\\contextiso\\build\\index.js"],
      "env": {
        "NEO4J_URI": "neo4j+s://your-instance.databases.neo4j.io",
        "NEO4J_USERNAME": "neo4j",
        "NEO4J_PASSWORD": "your-password",
        "WORKSPACE": "frontend-app"
      }
    },
    "contextiso-backend": {
      "command": "node",
      "args": ["C:\\git\\contextiso\\build\\index.js"],
      "env": {
        "NEO4J_URI": "neo4j+s://your-instance.databases.neo4j.io",
        "NEO4J_USERNAME": "neo4j",
        "NEO4J_PASSWORD": "your-password",
        "WORKSPACE": "backend-api"
      }
    }
  }
}
```

## Tool Options Configuration

**Important:** All tool options must be configured via environment variables. The LLM cannot override these settings - they are set once in the MCP server configuration.

### Query Directive Options

Control behavior for `memory.rules.query_directives` tool:

```json
{
  "mcpServers": {
    "contextiso": {
      "command": "node",
      "args": ["C:\\git\\contextiso\\build\\index.js"],
      "env": {
        "NEO4J_URI": "neo4j+s://your-instance.databases.neo4j.io",
        "NEO4J_USERNAME": "neo4j",
        "NEO4J_PASSWORD": "your-password",
        "WORKSPACE": "my-project",
        
        "QUERY_MAX_ITEMS": "8",
        "QUERY_TOKEN_BUDGET": "0",
        "QUERY_INCLUDE_METADATA": "false",
        "QUERY_INCLUDE_BREADCRUMBS": "true",
        "QUERY_SEVERITY_FILTER": "MUST,SHOULD"
      }
    }
  }
}
```

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `QUERY_MAX_ITEMS` | number | `8` | Maximum directives returned per query |
| `QUERY_TOKEN_BUDGET` | number | `0` | Soft token limit (0 = disabled) |
| `QUERY_INCLUDE_METADATA` | boolean | `false` | Include rule metadata in response |
| `QUERY_INCLUDE_BREADCRUMBS` | boolean | `true` | Include source file paths and sections |
| `QUERY_SEVERITY_FILTER` | string | - | Comma-separated severity levels (MUST,SHOULD,MAY) |

### Context Detection Options

Control behavior for `memory.rules.detect_context` tool:

```json
{
  "env": {
    "DETECT_RETURN_KEYWORDS": "false",
    "DETECT_CONFIDENCE_THRESHOLD": "0.5"
  }
}
```

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `DETECT_RETURN_KEYWORDS` | boolean | `false` | Include extracted keywords in response |
| `DETECT_CONFIDENCE_THRESHOLD` | number | `0.5` | Minimum confidence for context detection (0.0-1.0) |

### Document Processing Options

Control behavior for `memory.rules.upsert_markdown` tool:

```json
{
  "env": {
    "UPSERT_OVERWRITE": "false",
    "UPSERT_VALIDATE_ONLY": "false"
  }
}
```

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `UPSERT_OVERWRITE` | boolean | `false` | Replace existing rules from same source |
| `UPSERT_VALIDATE_ONLY` | boolean | `false` | Parse and validate without storing |

### Indexing Options

Control behavior for `memory.rules.index_rules` tool:

```json
{
  "env": {
    "INDEX_PATHS": "./docs/rules,./guidelines.md,./CONTRIBUTING.md",
    "INDEX_FILE_PATTERN": "**/*.md",
    "INDEX_EXCLUDE_PATTERNS": "**/draft/**,**/archive/**"
  }
}
```

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `INDEX_PATHS` | string | - | Comma-separated paths to crawl (required) |
| `INDEX_FILE_PATTERN` | string | `**/*.md` | Glob pattern for matching files |
| `INDEX_EXCLUDE_PATTERNS` | string | - | Comma-separated exclude patterns |

## Mode Configuration

Control which modes are allowed for context detection. The configured modes will be exposed as the enum options in the `modeSlug` parameter of the `memory.rules.query_directives` tool.

### Default Modes

```json
{
  "env": {
    "ALLOWED_MODES": "architect,code,debug"
  }
}
```

Default modes:
- `architect` - High-level design and architecture
- `code` - Implementation and coding
- `debug` - Troubleshooting and debugging

### Custom Modes

You can define any custom mode names to match your workflow:

```json
{
  "env": {
    "ALLOWED_MODES": ".net,frontend,api,database"
  }
}
```

Or mix default and custom modes:

```json
{
  "env": {
    "ALLOWED_MODES": "code,debug,.net,react"
  }
}
```

**Note:** The MCP tool schema dynamically reflects the configured allowed modes. For example, if you set `ALLOWED_MODES=.net,frontend`, only those two options will appear in the `modeSlug` enum.

## LLM Configuration (Optional)

For AI-enhanced directive generation:

```json
{
  "env": {
    "LLM_PROVIDER": "local",
    "LLM_ENDPOINT": "http://localhost:11434",
    "LLM_MODEL": "deepseek-coder-v2",
    "ENABLE_DIRECTIVE_GENERATION": "true",
    "ENABLE_SPLITTING": "true"
  }
}
```

## Complete Example

All available configuration options:

```json
{
  "mcpServers": {
    "contextiso": {
      "command": "node",
      "args": ["C:\\git\\contextiso\\build\\index.js"],
      "env": {
        // Neo4j Connection (Required)
        "NEO4J_URI": "neo4j+s://your-instance.databases.neo4j.io",
        "NEO4J_USERNAME": "neo4j",
        "NEO4J_PASSWORD": "your-password",
        "NEO4J_DATABASE": "neo4j",
        
        // Workspace Isolation (Required)
        "WORKSPACE": "my-project",
        
        // Query Directive Options (Optional)
        "QUERY_MAX_ITEMS": "10",
        "QUERY_TOKEN_BUDGET": "2000",
        "QUERY_INCLUDE_METADATA": "true",
        "QUERY_INCLUDE_BREADCRUMBS": "true",
        "QUERY_SEVERITY_FILTER": "MUST,SHOULD",
        
        // Context Detection Options (Optional)
        "DETECT_RETURN_KEYWORDS": "false",
        "DETECT_CONFIDENCE_THRESHOLD": "0.5",
        
        // Document Processing Options (Optional)
        "UPSERT_OVERWRITE": "false",
        "UPSERT_VALIDATE_ONLY": "false",
        
        // Indexing Options (Optional)
        "INDEX_PATHS": "./docs/rules,./guidelines.md,./CONTRIBUTING.md",
        "INDEX_FILE_PATTERN": "**/*.md",
        "INDEX_EXCLUDE_PATTERNS": "**/draft/**,**/archive/**",
        
        // Mode Configuration (Optional)
        "ALLOWED_MODES": "architect,code,debug,.net,react",
        
        // LLM Configuration (Optional)
        "LLM_PROVIDER": "local",
        "LLM_ENDPOINT": "http://localhost:11434",
        "LLM_MODEL": "deepseek-coder-v2",
        "LLM_API_KEY": "your-api-key-if-needed",
        
        // Rule Processing (Optional)
        "ENABLE_SPLITTING": "true",
        "MIN_WORD_COUNT_SPLIT": "250",
        "ENABLE_DIRECTIVE_GENERATION": "true",
        "MIN_WORD_COUNT_GENERATION": "100"
      }
    }
  }
}
```

### Environment Variable Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEO4J_URI` | ✅ | - | Neo4j Aura connection URI |
| `NEO4J_USERNAME` | ✅ | - | Database username |
| `NEO4J_PASSWORD` | ✅ | - | Database password |
| `NEO4J_DATABASE` | ❌ | `"neo4j"` | Database name |
| `WORKSPACE` | ❌ | `"default"` | Workspace identifier for isolation |
| `QUERY_MAX_ITEMS` | ❌ | `8` | Max directives per query |
| `QUERY_TOKEN_BUDGET` | ❌ | `0` | Token budget (0 = disabled) |
| `QUERY_INCLUDE_METADATA` | ❌ | `false` | Include metadata in responses |
| `QUERY_INCLUDE_BREADCRUMBS` | ❌ | `true` | Include source paths in responses |
| `QUERY_SEVERITY_FILTER` | ❌ | - | Severity filter (MUST,SHOULD,MAY) |
| `DETECT_RETURN_KEYWORDS` | ❌ | `false` | Return keywords from context detection |
| `DETECT_CONFIDENCE_THRESHOLD` | ❌ | `0.5` | Min confidence for context detection |
| `UPSERT_OVERWRITE` | ❌ | `false` | Overwrite existing rules on upsert |
| `UPSERT_VALIDATE_ONLY` | ❌ | `false` | Validate without storing |
| `INDEX_PATHS` | ❌ | - | Comma-separated paths to crawl |
| `INDEX_FILE_PATTERN` | ❌ | `**/*.md` | File pattern for indexing |
| `INDEX_EXCLUDE_PATTERNS` | ❌ | - | Exclude patterns for indexing |
| `ALLOWED_MODES` | ❌ | `"architect,code,debug"` | Comma-separated allowed modes |
| `LLM_PROVIDER` | ❌ | `"local"` | LLM provider (local, openai, azure_openai) |
| `LLM_ENDPOINT` | ❌ | `"http://localhost:11434"` | LLM API endpoint |
| `LLM_MODEL` | ❌ | `"deepseek-coder-v2"` | Model name |
| `LLM_API_KEY` | ❌ | - | API key if required |
| `ENABLE_SPLITTING` | ❌ | `false` | Enable document splitting |
| `MIN_WORD_COUNT_SPLIT` | ❌ | `250` | Min words to trigger split |
| `ENABLE_DIRECTIVE_GENERATION` | ❌ | `false` | AI directive generation |
| `MIN_WORD_COUNT_GENERATION` | ❌ | `100` | Min words for AI generation |

## Indexing Rules

Use the `memory.rules.index_rules` tool to crawl and index markdown files:

### Usage

```typescript
// Via MCP tool call - no parameters, paths configured via INDEX_PATHS environment variable
{
  "tool": "memory.rules.index_rules"
}
```

### Slash Command

Many MCP clients support slash commands:
```
/index-rules
```

**Important:** All indexing configuration (including paths) must be set via environment variables in the MCP server configuration.

To configure indexing behavior, set these environment variables:

```json
{
  "env": {
    "INDEX_PATHS": "./docs/rules,./guidelines.md,./CONTRIBUTING.md",
    "INDEX_FILE_PATTERN": "**/*.md",
    "INDEX_EXCLUDE_PATTERNS": "**/draft/**,**/archive/**"
  }
}
```

### Response

```json
{
  "indexed": {
    "rules": 15,
    "sections": 42,
    "directives": 127,
    "patterns": 0
  },
  "filesProcessed": 8,
  "files": ["./docs/coding-standards.md", ...],
  "warnings": [],
  "errors": []
}
```

## Quick Start

1. Build the project: `npm run build`
2. Get Neo4j credentials from https://aura.neo4j.io
3. Add configuration to `.kilocode/mcp.json` with required environment variables:
   - Required: `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`, `WORKSPACE`
   - Optional: `INDEX_PATHS` (required if using index_rules), `QUERY_MAX_ITEMS`, etc.
4. Restart your MCP client
5. Index your rules: Call `memory.rules.index_rules` (paths configured via `INDEX_PATHS` environment variable)

## Notes

- **All tool options must be configured in `mcp.json` environment variables**
- **LLM cannot override these settings** - they are server-side configuration only
- Tool requests only provide the core parameters (userPrompt, text, documents)
- Indexing paths are configured via `INDEX_PATHS` environment variable, not as tool parameters
- Invalid `modeSlug` values are rejected with error
- Configuration changes require MCP server restart
