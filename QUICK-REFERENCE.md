# Quick Reference: Phases 1-4 Implementation

**Bookmark this!** Quick lookup for all specifications.

---

## 📌 Phase 1: Rule Ingestion (2-3 days)

### What to build:
1. **Markdown Parser** → Parse docs into AST
2. **Directive Extractor** → Extract [MUST/SHOULD/MAY] with metadata  
3. **Graph Builder** → Create Neo4j relationships
4. **Upsert Function** → Store in database

### Key Schema (Directive):
```typescript
interface Directive {
  id: string;
  content: string;
  severity: 'MUST' | 'SHOULD' | 'MAY';  // CRITICAL
  topics: string[];                     // security, testing, api, etc.
  layers: string[];                     // 1-Presentation to 7-Deployment
  technologies: string[];               // React, Node.js, etc.
  section: string;
  lineNumber: number;
}
```

### Files to create:
```
src/parsing/markdown-parser.ts
src/parsing/directive-extractor.ts
src/parsing/graph-builder.ts
```

### Tests needed:
- 50+ unit tests (>90% coverage)
- 2+ integration tests

### Performance target:
- Parse: <500ms per 100KB
- Upsert: <2s for 100 rules

---

## 📌 Phase 2: Context Detection (2-3 days)

### What to build:
1. **Layer Detector** → 1-Presentation to 7-Deployment
2. **Tech Detector** → React, Node.js, etc. (with fuzzy matching)
3. **Topic Detector** → security, testing, performance, api, etc.
4. **Integration** → Combine all 3

### Layer Mapping Quick Ref:
```
1-Presentation    UI, frontend, view, component, template
2-Application     service, business logic, handler
3-Domain          entity, model, domain object
4-Persistence     repository, database access
5-Integration     API client, external service
6-Infrastructure  config, logging, caching
7-Deployment      containers, orchestration
```

### Topic Categories:
```
security, testing, performance, api, database
deployment, documentation, accessibility
```

### Output (DetectContext):
```typescript
interface DetectContextOutput {
  detectedLayer: string;              // "3-Domain"
  confidence: number;                 // 0-1
  topics: string[];
  technologies: string[];
  keywords?: string[];
  alternativeContexts?: Array<{...}>;
}
```

### Files to create:
```
src/detection/layer-detector.ts
src/detection/tech-detector.ts
src/detection/topic-detector.ts
```

### Tests needed:
- 60+ unit tests (>80% coverage)
- 2+ integration tests

### Performance target:
- Detection: <200ms per task

---

## 📌 Phase 3: Ranking (2-3 days)

### What to build:
1. **Scoring Engine** → Calculate scores with weights
2. **Ranking Engine** → Query + rank directives
3. **Severity Prioritization** → MUST > SHOULD > MAY
4. **Token Counter** → Track token budget

### Scoring Formula (CRITICAL):
```
total_score = (
  severity_score * 0.30 +
  relevance_score * 0.25 +
  layer_score * 0.20 +
  topic_score * 0.15 +
  authoritativeness_score * 0.10
)
normalized = total / 100  // 0-1 range
```

### Severity Values:
```
MUST = 100 (always prioritized)
SHOULD = 50 (secondary)
MAY = 25 (optional)
```

### Token Budget Logic:
```
IF cumulative_tokens + directive_tokens <= budget:
  include_directive()
ELSE:
  break  // Stop adding
```

### Files to create:
```
src/ranking/scoring-engine.ts
src/ranking/ranking-engine.ts
src/ranking/token-counter.ts
```

### Tests needed:
- 50+ unit tests (>90% coverage)
- 2+ integration tests

### Performance target:
- Ranking: <300ms for 100+ rules

---

## 📌 Phase 4: Smart Retrieval (2-3 days)

### What to build:
1. **Query Function** → Full queryDirectives() implementation
2. **Formatter** → Convert to readable markdown
3. **Citations** → Add breadcrumb references
4. **Fallbacks** → Handle errors gracefully
5. **Modes** → architect/code/debug support

### Query Flow (Complete):
```
taskDescription + options
  ↓
detectContext()
  ↓
rankingEngine.query()
  ↓
contextFormatter.format()
  ↓
Output: {context_block, citations, diagnostics}
```

### Output Context Block (Example):
```markdown
# Contextual Rules

**Detected Context:**
- Layer: 5-Integration
- Topics: API, security
- Technologies: Node.js, REST

## Critical (MUST) Directives

- **[MUST]** Endpoints require authentication
  *Applies to: API, Security*
  *Source: API-Guidelines.md → Security Section*

## Recommended (SHOULD) Directives

- **[SHOULD]** Rate limit requests
  *Source: API-Guidelines.md → Performance*
```

### Mode Adjustments (Quick Ref):
```
architect: Focus on patterns, design, scalability
code: Focus on standards, implementation, testing
debug: Focus on errors, logging, troubleshooting
```

### Fallback Response (When no rules found):
```
Core Programming Principles:
- Write clean, readable code
- Add tests for new functionality
- Follow project code style guide
- Document public APIs
```

### Files to create:
```
src/formatting/context-formatter.ts
src/formatting/citation-generator.ts
```

### Update existing:
```
src/rules/rule-manager.ts (full implementations)
```

### Tests needed:
- 40+ unit tests (>85% coverage)
- 5+ integration tests

### Performance target:
- Full query: <400ms

---

## 🧪 Testing Quick Reference

### Unit Test Count Target:
```
Phase 1: 50+ tests
Phase 2: 60+ tests
Phase 3: 50+ tests
Phase 4: 40+ tests
Total: 200+ tests (>90% coverage)
```

### Integration Test Count Target:
```
Phase 1: 2 tests
Phase 2: 2 tests
Phase 3: 2 tests
Phase 4: 5 tests
Total: 11+ tests
```

### Key Test Scenarios:
```
✓ Happy path (everything works)
✓ Edge cases (empty input, special chars, etc.)
✓ Error cases (bad data, missing config)
✓ Performance (under time limits)
✓ Integration (phases working together)
```

---

## 📊 Dependency Graph

```
Phase 1 (Ingestion)
  ↓ (stores rules)
Phase 2 (Detection)
  ↓ (analyzes task)
Phase 3 (Ranking)
  ↓ (scores and filters)
Phase 4 (Output)
  ↓ (returns context)
LLM receives optimized context
```

**Important:** Can't skip ahead. Phase 1 must complete before Phase 2, etc.

---

## ⚡ Performance Checklist

- [ ] Rule ingestion: <2s for 100 rules
- [ ] Layer detection: <200ms
- [ ] Tech detection: <100ms
- [ ] Topic detection: <100ms
- [ ] Context detection overall: <200ms
- [ ] Scoring: <100ms for 50 directives
- [ ] Ranking query: <300ms
- [ ] Token counting: <50ms
- [ ] Formatting: <100ms
- [ ] Full query: <400ms (total)

---

## 🔍 Key Neo4j Schema Elements

### Nodes:
```
Rule (path, title, created_at)
Section (name, index)
Directive (content, severity, lineNumber)
Topic (name)
Layer (name)
Technology (name)
```

### Relationships:
```
Rule -[CONTAINS]-> Section
Section -[CONTAINS]-> Subsection
Section -[HAS_DIRECTIVE]-> Directive
Directive -[APPLIES_TO_LAYER]-> Layer
Directive -[APPLIES_TO_TOPIC]-> Topic
Directive -[APPLIES_TO_TECHNOLOGY]-> Technology
```

---

## 💾 Data Model Reference

### Parsed Directive:
```typescript
interface Directive {
  id: string;           // UUID or hash
  content: string;      // Full text
  severity: string;     // MUST|SHOULD|MAY
  topics: string[];     // ['security', 'api']
  layers: string[];     // ['5-Integration']
  technologies: string[]; // ['REST', 'API']
  section: string;      // "2.1 Design"
  subsection?: string;
  context?: string;     // Surrounding text
  lineNumber: number;
}
```

### Query Result:
```typescript
interface QueryDirectivesOutput {
  context_block: string;           // Markdown
  citations: Array<{
    source: string;                // "API-Guidelines.md"
    section: string;               // "Authentication"
    lineNumber: number;
  }>;
  diagnostics: {
    detectedLayer: string;
    topics: string[];
    retrievalStats: {
      searched: number;
      considered: number;
      selected: number;
    };
  };
}
```

---

## 🎯 Common Pitfalls to Avoid

❌ **Don't:**
- Skip testing (do it incrementally!)
- Ignore edge cases (handle them explicitly)
- Hardcode thresholds (make them configurable)
- Forget error handling (provide meaningful errors)
- Optimize prematurely (measure first)

✅ **Do:**
- Test after each small piece
- Handle empty/null/undefined everywhere
- Use configuration objects for weights
- Log what's happening for debugging
- Profile and optimize only if needed

---

## 📞 Debugging Tips

### If detection is wrong:
- Check layer keywords (Phase 2.1)
- Verify token extraction (Phase 2.2)
- Review topic matching (Phase 2.3)

### If ranking is wrong:
- Verify scoring formula (Phase 3.1)
- Check weight values (Phase 3.1)
- Review query filtering (Phase 3.2)

### If output is bad:
- Check context block formatting (Phase 4.2)
- Verify citations are generated (Phase 4.3)
- Test fallback responses (Phase 4.4)

### Performance issues:
- Profile with large datasets
- Check Neo4j query performance
- Verify token counter efficiency
- Look for N+1 query problems

---

## 🚀 Implementation Checklist

- [ ] Understand all 4 phases
- [ ] Review this quick reference
- [ ] Review PHASES-1-4-TODO.md (complete spec)
- [ ] Review PHASES-1-4-ROADMAP.md (timeline)
- [ ] Create project structure
- [ ] Start Phase 1.1 (Parser)
- [ ] Get it tested thoroughly
- [ ] Move to Phase 1.2
- [ ] ...continue phase by phase...

---

## 📚 File Structure (for copy-paste)

```typescript
// Phase 1.1: Markdown Parser
export interface ParsedMarkdown {
  sections: Section[];
  metadata?: Record<string, any>;
  rawContent: string;
}

// Phase 1.2: Directive Extractor
export interface Directive {
  id: string;
  severity: 'MUST' | 'SHOULD' | 'MAY';
  content: string;
  metadata: DirectiveMetadata;
}

// Phase 2.4: Context Detection
export interface DetectedContext {
  layer: string;
  confidence: number;
  topics: string[];
  technologies: string[];
}

// Phase 3.1: Scoring
export interface ScoringWeights {
  severity: number;     // 0.30
  relevance: number;    // 0.25
  layer: number;        // 0.20
  topic: number;        // 0.15
  authority: number;    // 0.10
}

// Phase 4.1: Query Output
export interface QueryDirectivesOutput {
  context_block: string;
  citations: Citation[];
  diagnostics: Diagnostics;
}
```

---

**Remember:** 
- Break it down into small, testable pieces
- Test frequently
- Document as you go
- Ask questions if you get stuck

**Good luck! 🚀**

*Last Updated: October 16, 2025*
