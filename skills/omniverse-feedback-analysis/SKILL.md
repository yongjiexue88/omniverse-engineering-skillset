---
name: omniverse-feedback-analysis
description: Analyze qualitative feedback into themes and actions. Use when the user asks to synthesize review comments, user feedback, beta notes, bug reports, support threads, recordings, or survey responses.
---

# Omniverse Feedback Analysis

Use this skill to extract signal from messy feedback.

## Workflow

1. Normalize feedback into discrete observations.
2. Cluster observations by user goal, failure mode, or product area.
3. Count repeated themes without losing important outliers.
4. Separate symptoms from likely root causes.
5. Recommend actions with confidence and evidence.

## Output Shape

- `Top themes`
- `Representative evidence`
- `Likely root causes`
- `Recommended actions`
- `Open questions`

## Rules

- Do not invent user intent beyond the evidence.
- Quote short snippets only when useful.
- Keep severity tied to frequency, impact, and reversibility.
