# ContextISO Rule Management Implementation - Phases 1-4

**Project:** ContextISO (Context Isolation & Optimization)  
**Status:** Ready for Implementation  
**Target Completion:** 2-3 weeks  
**Priority:** High

---

## 🎯 Overview

This todo outlines the implementation of the rule management system (Phases 1-4) that transforms ContextISO from a memory system into a full context optimization platform. The result will be a production-ready system that delivers precisely targeted contextual information to LLMs.

### Success Criteria
- ✅ All 4 phases completed
- ✅ 95%+ test coverage for new code
- ✅ Integration tests passing (all requirements)
- ✅ Performance benchmarks met (<400ms for rule queries)
- ✅ Documentation complete

---

## 📋 PHASE 1: Rule Document Ingestion (2-3 days)

### 1.1 Markdown Parser Engine
- [ ] Create `src/parsing/markdown-parser.ts`
  - [ ] Parse markdown rule documents into AST
  - [ ] Extract sections (h1, h2, h3 headers)
  - [ ] Identify code blocks and examples
  - [ ] Parse metadata blocks (YAML front matter or special comments)
  - [ ] Handle nested sections and subsections
  - [ ] Normalize whitespace and formatting
  - [ ] Add unit tests for parser

**Acceptance Criteria:**
- Can parse standard markdown files
- Extracts all header levels
- Preserves code blocks verbatim
- Handles edge cases (empty sections, special chars)
- Test coverage: >90%

### 1.2 Metadata & Directive Extraction
- [ ] Create `src/parsing/directive-extractor.ts`
  - [ ] Extract directives (marked with [MUST], [SHOULD], [MAY])
  - [ ] Parse severity levels and categorization
  - [ ] Extract metadata from directives:
    - [ ] Author/Owner
    - [ ] Applicable topics (security, testing, performance, API, etc.)
    - [ ] Architectural layers (1-Presentation through 7-Deployment)
    - [ ] Last updated date
    - [ ] Related technologies/frameworks
  - [ ] Create structured directive objects
  - [ ] Validate directive format
  - [ ] Add unit tests

**Schema for Extracted Directive:**
```typescript
interface Directive {
  id: string;                    // UUID or hash
  content: string;               // Directive text
  severity: 'MUST' | 'SHOULD' | 'MAY';
  topics: string[];             // ['security', 'performance', ...]
  layers: string[];             // ['1-Presentation', '3-Data', ...]
  technologies: string[];        // ['React', 'Node.js', ...]
  section: string;              // "2.1 API Design"
  subsection?: string;
  context?: string;             // Surrounding paragraph
  lineNumber: number;
}
```

**Acceptance Criteria:**
- Extracts all directive types
- Correctly categorizes by severity
- Parses metadata accurately
- Handles missing metadata gracefully
- Test coverage: >90%

### 1.3 Graph Building & Validation
- [ ] Create `src/parsing/graph-builder.ts`
  - [ ] Convert parsed document into graph structure
  - [ ] Create rule nodes with properties
  - [ ] Create section nodes
  - [ ] Create directive nodes
  - [ ] Establish relationships (CONTAINS, HAS_DIRECTIVE, etc.)
  - [ ] Validate graph integrity
  - [ ] Detect cycles or conflicts
  - [ ] Add unit tests

**Relationships to Create:**
```
RuleDocument -[CONTAINS]-> Section
Section -[CONTAINS]-> Subsection
Section -[HAS_DIRECTIVE]-> Directive
Directive -[APPLIES_TO_LAYER]-> Layer
Directive -[APPLIES_TO_TECHNOLOGY]-> Technology
Directive -[APPLIES_TO_TOPIC]-> Topic
```

**Acceptance Criteria:**
- Creates correct node/relationship structure
- Validates against schema
- Reports validation errors clearly
- Handles nested sections
- Test coverage: >90%

### 1.4 Upsert & Batch Operations
- [ ] Implement `upsertMarkdown()` in RuleManager
  - [ ] Accept multiple documents
  - [ ] Parse each document
  - [ ] Build graph representation
  - [ ] Check for existing documents (by path or ID)
  - [ ] Create/update relationships without duplicating
  - [ ] Batch insert into Neo4j (transaction safety)
  - [ ] Report success/failure per document
  - [ ] Track metrics (rules created, updated, skipped)
  - [ ] Handle partial failures gracefully
  - [ ] Add integration tests

**Input Schema:**
```typescript
interface UpsertMarkdownInput {
  documents: Array<{
    path: string;           // File path identifier
    content: string;        // Markdown content
  }>;
  options?: {
    overwrite?: boolean;    // Replace if exists
    validateOnly?: boolean; // Parse without storing
  };
}
```

**Output Schema:**
```typescript
interface UpsertMarkdownOutput {
  upserted: {
    rules: number;         // New/updated rules
    sections: number;
    directives: number;
    patterns: number;
  };
  relations: number;       // Created relationships
  warnings: string[];
  errors: string[];
  timestamp: string;
}
```

**Acceptance Criteria:**
- Processes multiple documents
- Handles transactions correctly
- Reports detailed results
- Manages overwrites properly
- Graceful error handling
- Integration tests passing

---

## 📋 PHASE 2: Context Detection Engine (2-3 days)

### 2.1 Architectural Layer Detection
- [ ] Create `src/detection/layer-detector.ts`
  - [ ] Analyze task/code text for layer indicators
  - [ ] Map keywords to architectural layers (1-7)
  - [ ] Extract layer markers (UI, API, database, etc.)
  - [ ] Combine multiple signals for layer detection
  - [ ] Return detected layer with confidence score
  - [ ] Provide alternative layers if confidence < threshold
  - [ ] Add unit tests

**Layer Mapping:**
```
1-Presentation:     UI, frontend, view, component, template
2-Application:      service, use case, business logic, handler
3-Domain:           entity, model, domain object, aggregate
4-Persistence:      repository, dao, database access
5-Integration:      API client, external service, adapter
6-Infrastructure:   config, logging, messaging, caching
7-Deployment:       containerization, orchestration, cloud
```

**Acceptance Criteria:**
- Correctly identifies layers from text
- Provides confidence scores
- Handles multi-layer scenarios
- Returns alternatives when needed
- Confidence calculation accurate
- Test coverage: >85%

### 2.2 Technology/Framework Extraction
- [ ] Create `src/detection/tech-detector.ts`
  - [ ] Maintain registry of known technologies
  - [ ] Extract tech mentions from text
  - [ ] Match fuzzy (handle variations: "React" vs "ReactJS" vs "React.js")
  - [ ] Return list of detected technologies
  - [ ] Provide categories (frontend, backend, database, etc.)
  - [ ] Add unit tests

**Technology Registry Structure:**
```typescript
interface TechEntry {
  name: string;
  aliases: string[];      // ["React", "ReactJS", "React.js"]
  category: string;       // "frontend", "backend", "database"
  keywords: string[];     // ["component", "jsx", "hooks"]
}
```

**Acceptance Criteria:**
- Detects common tech stack items
- Handles aliases/variations
- Returns categorized results
- Minimal false positives
- Test coverage: >80%

### 2.3 Topic Identification
- [ ] Create `src/detection/topic-detector.ts`
  - [ ] Define topic categories (security, testing, performance, API, etc.)
  - [ ] Extract topic indicators from text
  - [ ] Use semantic similarity for fuzzy matching
  - [ ] Return topics with confidence scores
  - [ ] Handle domain-specific terminology
  - [ ] Add unit tests

**Topic Categories:**
```
- security (auth, encryption, vulnerabilities, OWASP)
- testing (unit, integration, e2e, coverage, TDD)
- performance (optimization, caching, latency, throughput)
- api (rest, graphql, grpc, versioning)
- database (schema, migration, query, backup)
- deployment (containers, ci/cd, environments)
- documentation (comments, readme, API docs)
- accessibility (a11y, wcag, inclusive design)
```

**Acceptance Criteria:**
- Identifies all major topics
- Handles multiple topics per task
- Confidence scoring works
- Minimal false positives
- Test coverage: >80%

### 2.4 Context Detection Integration
- [ ] Implement `detectContext()` in RuleManager
  - [ ] Combine layer, tech, and topic detection
  - [ ] Return structured context object
  - [ ] Include confidence scores
  - [ ] Provide keywords if requested
  - [ ] Handle alternative contexts
  - [ ] Performance: <200ms for typical input
  - [ ] Add integration tests

**Output Schema:**
```typescript
interface DetectContextOutput {
  detectedLayer: string;           // "3-Domain" or "*" if uncertain
  confidence: number;              // 0-1
  topics: string[];
  technologies: string[];
  keywords?: string[];             // If returnKeywords=true
  alternativeContexts?: Array<{
    layer: string;
    confidence: number;
    topics: string[];
    technologies: string[];
  }>;
  timestamp: string;
}
```

**Acceptance Criteria:**
- All detectors integrated
- Performance target met
- Accurate context identification
- Proper fallback handling
- Integration tests passing

---

## 📋 PHASE 3: Intelligent Rule Ranking (2-3 days)

### 3.1 Scoring Algorithm
- [ ] Create `src/ranking/scoring-engine.ts`
  - [ ] Implement severity-based scoring (MUST=100, SHOULD=50, MAY=25)
  - [ ] Implement relevance scoring (exact match > keyword match > fuzzy)
  - [ ] Implement layer matching score (exact=100, adjacent=50, distant=10)
  - [ ] Implement topic matching score (per topic matched)
  - [ ] Implement technology matching score
  - [ ] Implement authoritativeness scoring
  - [ ] Create weighted combination function
  - [ ] Allow tuning of weights
  - [ ] Add unit tests

**Scoring Formula:**
```
total_score = (
  severity_score * 0.30 +
  relevance_score * 0.25 +
  layer_score * 0.20 +
  topic_score * 0.15 +
  authoritativeness_score * 0.10
)

normalized_score = total_score / 100
```

**Weights Configuration:**
```typescript
interface ScoringWeights {
  severity: number;           // 0-1, default 0.30
  relevance: number;          // 0-1, default 0.25
  layerMatch: number;         // 0-1, default 0.20
  topicMatch: number;         // 0-1, default 0.15
  authoritativeness: number;  // 0-1, default 0.10
}
```

**Acceptance Criteria:**
- Scoring formula correct
- Weights configurable
- Handles edge cases
- Results are normalized 0-1
- Test coverage: >90%

### 3.2 Ranking Query Engine
- [ ] Create `src/ranking/ranking-engine.ts`
  - [ ] Query Neo4j for all relevant directives
  - [ ] Apply scoring to each directive
  - [ ] Sort by score (descending)
  - [ ] Apply filters (severity, layer, etc.)
  - [ ] Limit results (maxItems)
  - [ ] Calculate token budget
  - [ ] Rank by score then by authoritativeness
  - [ ] Add unit tests

**Cypher Query Pattern:**
```cypher
MATCH (d:Directive)
WHERE d.topics IN $topics 
   OR d.layers IN $layers 
   OR d.technologies IN $technologies
OPTIONAL MATCH (rule:Rule)-[rel:HAS_DIRECTIVE]->(d)
RETURN d, rule, collect(rel) as directives
ORDER BY d.score DESC
LIMIT $maxItems
```

**Acceptance Criteria:**
- Correct query generation
- Proper filtering
- Score ordering works
- Performance: <300ms
- Test coverage: >85%

### 3.3 Severity Prioritization
- [ ] Implement severity-based filtering in RuleManager
  - [ ] MUST directives always included (if space)
  - [ ] SHOULD directives next priority
  - [ ] MAY directives lowest priority
  - [ ] Respect severityFilter parameter
  - [ ] Document prioritization logic
  - [ ] Add unit tests

**Prioritization Logic:**
```
1. Include ALL directives with severity MUST
2. If space allows, add SHOULD directives by score
3. If space allows, add MAY directives by score
4. Respect token budget: stop when approaching limit
```

**Acceptance Criteria:**
- Correct prioritization order
- Severity filter working
- Token budget respected
- Results deterministic
- Test coverage: >90%

### 3.4 Token Budget Management
- [ ] Create `src/ranking/token-counter.ts`
  - [ ] Estimate tokens per directive
  - [ ] Track cumulative tokens
  - [ ] Stop adding directives when approaching budget
  - [ ] Return token count with results
  - [ ] Handle edge cases (very large directives)
  - [ ] Add unit tests

**Token Estimation:**
```
tokens ≈ text_length / 4  // Rough approximation
Can be tuned with actual tokenizer later
```

**Acceptance Criteria:**
- Token counting accurate (±10%)
- Budget respected
- Edge cases handled
- Configurable budget
- Test coverage: >85%

---

## 📋 PHASE 4: Smart Context Retrieval (2-3 days)

### 4.1 Query Directive Implementation
- [ ] Fully implement `queryDirectives()` in RuleManager
  - [ ] Call detectContext() on task description
  - [ ] Build ranking query from detected context
  - [ ] Execute ranking/filtering
  - [ ] Format results as context block
  - [ ] Include citations if requested
  - [ ] Provide diagnostics/metadata
  - [ ] Add integration tests

**Complete Flow:**
```
Input: taskDescription + options
  ↓
detectContext(taskDescription)
  ↓
queryDirectives() using detected context
  ↓
applyRanking() with scoring algorithm
  ↓
formatContextBlock() with markdown
  ↓
Output: formatted block + metadata
```

**Acceptance Criteria:**
- Full implementation complete
- All parameters working
- Context detection accurate
- Results properly ranked
- Formatting correct
- Integration tests passing

### 4.2 Context Block Formatter
- [ ] Create `src/formatting/context-formatter.ts`
  - [ ] Generate markdown context block
  - [ ] Include detected context info
  - [ ] Group directives by section
  - [ ] Format with severity indicators
  - [ ] Add breadcrumb/citation info
  - [ ] Handle special characters/escaping
  - [ ] Optimize for LLM readability
  - [ ] Add unit tests

**Context Block Template:**
```markdown
# Contextual Rules

**Detected Context:**
- Layer: 3-Domain
- Topics: security, testing, API
- Technologies: TypeScript, Node.js

## Critical (MUST) Directives

### API Design & Security
- **[MUST]** All endpoints require authentication
  *Applies to: API, Security*
  *Source: API-Guidelines.md → Security Section*

## Recommended (SHOULD) Directives

### Performance Optimization
- **[SHOULD]** Implement request caching for GET endpoints
  *Applies to: API, Performance*
  *Source: API-Guidelines.md → Performance Section*

## Optional (MAY) Directives

### Documentation
- **[MAY]** Include OpenAPI/Swagger definitions
  *Applies to: Documentation, API*
  *Source: API-Guidelines.md → Documentation Section*

---
**Retrieved:** 3/8 rules (2500 tokens) | **Source:** API-Guidelines.md
```

**Acceptance Criteria:**
- Clean, readable markdown
- Proper grouping and hierarchy
- All metadata included
- Citations formatted correctly
- Escaping works for special chars
- Test coverage: >85%

### 4.3 Citation & Breadcrumb Generation
- [ ] Create `src/formatting/citation-generator.ts`
  - [ ] Generate file path references
  - [ ] Include section hierarchy
  - [ ] Track line numbers (if available)
  - [ ] Create clickable references (if applicable)
  - [ ] Handle missing metadata gracefully
  - [ ] Format consistently
  - [ ] Add unit tests

**Citation Format:**
```
Source: API-Guidelines.md → Security Section → Authentication [Line 42]
```

**Acceptance Criteria:**
- Citations accurate
- Hierarchical breadcrumbs
- Consistent formatting
- Handles missing data
- Test coverage: >80%

### 4.4 Fallback & Error Handling
- [ ] Implement fallback responses
  - [ ] Core programming principles (when no rules found)
  - [ ] Layer defaults (when detection fails)
  - [ ] Graceful degradation
  - [ ] Error logging
  - [ ] User-friendly error messages
  - [ ] Add integration tests

**Fallback Responses:**
```typescript
const CORE_PRINCIPLES = [
  '[MUST] Write clean, readable code',
  '[MUST] Add tests for new functionality',
  '[MUST] Follow the project code style guide',
  '[SHOULD] Include documentation for public APIs',
  '[SHOULD] Consider performance implications'
];
```

**Acceptance Criteria:**
- Fallbacks provided when needed
- No crashes on errors
- Clear error messages
- Logging working
- Integration tests passing

### 4.5 Mode-Based Context Influence
- [ ] Implement mode support in queryDirectives
  - [ ] **architect mode**: High-level design focus, prioritize architectural patterns
  - [ ] **code mode**: Implementation focus, prioritize coding standards
  - [ ] **debug mode**: Troubleshooting focus, prioritize error handling
  - [ ] Apply mode-specific scoring adjustments
  - [ ] Document mode behavior
  - [ ] Add integration tests

**Mode Adjustments:**
```typescript
const modeScoreAdjustments = {
  architect: {
    'architecture': 1.5,
    'design-pattern': 1.5,
    'scalability': 1.2,
    'testing': 0.8
  },
  code: {
    'coding-standard': 1.5,
    'testing': 1.3,
    'performance': 1.1,
    'architecture': 0.8
  },
  debug: {
    'error-handling': 1.5,
    'logging': 1.3,
    'testing': 1.2,
    'documentation': 0.8
  }
};
```

**Acceptance Criteria:**
- All 3 modes working
- Score adjustments applied
- Results match mode intent
- Integration tests passing

---

## 🧪 TESTING & VALIDATION

### Unit Tests (All Phases)
- [ ] Parser tests (50+ test cases)
- [ ] Detector tests (60+ test cases)
- [ ] Scoring tests (50+ test cases)
- [ ] Formatting tests (40+ test cases)
- [ ] **Target Coverage: >90%**

### Integration Tests
- [ ] End-to-end rule ingestion test
- [ ] End-to-end context detection test
- [ ] End-to-end query directive test
- [ ] Multi-document ingestion test
- [ ] Performance tests (all <400ms)
- [ ] Error handling scenarios
- [ ] **Target: 15+ integration tests**

### Sample Test Data
- [ ] Create 3-5 sample rule documents
- [ ] Various topic/layer combinations
- [ ] Edge cases and special characters
- [ ] Large documents (500+ directives)

### Documentation Tests
- [ ] API documentation complete
- [ ] Examples working and tested
- [ ] README updated
- [ ] Architecture documented

---

## 📊 DELIVERABLES

### Code
- [ ] Complete `src/parsing/` directory
- [ ] Complete `src/detection/` directory
- [ ] Complete `src/ranking/` directory
- [ ] Complete `src/formatting/` directory
- [ ] Updated RuleManager with full implementations
- [ ] >90% unit test coverage

### Tests
- [ ] 200+ unit tests
- [ ] 15+ integration tests
- [ ] All tests passing
- [ ] Performance benchmarks met

### Documentation
- [ ] Phase implementation guide
- [ ] API reference (rules)
- [ ] Architecture diagrams
- [ ] Usage examples
- [ ] Troubleshooting guide

### Performance
- [ ] Rule ingestion: <2s for 100 rules
- [ ] Context detection: <200ms
- [ ] Query directives: <400ms
- [ ] Token counting: <50ms

---

## 🚀 IMPLEMENTATION ROADMAP

### Week 1: Phase 1 (Rule Ingestion)
- Days 1-2: Parser + Extractor
- Days 3-4: Graph Builder + Upsert
- Day 5: Integration + Tests

### Week 2: Phase 2-3 (Detection + Ranking)
- Days 1-2: Layer + Tech + Topic Detection
- Days 3-4: Scoring Algorithm
- Day 5: Integration + Tests

### Week 3: Phase 4 (Smart Retrieval)
- Days 1-2: Query Implementation + Formatting
- Days 3-4: Error Handling + Mode Support
- Day 5: Final Testing + Documentation

### Post-Implementation
- Bug fixes and optimization
- Performance tuning
- Community feedback integration
- Release preparation

---

## ✅ COMPLETION CRITERIA

Project is **COMPLETE** when:
1. ✅ All 4 phases fully implemented
2. ✅ 200+ unit tests (>90% coverage)
3. ✅ 15+ integration tests (all passing)
4. ✅ All performance benchmarks met
5. ✅ Complete documentation
6. ✅ Zero critical issues
7. ✅ Code reviewed and approved
8. ✅ Ready for production deployment

---

## 📞 SUCCESS METRICS

After completion, ContextISO will:
- ✨ Ingest markdown rule documents with 100% accuracy
- 🎯 Detect architectural context with 90%+ accuracy
- 📊 Rank rules intelligently using sophisticated scoring
- 📋 Return optimized context blocks in <400ms
- 🛡️ Handle errors gracefully with meaningful fallbacks
- 📈 Reduce token usage by 70-85% while improving relevance to 85-95%

---

**Status:** Ready to implement  
**Estimated Duration:** 2-3 weeks  
**Last Updated:** October 16, 2025  
**Version:** 1.0
