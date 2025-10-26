
name: "MUST-READ-Rule"
description: "Sets Must follow rules and framework for when to use which rule."
when-to-apply: "always"
rule: |
Non‑Negotiable Global Rules (apply always)

1. Security (zero tolerance): Never commit secrets; use environment variables (e.g., Environment.GetEnvironmentVariable). Parameterize all SQL; sanitize/escape all inputs and logs. Enforce HTTPS and least-privilege authorization for every action — see [`​.kilocode/rules/security-general-rule.md`](.kilocode/rules/security-general-rule.md:1).  
2. Always use context7 when I need code generation, setup or configuration steps, or library/API documentation. This means you should automatically use the Context7 MCP
tools to resolve library id and get library docs without me having to explicitly ask.
3. Build Quality: Fix build errors and warnings immediately; treat warnings as errors in CI — see [`​.kilocode/rules/code-quality-general-rule.md`](.kilocode/rules/code-quality-general-rule.md:1).  
4. Architecture: Never ever put any project or code file in the root of the project always Respect numbered folder layering (0-Base → 7-Deployment); dependencies must flow downward only — see [`​.kilocode/rules/architecture-general.md`](.kilocode/rules/architecture-general.md:1).  
5. Data Access: Use native ADO.NET only; no Entity Framework. Manage schema with FluentMigrator where applicable — see [`​.kilocode/rules/architecture-general.md`](.kilocode/rules/architecture-general.md:1).

Task‑Start Requirements (must perform before changes)
- Identify which architectural layer the work touches (0–7). ([`​.kilocode/rules/architecture-general.md`](.kilocode/rules/architecture-general.md:1))  
- Check security constraints and secrets handling (do not hardcode secrets). ([`​.kilocode/rules/security-general-rule.md`](.kilocode/rules/security-general-rule.md:1))  
- Ensure build compiles with zero warnings and required tests pass or are added. ([`​.kilocode/rules/code-quality-general-rule.md`](.kilocode/rules/code-quality-general-rule.md:1))

Situational Rule Pointers (consult only when relevant)

- File placement & architecture decisions: when creating/moving files or enforcing layer boundaries → [`​.kilocode/rules/architecture-general.md`](.kilocode/rules/architecture-general.md:1)  
- Build, logging, error handling, CI quality gates → [`​.kilocode/rules/code-quality-general-rule.md`](.kilocode/rules/code-quality-general-rule.md:1)  
- Tests & coverage requirements: when adding/updating tests or measuring coverage → [`​.kilocode/rules/testing-general-rule.md`](.kilocode/rules/testing-general-rule.md:1)  
- Process, CLI commands, Windows shell guidance, task tracking → [`​.kilocode/rules/process-general-rule.md`](.kilocode/rules/process-general-rule.md:1)  


