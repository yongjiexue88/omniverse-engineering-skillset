---
name: omniverse-setup
description: Bootstrap or verify a repo's local development setup. Use when the user asks to install dependencies, run a project locally, validate environment setup, document setup steps, or diagnose first-run failures.
---

# Omniverse Setup

Use this skill to get a project into a known runnable state.

## Workflow

1. Read package, lockfile, runtime, and README setup instructions.
2. Identify required tools, services, environment variables, and secrets.
3. Install dependencies using the repo's existing package manager.
4. Run the smallest health check: tests, lint, build, or dev server.
5. Document missing prerequisites and exact commands.

## Rules

- Do not overwrite local env files or secrets.
- Respect the lockfile and package manager already in use.
- If a service credential is missing, verify everything that can run without it.
- Keep setup notes copy-paste safe.
