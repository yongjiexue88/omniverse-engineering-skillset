# Engineering Agent Skills

[![npm version](https://img.shields.io/npm/v/engineering-agent-skills?color=cb3837&label=npm)](https://www.npmjs.com/package/engineering-agent-skills)
![Node.js >=18](https://img.shields.io/badge/node-%3E%3D18-339933)
![Agent skill pack](https://img.shields.io/badge/agent%20skills-ready%20to%20use-7c3aed)
![Focus](https://img.shields.io/badge/focus-reviews%20%7C%20planning%20%7C%20system%20design-0ea5e9)

Make your coding agent a stronger engineering partner for code reviews, implementation planning, and production-grade system design.

This package installs a ready-to-use agent skill that helps your agent reason like a practical senior engineer: clear tradeoffs, focused changes, fewer hidden risks, and better engineering communication.

## Why Use It

| Need | How the skill helps |
| --- | --- |
| Better code reviews | Finds correctness gaps, missing tests, maintainability issues, and production risks. |
| Cleaner implementation plans | Keeps changes focused, testable, and aligned with existing module boundaries. |
| Stronger system design | Guides architecture tradeoffs for feeds, search, queues, caching, workflows, payments, LLM serving, and more. |
| Sharper engineering writing | Improves commit messages, API docs, release notes, ADRs, and PR feedback. |

## What You Get

- Practical coding principles for simple, maintainable changes without unnecessary abstraction.
- Low-level design guidance for module boundaries, state ownership, APIs, concurrency, resource safety, and testable implementation plans.
- Staff-level system design playbooks for common production systems, including feeds, search, queues, caching, rate limiting, real-time messaging, workflows, monitoring, large-file handling, payments, LLM serving, and high-contention inventory.
- Commit message guidance so every change has clear scope, behavior, and validation.
- Review checklists for architecture decisions, API docs, PRs, release notes, missing tests, and production readiness.

## Quick Start

Install from GitHub with the open `skills` CLI:

```bash
npx skills add yongjiexue88/engineering-agent-skills
```

That is the same repo shorthand style as:

```bash
npx skills add Aradotso/trending-skills
```

The `skills` CLI discovers this repo's bundled skill from:

```txt
skills/engineering-agent-skills/SKILL.md
```

Then it installs the skill into the agent directory you choose, such as:

```txt
.agents/skills/engineering-agent-skills
```

List the skill before installing:

```bash
npx skills add yongjiexue88/engineering-agent-skills --list
```

Install for a specific agent:

```bash
npx skills add yongjiexue88/engineering-agent-skills --agent codex
npx skills add yongjiexue88/engineering-agent-skills --agent claude-code
```

Install globally instead of into the current project:

```bash
npx skills add yongjiexue88/engineering-agent-skills --global
```

Prefer copied files instead of symlinks:

```bash
npx skills add yongjiexue88/engineering-agent-skills --copy
```

This path does not add `engineering-agent-skills` as a project dependency.

If you want to pin the npm package as a project dependency instead, use the
package-specific installer:

```bash
npm install engineering-agent-skills
```

The npm install path uses the same default target: `.agents/skills` with an `s`.

## Use It

Ask your agent to use the skill by name:

```txt
Use engineering-agent-skills to review this architecture proposal.
```

Try it for everyday engineering work:

```txt
Use engineering-agent-skills before implementing this feature.
Use engineering-agent-skills to review these API docs before release.
Use engineering-agent-skills to write a commit message for this diff.
Use engineering-agent-skills to design a hybrid follower timeline.
Use engineering-agent-skills to review state ownership and concurrency risks.
```

## Popular Workflows

| Workflow | Example prompt |
| --- | --- |
| Code review | `Use engineering-agent-skills to review this PR for production risks.` |
| Implementation planning | `Use engineering-agent-skills to plan the smallest safe implementation for this feature.` |
| System design | `Use engineering-agent-skills to design a rate limiter for this API.` |
| API documentation | `Use engineering-agent-skills to review these endpoint docs before release.` |
| Commit messages | `Use engineering-agent-skills to write a commit message for this diff.` |

## Command Reference

Install with the open `skills` CLI:

```bash
npx skills add yongjiexue88/engineering-agent-skills
```

List available skills in this repository:

```bash
npx skills add yongjiexue88/engineering-agent-skills --list
```

Install for Codex project skills:

```bash
npx skills add yongjiexue88/engineering-agent-skills --agent codex
```

Install for Claude Code project skills:

```bash
npx skills add yongjiexue88/engineering-agent-skills --agent claude-code
```

Install for all supported agents:

```bash
npx skills add yongjiexue88/engineering-agent-skills --all
```

Legacy package-specific installer:

```bash
npx --yes engineering-agent-skills@latest install
npx --yes engineering-agent-skills@latest install --agent claude-code
npx --yes engineering-agent-skills@latest install --target ~/.codex/skills
npx --yes engineering-agent-skills@latest list
```

## Best Fit

Use this skill when you want your agent to slow down just enough to catch engineering risk before it ships: unclear ownership, brittle abstractions, missing tests, weak API contracts, unsafe concurrency, vague commit messages, or architecture decisions that need sharper tradeoff analysis.
