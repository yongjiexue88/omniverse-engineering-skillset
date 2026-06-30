---
name: omniverse-optimize
description: Improve performance, cost, reliability, or developer workflow after a baseline exists. Use when the user asks to optimize slow code, expensive calls, build times, database queries, API latency, memory use, or operational overhead.
---

# Omniverse Optimize

Optimize with measurements and guardrails.

## Workflow

1. Define the metric and target before changing code.
2. Capture the baseline with commands, logs, traces, or query plans.
3. Identify the dominant cost.
4. Choose the smallest optimization that addresses that cost.
5. Verify the metric improved and behavior stayed equivalent.
6. Add a regression check when the optimization is easy to break.

## Common Levers

- Remove redundant work.
- Move work off critical paths.
- Batch, cache, or precompute.
- Add indexes or reduce query fanout.
- Stream large data instead of buffering.
- Replace quadratic logic with bounded structures.

## Rules

- Do not optimize speculative bottlenecks.
- State tradeoffs such as memory, freshness, complexity, or consistency.
- Preserve readability unless the measured gain justifies complexity.
