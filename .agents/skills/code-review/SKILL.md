---
name: code-review
description: "Automated code review for PRs and changesets. Checks for bugs, security issues, code quality, test coverage, and consistency. Use when user asks to review code, check a PR, or audit changes."
---

# Code Review

## Review Scope

When reviewing code, check the following dimensions:

### 1. Correctness & Bugs
- Logic errors, off-by-one, null pointer risks
- Race conditions or async issues
- Incorrect API usage
- Missing edge case handling (empty states, error states, boundary values)

### 2. Security
- Command injection (shell commands with user input)
- XSS (unescaped user content in HTML)
- SQL injection (raw query construction)
- Insecure deserialization (pickle, eval)
- Hardcoded secrets, API keys, tokens
- Path traversal (unvalidated file paths)

### 3. Code Quality
- Duplicated code — should it be extracted?
- Over-engineering — is there abstraction that isn't needed?
- Naming — do names reveal intent?
- Function length — is any function doing too much?
- Error handling — are errors caught and handled appropriately?
- Magic numbers/strings — should they be named constants?

### 4. Test Coverage
- Are there tests for the new/changed code?
- Do tests cover the failure modes, not just the happy path?
- Are tests readable and maintainable?
- Do tests avoid unnecessary mocks?

### 5. Consistency
- Follows project conventions (code style, patterns)
- Follows team conventions in CLAUDE.md
- API design is consistent with existing endpoints

## Output Format

Organize findings by severity:

- **BLOCKER** — must fix before merge (bugs, security issues)
- **WARNING** — should fix (code quality, missing edge cases)
- **SUGGESTION** — nice to have (style, minor improvements)

For each finding: file path, line number, what's wrong, and how to fix it.

## Principles

- Be specific: reference exact file paths and line numbers
- Be constructive: suggest how to fix, not just what's wrong
- Prioritize: focus on real issues, not stylistic preferences
- Be concise: one sentence per finding, expand only when needed
- Don't request changes for things covered by auto-formatters or linters
