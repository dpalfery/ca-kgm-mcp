# ContextISO Rule Templates

This directory contains templates and tools for creating rule documents that can be ingested into the ContextISO knowledge graph system.

## 📚 Documentation Files

### Core Template
- **[rule-template.md](./rule-template.md)** - Complete annotated template with all sections, examples, and comprehensive documentation

### Guides
- **[RULE-TEMPLATE-README.md](./RULE-TEMPLATE-README.md)** - Full documentation on using the template, including format specifications, best practices, and integration details
- **[QUICK-REFERENCE.md](./QUICK-REFERENCE.md)** - Quick lookup guide with common patterns, layers, topics, and validation checklist

### Examples
- **[example-typescript-rules.md](./example-typescript-rules.md)** - Working example of a rule document following the template format

### Tools
- **[validate-template.cjs](./validate-template.cjs)** - Validation script to check rule document format before ingestion

## 🚀 Quick Start

```bash
# 1. Copy the template
cp .github/rule-template.md .github/my-rules.md

# 2. Edit with your project-specific rules
vim .github/my-rules.md

# 3. Validate the format
cd .github
sed -i 's|rule-template.md|my-rules.md|' validate-template.cjs
node validate-template.cjs
sed -i 's|my-rules.md|rule-template.md|' validate-template.cjs
```

## 📖 What is a Rule Document?

A rule document is a markdown file that contains project-specific guidelines, best practices, and requirements. These documents:

- Use **YAML front matter** for metadata (topics, layers, technologies)
- Contain **severity-marked directives**: `[MUST]`, `[SHOULD]`, `[MAY]`
- Are **automatically parsed** by ContextISO's ingestion system
- Enable **context-aware rule retrieval** by AI coding assistants

## 🎯 Rule Severity Levels

| Marker | Level | Use For |
|--------|-------|---------|
| `[MUST]` | Mandatory | Security requirements, compliance rules, data integrity |
| `[SHOULD]` | Recommended | Code quality standards, performance optimizations, testing |
| `[MAY]` | Optional | Enhancements, alternative approaches, suggestions |

## 📝 Example Rule Document

```markdown
---
title: "API Security Guidelines"
layer: "5-Integration"
topics:
  - "security"
  - "api"
technologies:
  - "REST"
  - "Node.js"
---

# API Security Guidelines

## Authentication

[MUST] All API endpoints must require authentication.

[MUST] Use JWT tokens with appropriate expiration times.

[SHOULD] Implement rate limiting to prevent abuse.

## Input Validation

[MUST] Validate all input parameters using a schema validation library.

[SHOULD] Sanitize input to prevent injection attacks.
```

## 🔍 How ContextISO Uses These Templates

1. **Ingestion**: Rule documents are parsed to extract directives, metadata, and relationships
2. **Storage**: Rules are stored in Neo4j knowledge graph with semantic relationships
3. **Detection**: When a developer describes a task, ContextISO detects relevant context (layer, topics, technologies)
4. **Retrieval**: Rules are matched to the detected context and ranked by relevance
5. **Formatting**: Top-ranked rules are formatted as a context block for the AI assistant

## 📋 Template Structure

Each rule document should include:

1. **YAML Front Matter** - Metadata for context detection
   - `title`, `layer`, `topics`, `technologies`, `authoritativeFor`
2. **Introduction** - Purpose and scope of the rules
3. **Critical Requirements** - `[MUST]` rules
4. **Recommended Practices** - `[SHOULD]` rules
5. **Optional Considerations** - `[MAY]` rules
6. **Code Examples** - Demonstrations of good/bad practices
7. **Anti-Patterns** - Common mistakes to avoid
8. **Rationale** - Why these rules exist

## ✅ Validation

Before ingesting rules into ContextISO, validate the format:

```bash
cd .github
node validate-template.cjs
```

The validator checks for:
- ✓ YAML front matter present
- ✓ Severity markers (`[MUST]`, `[SHOULD]`, `[MAY]`)
- ✓ Markdown structure (headers, sections)
- ✓ Metadata fields (title, layer, topics, technologies)

## 🔗 Integration with ContextISO

To ingest rule documents into ContextISO:

```typescript
import { readFileSync } from 'fs';

await server.handleToolCall('memory.rules.upsert_markdown', {
  documents: [{
    path: '.github/my-rules.md',
    content: readFileSync('.github/my-rules.md', 'utf-8')
  }],
  options: {
    overwrite: false,
    validateOnly: false
  }
});
```

See [RULE-TEMPLATE-README.md](./RULE-TEMPLATE-README.md) for complete integration details.

## 📚 Additional Resources

- [Main Project README](../README.md)
- [Architecture Documentation](../6-Docs/)
- [Knowledge Graph Design](../6-Docs/knowledge-graph-memory/design.md)
- [Implementation Roadmap](../PHASES-1-4-ROADMAP.md)

## 🤝 Contributing

To improve these templates:

1. Review the existing template and documentation
2. Propose changes via pull request
3. Include rationale and examples
4. Update relevant documentation

---

**Questions?** See [RULE-TEMPLATE-README.md](./RULE-TEMPLATE-README.md) or check the main [project documentation](../README.md).
