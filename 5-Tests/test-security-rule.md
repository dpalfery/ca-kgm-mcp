---
name: "Security General Rule"
description: "Enforces fundamental security practices that apply across all development activities"
layer: "4-Persistence"
authoritativeFor: ["security", "authentication", "authorization", "input-validation", "secrets-management"]
topics: ["security", "authentication", "authorization", "input-validation", "secrets-management", "sql-injection", "xss-prevention"]
severity: "MUST"
when-to-apply: ["always", "api-development", "database-operations", "user-input-handling"]
---

# Security General Rule

This document is authoritative for security directives; other rule files must reference it for security-related guidance.

## Secrets Management

[MUST] Never use a .env file always use environment variables. If they don't exist ask the user to create one for you.
[MUST] Never check secrets into source control or store them in plain text.
[MUST] Appsettings files are not secure and secrets and passwords should never be stored there.
[MUST] Database connection strings are secrets and should never be stored in any file. Every for any reason. Even as a fall back or generic string. I never want to see var connectionstring="some string" in my code.
[MUST] It is better app not work than for a secret to be exposed. Never under any circumstances are you to put a password, secret, token or connection string or any other secure value in a file on users computer. I mean NEVER!!!!!!!!!!

## Input Validation & Sanitization

[MUST] ESCAPE ALL INPUTS contextually before use:
- For SQL: Use parameterized queries ONLY. Never construct queries with string concatenation.
- For HTML/UI: Encode output before rendering to prevent XSS.
- For OS Commands: Avoid if possible. If necessary, use APIs that accept arguments as a list, not a single command string.
[MUST] SANITIZE BEFORE LOGGING: For any user-provided data going into a log, you MUST:
- Replace newlines and tabs with spaces.
- Use structured logging with placeholders.
[MUST] NEVER do: logger.LogInfo("User " + rawUserInput + " logged in").

## Secure Communication & Configuration

[MUST] ENFORCE HTTPS: Any code configuring a web server must:
- Redirect HTTP to HTTPS.
- Set HSTS headers.

## Authentication & Authorization

[MUST] PRINCIPLE OF LEAST PRIVILEGE: When defining roles or permissions, default must be no access. Permissions are explicitly granted.
[MUST] AUTHORIZE EVERY ACTION: For any function that accesses data or performs an action, you MUST see an authorization check after authentication check.

## Dependency & Operational Security

[SHOULD] FLAG VULNERABLE DEPENDENCIES: If you generate a dependency file, include a comment instructing user to regularly scan for vulnerabilities.
[SHOULD] IMPLEMENT RATE LIMITING: Enforce rate limiting on public APIs. Document requirements in code and infrastructure.