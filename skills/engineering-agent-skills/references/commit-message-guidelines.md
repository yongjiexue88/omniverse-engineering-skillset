# Commit Message Guidelines

Use these guidelines when creating, reviewing, or improving a Git commit message.

## Format

```text
<type>(<scope>): <short summary>

Explain why the change was needed in 1-3 sentences.

- Summarize what changed.
- Include additional bullets as needed.

Testing:
- List testing or validation steps.

Reference: <ticket/reference or N/A>
```

## Rules

- Use present tense.
- Keep the first line under 72 characters.
- Do not use vague summaries like "update code" or "fix stuff."
- Choose the most accurate type.
- Scope should be the affected module, service, component, or feature.
- Mention behavior changes clearly.
- Mention migration, config, API, or backward-compatibility impact if relevant.
- End with a ticket/reference if available; use `Reference: N/A` when none is available.

## Types

| Type | Use for |
| --- | --- |
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code restructuring without behavior change |
| `chore` | Tooling, config, cleanup |
| `docs` | Documentation only |
| `test` | Add or update tests |
| `style` | Formatting only |
| `perf` | Performance improvement |
| `build` | Build/dependency changes |
| `ci` | CI/CD pipeline changes |
| `revert` | Revert previous change |

## Checks Before Finalizing

- The first line names the actual behavior or artifact changed.
- The body explains why, not just what.
- The bullets are concrete and scoped to the commit.
- Testing lines reflect commands actually run, or explicitly state when validation was not run.
- Any compatibility, migration, API, or config impact is called out.
