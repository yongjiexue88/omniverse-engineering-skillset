# Engineering Agent Skills

Reusable AI agent skills for software engineering workflows.

This repository stores a portable skill folder that can be copied into projects and used by AI agents during engineering review, writing, implementation guidance, and release work.

## Repository Layout

The skill lives under:

```txt
skills/<skill-name>/SKILL.md
```

Bundled skill:

- `engineering-workflow-reviewer`: reviews software engineering work before shipping, including system design, backend architecture technology choices, code review, low-level design/coding guidance, PR descriptions, architecture decisions, API documentation, debugging plans, and release notes.

Low-level design guidance is bundled inside the reviewer skill at:

```txt
skills/engineering-workflow-reviewer/references/low-level-design-coding-principles.md
```

System design architecture decision guidance is bundled inside the reviewer skill at:

```txt
skills/engineering-workflow-reviewer/references/system-design-architecture-decision-playbook.md
```

## Install All Skills

From this repository, copy the bundled skill into another project's `.agents/skills` folder:

```bash
./install.sh
```

By default, this installs into:

```txt
.agents/skills
```

To install into a custom target:

```bash
./install.sh /path/to/project/.agents/skills
```

## Install With Skills CLI

This repo also works with the Skills CLI used by `npx skills add`.

List available skills:

```bash
npx skills add yongjiexue88/engineering-agent-skills --list
```

Install the skill for Codex without prompts:

```bash
npx skills add yongjiexue88/engineering-agent-skills \
  --skill engineering-workflow-reviewer \
  --agent codex \
  --yes
```

Codex uses the universal `.agents/skills` location. If the CLI shows `Universal (.agents/skills) — always included`, Codex is already covered there; it may not appear again under “Additional agents.”

Install the skill for the detected agent in the current project:

```bash
npx skills add yongjiexue88/engineering-agent-skills \
  --skill engineering-workflow-reviewer
```

Install the skill for all supported agents without prompts:

```bash
npx skills add yongjiexue88/engineering-agent-skills \
  --skill engineering-workflow-reviewer \
  --agent '*' \
  --yes
```

Install by copying instead of symlinking:

```bash
npx skills add yongjiexue88/engineering-agent-skills \
  --skill engineering-workflow-reviewer \
  --agent '*' \
  --copy \
  --yes
```

Install globally:

```bash
npx skills add yongjiexue88/engineering-agent-skills \
  --skill engineering-workflow-reviewer \
  --global
```

Install all skills for all supported agents without prompts:

```bash
npx skills add yongjiexue88/engineering-agent-skills --all
```

Use `--agent codex`, `--agent claude-code`, `--agent cursor`, or another explicit agent only when you want to target one agent. No npm package is required for this repository. The Skills CLI reads the public GitHub repo, finds `skills/engineering-workflow-reviewer/SKILL.md`, and installs it into the target agent skill folder.

## Install With This npm Package

Install the bundled skill from npm with:

```bash
npx engineering-agent-skills install
```

Install the skill explicitly:

```bash
npx engineering-agent-skills install --skill engineering-workflow-reviewer
```

Install for Codex or another agent target:

```bash
npx engineering-agent-skills install --agent codex
npx engineering-agent-skills install --agent claude-code
```

Install into a custom target:

```bash
npx engineering-agent-skills install --target .agents/skills
```

List bundled skills:

```bash
npx engineering-agent-skills list
```

Publish the npm package:

```bash
npm login
npm publish --access public
```

## Install One Skill Manually

Copy the skill folder:

```bash
mkdir -p /path/to/project/.agents/skills
cp -R skills/engineering-workflow-reviewer /path/to/project/.agents/skills/
```

The installed skill should look like:

```txt
/path/to/project/.agents/skills/engineering-workflow-reviewer/SKILL.md
```

## Invoke From an AI Agent

Ask the agent to use the skill by name:

```txt
Use the engineering-workflow-reviewer skill to review this PR.
```

Examples:

```txt
Use engineering-workflow-reviewer to review this architecture proposal.
Use engineering-workflow-reviewer to decide between REST, GraphQL, gRPC, WebSocket, SQL, NoSQL, Redis, queues, or sharding.
Use engineering-workflow-reviewer to write a PR description from this diff.
Use engineering-workflow-reviewer to review these API docs before release.
Use engineering-workflow-reviewer to turn these changes into release notes.
Use engineering-workflow-reviewer before implementing this feature.
Use engineering-workflow-reviewer to review state ownership and concurrency risks.
```
