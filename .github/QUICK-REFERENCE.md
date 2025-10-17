# .github/rule File Template - Quick Reference

This is a quick reference for the ContextISO rule document template.

## 📁 Files in This Directory

- **`rule-template.md`** - Complete annotated template with all sections and examples
- **`RULE-TEMPLATE-README.md`** - Comprehensive guide on using the template
- **`example-typescript-rules.md`** - Example rule document based on the template
- **`validate-template.cjs`** - Validation script to check rule documents
- **`QUICK-REFERENCE.md`** - This file

## 🚀 Quick Start

```bash
# 1. Copy the template
cp .github/rule-template.md .github/my-rules.md

# 2. Edit with your rules
vim .github/my-rules.md

# 3. Validate the format
node .github/validate-template.cjs

# 4. Ingest into ContextISO (via MCP)
# See RULE-TEMPLATE-README.md for code examples
```

## 📝 Template Format

### YAML Front Matter (Required Metadata)

```yaml
---
title: "Your Document Title"
layer: "2-Application"     # or * for all layers
topics:
  - "security"             # Topics: security, testing, performance, api, etc.
  - "validation"
technologies:
  - "TypeScript"           # Tech stack: React, Node.js, SQL, etc.
  - "Node.js"
---
```

### Directive Format

```markdown
[MUST] This is a mandatory requirement.
[SHOULD] This is a recommended practice.
[MAY] This is an optional consideration.
```

## 📊 Severity Levels

| Marker | Level | Use For |
|--------|-------|---------|
| `[MUST]` | Mandatory | Security, compliance, data integrity |
| `[SHOULD]` | Recommended | Quality, performance, best practices |
| `[MAY]` | Optional | Enhancements, alternatives, suggestions |

## 🎯 Architectural Layers

| Layer | Description | Examples |
|-------|-------------|----------|
| `1-Presentation` | UI/Frontend | React components, CSS, forms |
| `2-Application` | Business Logic | Services, workflows, validation |
| `3-Domain` | Domain Models | Entities, business rules, aggregates |
| `4-Persistence` | Data Access | Database, repositories, queries |
| `5-Integration` | APIs/External | REST APIs, external services |
| `6-Docs` | Documentation | READMEs, diagrams, specs |
| `7-Deployment` | Infrastructure | CI/CD, monitoring, Docker |
| `*` | All Layers | Cross-cutting concerns |

## 📚 Common Topics

```
security        testing         performance     api
database        frontend        backend         validation
authentication  authorization   caching         logging
error-handling  documentation   code-quality    deployment
```

## 🔍 Common Technologies

```
TypeScript      JavaScript      React           Node.js
Python          C#              .NET            Java
PostgreSQL      MySQL           MongoDB         Neo4j
Docker          Kubernetes      Azure           AWS
REST            GraphQL         HTTP            WebSocket
```

## ✅ Validation Checklist

Before ingesting your rule document:

- [ ] Has YAML front matter with at least `title` and `layer`
- [ ] Contains at least one `[MUST]`, `[SHOULD]`, or `[MAY]` directive
- [ ] Uses uppercase for severity markers: `[MUST]` not `[must]`
- [ ] Has markdown headers (# ## ###) for organization
- [ ] Includes relevant topics and technologies in YAML
- [ ] Provides code examples for complex rules (recommended)
- [ ] Documents anti-patterns to avoid (recommended)

## 🔧 Validation Command

```bash
# Validate your rule document
cd .github
sed -i 's|rule-template.md|your-rules.md|' validate-template.cjs
node validate-template.cjs
sed -i 's|your-rules.md|rule-template.md|' validate-template.cjs
```

## 📖 Full Documentation

For complete details, see [`RULE-TEMPLATE-README.md`](./RULE-TEMPLATE-README.md)

## 💡 Tips

1. **Be Specific**: "Functions should be < 50 lines" is better than "Keep functions small"
2. **Provide Context**: Explain *why* a rule exists, not just *what* it requires
3. **Show Examples**: Code examples clarify intent better than text alone
4. **Tag Accurately**: Correct topics and layers improve rule matching
5. **Keep Updated**: Review rules quarterly or when processes change

## 🎨 Template Sections

The full template includes:

1. **YAML Front Matter** - Metadata for context detection
2. **Purpose & Scope** - Why these rules exist
3. **Critical Requirements** - `[MUST]` rules for security, compliance
4. **Recommended Practices** - `[SHOULD]` rules for quality
5. **Optional Considerations** - `[MAY]` rules for enhancements
6. **Code Examples** - Good vs bad examples
7. **Anti-Patterns** - Common mistakes to avoid
8. **Context & Rationale** - Why rules matter, when to deviate
9. **Related Documents** - Links to other docs
10. **Maintenance** - Review schedule and change process

## 🔗 Links

- [Complete Template](./rule-template.md)
- [Full Documentation](./RULE-TEMPLATE-README.md)
- [Example Rules](./example-typescript-rules.md)
- [Main Project README](../README.md)

---

**Questions?** See [RULE-TEMPLATE-README.md](./RULE-TEMPLATE-README.md) for detailed guidance.
