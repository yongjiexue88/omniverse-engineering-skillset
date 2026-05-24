# Code Review Checklist

Use this checklist for code snippets, pull requests, patches, and git diffs.

## Correctness

- Does the code implement the intended behavior completely?
- Are conditions, loops, async flows, and state transitions correct?
- Are edge cases handled: empty input, null values, duplicates, large inputs, time zones, concurrency, and retries?
- Are data transformations reversible or auditable when needed?
- Are race conditions, ordering assumptions, and idempotency risks addressed?

## Backward Compatibility

- Does the change preserve public APIs, database schemas, events, config names, CLI flags, and file formats?
- Are migrations safe for rolling deploys and rollback?
- Do old clients or consumers keep working?
- Are behavior changes documented and intentional?
- Are default values safe for existing installations?

## Security and Auth

- Are authentication and authorization checks present at the right boundary?
- Are object ownership, tenant isolation, and role permissions enforced server-side?
- Are inputs validated and outputs encoded?
- Are secrets, tokens, credentials, and PII excluded from logs and errors?
- Are dependency, deserialization, injection, SSRF, path traversal, and open redirect risks considered?

## Error Handling

- Are errors handled close to the failure boundary with useful context?
- Does the code distinguish expected user errors from system failures?
- Are retries bounded and safe?
- Are partial failures, cleanup, and compensation paths handled?
- Are errors observable without leaking sensitive information?

## Observability

- Are logs structured, actionable, and low-noise?
- Are metrics added for new critical paths, failures, queue depth, latency, or user-impacting outcomes?
- Are traces or correlation IDs preserved across boundaries?
- Will on-call engineers be able to diagnose production failures from this change?
- Are dashboards or alerts needed before shipping?

## Performance

- Are database queries indexed and bounded?
- Are N+1 queries, unbounded loops, excessive memory use, and large payloads avoided?
- Is caching correct and invalidated safely?
- Are synchronous operations acceptable for the latency budget?
- Are expensive operations batched, streamed, paginated, or moved async where appropriate?

## Maintainability

- Is the code easy to read and consistent with nearby patterns?
- Are names precise and domain-appropriate?
- Is complexity localized instead of spread across unrelated files?
- Are abstractions justified by repeated use rather than speculation?
- Is dead code, duplicate logic, or hidden coupling introduced?

## Testing

- Are tests added or updated for the core behavior?
- Do tests cover edge cases, failure modes, permissions, and backward compatibility?
- Are integration or contract tests needed for service boundaries?
- Are snapshot tests intentional and stable?
- Do tests fail for the bug or behavior the change claims to address?

## Documentation and Product Impact

- Do docs, examples, API references, or migration guides need updates?
- Is user-facing copy clear and consistent?
- Are support, rollout, or operational notes needed?
- Are behavior changes visible to customers or downstream teams?
- Is there a documentation or rollout communication gap?

## Review Output Severity

- `Blocker`: likely correctness, security, data loss, outage, or severe compatibility issue.
- `High`: significant bug, missing critical test, operational blind spot, or risky migration.
- `Medium`: maintainability, incomplete edge case, unclear behavior, or non-critical observability gap.
- `Low`: wording, small cleanup, style, or optional clarity improvement.
