# Summary: .github/rule File Template Implementation

## What Was Created

In response to the question "what is the .github/rule file template", I have created a comprehensive template system for the ContextISO project that enables users to create rule documents that can be ingested into the knowledge graph system.

## Files Created

### 1. `.github/rule-template.md` (6.7 KB)
**Complete annotated template with all sections and comprehensive examples**

Features:
- YAML front matter with all supported metadata fields
- Organized sections for different severity levels (MUST, SHOULD, MAY)
- Code examples showing good vs bad practices
- Anti-patterns section
- Context and rationale explanations
- Maintenance guidelines
- Integration notes for ContextISO

### 2. `.github/RULE-TEMPLATE-README.md` (12 KB)
**Full documentation guide for using the template**

Includes:
- Quick start instructions
- Template structure explanation
- Field-by-field YAML documentation
- Directive format specifications
- Best practices for writing rules
- Common use cases with examples
- Ingestion and querying instructions
- Troubleshooting guide

### 3. `.github/QUICK-REFERENCE.md` (4.9 KB)
**Quick lookup guide for common patterns**

Provides:
- Quick start commands
- YAML format reference
- Severity level table
- Architectural layers reference
- Common topics and technologies lists
- Validation checklist
- Template sections overview

### 4. `.github/example-typescript-rules.md` (2.8 KB)
**Working example of a rule document**

Demonstrates:
- Proper YAML front matter usage
- Mix of MUST, SHOULD, and MAY directives
- Organization by topic (Security, Code Quality, Testing, etc.)
- Real-world coding standards
- Practical application of the template

### 5. `.github/validate-template.cjs` (4.2 KB)
**Validation script to check rule documents**

Validates:
- ✓ YAML front matter presence
- ✓ Required metadata fields (title, layer, topics, technologies)
- ✓ Severity markers ([MUST], [SHOULD], [MAY])
- ✓ Markdown structure (headers)
- ✓ Code examples presence
- ⚠ Warnings for best practices

### 6. `.github/README.md` (5.0 KB)
**Index and overview for the .github directory**

Covers:
- File descriptions and purposes
- Quick start guide
- What rule documents are and how they work
- Example rule document
- Integration with ContextISO
- Validation instructions

## Integration with Existing System

### Updated Files

**`README.md`** - Updated to reference the new template:
- Added link to rule template in "Rule Tools" section
- Added new "Example: Creating Rule Documents" section
- Linked to all template documentation files

## How the Template Works

### 1. Template Format

The template uses a specific format that aligns with ContextISO's parsing system:

```yaml
---
title: "Document Title"
layer: "2-Application"
topics: ["security", "testing"]
technologies: ["TypeScript", "Node.js"]
---

# Document Title

[MUST] Mandatory requirement
[SHOULD] Recommended practice
[MAY] Optional consideration
```

### 2. Severity Levels

| Marker | Level | Use Case |
|--------|-------|----------|
| `[MUST]` | Mandatory | Security, compliance, data integrity |
| `[SHOULD]` | Recommended | Quality, performance, best practices |
| `[MAY]` | Optional | Enhancements, alternatives |

### 3. Architectural Layers

Templates support 8 layer classifications:
- `1-Presentation` - UI/Frontend
- `2-Application` - Business Logic
- `3-Domain` - Domain Models
- `4-Persistence` - Data Access
- `5-Integration` - APIs/External Services
- `6-Docs` - Documentation
- `7-Deployment` - Infrastructure
- `*` - All Layers (cross-cutting)

### 4. Context Detection

The YAML metadata enables automatic context matching:
- **Topics** - Security, testing, performance, API, database, etc.
- **Technologies** - React, TypeScript, Node.js, SQL, Neo4j, etc.
- **Layers** - Architectural layer for rule application

## Usage Flow

```bash
# 1. Copy template
cp .github/rule-template.md .github/my-rules.md

# 2. Edit with project rules
vim .github/my-rules.md

# 3. Validate format
cd .github
sed -i 's|rule-template.md|my-rules.md|' validate-template.cjs
node validate-template.cjs

# 4. Ingest into ContextISO (via MCP)
# See RULE-TEMPLATE-README.md for integration code
```

## Testing and Validation

Created validation script that checks:
- ✅ YAML front matter structure
- ✅ Required metadata fields
- ✅ Severity marker format ([MUST], [SHOULD], [MAY])
- ✅ Markdown headers
- ✅ Code examples (recommended)
- ✅ Proper casing for directives

Both template files validated successfully:
```
✓ rule-template.md: 7 MUST, 10 SHOULD, 7 MAY directives
✓ example-typescript-rules.md: 5 MUST, 9 SHOULD, 4 MAY directives
```

## Key Features

### 1. Comprehensive Documentation
- **3 levels of documentation**: Full guide, quick reference, and example
- **Clear examples**: Shows both good and bad practices
- **Best practices**: Guidance on writing effective rules

### 2. Easy to Use
- **Copy-paste ready**: Template is immediately usable
- **Validation**: Script ensures format correctness before ingestion
- **Examples**: Working examples demonstrate proper usage

### 3. ContextISO Integration
- **Metadata-driven**: YAML front matter enables smart matching
- **Severity-based**: MUST/SHOULD/MAY aligns with scoring system
- **Layer-aware**: Architectural layer detection supported
- **Topic-tagged**: Automatic topic and technology extraction

### 4. Maintainable
- **Version controlled**: Templates are in Git
- **Documented**: Clear maintenance and review guidelines
- **Extensible**: Easy to add new rule documents

## Documentation Structure

```
.github/
├── README.md                    # Directory index and overview
├── rule-template.md             # Main template (6.7 KB)
├── RULE-TEMPLATE-README.md      # Full documentation (12 KB)
├── QUICK-REFERENCE.md           # Quick lookup (4.9 KB)
├── example-typescript-rules.md  # Working example (2.8 KB)
└── validate-template.cjs        # Validation script (4.2 KB)
```

Total: **6 files, ~36 KB of documentation and tooling**

## Benefits

1. **Standardization**: Consistent format for all rule documents
2. **Quality**: Validation ensures correctness before ingestion
3. **Discoverability**: Well-documented with multiple entry points
4. **Integration**: Works seamlessly with ContextISO parsing system
5. **Examples**: Real-world examples guide users
6. **Maintainability**: Clear guidelines for updates and reviews

## Next Steps for Users

1. **Review the template**: Start with `.github/rule-template.md`
2. **Read the guide**: Full details in `.github/RULE-TEMPLATE-README.md`
3. **Check examples**: See `.github/example-typescript-rules.md`
4. **Create your rules**: Copy template and customize
5. **Validate**: Run `validate-template.cjs` to check format
6. **Ingest**: Use ContextISO MCP tools to load rules

## Alignment with ContextISO

The template format aligns perfectly with:
- **Phase 1**: Markdown parsing and directive extraction
- **Phase 2**: Context detection (layers, topics, technologies)
- **Phase 3**: Rule ranking (severity-based scoring)
- **Phase 4**: Context block formatting

All metadata fields and directive formats match the specifications in:
- `src/parsing/markdown-parser.ts`
- `src/parsing/directive-extractor.ts`
- `src/parsing/graph-builder.ts`
- `src/detection/*.ts`

## Conclusion

The `.github/rule` file template is now a comprehensive, well-documented system that enables users to:

1. Create project-specific rule documents
2. Validate format before ingestion
3. Integrate seamlessly with ContextISO
4. Maintain and update rules over time

The template includes complete documentation at three levels (comprehensive, quick reference, and by-example) to support users with different needs and learning styles.
