---
name: omniverse-worktree
description: Manage git worktrees for parallel engineering tasks. Use when the user asks to create, inspect, clean up, or use separate worktrees or branches without disturbing the current workspace.
---

# Omniverse Worktree

Use this skill when isolation matters.

## Workflow

1. Inspect current branch, status, and existing worktrees.
2. Choose a branch name and worktree path that match the task.
3. Create the worktree without moving unrelated dirty changes.
4. Run setup checks in the new worktree.
5. Keep commits and validation scoped to that worktree.
6. Clean up only when the user asks or the branch is merged.

## Commands

Common checks:

```bash
git worktree list
git status --short
git branch --show-current
```

## Rules

- Never delete a worktree with uncommitted work unless explicitly requested.
- Avoid shared build artifacts that can corrupt parallel runs.
- Report the worktree path before continuing there.
