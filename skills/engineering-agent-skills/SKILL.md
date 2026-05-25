---
name: engineering-agent-skills
description: Use this skill to review software engineering work before shipping and guide implementation quality. It helps with system design review, backend architecture technology choices, system design pattern recognition, coding guidelines, low-level design, commit messages, architecture decisions, API documentation, missing tests, risk areas, and reviewer questions.
---

# Engineering Agent Skills

## Purpose

Review software engineering work before it ships and guide implementation quality when requested. Use this skill to find correctness gaps, production risks, unclear decisions, weak documentation, weak low-level design, missing tests, and reviewer questions. Keep the review practical: identify what matters, explain why it matters, and propose concrete fixes.

## When to use

Use this skill when the user asks for help with any of these tasks:

- Reviewing a system design, architecture proposal, design doc, ADR, RFC, or technical plan.
- Choosing backend/system architecture technologies such as API style, database type, indexing strategy, caching, queues, sharding, load balancing, or consistency model.
- Recognizing common system design patterns such as long-running tasks, large blob handling, read scaling, write scaling, multi-step workflows, contention handling, or real-time updates.
- Writing, reviewing, or refactoring code while avoiding overcomplication, broad edits, hidden assumptions, or unverifiable success criteria.
- Writing or improving a Git commit message.
- Reviewing API documentation, integration docs, endpoint specs, or SDK docs.
- Guiding implementation, refactoring, module boundaries, state ownership, concurrency/resource safety, or testable low-level design.
- Combining any of the above into one pre-ship review.

## Inputs to inspect

Inspect only the inputs relevant to the request:

- User-provided text, design notes, API docs, diffs, or code snippets.
- Local repository files when the user asks to review the current project or branch.
- Git diff, commit history, tests, docs, configuration, and release files when available and relevant.
- Reference files in `references/` only when they match the selected workflow.

If a critical input is missing, state the assumption and continue with the strongest review possible. Ask a focused question only when the missing detail changes the likely recommendation.

## Workflow selection

Choose the workflow from the request:

- If the user provides a system design or architecture proposal, use `references/system-design-checklist.md`.
- If the user asks to design or choose backend/system architecture involving networking, APIs, data modeling, database choice, indexing, caching, sharding, consistent hashing, CAP tradeoffs, capacity estimates, or technology selection, use `references/system-design-architecture-decision-playbook.md`.
- If the user asks for system design pattern recognition, architecture pattern selection, or a design involving long-running tasks, large blobs, read scaling, write scaling, multi-step processes/workflows, contention, or real-time updates, use `references/system-design-pattern-recognition-playbook.md`; combine it with `references/system-design-architecture-decision-playbook.md` when technology choices or scaling paths need deeper justification.
- If the user provides an architecture decision, ADR, RFC decision, or tradeoff analysis, use `references/architecture-decision-checklist.md`; combine it with `references/system-design-architecture-decision-playbook.md` when the decision is about backend/system architecture technology choices.
- If the user asks for a Git commit message, commit wording, or commit review, use `references/commit-message-guidelines.md`.
- If the user provides API docs, endpoint specs, SDK docs, or integration docs, use `references/api-doc-review-checklist.md`.
- If the user asks for implementation, refactoring, class/module design, state ownership, dependency boundaries, concurrency/resource handling, or testable code structure, use `references/low-level-design-coding-principles.md`; combine it with `references/coding-guidelines.md` for behavioral coding guardrails.
- If the user specifically asks for coding guidelines, avoiding LLM coding mistakes, simplicity, surgical changes, explicit assumptions, or verifiable success criteria, use `references/coding-guidelines.md`.
- If the request is mixed, combine the relevant workflows and avoid duplicating findings.

## General review workflow

1. Identify the artifact type, audience, shipping context, and risk level.
2. Load only the reference files needed for the selected workflow.
3. Review for correctness, edge cases, backward compatibility, security/auth, error handling, observability, performance, maintainability, testing, documentation clarity, user-facing impact, and production risk.
4. Separate blocking issues from improvements and wording suggestions.
5. For each important issue, explain the impact and give a concrete remediation.
6. Call out missing information, assumptions, and reviewer questions.
7. End with a concise ship/no-ship recommendation when the context supports it.

## Output formats

For reviews, use:

```md
## Summary

## Blocking Issues

## Non-Blocking Improvements

## Missing Tests

## Risk Areas

## Reviewer Questions

## Recommendation
```

For backend architecture technology choices or "which tool should we use?" decisions, use the recommendation format in `references/system-design-architecture-decision-playbook.md`.

For common system design pattern recognition, architecture pattern selection, or designs involving long-running tasks, large blobs, read scaling, write scaling, multi-step workflows, contention, or real-time updates, use the response shape in `references/system-design-pattern-recognition-playbook.md`.

For Git commit messages, use the format and rules in `references/commit-message-guidelines.md`.

For low-level design or coding guidance, use the response structure in `references/low-level-design-coding-principles.md` when the task is non-trivial.

For small requests, keep the output shorter and include only the sections that add value.

## Style rules

- Be direct, specific, and evidence-based.
- Prefer actionable findings over generic advice.
- Label severity clearly when reviewing code or production-impacting changes.
- Do not invent facts that are not present in the artifact.
- Preserve the user’s intent and improve clarity without overengineering.
- Keep examples short and focused.
- Avoid praise-heavy review language; focus on correctness and risk.

## Final checks

Before responding, verify:

- The selected workflow matches the user’s artifact.
- High-risk issues are clearly separated from minor improvements.
- Security, auth, data integrity, observability, rollout, rollback, and testing were considered when relevant.
- The output gives the user a concrete next step.
- Any assumptions or missing inputs are explicit.
- The response avoids speculative scope, names verification steps, and keeps suggested changes surgical when code changes are involved.
