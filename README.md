# Engineering Agent Skills

Make your coding agent a stronger engineering partner for reviews, implementation planning, and system design.

This package installs a ready-to-use agent skill that helps your agent:

- Think through code changes with practical senior-engineer judgment.
- Keep implementations simple, focused, and maintainable.
- Evaluate architecture and system design tradeoffs clearly.
- Catch production risks before they become shipping problems.
- Write cleaner engineering communication for commits, docs, and reviews.

## What You Get

- Simple coding principles for making focused, maintainable changes without unnecessary abstraction.
- Low-level design guidance for module boundaries, state ownership, APIs, concurrency, resource safety, and testable implementation plans.
- Staff-level system design playbooks for common production systems, including feeds, search, queues, caching, rate limiting, real-time messaging, workflows, monitoring, large-file handling, payments, LLM serving, and high-contention inventory.
- Commit message guidance so changes are described with clear scope, behavior, and validation.
- Review checklists for architecture decisions, API docs, PRs, release notes, missing tests, and production risk.

## Quick Start

Run this from the project where you want your agent to use the skill:

```bash
npm install engineering-agent-skills
```

The npm install step automatically copies the bundled skill into:

```txt
.agents/skills/engineering-agent-skills
```

If you do not want to add the package as a project dependency, run the installer directly with `npx`:

```bash
npx engineering-agent-skills install
```

This installs the same skill into:

```txt
.agents/skills/engineering-agent-skills
```

## Use It

Ask your agent to use the skill by name:

```txt
Use engineering-agent-skills to review this architecture proposal.
```

Other examples:

```txt
Use engineering-agent-skills before implementing this feature.
Use engineering-agent-skills to review these API docs before release.
Use engineering-agent-skills to write a commit message for this diff.
Use engineering-agent-skills to design a hybrid follower timeline.
Use engineering-agent-skills to review state ownership and concurrency risks.
```

## Optional Commands

Install for a specific agent target:

```bash
npx engineering-agent-skills install --agent codex
npx engineering-agent-skills install --agent claude-code
```

Install into a custom skills directory:

```bash
npx engineering-agent-skills install --target .agents/skills
```

List bundled skills:

```bash
npx engineering-agent-skills list
```
