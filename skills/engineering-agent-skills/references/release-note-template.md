# Release Note Template

Use this template for release notes, changelog entries, and customer-facing change summaries.

## Template

```md
## Release Notes

### Added

- 

### Changed

- 

### Fixed

- 

### Deprecated

- 

### Removed

- 

### Security

- 

### Compatibility and Migration Notes

- 

### Known Issues

- 
```

## Writing Guidance

- Write for users first, then operators and developers.
- Lead with user-facing impact and avoid internal implementation detail unless it helps users act.
- Group changes by impact area, not by commit order.
- Call out breaking changes, required migrations, config changes, API changes, and behavior changes.
- Include mitigation, workaround, or upgrade guidance for risky changes.
- Mention security fixes carefully: enough for users to update, not enough to help attackers exploit.
- Keep entries concise, concrete, and past tense.

## Quality Checks

- Can users tell whether they need to act?
- Are changed defaults, permissions, limits, or workflows clear?
- Are deprecated and removed features separated?
- Are known issues honest and actionable?
- Are links to docs, migration guides, or PRs included when available?
- Are internal-only changes excluded unless they affect reliability, performance, or operations?

## Common Rewrites

- Replace “improved performance” with the affected workflow and measurable result when known.
- Replace “fixed bugs” with the user-visible problem that was fixed.
- Replace “refactored service” with no release note unless behavior, reliability, or operations changed.
- Replace vague migration warnings with exact steps, affected versions, and deadlines.
