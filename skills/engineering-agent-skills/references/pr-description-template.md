# PR Description Template

Use this template to write or improve a pull request description from a diff, commit list, ticket, or user summary.

## Template

```md
## Summary

- 
- 

## Why

- 

## What Changed

- 
- 

## Testing

- [ ] Unit tests
- [ ] Integration tests
- [ ] Manual verification
- [ ] Not tested: 

## Risk and Rollout

- Risk level: Low / Medium / High
- Rollout plan:
- Rollback plan:

## Compatibility Notes

- API changes:
- Database/schema changes:
- Config/env changes:
- User-facing changes:

## Reviewer Notes

- 
```

## Writing Guidance

- Lead with the behavior change, not the implementation detail.
- Explain why the change is needed and what problem it solves.
- Group changes by reviewer-relevant area: API, data model, UI, tests, infrastructure, docs.
- Call out compatibility impact explicitly, even when there is none.
- Include test commands and manual verification steps when available.
- Highlight risky files, migrations, security-sensitive paths, or operational changes.
- Keep the summary skimmable; reviewers should understand the PR in under one minute.

## Review Questions to Answer

- What should reviewers focus on?
- What behavior changed for users or downstream systems?
- What could go wrong in production?
- How was the change tested?
- How can the change be rolled back?
- Are screenshots, logs, API examples, or migration outputs useful?

## Common Gaps

- Describes files changed but not user-visible behavior.
- Omits migration, config, API, or backward-compatibility impact.
- Says “tested locally” without commands or scenarios.
- Hides known limitations or follow-up work.
- Fails to mention security, permissions, or data handling changes.
