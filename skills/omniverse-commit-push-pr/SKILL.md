---
name: omniverse-commit-push-pr
description: Commit, push, and prepare a pull request. Use when the user asks to ship local work to GitHub, push a branch, open a PR, update PR metadata, or create a final PR-ready summary.
---

# Omniverse Commit Push PR

Use this skill for the full local-to-remote handoff.

## Workflow

1. Inspect branch, remotes, and status.
2. Review and stage only intended changes.
3. Run relevant tests.
4. Commit with a scoped message.
5. Push the current branch to its configured remote or set upstream when needed.
6. Create or update a PR if GitHub tooling is available and the user requested it.

## PR Body

Include:

- `Summary`: what changed.
- `Validation`: commands and outcomes.
- `Risk`: migrations, feature flags, external services, user-visible behavior.
- `Notes`: follow-ups that are not part of this change.

## Rules

- Do not force-push unless explicitly requested.
- Do not include unrelated dirty files.
- If `gh` is unavailable or unauthenticated, push the branch and provide the PR title/body.
- Report the commit hash and branch in the final response.
