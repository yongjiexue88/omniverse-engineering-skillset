---
name: omniverse-brainstorm
description: Generate and narrow engineering options before planning or implementation. Use when the user asks to brainstorm features, approaches, architecture options, product directions, refactor paths, agent workflows, or tradeoff-heavy solution ideas.
---

# Omniverse Brainstorm

Use this skill to expand the option space without losing engineering discipline.

## Workflow

1. Restate the problem in one sentence.
2. List constraints already visible in the repo, request, or environment.
3. Generate 3-7 viable approaches with different tradeoffs.
4. For each approach, name the implementation shape, upside, cost, risk, and validation path.
5. Recommend one approach only after the alternatives are clear.

## Output Shape

Use this structure:

- `Problem`: what needs to be solved.
- `Constraints`: facts that shape the solution.
- `Options`: concrete paths, not vague themes.
- `Recommendation`: the best path and why.
- `Next step`: what to inspect, prototype, or decide next.

## Rules

- Keep speculation labeled.
- Prefer options that can be tested cheaply.
- Do not bury the recommended path in a long list.
- If the user wants code, continue into implementation after choosing the approach.
