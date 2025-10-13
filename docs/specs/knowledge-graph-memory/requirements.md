# Requirements Document: Knowledge Graph Memory for AI Coding Assistants

## Introduction

This document defines the requirements for a Knowledge Graph Memory system that provides intelligent, context-aware rule and directive retrieval for AI coding assistants. The system addresses the fundamental challenge of providing comprehensive project context within token limits by using semantic search combined with domain-specific ranking to surface only the most relevant directives for each coding task.

The system will reduce token usage by 70-85% while improving context quality, ensuring AI-generated code consistently follows project-specific security rules, architectural patterns, and coding standards. It extends the open-source Memory MCP Server with three new domain-specific tools and integrates seamlessly with coding assistants like Roo-Cline and Cline.

**Target Users:**
- AI coding assistants (Roo-Cline, Cline)
- Development teams using AI-assisted coding
- DevOps teams managing project rules and standards

**Key Benefits:**
- Reduced context tokens per task from 5,000-15,000 to 800-1,500
- Improved relevant directive surfacing from 30-40% to 85-95%
- Automated context retrieval with minimal setup effort
- Consistent, high-quality AI-generated code

---

## Requirements

### Requirement 1: Knowledge Graph Storage and Management

**User Story:** As a development team, I want project rules and directives stored in a searchable knowledge graph, so that I can maintain version-controlled, centralized project standards that are automatically available to AI coding assistants.

#### Acceptance Criteria

1. WHEN a rule document in markdown format is provided THEN the system SHALL parse it and extract rules, directives, sections, and patterns as graph nodes.

2. WHEN entities are stored in the graph THEN the system SHALL create semantic relationships including:
   - Rule → AuthoritativeFor topics
   - Rule → Layer assignments
   - Directive → Topics
   - Directive → Severity (MUST/SHOULD/MAY)
   - Directive → WhenToApply conditions

3. WHEN rules are ingested THEN the system SHALL generate vector embeddings for semantic search capability.

4. WHEN a rule document uses the standard template format THEN the system SHALL correctly parse:
   - Metadata (Layer, AuthoritativeFor, Topics, Severity)
   - "When to Apply" conditions
   - Individual directives with rationale and examples
   - Related rules references

5. WHEN multiple rule documents reference the same topic THEN the system SHALL maintain consistent topic entities and create appropriate cross-references.

6. WHEN rules are stored THEN the system SHALL persist them in SQLite-based graph database with ACID compliance.

7. IF a rule document contains invalid markdown or missing required fields THEN the system SHALL return validation errors with specific line numbers and field names.

### Requirement 2: Context Detection Engine

**User Story:** As an AI coding assistant, I want the system to automatically detect the architectural layer, relevant topics, and technologies from task descriptions, so that I can retrieve the most appropriate rules without manual classification.

#### Acceptance Criteria

1. WHEN a task description is provided THEN the system SHALL detect the primary architectural layer using pattern matching against:
   - 1-Presentation (keywords: UI, component, page, view, CSS, React, form)
   - 2-Application (keywords: service, business logic, workflow, orchestration)
   - 3-Domain (keywords: entity, aggregate, value object, domain model)
   - 4-Persistence (keywords: database, repository, SQL, query, migration)
   - 5-Tests (keywords: unit test, integration test, E2E, coverage)
   - 6-Docs (keywords: documentation, diagrams, specifications)
   - 7-Deployment (keywords: infrastructure, CI/CD, monitoring, Azure, Docker)

2. WHEN layer detection is ambiguous THEN the system SHALL return multiple candidate layers with confidence scores.

3. WHEN a task description is provided THEN the system SHALL extract relevant topics using NLP and domain dictionaries for:
   - Security (authentication, authorization, encryption, validation, secrets)
   - Testing (unit test, integration test, E2E, coverage, mocking)
   - Performance (optimization, caching, indexing, scaling)
   - API (REST, GraphQL, endpoint, contract, versioning)

4. WHEN a task description mentions specific technologies THEN the system SHALL detect:
   - Languages (C#, TypeScript, Python, JavaScript)
   - Frameworks (React, .NET, Express, FastAPI)
   - Platforms (Azure, AWS, Docker, Kubernetes)

5. WHEN context detection completes THEN the system SHALL return a confidence score between 0.0 and 1.0.

6. IF the confidence score is below 0.6 THEN the system SHALL include a warning about low confidence detection.

7. WHEN context detection is requested with returnKeywords option THEN the system SHALL extract and return key action words and domain terms from the task description.

### Requirement 3: Smart Directive Retrieval and Ranking

**User Story:** As an AI coding assistant, I want to receive only the most relevant directives ranked by importance, so that I can generate code that follows critical project standards without exceeding token budgets.

#### Acceptance Criteria

1. WHEN a task description is provided THEN the system SHALL query the knowledge graph using detected context to retrieve candidate directives.

2. WHEN candidate directives are retrieved THEN the system SHALL rank them using a weighted scoring algorithm:
   - Score = (Authority × 10) + (WhenToApply × 8) + (LayerMatch × 7) + (TopicOverlap × 5) + (SeverityBoost × 4) + (SemanticSim × 3)

3. WHEN calculating Authority score THEN the system SHALL assign 10 points IF the directive's source rule is marked AuthoritativeFor any detected topic.

4. WHEN calculating WhenToApply score THEN the system SHALL assign 8 points IF the directive's WhenToApply conditions match task keywords.

5. WHEN calculating LayerMatch score THEN the system SHALL assign 7 points IF the directive's layer equals detected layer OR the directive applies to all layers (wildcard *).

6. WHEN calculating TopicOverlap score THEN the system SHALL compute Jaccard similarity between directive topics and detected topics, multiplied by 5.

7. WHEN calculating SeverityBoost THEN the system SHALL assign points: MUST=3, SHOULD=2, MAY=1, multiplied by 4.

8. WHEN calculating SemanticSim THEN the system SHALL compute cosine similarity between task embedding and directive embedding, multiplied by 3.

9. WHEN ranking is complete THEN the system SHALL return directives sorted by total score in descending order.

10. WHEN maxItems option is provided THEN the system SHALL return at most the specified number of top-ranked directives.

11. WHEN strictLayer option is true THEN the system SHALL exclude directives that don't match the detected layer (except wildcard layer directives).

### Requirement 4: Token Budget Management

**User Story:** As an AI coding assistant, I want the system to respect token budget limits when returning context, so that I can maintain optimal performance while staying within my context window.

#### Acceptance Criteria

1. WHEN tokenBudget option is provided THEN the system SHALL limit the total output size to approximately the specified token count.

2. WHEN building the context block THEN the system SHALL estimate tokens using the approximation: 1 token ≈ 4 characters for English text.

3. WHEN adding directives to the context block THEN the system SHALL stop adding directives IF the next directive would exceed the token budget.

4. WHEN token budget is specified THEN the system SHALL always include the top 3 MUST directives regardless of budget, up to a maximum of 2000 tokens for safety.

5. WHEN the context block is complete THEN the system SHALL include actual token count in diagnostic information.

6. IF no tokenBudget is specified THEN the system SHALL use a default budget of 900 tokens.

### Requirement 5: MCP Server Extension - query_directives Tool

**User Story:** As an AI coding assistant, I want a single tool call that retrieves context-aware directives, so that I can efficiently obtain relevant rules at the start of every coding task.

#### Acceptance Criteria

1. WHEN memory.rules.query_directives is called with taskDescription THEN the system SHALL:
   - Detect context (layer, topics, technologies)
   - Query the knowledge graph
   - Rank candidate directives
   - Format results within token budget
   - Return formatted context_block

2. WHEN the tool is called with modeSlug parameter THEN the system SHALL use mode-specific behavior if defined (e.g., architect mode prioritizes architectural patterns).

3. WHEN the tool is called THEN the system SHALL return a JSON response containing:
   - context_block (formatted markdown string)
   - citations (array of source references)
   - diagnostics (detection results and retrieval statistics)

4. WHEN includeBreadcrumbs option is true THEN the system SHALL include source path and section information for each directive in the context block.

5. WHEN the context_block is returned THEN it SHALL be formatted with:
   - Header indicating detected context
   - Hierarchical list of directives with severity markers
   - Source citations for traceability
   - Clear, readable markdown structure

6. IF the knowledge graph is empty or unavailable THEN the system SHALL return an error with a clear message about missing rules.

7. WHEN the tool completes successfully THEN the system SHALL include retrieval statistics showing: total directives searched, candidates considered, and final directives selected.

### Requirement 6: MCP Server Extension - detect_context Tool

**User Story:** As a developer testing the system, I want a standalone context detection tool, so that I can verify and tune the context detection engine independently.

#### Acceptance Criteria

1. WHEN memory.rules.detect_context is called with task text THEN the system SHALL analyze the text and return:
   - detectedLayer (string)
   - topics (array of strings)
   - confidence (number between 0.0 and 1.0)

2. WHEN returnKeywords option is true THEN the system SHALL also return an array of extracted keywords.

3. WHEN the tool is called THEN the system SHALL complete context detection within 200ms (95th percentile).

4. WHEN detection confidence is below 0.6 THEN the system SHALL include a warning in the response.

5. IF the input text is empty or null THEN the system SHALL return an error indicating invalid input.

### Requirement 7: MCP Server Extension - upsert_markdown Tool

**User Story:** As a development team, I want a simplified tool to ingest rule documents into the knowledge graph, so that I can quickly populate and update project rules without manual graph operations.

#### Acceptance Criteria

1. WHEN memory.rules.upsert_markdown is called with document paths THEN the system SHALL:
   - Read each markdown file
   - Parse the rule document structure
   - Extract entities (rules, sections, directives, patterns)
   - Create or update graph nodes
   - Establish semantic relationships

2. WHEN overwrite option is true THEN the system SHALL replace existing rules with the same name.

3. WHEN overwrite option is false or not provided THEN the system SHALL merge new directives with existing rules.

4. WHEN ingestion completes THEN the system SHALL return statistics showing:
   - Number of rules upserted
   - Number of sections created
   - Number of directives added
   - Number of patterns extracted
   - Number of relations established
   - Any warnings or validation errors

5. WHEN a document contains markdown parsing errors THEN the system SHALL continue processing other documents and include errors in the warnings array.

6. WHEN a document path is invalid or file doesn't exist THEN the system SHALL include a specific error for that document and continue processing remaining documents.

7. WHEN ingestion completes successfully THEN the system SHALL generate vector embeddings for all new directives.

### Requirement 8: Rule Document Format Support

**User Story:** As a development team, I want to author rules in structured markdown format, so that I can maintain readable, version-controlled project standards that the system can automatically ingest.

#### Acceptance Criteria

1. WHEN a rule document is provided THEN it SHALL support a standard template format with sections:
   - Metadata (Layer, AuthoritativeFor, Topics, Severity)
   - "When to Apply" conditions
   - Directives with subsections
   - Related rules references

2. WHEN parsing directive sections THEN the system SHALL extract:
   - Severity markers ([MUST], [SHOULD], [MAY])
   - Directive description
   - Rationale (if present)
   - Code examples (if present)
   - Anti-patterns (if present)

3. WHEN parsing metadata THEN the system SHALL validate:
   - Layer is one of: 1-Presentation, 2-Application, 3-Domain, 4-Persistence, 5-Tests, 6-Docs, 7-Deployment, or * (wildcard)
   - Severity is one of: MUST, SHOULD, MAY
   - Topics is an array of strings
   - AuthoritativeFor is an array of topic strings

4. WHEN code examples are present THEN the system SHALL preserve language-specific formatting and syntax highlighting markers.

5. IF a required metadata field is missing THEN the system SHALL return a validation error specifying the missing field.

6. WHEN "When to Apply" section is present THEN the system SHALL parse bullet points as individual conditions.

### Requirement 9: Integration with Coding Assistants

**User Story:** As an AI coding assistant, I want clear integration instructions and fallback behavior, so that I can reliably retrieve context even when the memory system is unavailable.

#### Acceptance Criteria

1. WHEN the memory MCP server is configured THEN coding assistants SHALL be able to discover and call the three extended tools.

2. WHEN the system prompt is updated THEN it SHALL instruct the assistant to call query_directives at the start of every coding task.

3. WHEN the memory system is unavailable THEN the assistant SHALL fall back to a minimal set of core rules (validation, security, maintainability).

4. WHEN a coding task begins THEN the assistant SHALL prepend the returned context_block to its working context before generating code.

5. WHEN generating code THEN the assistant SHALL prioritize MUST directives as non-negotiable requirements.

6. WHEN the tool call fails THEN the system SHALL log the error and continue with fallback rules rather than blocking the task.

### Requirement 10: Performance and Scalability

**User Story:** As a development team with hundreds of rules, I want the system to handle large rule sets efficiently, so that context retrieval remains fast as our standards grow.

#### Acceptance Criteria

1. WHEN a task invokes query_directives THEN the system SHALL complete the entire operation (detect, query, rank, format) within 400ms at 95th percentile.

2. WHEN the knowledge graph contains 500+ rules and 2000+ directives THEN query performance SHALL remain under 400ms.

3. WHEN ingesting rules THEN the system SHALL process at least 50 directives per second.

4. WHEN the same task is queried multiple times THEN the system SHOULD cache detection results for 5 minutes to improve performance.

5. WHEN concurrent queries are made THEN the system SHALL handle at least 10 simultaneous query_directives calls without degradation.

6. WHEN the graph database size exceeds 100MB THEN the system SHALL maintain query performance within acceptable limits.

### Requirement 11: Error Handling and Resilience

**User Story:** As an AI coding assistant, I want clear error messages and graceful degradation, so that I can handle failures without disrupting the user's workflow.

#### Acceptance Criteria

1. WHEN the knowledge graph is empty THEN query_directives SHALL return an error with message: "Knowledge graph is empty. Please ingest rule documents using memory.rules.upsert_markdown."

2. WHEN vector embeddings fail to generate THEN the system SHALL fall back to keyword-based matching and include a warning.

3. WHEN context detection confidence is very low (<0.3) THEN the system SHALL still return results but include a prominent warning.

4. WHEN a rule document is malformed THEN upsert_markdown SHALL provide specific validation errors with line numbers.

5. WHEN the SQLite database is corrupted THEN the system SHALL detect the corruption and suggest database recovery steps.

6. WHEN an MCP tool call times out THEN the system SHALL return a partial result if possible, with a timeout warning.

7. WHEN rate limiting would apply THEN the system SHALL return a 429 error with retry-after information.

### Requirement 12: Observability and Diagnostics

**User Story:** As a development team, I want detailed diagnostics and logging, so that I can troubleshoot issues and optimize rule retrieval.

#### Acceptance Criteria

1. WHEN query_directives completes THEN it SHALL return diagnostic information including:
   - detectedLayer
   - topics array
   - retrievalStats (searched, considered, selected counts)
   - confidence score
   - execution time in milliseconds

2. WHEN the system processes a query THEN it SHALL log:
   - Task description (sanitized, first 100 chars)
   - Detected context
   - Number of candidates retrieved
   - Top 5 directive scores
   - Total execution time

3. WHEN upsert_markdown completes THEN it SHALL log:
   - Number of documents processed
   - Success/failure count
   - Validation warnings
   - Processing time

4. WHEN an error occurs THEN the system SHALL log structured error information including:
   - Error type
   - Error message
   - Stack trace (in debug mode)
   - Context that triggered the error

5. WHEN logging user input THEN the system SHALL sanitize input to prevent log injection attacks.

### Requirement 13: Security and Data Protection

**User Story:** As a security-conscious development team, I want the system to handle rule documents securely, so that sensitive project information is protected.

#### Acceptance Criteria

1. WHEN rule documents are ingested THEN the system SHALL never log full document contents, only metadata and statistics.

2. WHEN API keys or tokens are mentioned in rule examples THEN the system SHALL redact them in logs using pattern matching.

3. WHEN file paths are provided THEN the system SHALL validate paths to prevent directory traversal attacks.

4. WHEN user input is processed THEN the system SHALL sanitize all input before use in SQL queries or system commands.

5. WHEN the knowledge graph database is created THEN it SHALL have appropriate file permissions (owner read/write only on Unix systems).

6. IF rule documents contain actual secrets (not examples) THEN the ingestion process SHALL flag them with a security warning.

---

## Non-Functional Requirements

### Performance
- Context retrieval: <400ms at P95
- Rule ingestion: >50 directives/second
- Concurrent queries: Support 10+ simultaneous requests

### Scalability
- Support 500+ rules and 2000+ directives without performance degradation
- Database size up to 500MB with efficient querying

### Reliability
- 99.9% uptime for query operations
- Graceful degradation when vector embeddings unavailable
- ACID compliance for all graph operations

### Maintainability
- Clear, documented markdown format for rules
- Validation feedback with specific error locations
- Version-controlled rule storage

### Security
- Input sanitization on all user-provided content
- Path validation to prevent traversal attacks
- Secure handling of rule documents
- No secrets in logs

---

## Glossary

- **Directive**: A specific rule statement with severity (MUST/SHOULD/MAY) that guides code generation
- **EARS Format**: Easy Approach to Requirements Syntax - structured requirement format
- **Knowledge Graph**: Graph database storing rules, directives, and their semantic relationships
- **MCP Server**: Model Context Protocol server providing tools to AI assistants
- **Semantic Search**: Search based on meaning using vector embeddings rather than keyword matching
- **Token Budget**: Maximum number of tokens allocated for context in AI prompts
- **Context Detection**: Automatic identification of architectural layer, topics, and technologies from task descriptions