# Knowledge Graph Integration Design (Option A via MCP Orchestrator)

Status
- Mode: Design only (no code changes)
- Scope: Integrate real‑time rule retrieval into Kilo Code using MCP, without internal hooks or extensions

Problem Statement
- Constraint: The only integration point into modes is via text instructions to the model. There are no programmatic pre‑task hooks or extension points.
- Goal: Before each task, provide a compact, ranked bundle of project rules that align to the current task, without dumping all rules.

Decision
- Introduce a lightweight custom MCP server named Rules Orchestrator that modes can call via text instructions. The orchestrator will:
  - Accept the task text and optional hints
  - Internally query the Memory MCP server
  - Apply domain ranking and formatting
  - Return a single compact context block (markdown text) that the mode inserts at task start
- We will NOT fork or modify the open source Memory MCP server; we layer the orchestrator in front of it for composition, agility, and clean boundaries.

Related Files
- MCP config: [`.kilocode/mcp.json`](.kilocode/mcp.json:1)
- Knowledge graph docs: [`6-Docs/knowledge-graph-usage.md`](6-Docs/knowledge-graph-usage.md:1)

Architecture Overview
- Components
  - Rules Orchestrator MCP (new): front door for modes; provides domain‑specific logic and stable API
  - Memory MCP (existing): stores entities and relations (rules, sections, directives, patterns)
  - Modes (Architect, Code, Debug): call Rules Orchestrator via text‑driven tool usage and prepend the returned context block to their reasoning

Mermaid Flow
flowchart TD
  M[Mode receives task text] --> A[Mode calls Rules Orchestrator MCP tool query]
  A --> B[Orchestrator detects layer/topics and builds query]
  B --> C[Orchestrator queries Memory MCP search_nodes with filters]
  C --> D[Orchestrator ranks results authority then when_to_apply then layer then semantics]
  D --> E[Orchestrator formats compact context_block]
  E --> F[Mode prepends context_block then proceeds normally]

Rules Orchestrator MCP Design

- Tools exposed (logical contract)
  - [rules-orchestrator.query()](6-Docs/specs/knowledge-graph-integration/design.md:1)
    - Input:
      - taskDescription: string (required)
      - modeSlug: string (architect | code | debug | next | net | etc.)
      - options:
        - maxItems: number (default 8)
        - strictLayer: boolean (default true)
        - includeBreadcrumbs: boolean (default true)
    - Output:
      - context_block: string (markdown, 300–1200 tokens)
      - diagnostics:
        - detectedLayer: string | null
        - topics: string[]
        - scoringNotes: string[]
      - citations: Array of { sourcePath, section, severity }

- Internal steps
  1) Context detection
     - Detect architectural layer and topics from taskDescription
     - If strictLayer, force filter by layer; else bias ranking
  2) Memory MCP query plan
     - call [memory.search_nodes](.kilocode/mcp.json:1) with:
       - semantic terms: taskDescription + detected keywords
       - filters: layer, topics, entityTypes [Directive, Rule, Section]
       - limit: maxItems * 3
  3) Ranking
     - Priority: authority > when_to_apply > layer match > topic match > severity boost > semantic similarity
     - De‑duplicate near‑identical directives
  4) Formatting
     - Emit a single markdown context_block with:
       - Title
       - Top N directives: [MUST | SHOULD | MAY] directive
       - Rationale: layer and topic alignment
       - Breadcrumb and source (file and section)
     - Keep under a configured token budget
  5) Output
     - Return context_block (one block to prepend), plus diagnostics and citations

Mode Integration (text‑only)
- Since modes only accept text instructions, we will add a small instruction block to each mode definition instructing the model to call the Rules Orchestrator MCP tool at the start of a task.

- Instruction template (insert into each mode):
  - [architect.mode_instructions](6-Docs/specs/knowledge-graph-integration/design.md:1)
  - [code.mode_instructions](6-Docs/specs/knowledge-graph-integration/design.md:1)
  - [debug.mode_instructions](6-Docs/specs/knowledge-graph-integration/design.md:1)

Suggested text to add to each mode
- Start of task:
  - Before reasoning, call MCP server rules-orchestrator tool query with the full task description and your mode name. Insert the returned context_block at the top of your working context. Prefer directives labeled MUST. Respect severity order MUST > SHOULD > MAY. If MCP is not available or returns nothing, fall back to core rules from [`.kilocode/rules/base-rule.md`](.kilocode/rules/base-rule.md:1), [`.kilocode/rules/security-general-rule.md`](.kilocode/rules/security-general-rule.md:1), and [`.kilocode/rules/architecture-general.md`](.kilocode/rules/architecture-general.md:1).

MCP Configuration Changes
- Update [`.kilocode/mcp.json`](.kilocode/mcp.json:1)
  - Add server rules-orchestrator
    - command: npx (or local binary)
    - args: package that exposes the MCP server
  - Permissions for memory:
    - alwaysAllow add: create_relations, add_observations, search_nodes, open_nodes, read_graph, create_entities

Data Contracts & Constraints
- Input contract to [rules-orchestrator.query()](6-Docs/specs/knowledge-graph-integration/design.md:1)
  - taskDescription length: 10–4000 chars
  - modeSlug: used for biasing (e.g., Architect biases architecture topics)
  - options
    - maxItems default 8; clamp 3–12
    - strictLayer default true to avoid irrelevant rules

- Output contract
  - context_block: single markdown block, budgeted (default cap ~900 tokens)
  - citations: include relative file paths and section anchors for auditability
  - diagnostics: optional; hidden from end user unless requested

Security
- Secrets: None. Only rule text and derived metadata are processed.
- PII: None processed or persisted.
- Transport: MCP channels secured by the host (no additional keys required).
- Do not ever include DB connection strings or secrets in context; enforce a sanitizer step in the orchestrator.

Performance & Limits
- Token budget targets:
  - context_block <= 900 tokens (configurable)
- Retrieval latency target:
  - 200–400 ms typical (depends on Memory server and index size)
- Caching:
  - Cache by taskDescription hash with a short TTL (e.g., 5 minutes)
  - Evict cache on rule document modification (if watcher is wired later)

Fallbacks
- If Memory MCP is unavailable:
  - Emit a minimal context_block with links to base core rules:
    - [`.kilocode/rules/base-rule.md`](.kilocode/rules/base-rule.md:1)
    - [`.kilocode/rules/security-general-rule.md`](.kilocode/rules/security-general-rule.md:1)
    - [`.kilocode/rules/architecture-general.md`](.kilocode/rules/architecture-general.md:1)

Testing Plan
- Golden tasks
  - implement new API endpoint → expect security MUST, architecture MUST, testing MUST surfaced first
  - add SQL query optimization → expect 4-Persistence data‑access rules
- Contracts
  - Validate [rules-orchestrator.query()](6-Docs/specs/knowledge-graph-integration/design.md:1) respects maxItems; strictLayer filtering works
- Negative cases
  - Empty taskDescription → return base minimal block
  - Oversized taskDescription → truncate, warn in diagnostics

Rollout Plan
- Phase 1: Create Rules Orchestrator MCP (scaffold only; no behavior change)
- Phase 2: Update [`.kilocode/mcp.json`](.kilocode/mcp.json:1) to include rules-orchestrator; validate server discovery
- Phase 3: Insert the instruction template into Architect, Code, and Debug modes
- Phase 4: Pilot