# Rule Template Workflow

## Visual Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      USER WORKFLOW                               │
└─────────────────────────────────────────────────────────────────┘

1. CREATE RULES
   ├── Copy template
   │   cp .github/rule-template.md .github/my-rules.md
   │
   ├── Edit with project rules
   │   vim .github/my-rules.md
   │
   └── Add YAML metadata + [MUST]/[SHOULD]/[MAY] directives

2. VALIDATE FORMAT
   ├── Run validation script
   │   node .github/validate-template.cjs
   │
   └── Check for:
       ✓ YAML front matter
       ✓ Severity markers
       ✓ Markdown structure

3. INGEST INTO CONTEXTISO
   ├── Use MCP tool
   │   memory.rules.upsert_markdown
   │
   └── ContextISO processes:
       ├── Parse YAML metadata
       ├── Extract directives
       ├── Build knowledge graph
       └── Store in Neo4j

4. AI ASSISTANT QUERIES
   ├── Developer describes task
   │   "Create a REST API for user auth"
   │
   ├── ContextISO detects context
   │   Layer: 5-Integration
   │   Topics: [api, security, auth]
   │   Technologies: [REST]
   │
   ├── Retrieves relevant rules
   │   Matches by layer + topics + tech
   │   Ranks by severity + relevance
   │
   └── Returns formatted context
       # Contextual Rules
       
       [MUST] Validate all inputs
       [MUST] Use HTTPS
       [SHOULD] Implement rate limiting
```

## File Relationships

```
.github/
├── rule-template.md              ← Main template (copy this)
│   └── Used by: Developers creating new rule documents
│
├── RULE-TEMPLATE-README.md       ← Complete documentation
│   └── Reference for: Template format, fields, best practices
│
├── QUICK-REFERENCE.md            ← Quick lookup
│   └── Reference for: Common patterns, layers, topics
│
├── example-typescript-rules.md   ← Working example
│   └── Reference for: How to apply the template
│
├── validate-template.cjs         ← Validation tool
│   └── Used by: Developers to validate before ingestion
│
└── README.md                     ← Directory index
    └── Starting point for: Understanding the template system
```

## Data Flow

```
┌──────────────────┐
│  Rule Document   │  (my-rules.md)
│                  │
│  ---             │
│  title: "..."    │  ← YAML Metadata
│  layer: "..."    │
│  topics: [...]   │
│  ---             │
│                  │
│  [MUST] Rule 1   │  ← Directives
│  [SHOULD] Rule 2 │
│  [MAY] Rule 3    │
└────────┬─────────┘
         │
         ├─ Validate ──→ validate-template.cjs
         │                      │
         │                      ✓ Format OK
         │
         ├─ Ingest ────→ MarkdownParser (Phase 1)
         │                      │
         │                      ├─ Parse YAML
         │                      ├─ Extract sections
         │                      └─ Find directives
         │
         ├─ Extract ───→ DirectiveExtractor
         │                      │
         │                      ├─ Extract [MUST]/[SHOULD]/[MAY]
         │                      ├─ Detect topics from content
         │                      └─ Identify technologies
         │
         ├─ Build ─────→ GraphBuilder
         │                      │
         │                      ├─ Create Rule node
         │                      ├─ Create Section nodes
         │                      ├─ Create Directive nodes
         │                      └─ Build relationships
         │
         └─ Store ─────→ Neo4j Knowledge Graph
                               │
                               └─ Ready for queries
```

## Context Detection & Retrieval

```
┌─────────────────────────────────────────────────────────────┐
│ Developer Task: "Build REST API for user authentication"    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
              ┌────────────────┐
              │ Context        │
              │ Detection      │
              │ (Phase 2)      │
              └────────┬───────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ↓              ↓              ↓
  Layer Detect    Topic Detect   Tech Detect
        │              │              │
        ↓              ↓              ↓
  5-Integration   [api,          [REST]
                   security,
                   auth]
                       │
                       ↓
              ┌────────────────┐
              │ Query Neo4j    │
              │ (Phase 3)      │
              └────────┬───────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ↓              ↓              ↓
  Match Layer    Match Topics   Match Tech
        │              │              │
        └──────────────┼──────────────┘
                       │
                       ↓
              ┌────────────────┐
              │ Rank & Score   │
              │ (Phase 3)      │
              └────────┬───────┘
                       │
        Severity: MUST > SHOULD > MAY
        Relevance: Topic overlap
        Authority: AuthoritativeFor
                       │
                       ↓
              ┌────────────────┐
              │ Format Output  │
              │ (Phase 4)      │
              └────────┬───────┘
                       │
                       ↓
        ┌──────────────────────────┐
        │ # Contextual Rules       │
        │                          │
        │ [MUST] Validate inputs   │
        │ [MUST] Use HTTPS         │
        │ [SHOULD] Rate limiting   │
        └──────────────────────────┘
                       │
                       ↓
              AI Assistant Context
```

## Template Structure

```
rule-template.md
│
├── YAML Front Matter
│   ├── title            ← Document name
│   ├── layer            ← 1-7 or * for all
│   ├── authoritativeFor ← Primary topics
│   ├── topics           ← Relevant topics
│   ├── technologies     ← Tech stack
│   └── severity         ← Default severity
│
├── Introduction
│   ├── Purpose
│   └── Scope
│
├── Critical Requirements ([MUST])
│   ├── Security rules
│   ├── Compliance rules
│   └── Data integrity rules
│
├── Recommended Practices ([SHOULD])
│   ├── Code quality
│   ├── Performance
│   └── Testing
│
├── Optional Considerations ([MAY])
│   ├── Enhancements
│   └── Alternatives
│
├── Code Examples
│   ├── Good examples (✅)
│   └── Bad examples (❌)
│
├── Anti-Patterns
│   └── What to avoid
│
└── Context & Rationale
    ├── Why rules matter
    └── When to deviate
```

## Quick Commands

```bash
# Copy template
cp .github/rule-template.md .github/my-rules.md

# Validate
cd .github
sed -i 's|rule-template.md|my-rules.md|' validate-template.cjs
node validate-template.cjs
sed -i 's|my-rules.md|rule-template.md|' validate-template.cjs

# View example
cat .github/example-typescript-rules.md

# Check documentation
cat .github/QUICK-REFERENCE.md        # Quick lookup
cat .github/RULE-TEMPLATE-README.md   # Full guide
cat .github/README.md                 # Directory index
```

## Integration Points

```
User-Created Rules (.github/*.md)
         │
         ↓
ContextISO MCP Server
         │
         ├─→ src/parsing/markdown-parser.ts       (Parse markdown)
         ├─→ src/parsing/directive-extractor.ts   (Extract directives)
         ├─→ src/parsing/graph-builder.ts         (Build graph)
         │
         ↓
Neo4j Knowledge Graph
         │
         ├─→ src/detection/layer-detector.ts      (Detect layer)
         ├─→ src/detection/tech-detector.ts       (Detect tech)
         ├─→ src/detection/topic-detector.ts      (Detect topics)
         │
         ↓
Context Matching & Ranking
         │
         ├─→ src/ranking/scoring-engine.ts        (Score directives)
         ├─→ src/ranking/token-counter.ts         (Token budget)
         │
         ↓
Formatted Context Block
         │
         ├─→ src/formatting/context-formatter.ts  (Format output)
         ├─→ src/formatting/citation-generator.ts (Generate citations)
         │
         ↓
AI Assistant (Roo-Cline/Cline)
```
