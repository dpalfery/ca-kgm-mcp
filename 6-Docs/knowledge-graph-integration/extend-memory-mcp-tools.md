# Extend Memory MCP: Rules-Oriented Tooling Design

Status
- Phase: Design only (no code)
- Decision: Extend the existing Memory MCP server with domain tools for rules retrieval to avoid an additional MCP hop and reduce tokens.
- Reference baseline: [`.kilocode/mcp.json`](.kilocode/mcp.json:1), Memory MCP upstream docs

Goal
- Provide modes a single, high-level tool on the Memory MCP that:
  - Accepts task text and mode hint
  - Detects layer/topics
  - Performs targeted retrieval over the existing knowledge graph
  - Ranks results with domain scoring
  - Returns a compact, ready-to-append markdown block + citations
- Keep ingestion/storage/search responsibilities of Memory MCP intact; add a rules-aware orchestrating facade to it.

Design Summary
- Add three new tools to Memory MCP:
  1) [`memory.rules.query_directives()`](6-Docs/specs/knowledge-graph-integration/extend-memory-mcp-tools.md:1) → primary entrypoint used by modes at task start
  2) [`memory.rules.detect_context()`](6-Docs/specs/knowledge-graph-integration/extend-memory-mcp-tools.md:1) → standalone context detection (optional)
  3) [`memory.rules.upsert_markdown()`](6-Docs/specs/knowledge-graph-integration/extend-memory-mcp-tools.md:1) → optional higher-level ingestion wrapper that composes underlying create_entities/create_relations (for easier ops)

All other existing Memory MCP tools remain unchanged and may be called internally by these rules.* tools (e.g., search_nodes, open_nodes, read_graph).

Integration Model (text-only modes)
- Each mode (Architect, Code, Debug) is instructed to call only [`memory.rules.query_directives()`](6-Docs/specs/knowledge-graph-integration/extend-memory-mcp-tools.md:1) at task start and prepend the returned context_block to its reasoning.
- No platform hooks required.

Token Efficiency
- Single MCP server
- Single call per task (default)
- Server returns a compact markdown context_block ≤ tokenBudget (default: ~900 tokens)

--------------------------------------------------------------------

Tool Specifications (Design Only)

1) [`memory.rules.query_directives()`](6-Docs/specs/knowledge-graph-integration/extend-memory-mcp-tools.md:1)
- Purpose
  - One-call interface for modes to obtain a compact, ranked rules bundle for a given task.
  - Internally:
    - Detects layer/topics (or accepts overrides)
    - Calls `search_nodes` (and `open_nodes` as needed)
    - Applies domain ranking
    - Formats a final markdown block with citations
- Input (JSON Schema, conceptual)
  - taskDescription: string (required) — raw user task text
  - modeSlug: string (optional) — hints: architect, code, debug, next, net
  - options (object, optional):
    - strictLayer: boolean (default true) — enforce layer filter rather than boost
    - maxItems: number (default 8; clamp 3–12) — maximum directives to surface
    - tokenBudget: number (default 900) — soft cap for context_block tokens
    - includeBreadcrumbs: boolean (default true)
    - includeDiagnostics: boolean (default false)
    - topicsBias: string[] (optional) — user-provided topic hints; bias ranking
- Output
  - context_block: string (markdown, ready to prepend to prompt)
  - citations: Array<{ sourcePath: string, section?: string, severity?: string }>
  - diagnostics (optional when includeDiagnostics true):
    - detectedLayer: string | null
    - topics: string[]
    - keywords: string[]
    - scoringNotes: string[]
    - retrievalStats: { searched: number, considered: number, selected: number }
- Behavior (server-side)
  1) If options provides topicsBias/layer overrides, honor them
  2) Context detection (fallback) via [`memory.rules.detect_context()`](6-Docs/specs/knowledge-graph-integration/extend-memory-mcp-tools.md:1)
  3) Build retrieval plan:
     - semantic terms: taskDescription + keywords
     - filters:
       - layer: detectedLayer when strictLayer=true; otherwise boost
       - topics: detected topics + topicsBias
       - entityTypes: ["Directive", "Rule", "Section"]
       - limit: maxItems * 3 (pre-ranking)
  4) Call Memory MCP `search_nodes` and expand with `open_nodes` where necessary
  5) Rank with domain weights (see Ranking Model)
  6) Select top N (≤ maxItems) under tokenBudget
  7) Format `context_block`:
     - Header with short title
     - Bullet list of directives: "[MUST|SHOULD|MAY] text" with breadcrumbs when enabled
     - Short rationale per directive (layer/topic alignment)
  8) Return `context_block`, citations, and optional diagnostics

2) [`memory.rules.detect_context()`](6-Docs/specs/knowledge-graph-integration/extend-memory-mcp-tools.md:1)
- Purpose
  - Expose the context detection subroutine independently (useful for tooling/tests or advanced clients)
- Input
  - text: string (required)
  - options (optional):
    - modeSlug: string
    - returnKeywords: boolean (default true)
- Output
  - detectedLayer: string | null (e.g., "1-Presentation", "4-Persistence")
  - topics: string[] (e.g., ["security", "testing", "architecture"])
  - keywords: string[] (top technical tokens)
  - confidence: number (0–1)
- Behavior (server-side)
  - Uses fast heuristic patterning for layers and topics
  - May apply small biases based on modeSlug

3) [`memory.rules.upsert_markdown()`](6-Docs/specs/knowledge-graph-integration/extend-memory-mcp-tools.md:1)
- Purpose
  - Provide a higher-level ingestion wrapper to simplify ops, composing existing `create_entities` and `create_relations` into a single request. Optional if ingest is handled elsewhere.
- Input
  - documents: Array<{ path: string, content?: string }>
    - path may be enough for server-side file read (config dependent)
  - options (optional):
    - overwrite: boolean (default true) — replace existing observations/relations for same IDs
    - batchSize: number (default 100)
- Output
  - upserted: { rules: number, sections: number, directives: number, patterns: number }
  - relations: number
  - warnings: string[]
- Behavior (server-side)
  - Parse markdown → produce entities + relations
  - Deterministic IDs (path + section anchor + directive index)
  - Upsert via core Memory MCP primitives

--------------------------------------------------------------------

Ranking Model (applies inside [`memory.rules.query_directives()`](6-Docs/specs/knowledge-graph-integration/extend-memory-mcp-tools.md:1))
- Weighted priority order:
  1) Authority match (rule.AuthoritativeFor includes detected topic) — very high
  2) When-to-apply alignment (layer/topic in rule metadata) — high
  3) Layer match — high (strict filter or strong boost)
  4) Topic overlap — medium
  5) Severity boost — MUST > SHOULD > MAY
  6) Semantic similarity — medium
  7) Entity type preference — Directive > Rule > Section > Pattern
- De-duplication:
  - Remove near-duplicate directives by similarity over first 100 chars
- Token budget enforcement:
  - Iteratively include directives until tokenBudget approximated; always prefer higher-ranked items

Formatting Model (output `context_block`)
- Title: "Contextual Rules for Task"
- Bullets:
  - "[MUST] Validate all inputs client and server"
  - "[MUST] Authorize every action after authentication check"
  - "[SHOULD] Presentation layer calls into Application only"
- Each bullet includes:
  - optional rationale (e.g., "applies to 1-Presentation; covers security")
  - optional breadcrumb "Security General Rule > Input Validation"
  - citations returned separately for audit/logging

Failure Modes & Fallbacks
- Memory MCP unavailable → return minimal `context_block` with links to:
  - [`.kilocode/rules/base-rule.md`](.kilocode/rules/base-rule.md:1)
  - [`.kilocode/rules/security-general-rule.md`](.kilocode/rules/security-general-rule.md:1)
  - [`.kilocode/rules/architecture-general.md`](.kilocode/rules/architecture-general.md:1)
- No matches → return minimal `context_block` with core rules and diagnostics
- Oversized taskDescription → truncate internally, add diagnostics

Security & Compliance
- No secrets handled; rule text only
- Sanitization: never emit environment variables or secrets in output
- Consistent with:
  - [`.kilocode/rules/security-general-rule.md`](.kilocode/rules/security-general-rule.md:1)
  - [`.kilocode/rules/code-quality-general-rule.md`](.kilocode/rules/code-quality-general-rule.md:1)

Mode Instruction Snippet (for documentation only)
- Architect/Code/Debug mode text:
  - "At the start of a task, call [`memory.rules.query_directives()`](6-Docs/specs/knowledge-graph-integration/extend-memory-mcp-tools.md:1) with the full task text and your mode name. Prepend the returned context_block to your reasoning. Prefer MUST items. If the tool is unavailable, fall back to base/security/architecture core rules."

Operational Notes
- Performance targets:
  - 200–400 ms typical per query at the designed graph size
- Defaults:
  - strictLayer: true
  - maxItems: 8
  - tokenBudget: 900
- Caching (optional implementation detail):
  - Cache by hash(taskDescription) with TTL; invalidate on source doc changes

Rollout
- Phase 1: Implement [`memory.rules.query_directives()`](6-Docs/specs/knowledge-graph-integration/extend-memory-mcp-tools.md:1) only; document mode snippet
- Phase 2 (optional): Add [`memory.rules.detect_context()`](6-Docs/specs/knowledge-graph-integration/extend-memory-mcp-tools.md:1) for testing and advanced clients
- Phase 3 (optional): Add [`memory.rules.upsert_markdown()`](6-Docs/specs/knowledge-graph-integration/extend-memory-mcp-tools.md:1) if ingestion simplification is desired

End State
- Single MCP server (Memory MCP) providing both storage/search and rule-aware retrieval
- Modes make one call per task to get a compact, ranked, properly-cited rules block
- No additional orchestrator MCP required; token and operationally efficient