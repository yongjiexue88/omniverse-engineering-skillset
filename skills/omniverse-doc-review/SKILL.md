---
name: omniverse-doc-review
description: Review engineering documentation. Use when checking API docs, README changes, architecture docs, ADRs, setup guides, release notes, runbooks, design specs, or migration instructions for accuracy and usefulness.
---

# Omniverse Doc Review

Review docs as operational interfaces.

## Workflow

1. Identify the target reader and the action the doc should enable.
2. Verify claims against code, config, schemas, commands, and current behavior.
3. Check missing prerequisites, failure modes, rollback steps, and ownership.
4. Flag ambiguity that could cause a wrong implementation or operation.
5. Suggest concise edits, not a full rewrite unless requested.

## Review Axes

- Accuracy
- Completeness
- Ordering
- Environment assumptions
- Security or secret handling
- Copy-paste safety
- Staleness against current code

## Rules

- Prefer concrete corrections with file references.
- Do not optimize wording before correctness.
- If a doc is aspirational rather than current, label that distinction.
