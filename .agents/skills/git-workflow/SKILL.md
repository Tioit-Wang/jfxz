---
name: git-workflow
description: "Git workflow automation: branching strategies, conventional commits, PR workflows, and safe git operations. Use when the user needs to commit, create branches, manage PRs, or follow git best practices."
---

# Git Workflow

## Branching Strategy

- **main** — production-ready, protected, requires PR + review
- **feat/<name>** — new features, branched from main
- **fix/<name>** — bug fixes, branched from main
- **chore/<name>** — tooling, config, maintenance
- **docs/<name>** — documentation only

## Commit Convention (Conventional Commits)

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `style`, `perf`, `ci`

## Safe Git Operations

**Before destructive commands, verify:**
- `git status` — check for uncommitted work
- `git log --oneline -5` — confirm current position
- Never force-push to main/master without explicit confirmation
- Never use `--no-verify` unless explicitly asked
- Prefer `git switch -c` over `git checkout -b`

## PR Workflow

1. Ensure branch is up to date with target: `git rebase main` or `git merge main`
2. Run tests: verify CI/local tests pass
3. Create PR with:
   - Clear title (< 70 chars) summarizing change
   - Description: what, why, test plan
   - Link to related issue if applicable
4. Address review feedback with additional commits

## Common Operations

- **New feature:** `git switch -c feat/description main`
- **Amend last commit:** Only if not pushed, only when explicitly asked
- **Squash before merge:** Use rebase interactive only through explicit workflow
- **Undo local changes:** `git restore <file>` (safer than `git checkout -- <file>`)
