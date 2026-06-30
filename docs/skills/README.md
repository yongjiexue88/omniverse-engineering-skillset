# Skill Documentation

End-user-facing documentation for the Omniverse Engineering Skillset plugin.

The authoritative runtime instructions live in each `skills/*/SKILL.md` file.

## Skill Inventory

| Skill | Purpose |
| --- | --- |
| [`omniverse-engineering-skillset`](./omniverse-engineering-skillset.md) | Deep senior-engineering judgment for code, architecture, implementation plans, API docs, commit messages, and system design. |
| `omniverse-brainstorm` | Generate and compare engineering options before planning. |
| `omniverse-ideate` | Create product or implementation concepts with feasibility criteria. |
| `omniverse-strategy` | Sequence larger technical or product engineering direction. |
| `omniverse-pov` | Produce a clear technical recommendation and tradeoff stance. |
| `omniverse-lfg` | Run a fast, high-agency loop from messy request to useful outcome. |
| `omniverse-plan` | Create implementation plans and optional `docs/plans/` artifacts. |
| `omniverse-work` | Execute code/docs changes through verification. |
| `omniverse-setup` | Bootstrap or verify local development setup. |
| `omniverse-worktree` | Manage isolated git worktrees for parallel tasks. |
| `omniverse-debug` | Debug failures through evidence and narrow hypotheses. |
| `omniverse-optimize` | Improve measured performance, cost, reliability, or workflow. |
| `omniverse-simplify-code` | Reduce complexity without changing behavior. |
| `omniverse-code-review` | Review diffs and PRs for production risks. |
| `omniverse-doc-review` | Review API docs, setup guides, ADRs, runbooks, and release docs. |
| `omniverse-resolve-pr-feedback` | Triage and address pull request review comments. |
| `omniverse-dogfood` | Test the product like a real user. |
| `omniverse-test-browser` | Run browser QA and optional `docs/qa/` reports. |
| `omniverse-test-xcode` | Build and test Apple-platform projects. |
| `omniverse-polish` | Improve user-facing readiness before shipping. |
| `omniverse-proof` | Create evidence packets for correctness and release claims. |
| `omniverse-commit` | Prepare clean local commits with validation. |
| `omniverse-commit-push-pr` | Commit, push, and prepare PR handoff. |
| `omniverse-product-pulse` | Summarize project status for stakeholders. |
| `omniverse-promote` | Write release notes, changelog entries, launch copy, or demo scripts. |
| `omniverse-compound` | Capture durable solution notes under `docs/solutions/`. |
| `omniverse-compound-refresh` | Load prior repo memory before starting work. |
| `omniverse-feedback-analysis` | Synthesize qualitative feedback into themes and actions. |

## Artifact Folders

| Folder | Written by |
| --- | --- |
| `docs/plans/` | `omniverse-plan` |
| `docs/solutions/` | `omniverse-compound` |
| `docs/reviews/` | Review-oriented skills when a durable review note is useful. |
| `docs/qa/` | `omniverse-test-browser`, `omniverse-dogfood` |
| `docs/proof/` | `omniverse-proof` |
