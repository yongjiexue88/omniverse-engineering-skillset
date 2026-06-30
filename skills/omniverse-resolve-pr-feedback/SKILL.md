---
name: omniverse-resolve-pr-feedback
description: Address pull request review feedback. Use when the user asks to resolve PR comments, respond to review threads, apply requested changes, triage reviewer feedback, or update a branch after code review.
---

# Omniverse Resolve PR Feedback

Use this skill to turn review feedback into a focused update.

## Workflow

1. Collect reviewer comments and requested changes.
2. Group feedback into must-fix, clarify, disagree, and follow-up.
3. Inspect the current branch before editing.
4. Apply minimal changes that address the real concern.
5. Run targeted validation.
6. Draft responses explaining what changed or why not.

## Rules

- Do not implement broad refactors while resolving narrow feedback.
- If disagreeing, explain with evidence and offer a concrete alternative.
- Keep reviewer replies short and tied to code changes.
- Preserve unrelated local changes.
