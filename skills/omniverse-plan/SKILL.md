---
name: omniverse-plan
description: Create implementation plans and durable plan docs. Use when the user asks to plan a feature, refactor, migration, fix, agent workflow, or multi-step engineering task before code changes.
---

# Omniverse Plan

Use this skill to turn a request into an executable engineering plan.

## Workflow

1. Read the relevant code and docs first.
2. Define scope, non-goals, assumptions, and risks.
3. Break work into ordered steps with verification after risky steps.
4. Identify affected files, contracts, data, tests, and rollout concerns.
5. Persist the plan under `docs/plans/` when the work spans multiple steps or turns.

## Plan Shape

Use `scripts/create-plan.js "<title>"` to create the standard plan file when a durable artifact is useful.

```markdown
# <Plan Title>

Date: YYYY-MM-DD

## Goal
## Current State
## Constraints
## Steps
## Validation
## Risks
## Rollback
```

## Rules

- Do not produce a plan from imagination when local code can be inspected.
- Keep steps specific enough to execute.
- Update task status as work proceeds when a checklist exists.
- If the user asks for implementation, execute after planning.
