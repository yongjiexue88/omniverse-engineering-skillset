# Omniverse Engineering Skillset

[![npm version](https://img.shields.io/npm/v/omniverse-engineering-skillset?color=cb3837&label=npm)](https://www.npmjs.com/package/omniverse-engineering-skillset)
![Node.js >=18](https://img.shields.io/badge/node-%3E%3D18-339933)
![Agent skill pack](https://img.shields.io/badge/agent%20skills-ready%20to%20use-7c3aed)
![Focus](https://img.shields.io/badge/focus-reviews%20%7C%20planning%20%7C%20system%20design-0ea5e9)

Make your coding agent a stronger engineering partner across planning, implementation, debugging, review, QA, git workflow, durable learnings, and production-grade system design.

This package installs a ready-to-use skillset that helps your agent reason like a practical senior engineer: clear tradeoffs, focused changes, fewer hidden risks, stronger validation, and better engineering communication.

## Why Use It

| Need | How the skill helps |
| --- | --- |
| Full engineering loop | Adds workflow skills for brainstorming, planning, implementation, debugging, review, testing, polishing, committing, pushing, and PR handoff. |
| Better code reviews | Finds correctness gaps, missing tests, maintainability issues, and production risks. |
| Cleaner implementation plans | Keeps changes focused, testable, and aligned with existing module boundaries. |
| Stronger system design | Guides architecture tradeoffs for feeds, search, queues, caching, workflows, payments, LLM serving, and more. |
| Durable learning | Captures plans, solution notes, QA reports, and proof packets under `docs/` so future agents can reuse them. |
| Sharper engineering writing | Improves commit messages, API docs, release notes, ADRs, PR feedback, and stakeholder updates. |

## What You Get

- 28 bundled skills: one deep engineering judgment skill plus 27 lifecycle workflow skills.
- Workflow coverage for brainstorm, ideate, strategy, plan, work, debug, optimize, simplify, code review, doc review, polish, dogfood, browser QA, Xcode checks, proof, product pulse, promotion, commit, push/PR, PR feedback, worktrees, setup, feedback analysis, and durable learning.
- Skill-local helper scripts for plan files, solution notes, git summaries, browser QA reports, and proof packets.
- Staff-level system design playbooks for common production systems, including feeds, search, queues, caching, rate limiting, real-time messaging, workflows, monitoring, large-file handling, payments, LLM serving, and high-contention inventory.
- Multi-platform plugin manifests for Codex-style plugins plus Claude, Cursor, Kimi, OpenCode, Pi, and Agent Gateway layouts.

## Quick Start

Install from GitHub with the open `skills` CLI:

```bash
npx skills add yongjiexue88/omniverse-engineering-skillset
```

That is the same repo shorthand style as:

```bash
npx skills add Aradotso/trending-skills
```

The `skills` CLI discovers this repo's bundled skills from:

```txt
skills/*/SKILL.md
```

Then it installs the skills into the agent directory you choose, such as:

```txt
.agents/skills/omniverse-plan
```

List the skill before installing:

```bash
npx skills add yongjiexue88/omniverse-engineering-skillset --list
```

Install for a specific agent:

```bash
npx skills add yongjiexue88/omniverse-engineering-skillset --agent codex
npx skills add yongjiexue88/omniverse-engineering-skillset --agent claude-code
```

Install globally instead of into the current project:

```bash
npx skills add yongjiexue88/omniverse-engineering-skillset --global
```

Prefer copied files instead of symlinks:

```bash
npx skills add yongjiexue88/omniverse-engineering-skillset --copy
```

This path does not add `omniverse-engineering-skillset` as a project dependency.

If you want to pin the npm package as a project dependency instead, use the
package-specific installer:

```bash
npm install omniverse-engineering-skillset
```

The npm install path uses the same default target: `.agents/skills` with an `s`.

## Use It

Ask your agent to use the skill by name:

```txt
Use omniverse-engineering-skillset to review this architecture proposal.
```

Try it for everyday engineering work:

```txt
Use omniverse-plan to create an implementation plan for this feature.
Use omniverse-work to implement the approved plan.
Use omniverse-debug to investigate this failing test.
Use omniverse-code-review to review this PR for production risks.
Use omniverse-test-browser to smoke test this dev server.
Use omniverse-commit-push-pr to commit, push, and draft the PR.
Use omniverse-compound to capture the solution after this fix.
Use omniverse-engineering-skillset before implementing this feature.
Use omniverse-engineering-skillset to review these API docs before release.
Use omniverse-engineering-skillset to write a commit message for this diff.
Use omniverse-engineering-skillset to design a hybrid follower timeline.
Use omniverse-engineering-skillset to review state ownership and concurrency risks.
```

## Popular Workflows

| Workflow | Example prompt |
| --- | --- |
| Brainstorming | `Use omniverse-brainstorm to compare implementation options for this feature.` |
| Planning | `Use omniverse-plan to write a plan under docs/plans for this migration.` |
| Execution | `Use omniverse-work to implement the smallest safe version of this change.` |
| Debugging | `Use omniverse-debug to reproduce and fix this CI failure.` |
| Code review | `Use omniverse-engineering-skillset to review this PR for production risks.` |
| Focused code review | `Use omniverse-code-review to review this diff for correctness and missing tests.` |
| Browser QA | `Use omniverse-test-browser to verify this workflow on desktop and mobile.` |
| Git handoff | `Use omniverse-commit-push-pr to commit, push, and prepare the PR body.` |
| Knowledge capture | `Use omniverse-compound to write a reusable solution note for this issue.` |
| System design | `Use omniverse-engineering-skillset to design a rate limiter for this API.` |
| API documentation | `Use omniverse-engineering-skillset to review these endpoint docs before release.` |
| Commit messages | `Use omniverse-engineering-skillset to write a commit message for this diff.` |

## Skill Inventory

| Category | Skills |
| --- | --- |
| Core judgment | `omniverse-engineering-skillset` |
| Discovery and direction | `omniverse-brainstorm`, `omniverse-ideate`, `omniverse-strategy`, `omniverse-pov`, `omniverse-lfg` |
| Planning and execution | `omniverse-plan`, `omniverse-work`, `omniverse-setup`, `omniverse-worktree` |
| Debugging and improvement | `omniverse-debug`, `omniverse-optimize`, `omniverse-simplify-code` |
| Reviews | `omniverse-code-review`, `omniverse-doc-review`, `omniverse-resolve-pr-feedback` |
| QA and readiness | `omniverse-dogfood`, `omniverse-test-browser`, `omniverse-test-xcode`, `omniverse-polish`, `omniverse-proof` |
| Shipping and communication | `omniverse-commit`, `omniverse-commit-push-pr`, `omniverse-product-pulse`, `omniverse-promote` |
| Durable learning | `omniverse-compound`, `omniverse-compound-refresh`, `omniverse-feedback-analysis` |

## Durable Artifacts

Several workflow skills can write lightweight project memory:

| Folder | Purpose |
| --- | --- |
| `docs/plans/` | Implementation plans and migration plans. |
| `docs/solutions/` | Reusable debugging and solution notes. |
| `docs/reviews/` | Review summaries and review follow-up notes. |
| `docs/qa/` | Browser or product QA reports. |
| `docs/proof/` | Evidence packets for release or correctness claims. |

## Command Reference

Install with the open `skills` CLI:

```bash
npx skills add yongjiexue88/omniverse-engineering-skillset
```

List available skills in this repository:

```bash
npx skills add yongjiexue88/omniverse-engineering-skillset --list
```

Install for Codex project skills:

```bash
npx skills add yongjiexue88/omniverse-engineering-skillset --agent codex
```

Install for Claude Code project skills:

```bash
npx skills add yongjiexue88/omniverse-engineering-skillset --agent claude-code
```

Install for all supported agents:

```bash
npx skills add yongjiexue88/omniverse-engineering-skillset --all
```

Legacy package-specific installer:

```bash
npx --yes omniverse-engineering-skillset@latest install
npx --yes omniverse-engineering-skillset@latest install --agent claude-code
npx --yes omniverse-engineering-skillset@latest install --target ~/.codex/skills
npx --yes omniverse-engineering-skillset@latest list
```

## Best Fit

Use this skill when you want your agent to slow down just enough to catch engineering risk before it ships: unclear ownership, brittle abstractions, missing tests, weak API contracts, unsafe concurrency, vague commit messages, or architecture decisions that need sharper tradeoff analysis.
