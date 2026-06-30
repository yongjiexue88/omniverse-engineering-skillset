---
name: omniverse-compound
description: Capture durable project learnings after solving a hard issue. Use when the user asks to document what was learned, preserve debugging knowledge, write a solution note, or prevent the same problem from being rediscovered later.
---

# Omniverse Compound

Use this skill to turn completed work into reusable repository memory.

## Workflow

1. Identify the concrete problem and why it was non-obvious.
2. Record the root cause, failed paths, final fix, and validation.
3. Save a concise note under `docs/solutions/` when writing files is appropriate.
4. Link related files, commands, issues, PRs, or logs.
5. Add follow-up checks only when they would prevent recurrence.

## Solution Note Shape

Use `scripts/create-solution-note.js "<problem>"` to create the standard `docs/solutions/` file when writing is appropriate.

```markdown
# <Problem>

Date: YYYY-MM-DD

## Context
## Root Cause
## Fix
## Validation
## Reuse This When
## Related Files
```

## Rules

- Capture facts and repeatable signals, not a diary.
- Do not include secrets, tokens, private customer data, or sensitive logs.
- Keep notes short enough that a future agent can scan them quickly.
