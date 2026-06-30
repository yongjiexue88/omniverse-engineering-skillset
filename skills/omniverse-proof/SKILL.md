---
name: omniverse-proof
description: Build an evidence packet for claims about correctness, readiness, or behavior. Use when the user asks to prove something works, gather validation evidence, audit claims, prepare handoff proof, or verify a release assertion.
---

# Omniverse Proof

Use this skill to connect claims to evidence.

## Workflow

1. List the claims that must be true.
2. For each claim, identify the strongest available evidence.
3. Run or cite tests, logs, screenshots, diffs, traces, or docs.
4. Mark unsupported claims as unproven.
5. Summarize residual risk.

Use `scripts/create-proof-packet.js "<claim set>"` when the evidence should be saved under `docs/proof/`.

## Evidence Table

| Claim | Evidence | Result | Confidence |
| --- | --- | --- | --- |

## Rules

- Evidence must be reproducible or directly inspectable.
- Do not treat a passing build as proof of unrelated behavior.
- Include exact commands and outcomes when possible.
- Keep uncertainty visible.
