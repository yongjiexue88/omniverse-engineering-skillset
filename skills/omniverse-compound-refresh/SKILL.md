---
name: omniverse-compound-refresh
description: Refresh repo memory and reusable learnings before starting work. Use when the user asks to load prior solutions, review project memory, avoid rediscovering previous fixes, or prepare from existing docs before acting.
---

# Omniverse Compound Refresh

Use this skill before work that may repeat known project problems.

## Workflow

1. Search `docs/solutions/`, `docs/plans/`, `docs/reviews/`, and project docs.
2. Read only notes relevant to the current task.
3. Extract constraints, prior decisions, known pitfalls, and validation commands.
4. Apply those learnings to the current plan or review.
5. If notes are stale, update them after confirming the current behavior.

## Search Targets

Prefer:

- `rg "<feature|error|module|domain>" docs`
- `rg "<symbol|route|table|component>" .`
- `git log --oneline -- <path>`

## Rules

- Do not blindly trust old notes; verify against current code.
- Keep loaded memory scoped to the task.
- If no relevant memory exists, say so and continue normally.
