# Knowledge Graph Usage Guide

## Overview

The Knowledge Graph system provides intelligent, context-aware retrieval of project rules and guidelines. Instead of sending all rule content with each task, the system analyzes task descriptions to detect architectural layers and topics, then retrieves only the most relevant directives from the knowledge graph.

## How It Works

### 1. Task Analysis
When a task begins, the system:
- Analyzes the task description for keywords
- Detects the architectural layer (0-Base through 7-Deployment)
- Identifies relevant topics (security, testing, architecture, etc.)
- Calculates confidence in the detection

### 2. Query Construction
The system builds a retrieval query combining:
- Semantic search terms from the task description
- Layer filters (e.g., "1-Presentation")
- Topic filters (e.g., "security", "testing")
- Entity type preferences (Directive > Rule > Section)

### 3. Ranked Retrieval
Results are scored by relevance:
1. **Authority match** (highest priority) - Rules authoritative for detected topics
2. **When to apply match** - Rules specifying the detected layer/context
3. **Layer match** - Rules applying to the detected architectural layer
4. **Topic match** - Rules covering detected topics
5. **Severity boost** - Must > Should > May directives
6. **Semantic similarity** - Keyword matching in content

### 4. Response Formatting
Top results are formatted as compact directives with:
- The directive text
- Severity level (must/should/may)
- Source document
- Breadcrumb navigation
- Relevance rationale

## Usage Workflow

### For Task Execution
1. **Task Start**: System automatically analyzes task description
2. **Context Retrieval**: Relevant rules are fetched from knowledge graph
3. **Guided Execution**: Rules are presented as contextual guidance
4. **Compliance Check**: System can verify rule adherence during execution

### For Rule Updates
1. **File Changes**: VS Code watcher detects rule file modifications
2. **Incremental Update**: Only changed entities are updated in graph
3. **Validation**: System verifies graph consistency
4. **Notification**: Users are notified of rule updates

## Example Output

For task "implement new API endpoint for user authentication":

```
1. [MUST] Authorize every action after authentication check
   Source: Security General Rule
   Breadcrumb: Security General Rule > Authentication And Authorization
   Rationale: applies to 1-Presentation layer; covers security topics; authoritative for security

2. [MUST] Validate all user inputs on both client and server
   Source: Security General Rule
   Breadcrumb: Security General Rule > Input Validation And Sanitization
   Rationale: applies to 1-Presentation layer; covers security topics; authoritative for security

3. [MUST] All business logic must be covered by unit tests
   Source: Testing General Rule
   Breadcrumb: Testing General Rule > Unit Testing
   Rationale: covers testing topics; authoritative for testing

4. [MUST] Presentation layer calls into Application only
   Source: Architecture General
   Breadcrumb: Architecture General > Presentation Layer
   Rationale: applies to 1-Presentation layer; covers architecture topics; authoritative for architecture
```

## Maintenance Procedures

### Initial Setup
1. Run the knowledge graph crawler: `npm run crawl-knowledge`
2. Verify entities created in MCP memory server
3. Run integration tests to validate retrieval

### Ongoing Maintenance
1. **Rule Updates**: Modify `.kilocode/rules/*.md` files as needed
2. **Automatic Sync**: File watcher triggers incremental updates
3. **Manual Sync**: Run `npm run sync-knowledge` for full refresh
4. **Validation**: Run `npm run test-knowledge` to verify functionality

### Troubleshooting
- **Low confidence detections**: Review task description keywords
- **Missing rules**: Check if crawler parsed the updated files
- **Irrelevant results**: Adjust scoring weights or add more specific keywords
- **Performance issues**: Implement caching for frequently accessed rules

## Technical Implementation

### Components
- **Crawler** (`knowledge-graph-crawler.ts`): Parses markdown into entities
- **Context Detector** (`task-context-detector.ts`): Analyzes task descriptions
- **Query Builder** (`query-builder.ts`): Constructs retrieval queries
- **Ranked Retrieval** (`ranked-retrieval.ts`): Scores and ranks results
- **Response Formatter** (`response-formatter.ts`): Formats compact output

### MCP Integration
- Uses `memory` server for entity storage and retrieval
- `create_entities` for initial population
- `create_relations` for linking entities
- `search_nodes` for semantic retrieval with filters

### File Structure
```
0-Base/
├── knowledge-graph-crawler.ts    # Main crawler script
├── task-context-detector.ts      # Task analysis
├── query-builder.ts              # Query construction
├── ranked-retrieval.ts           # Scoring and ranking
├── response-formatter.ts         # Output formatting
└── integration-test.ts           # Validation tests
```

## Benefits

1. **Reduced Context Length**: Only relevant rules sent per task
2. **Improved Relevance**: Context-aware retrieval based on task analysis
3. **Automatic Updates**: File watchers keep knowledge current
4. **Scalable**: Handles growing rule sets efficiently
5. **Auditable**: Clear source attribution for all directives
6. **Testable**: Integration tests verify correct rule surfacing