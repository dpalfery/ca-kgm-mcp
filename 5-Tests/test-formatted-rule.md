---
name: "Test Security Rule"
description: "Test rule with proper directive formatting"
when-to-apply: "always"
topics: ["security", "authentication"]
layer: "1-Presentation"
---

# Test Security Rule

This is a test rule to verify the directive extraction system works correctly.

## Authentication Requirements

[MUST] All API endpoints must require authentication before processing requests.

[MUST] Use strong password policies with minimum 12 characters, including uppercase, lowercase, numbers, and special characters.

[SHOULD] Implement multi-factor authentication for administrative accounts.

[MAY] Consider using biometric authentication for enhanced security.

## Input Validation

[MUST] Validate all user inputs on both client and server side to prevent injection attacks.

[SHOULD] Use parameterized queries for all database operations.

[MAY] Implement additional input sanitization for enhanced protection.

## Error Handling

[MUST] Never expose internal system details in error messages to end users.

[SHOULD] Log all security-related errors with appropriate detail for monitoring.

[MAY] Implement custom error pages for better user experience.