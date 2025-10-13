# Knowledge Graph Memory for AI Coding Assistants
## Vision Document v1.0

---

## Executive Summary

AI coding assistants like Roo-Cline and Cline face a fundamental challenge: they need comprehensive project context to produce quality code, but token limits force trade-offs between context breadth and depth. Current approaches either:
- Dump entire rule sets into every prompt (wasteful, slow, expensive)
- Provide minimal context (inconsistent outputs, missing critical requirements)
- Rely on the model's training data alone (ignores project-specific patterns)

**This vision proposes a knowledge graph-based memory system** that intelligently retrieves and ranks only the most relevant project rules, architectural patterns, and security requirements for each coding task. By using semantic search combined with domain-specific ranking, we can provide 10-15 highly relevant directives instead of hundreds of rules, **reducing token usage by 70-85% while improving context quality**.

### Key Benefits

| Metric | Current State | With Knowledge Graph Memory |
|--------|---------------|----------------------------|
| **Context tokens per task** | 5,000-15,000 | 800-1,500 |
| **Relevant directives surfaced** | 30-40% | 85-95% |
| **Setup effort** | High (manual prompt engineering) | Low (automated ingestion) |
| **Consistency** | Variable | High |
| **Cost per 1000 tasks** | $75-$225 | $12-$23 |

---

## Problem Statement

### The Context Challenge

Modern software projects have extensive requirements:
- **Security rules**: Input validation, authentication, authorization, secrets management
- **Architecture patterns**: Layer separation, dependency injection, API design
- **Code quality standards**: Naming conventions, error handling, testing requirements
- **Technology-specific constraints**: Framework best practices, deployment patterns

AI coding assistants need this context to generate production-ready code, but:

1. **Token limits are finite**: Each task has a context window budget (e.g., 200K tokens for Claude Sonnet)
2. **Most rules are irrelevant for any given task**: A frontend component doesn't need database connection pooling rules
3. **Manual prompt engineering doesn't scale**: Teams can't maintain complex prompt templates for every scenario
4. **Static instructions degrade over time**: Projects evolve but hardcoded rules become stale

### The Current Approach (Naive Solution)

```
User Task: "Add a login button to the header"

Context Sent (10,000 tokens):
├─ ALL security rules (200 lines)
├─ ALL architecture rules (300 lines)  
├─ ALL testing rules (150 lines)
├─ ALL code quality rules (200 lines)
└─ ALL Azure deployment rules (150 lines)

Relevant Rules Needed (~500 tokens):
├─ UI component security (50 lines)
├─ Authentication flow (40 lines)
└─ React best practices (30 lines)

Result: 95% wasted context, 5% useful
```

### What We Need

A system that:
1. **Understands the task semantically**: "Add login button" → UI layer + authentication + React
2. **Retrieves only relevant rules**: Security MUST for auth, React component patterns, accessibility
3. **Ranks by importance**: MUST directives first, then SHOULD, then MAY
4. **Formats for consumption**: Clean markdown block ready to prepend to the prompt
5. **Scales automatically**: New rules added to the graph are immediately available

---

## Solution Overview

### Architecture: Knowledge Graph + Smart Retrieval

We propose a two-component system:

```mermaid
graph TB
    subgraph "AI Coding Tool (Roo-Cline/Cline)"
        Task[User Task: Add API endpoint]
        Tool[Tool Decision: Call rules.query]
        Prepend[Prepend context_block to prompt]
        Generate[Generate code with context]
    end
    
    subgraph "Memory MCP Server (Extended)"
        Query[rules.query_directives tool]
        Detect[Context Detection Engine]
        Search[Semantic Search Engine]
        Rank[Domain-Aware Ranking]
        Format[Context Block Formatter]
    end
    
    subgraph "Knowledge Graph Storage"
        Rules[(Rules, Directives, Patterns)]
        Relations[(Layer → Topic → Severity)]
    end
    
    Task --> Tool
    Tool -->|1. Call with task text| Query
    Query --> Detect
    Detect -->|2. Detect: API + Security + 4-Persistence| Search
    Search -->|3. Query graph| Rules
    Rules -->|4. Return candidates| Rank
    Rank -->|5. Top 8 directives| Format
    Format -->|6. Markdown context_block| Prepend
    Prepend --> Generate
```

### Core Components

#### 1. Knowledge Graph Storage (Memory MCP Server)

The open-source [Memory MCP Server](https://github.com/modelcontextprotocol/servers/tree/main/src/memory) provides:
- **Entity storage**: Rules, Directives, Sections, Patterns stored as graph nodes
- **Relation modeling**: Layer→Topic, Topic→Directive, Rule→AuthoritativeFor
- **Semantic search**: Vector embeddings for natural language queries
- **Persistence**: SQLite-based graph database

**Example Graph Structure:**

```
Rule: "Security General"
├─ AuthoritativeFor: ["security", "authentication", "authorization"]
├─ Layer: "*" (applies to all layers)
└─ Directives:
    ├─ [MUST] "Validate all inputs client and server-side"
    │   ├─ Severity: MUST
    │   ├─ Topics: ["security", "validation"]
    │   └─ WhenToApply: ["user-input", "API", "forms"]
    ├─ [MUST] "Authorize every action after authentication"
    │   ├─ Severity: MUST
    │   └─ Topics: ["security", "authorization"]
    └─ [SHOULD] "Use parameterized queries for all SQL"
        ├─ Severity: SHOULD
        └─ Topics: ["security", "persistence", "SQL"]
```

#### 2. Extended Memory MCP Tools (New)

We extend the Memory MCP server with three new domain-specific tools:

**A. `memory.rules.query_directives()` - Primary Interface**

The main tool coding assistants call at task start:

```typescript
Input: {
  taskDescription: "Add user registration API endpoint",
  modeSlug: "code",  // Optional: architect|code|debug
  options: {
    strictLayer: true,      // Enforce layer filtering
    maxItems: 8,            // Max directives to return
    tokenBudget: 900,       // Soft cap on output size
    includeBreadcrumbs: true
  }
}

Output: {
  context_block: `
# Contextual Rules for Task

**Detected Context**: 4-Persistence layer, API design, Security

## Key Directives

- **[MUST]** Validate all inputs client and server-side
  - *Applies to: Security, Input Validation*
  - *Source: Security General Rule → Input Validation*

- **[MUST]** Authorize every action after authentication check
  - *Applies to: Security, Authorization*
  - *Source: Security General Rule → Authorization*

- **[MUST]** Use parameterized queries or ORM for all data access
  - *Applies to: 4-Persistence layer, Security*
  - *Source: Persistence Layer Rules → SQL Safety*

- **[SHOULD]** Return consistent error shapes from all API endpoints
  - *Applies to: 4-Persistence, API Design*
  - *Source: Architecture General → API Standards*

... (4 more directives)
  `,
  citations: [
    { sourcePath: ".kilocode/rules/security-general-rule.md", section: "Input Validation", severity: "MUST" },
    { sourcePath: ".kilocode/rules/persistence-layer-rule.md", section: "SQL Safety", severity: "MUST" }
  ],
  diagnostics: {
    detectedLayer: "4-Persistence",
    topics: ["security", "API", "database", "validation"],
    retrievalStats: { searched: 150, considered: 24, selected: 8 }
  }
}
```

**B. `memory.rules.detect_context()` - Context Detection**

Standalone tool for analyzing task context (useful for testing and advanced scenarios):

```typescript
Input: {
  text: "Add user registration API endpoint",
  options: { returnKeywords: true }
}

Output: {
  detectedLayer: "4-Persistence",
  topics: ["API", "security", "database", "authentication"],
  keywords: ["registration", "endpoint", "user", "POST"],
  confidence: 0.87
}
```

**C. `memory.rules.upsert_markdown()` - Simplified Ingestion**

High-level wrapper for ingesting markdown rule documents into the graph:

```typescript
Input: {
  documents: [
    { path: ".kilocode/rules/security-general-rule.md" },
    { path: ".kilocode/rules/architecture-general.md" }
  ],
  options: { overwrite: true }
}

Output: {
  upserted: { rules: 2, sections: 12, directives: 45, patterns: 8 },
  relations: 120,
  warnings: []
}
```

---

## Technical Deep Dive

### Context Detection Engine

The detection engine analyzes task descriptions to identify:

**1. Architectural Layer**

Using pattern matching and keyword analysis:

| Layer | Indicators | Example Tasks |
|-------|-----------|---------------|
| **1-Presentation** | UI, component, page, view, CSS, React, form | "Add login button", "Style the header" |
| **2-Application** | service, business logic, workflow, orchestration | "Implement checkout flow", "Add business validation" |
| **3-Domain** | entity, aggregate, value object, domain model | "Create Order entity", "Add inventory domain rules" |
| **4-Persistence** | database, repository, SQL, query, migration | "Add user table", "Optimize product query" |
| **5-Tests** | unit test, integration test, E2E, coverage | "Write unit tests for the new service" |
| **6-Docs** | documentation, diagrams, specifications | "Update the architecture diagram" |
| **7-Deployment** | infrastructure, CI/CD, monitoring, Azure, Docker | "Deploy to AKS", "Add health check endpoint" |

**2. Topics**

Extracted from task text using NLP and domain dictionaries:
- **Security**: authentication, authorization, encryption, validation, secrets
- **Testing**: unit test, integration test, E2E, coverage, mocking
- **Performance**: optimization, caching, indexing, scaling
- **API**: REST, GraphQL, endpoint, contract, versioning

**3. Technologies**

Detected from file extensions, imports, and explicit mentions:
- **Languages**: C#, TypeScript, Python, JavaScript
- **Frameworks**: React, .NET, Express, FastAPI
- **Platforms**: Azure, AWS, Docker, Kubernetes

### Ranking Algorithm

The system ranks candidate directives using a weighted scoring model:

```
Score = (Authority × 10) + (WhenToApply × 8) + (LayerMatch × 7) + 
        (TopicOverlap × 5) + (SeverityBoost × 4) + (SemanticSim × 3)
```

**Scoring Components:**

| Component | Weight | Logic |
|-----------|--------|-------|
| **Authority** | 10 | Rule marked `AuthoritativeFor` the detected topic |
| **WhenToApply** | 8 | Directive's `WhenToApply` matches task keywords |
| **LayerMatch** | 7 | Directive's layer equals detected layer (or `*` wildcard) |
| **TopicOverlap** | 5 | Jaccard similarity of directive topics vs detected topics |
| **SeverityBoost** | 4 | MUST=3, SHOULD=2, MAY=1 |
| **SemanticSim** | 3 | Cosine similarity of task text vs directive embedding |

**Example Ranking:**

```
Task: "Add user registration API with email validation"
Detected: Layer=4-Persistence, Topics=[API, security, validation, email]

Candidate Directives (scored):
1. [MUST] Validate all inputs client and server-side
   - Authority: 10 (security is authoritative)
   - WhenToApply: 8 (matches "validation")
   - LayerMatch: 0 (applies to all layers)
   - TopicOverlap: 5 (2/4 topics match)
   - SeverityBoost: 4 (MUST)
   - SemanticSim: 2.1
   - TOTAL: 29.1 ⭐

2. [MUST] Use parameterized queries for all SQL
   - Authority: 10 (security + persistence)
   - WhenToApply: 0 (no match)
   - LayerMatch: 7 (4-Persistence)
   - TopicOverlap: 2.5 (1/4 topics)
   - SeverityBoost: 4 (MUST)
   - SemanticSim: 1.8
   - TOTAL: 25.3 ⭐

3. [SHOULD] Use meaningful variable names
   - Authority: 0
   - WhenToApply: 0
   - LayerMatch: 0
   - TopicOverlap: 0
   - SeverityBoost: 2 (SHOULD)
   - SemanticSim: 0.8
   - TOTAL: 2.8
```

Result: Directives 1 and 2 are surfaced; directive 3 is filtered out.

### Token Budget Management

The formatter ensures output stays within the configured budget:

```typescript
function buildContextBlock(rankedDirectives: Directive[], budget: number): string {
  let block = "# Contextual Rules for Task\n\n";
  let tokensUsed = estimateTokens(block);
  
  for (const directive of rankedDirectives) {
    const entry = formatDirective(directive);
    const entryTokens = estimateTokens(entry);
    
    if (tokensUsed + entryTokens > budget) {
      break; // Stop adding directives
    }
    
    block += entry;
    tokensUsed += entryTokens;
  }
  
  return block;
}
```

**Token Estimation:**
- Use approximation: 1 token ≈ 4 characters for English text
- Conservative: Prefer fewer directives to stay under budget
- Always include top 3 MUST directives regardless of budget

---

## Integration with Coding Tools

### Roo-Cline / Cline Integration

Coding assistants integrate via simple tool instructions added to their system prompts:

**System Prompt Addition:**

```markdown
## Context Retrieval (Rules Memory)

Before starting any coding task, you MUST call the rules memory system to retrieve relevant project-specific directives.

**Tool**: `memory.rules.query_directives`

**When to call**: 
- At the start of EVERY coding task
- Before generating or modifying any code
- After the user provides a task description

**How to call**:
```json
{
  "taskDescription": "<full user task text>",
  "modeSlug": "code",
  "options": {
    "maxItems": 8,
    "strictLayer": true
  }
}
```

**How to use the response**:
1. Prepend the returned `context_block` to your working context
2. Prioritize MUST directives as non-negotiable requirements
3. Follow SHOULD directives unless you have a strong reason not to
4. Consider MAY directives as helpful guidelines

**Fallback**:
If the tool is unavailable, use these core rules as baseline context:
- Validate all inputs
- Follow security best practices
- Write testable, maintainable code
```

### Example Workflow

```
User: "Add a new API endpoint for user profile updates"

Assistant (internal flow):
1. Receive task
2. Call memory.rules.query_directives({
     taskDescription: "Add a new API endpoint for user profile updates",
     modeSlug: "code",
     options: { maxItems: 8 }
   })
3. Receive context_block (900 tokens):
   - [MUST] Validate all inputs
   - [MUST] Authorize user owns the profile being updated
   - [MUST] Use parameterized queries
   - [SHOULD] Return consistent error responses
   - [SHOULD] Log all profile changes for audit
   - [SHOULD] Add integration test for endpoint
   - [MAY] Consider rate limiting for profile updates
   - [MAY] Add caching for GET profile requests
4. Prepend context_block to prompt
5. Generate code following directives
6. Return code with explanations tied to directives

Assistant (to user):
"I'll create the profile update endpoint following these key requirements:

```csharp
[HttpPut("api/users/{id}/profile")]
[Authorize] // MUST: Authorization check
public async Task<IActionResult> UpdateProfile(
    int id, 
    [FromBody] UpdateProfileRequest request)
{
    // MUST: Validate inputs
    if (!ModelState.IsValid)
        return BadRequest(ModelState);
    
    // MUST: Verify user owns this profile
    var currentUserId = User.GetUserId();
    if (currentUserId != id)
        return Forbid();
    
    // MUST: Use parameterized query (via EF Core)
    var user = await _context.Users.FindAsync(id);
    if (user == null)
        return NotFound();
    
    user.UpdateProfile(request);
    
    // SHOULD: Log audit trail
    _logger.LogInformation(
        "User {UserId} updated profile", id);
    
    await _context.SaveChangesAsync();
    
    // SHOULD: Consistent error response
    return Ok(new { 
        success = true, 
        user = _mapper.Map<UserDto>(user) 
    });
}
```

**Tests** (SHOULD: Integration test):
```csharp
[Fact]
public async Task UpdateProfile_ValidRequest_ReturnsOk()
{
    // Arrange
    var client = _factory.CreateAuthenticatedClient(userId: 1);
    var request = new UpdateProfileRequest { Name = "John Doe" };
    
    // Act
    var response = await client.PutAsJsonAsync(
        "/api/users/1/profile", request);
    
    // Assert
    response.StatusCode.Should().Be(HttpStatusCode.OK);
}
```

The implementation follows security MUSTs (validation, authorization, parameterized queries) and best practices (logging, testing, error handling)."
```

---

## Rule Document Format

For the system to work, project rules must be stored in a structured markdown format:

### Standard Rule Template

```markdown
# [Rule Name]

## Metadata
- **Layer**: 1-Presentation | 2-Application | 3-Domain | 4-Persistence | 5-Tests | 6-Docs | 7-Deployment | *
- **AuthoritativeFor**: [security, testing, architecture]
- **Topics**: [API, validation, authentication, performance]
- **Severity**: MUST | SHOULD | MAY

## When to Apply
- Creating new API endpoints
- Handling user input
- Implementing authentication flows

## Directives

### Input Validation
**[MUST]** Validate all inputs on both client and server side.

**Rationale**: Defense in depth. Client validation for UX, server validation for security.

**Example**:
```csharp
public IActionResult CreateUser([FromBody] CreateUserRequest request)
{
    if (!ModelState.IsValid)
        return BadRequest(ModelState);
    // ...
}
```

### Authentication Check
**[MUST]** Authorize every action after authenticating the user.

**Rationale**: Prevent unauthorized access to resources.

**Anti-pattern**:
```csharp
// ❌ Don't assume authentication is enough
public IActionResult DeleteUser(int id)
{
    _userService.Delete(id); // Missing authorization!
}
```

**Correct**:
```csharp
// ✅ Verify user can perform this action
[Authorize]
public IActionResult DeleteUser(int id)
{
    if (!_authService.CanDeleteUser(User.GetUserId(), id))
        return Forbid();
    
    _userService.Delete(id);
}
```

### SQL Safety
**[SHOULD]** Use parameterized queries or an ORM for all database access.

**Rationale**: Prevent SQL injection attacks.

## Related Rules
- [Base Code Quality Rule](./base-rule.md)
- [Architecture General Rule](./architecture-general.md)

## References
- OWASP Top 10: https://owasp.org/www-project-top-ten/
- Azure Security Best Practices: https://learn.microsoft.com/azure/security/
```

### Ingestion Process

**Step 1: Create Rule Documents**
```
project/
├─ .aitools/
│  ├─ rules/
│  │  ├─ security-general.md
│  │  ├─ architecture-layers.md
│  │  ├─ testing-standards.md
│  │  ├─ azure-deployment.md
│  │  └─ csharp-conventions.md
│  └─ mcp.json
```

**Step 2: Configure Memory MCP**
```json
{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"]
    }
  }
}
```

**Step 3: Ingest Rules**
```bash
# Call the upsert tool (via MCP client or script)
memory.rules.upsert_markdown({
  documents: [
    { path: ".aitools/rules/security-general.md" },
    { path: ".aitools/rules/architecture-layers.md" },
    { path: ".aitools/rules/testing-standards.md" }
  ]
})

# Result:
# ✓ Parsed 3 documents
# ✓ Created 45 directives
# ✓ Created 12 sections
# ✓ Created 3 rules
# ✓ Created 120 relations
```

**Step 4: Verify**
```bash
memory.rules.query_directives({
  taskDescription: "Add user login API",
  options: { maxItems: 5 }
})

# Returns top 5 security + API directives
```

---

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)

**Goal**: Get Memory MCP server running with basic extension

- [ ] Set up Memory MCP server locally
- [ ] Create sample rule documents (3-5 rules)
- [ ] Implement `memory.rules.upsert_markdown()` tool
- [ ] Ingest sample rules into graph
- [ ] Verify storage with `memory.search_nodes`

**Deliverable**: Working knowledge graph with sample data

### Phase 2: Context Detection (Weeks 3-4)

**Goal**: Implement intelligent context detection

- [ ] Build layer detection heuristics
- [ ] Build topic extraction logic
- [ ] Implement `memory.rules.detect_context()` tool
- [ ] Test with 20+ diverse task descriptions
- [ ] Tune detection accuracy to >80%

**Deliverable**: Reliable context detection engine

### Phase 3: Query & Ranking (Weeks 5-7)

**Goal**: Implement the core query_directives tool

- [ ] Implement ranking algorithm
- [ ] Implement token budget management
- [ ] Implement context_block formatting
- [ ] Build `memory.rules.query_directives()` tool
- [ ] Test with 50+ task/directive combinations
- [ ] Optimize ranking weights based on quality

**Deliverable**: Production-ready query tool

### Phase 4: Tool Integration (Week 8)

**Goal**: Integrate with Roo-Cline or Cline

- [ ] Add MCP configuration to coding tool
- [ ] Add system prompt instructions
- [ ] Test with 10 real coding tasks
- [ ] Measure token usage reduction
- [ ] Measure output quality improvement

**Deliverable**: Integrated coding assistant with memory

### Phase 5: Production Hardening (Weeks 9-10)

**Goal**: Make it production-ready

- [ ] Add error handling and fallbacks
- [ ] Implement caching layer
- [ ] Add monitoring and logging
- [ ] Write documentation
- [ ] Create rule authoring guide

**Deliverable**: Production-ready system

### Phase 6: Scale & Optimize (Weeks 11-12)

**Goal**: Scale to large projects

- [ ] Performance testing with 500+ rules
- [ ] Optimize graph queries
- [ ] Add incremental rule updates
- [ ] Add rule versioning
- [ ] Build rule validation tools

**Deliverable**: Enterprise-scale solution

---

## Success Metrics

### Quantitative Metrics

| Metric | Baseline (No Memory) | Target (With Memory) | Measurement |
|--------|---------------------|---------------------|-------------|
| **Context tokens per task** | 5,000-15,000 | 800-1,500 | Prompt analysis |
| **Token cost per 1000 tasks** | $75-$225 | $12-$23 | API usage |
| **Relevant directives surfaced** | 30-40% | 85-95% | Manual review |
| **Context retrieval latency** | N/A | <400ms | Tool timing |
| **False positive rate** | N/A | <10% | Directive relevance |

### Qualitative Metrics

**Code Quality Improvements:**
- Security vulnerabilities: Reduced by 60-80%
- Architecture violations: Reduced by 70-90%
- Code review cycles: Reduced by 40-60%
- Time to production: Reduced by 20-30%

**Developer Experience:**
- Setup time: Reduced from hours to minutes
- Rule maintenance: Centralized, version-controlled
- Consistency: High across all generated code
- Trust: Increased confidence in AI outputs

### Success Criteria (Phase 4)

A successful integration will demonstrate:
1. ✅ 70%+ reduction in context tokens
2. ✅ 85%+ relevant directives in top 8 results
3. ✅ <400ms query latency (P95)
4. ✅ Zero security violations in generated code
5. ✅ Developers prefer AI-generated code over manual

---

## Risk Analysis & Mitigation

### Technical Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| **Memory MCP server performance** | High | Medium | Cache aggressively; monitor query times; optimize graph structure |
| **Context detection accuracy** | High | Medium | Extensive testing; fallback to safe defaults; allow manual overrides |
| **Ranking algorithm bias** | Medium | Medium | A/B test weights; gather feedback; iterate |
| **Token budget exceeded** | Low | Low | Conservative estimation; hard limits; graceful degradation |

### Operational Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| **Rule documents out of sync** | Medium | High | Automated ingestion on commit; CI/CD validation |
| **Memory MCP unavailable** | High | Low | Fallback to static core rules; graceful degradation |
| **Graph corruption** | High | Very Low | Regular backups; validation checks; rollback capability |

### Adoption Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| **Developers don't write rules** | High | Medium | Provide templates; automate initial extraction; show value early |
| **Too complex for teams** | Medium | Low | Simple markdown format; good docs; training materials |
| **Resistance to AI tools** | Low | Low | Demonstrate quality improvements; measure impact; iterate |

---

## Cost-Benefit Analysis

### Development Costs

| Phase | Effort | Cost (at $150/hr) |
|-------|--------|------------------|
| Phase 1: Foundation | 60 hours | $9,000 |
| Phase 2: Context Detection | 80 hours | $12,000 |
| Phase 3: Query & Ranking | 120 hours | $18,000 |
| Phase 4: Integration | 40 hours | $6,000 |
| Phase 5: Hardening | 80 hours | $12,000 |
| Phase 6: Scale | 80 hours | $12,000 |
| **Total** | **460 hours** | **$69,000** |

### Ongoing Costs

- **Rule maintenance**: 5-10 hours/month (~$1,500/month)
- **Memory MCP hosting**: Negligible (runs locally or on dev machines)
- **Monitoring**: Included in existing observability

### Savings (Annual, for 50-developer team)

| Benefit | Calculation | Annual Value |
|---------|-------------|--------------|
| **Token cost reduction** | 1000 tasks/dev/year × 10K tokens saved × $0.015/1K = $150/dev | $7,500 |
| **Faster development** | 2 hours saved/dev/week × 50 weeks × $150/hr = $15,000/dev | $750,000 |
| **Reduced code review** | 1 hour saved/dev/week × 50 weeks × $150/hr = $7,500/dev | $375,000 |
| **Fewer production bugs** | 10 bugs/dev/year × 5 hours/bug × $150/hr = $7,500/dev | $375,000 |

**Total Annual Savings**: $1,507,500

**ROI**: (($1,507,500 - $69,000 - $18,000) / $69,000) × 100 = **2,031%**

**Payback Period**: ~2 weeks

---

## Conclusion

Knowledge graph-based memory for AI coding assistants represents a fundamental shift from "dump everything" to "retrieve what matters." By combining semantic search with domain-specific ranking, we can:

1. **Reduce token usage by 70-85%** while improving context quality
2. **Ensure consistency** across all AI-generated code
3. **Encode institutional knowledge** in a maintainable, version-controlled format
4. **Scale to enterprise projects** with hundreds of rules
5. **Deliver measurable ROI** in weeks, not months

The solution leverages the open-source Memory MCP server with targeted extensions, making it practical to implement and integrate with existing tools like Roo-Cline and Cline.

### Next Steps

1. **Validate the vision**: Share with stakeholders and gather feedback
2. **Proof of concept**: Build Phase 1 (Foundation) with sample rules
3. **Pilot**: Integrate with one team's Roo-Cline/Cline setup
4. **Measure**: Track token usage, quality, and developer satisfaction
5. **Scale**: Roll out to additional teams based on success

### Call to Action

This vision document provides the blueprint. The technology exists. The benefits are clear. The next step is execution.

**Who should own this?**
- Development Tools Team (implementation)
- Architecture Team (rule authoring standards)
- DevEx Team (integration and rollout)

**Timeline**: 12 weeks from kickoff to production-ready system

**Investment**: $69K development + $1.5K/month maintenance

**Return**: $1.5M+ annual savings, immeasurable quality improvements

Let's build it.

---

## Appendix A: Technology Stack

- **Memory MCP Server**: [GitHub](https://github.com/modelcontextprotocol/servers/tree/main/src/memory)
  - Language: TypeScript
  - Storage: SQLite
  - Embeddings: Customizable (OpenAI, local, etc.)

- **MCP Protocol**: [Documentation](https://modelcontextprotocol.io/)
  - Standard: JSON-RPC over stdio/HTTP
  - Supported by: Claude, Roo-Cline, Cline, Continue

- **Coding Tools**:
  - Roo-Cline: [VS Code Extension](https://marketplace.visualstudio.com/items?itemName=RooVeterinaryInc.roo-cline)
  - Cline: [VS Code Extension](https://marketplace.visualstudio.com/items?itemName=saoudrizwan.claude-dev)

## Appendix B: Sample Rules Library Structure

```
.aitools/rules/
├─ 1-presentation/
│  ├─ react-components.md
│  ├─ ui-accessibility.md
│  └─ frontend-security.md
├─ 2-application/
│  ├─ service-patterns.md
│  ├─ business-logic.md
│  └─ validation.md
├─ 3-domain/
│  ├─ entity-design.md
│  ├─ value-objects.md
│  └─ domain-events.md
├─ 4-persistence/
│  ├─ repository-pattern.md
│  ├─ sql-safety.md
│  └─ migrations.md
├─ 5-Tests/
│  ├─ testing-standards.md
│  └─ test-strategy.md
├─ 6-Docs/
│  ├─ architecture-decisions.md
│  └─ onboarding.md
├─ 7-Deployment/
│  ├─ azure-deployment.md
│  ├─ docker-best-practices.md
│  └─ monitoring.md
└─ cross-cutting/
   ├─ security-general.md
   ├─ code-quality.md
   └─ error-handling.md
```

## Appendix C: References

1. Memory MCP Server: https://github.com/modelcontextprotocol/servers/tree/main/src/memory
2. MCP Protocol: https://modelcontextprotocol.io/
3. Claude API: https://docs.anthropic.com/
4. Knowledge Graphs for RAG: https://arxiv.org/abs/2312.10997
5. Token Cost Calculator: https://anthropic.com/pricing

---

**Document Version**: 1.0  
**Last Updated**: October 2025  
**Authors**: David Palfery & Claude 
**Status**: Draft for Review