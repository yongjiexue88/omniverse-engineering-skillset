---
name: omniverse-debug
description: Debug failures with evidence. Use when builds, tests, CI, runtime behavior, integrations, auth flows, data syncs, or agent workflows are broken, flaky, slow, or producing unexpected results.
---

# Omniverse Debug

Debug by reducing uncertainty, not by stacking guesses.

## Workflow

1. Reproduce or collect the exact failure signal.
2. Identify the smallest failing boundary: input, state, dependency, code path, environment, or expectation.
3. Inspect recent changes and nearby tests.
4. Form one hypothesis at a time.
5. Run the cheapest check that can disprove it.
6. Patch narrowly and rerun the failing check plus one regression check.

## Evidence Log

Track:

- `Observed`: command, error, log, screenshot, or response.
- `Expected`: the behavior that should happen.
- `Hypothesis`: what could explain the gap.
- `Check`: what was run or inspected.
- `Result`: what changed in confidence.

## Rules

- Prefer deterministic reproduction over broad refactors.
- Do not mask failures by weakening tests unless the test is wrong and you explain why.
- When blocked by missing credentials or external state, isolate the local part anyway.
