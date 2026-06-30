---
name: omniverse-simplify-code
description: Simplify existing code without changing behavior. Use when the user asks to reduce complexity, remove unnecessary abstraction, clarify control flow, shrink duplication, or make code easier to maintain.
---

# Omniverse Simplify Code

Use this skill to make code easier to reason about while preserving behavior.

## Workflow

1. Identify the behavior that must remain unchanged.
2. Find complexity sources: indirection, duplicated branches, hidden state, mixed concerns, or broad abstractions.
3. Choose one simplification at a time.
4. Keep public contracts stable unless the user requested an API change.
5. Run tests before and after if available.

## Preferred Moves

- Inline needless wrappers.
- Split mixed responsibilities.
- Replace clever branching with explicit cases.
- Remove dead paths after verifying they are unused.
- Consolidate repeated validation or serialization.

## Rules

- Do not simplify by deleting edge-case handling.
- Avoid style-only rewrites.
- Keep diffs reviewable.
