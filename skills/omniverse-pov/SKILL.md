---
name: omniverse-pov
description: Produce a clear engineering point of view. Use when the user asks for a recommendation, technical stance, architecture decision, build-versus-buy judgment, strategy memo, or tradeoff summary.
---

# Omniverse POV

Use this skill to make a defensible technical recommendation.

## Workflow

1. State the decision being made.
2. Name the decision criteria.
3. Compare plausible options.
4. Recommend one option.
5. Explain the tradeoffs and conditions that would change the answer.

## Output Shape

- `Decision`
- `Recommendation`
- `Why`
- `Alternatives considered`
- `Risks`
- `Trigger to revisit`

## Rules

- Be direct. Avoid false balance when evidence favors one path.
- Separate facts from preferences.
- Tie the recommendation to constraints, not generic best practices.
