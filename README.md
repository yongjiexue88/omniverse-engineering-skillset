# Engineering Agent Skills

Reusable AI agent skills for software engineering workflows.

This repository stores portable skill folders that can be copied into projects and used by AI agents during engineering review, writing, and release work.

## Repository Layout

Skills live under:

```txt
skills/<skill-name>/SKILL.md
```

The first skill is:

```txt
skills/engineering-workflow-reviewer/SKILL.md
```

`engineering-workflow-reviewer` helps review software engineering work before shipping, including system design, code review, PR descriptions, architecture decisions, API documentation, debugging plans, and release notes.

## Install All Skills

From this repository, copy every skill into another project's `.agents/skills` folder:

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

Install the skill for the detected agent in the current project:

```bash
npx skills add yongjiexue88/engineering-agent-skills \
  --skill engineering-workflow-reviewer
```

Install the skill for all supported agents:

```bash
npx skills add yongjiexue88/engineering-agent-skills \
  --skill engineering-workflow-reviewer \
  --agent '*'
```

Install by copying instead of symlinking:

```bash
npx skills add yongjiexue88/engineering-agent-skills \
  --skill engineering-workflow-reviewer \
  --agent '*' \
  --copy
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

## Install One Skill Manually

Copy the skill folder you want:

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
Use engineering-workflow-reviewer to write a PR description from this diff.
Use engineering-workflow-reviewer to review these API docs before release.
Use engineering-workflow-reviewer to turn these changes into release notes.
```
