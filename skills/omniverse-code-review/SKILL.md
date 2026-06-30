---
name: omniverse-code-review
description: Perform production-focused code review. Use when reviewing diffs, pull requests, branches, files, generated code, or implementation changes for correctness, security, tests, regressions, maintainability, and release risk.
---

# Omniverse Code Review

Review like a senior engineer protecting production behavior.

## Workflow

1. Inspect the diff and nearby call sites before judging.
2. Identify correctness, data integrity, auth, concurrency, error handling, performance, and migration risks.
3. Check whether tests cover the risky behavior and failure modes.
4. Separate blocking findings from nits and optional refactors.
5. Provide actionable fixes with file and line references where possible.

## Output Shape

Lead with findings:

- `Severity`: critical, high, medium, low.
- `Location`: file and line.
- `Issue`: the behavior that can fail.
- `Impact`: why it matters.
- `Fix`: the smallest safe correction.

Then include:

- `Open questions`
- `Tests or validation gaps`
- `Summary`

## Rules

- Findings first. Do not start with praise or a broad summary.
- Do not flag style preferences unless they hide real risk.
- If no findings exist, say that clearly and name residual risk.
- When reviewing generated code, check integration contracts more carefully than formatting.
