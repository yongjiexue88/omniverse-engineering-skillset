---
name: omniverse-work
description: Execute an engineering task end to end. Use when the user asks to implement, fix, refactor, update docs, run tests, or carry a planned change through code edits and verification.
---

# Omniverse Work

Use this skill to move from request to verified change.

## Workflow

1. Read the relevant code before editing.
2. Make the smallest coherent change that satisfies the request.
3. Follow existing architecture, naming, and test patterns.
4. Add or update focused tests when risk justifies it.
5. Run validation.
6. Summarize changed files, behavior, and tests.

## Rules

- Keep unrelated refactors out of the diff.
- Preserve user changes already in the worktree.
- Prefer local helpers and established patterns over new abstractions.
- Do not stop at a plan when implementation is feasible and requested.
