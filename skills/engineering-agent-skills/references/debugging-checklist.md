# Debugging Review Checklist

Use this checklist for bug reports, incident notes, failing tests, production issues, and debugging plans.

## Problem Definition

- Is the observed behavior stated separately from the expected behavior?
- Is the user impact clear: who is affected, how often, and how severely?
- Is the first known bad time or release identified?
- Are affected versions, environments, tenants, regions, or platforms listed?
- Is there a minimal reproduction or a clear reason why reproduction is not available?

## Evidence

- Are logs, metrics, traces, screenshots, request IDs, commits, deploys, and config changes collected?
- Is evidence tied to timestamps and affected users or requests?
- Are symptoms distinguished from suspected causes?
- Are data samples safe to share and free of secrets or PII?
- Are missing signals called out explicitly?

## Hypotheses

- Are multiple plausible causes listed?
- Does each hypothesis include evidence for and against it?
- Is the fastest safe test identified for each hypothesis?
- Are recent changes, dependencies, flags, migrations, and infrastructure events checked?
- Are edge cases such as concurrency, retries, caching, clock skew, and partial failure considered?

## Isolation Plan

- Can the issue be narrowed by tenant, endpoint, feature flag, version, region, data shape, or dependency?
- Are experiments safe for production?
- Is there a rollback, disable switch, or mitigation while debugging continues?
- Are debugging steps ordered by risk and expected information gain?
- Are owners assigned for parallel investigation tracks?

## Fix Review

- Does the proposed fix address root cause instead of only suppressing symptoms?
- Are data repair, replay, backfill, cache invalidation, or cleanup steps needed?
- Are retry and idempotency behaviors safe after the fix?
- Are permission, security, or data integrity impacts considered?
- Is rollback safe if the fix causes regressions?

## Testing

- Is there a regression test that fails before the fix?
- Are integration, contract, migration, and concurrency tests needed?
- Are affected edge cases covered?
- Is manual verification documented with commands or steps?
- Are production validation checks defined after deployment?

## Observability and Prevention

- Would existing logs, metrics, traces, and alerts catch this issue next time?
- Are new alerts tied to user impact?
- Are dashboards, runbooks, or playbooks updated?
- Should the system reject bad states earlier?
- Are follow-up hardening tasks specific and owned?

## Communication

- Is the status clear for stakeholders?
- Are customer-facing messages accurate and non-speculative?
- Are severity, timeline, mitigation, root cause, and next update time included?
- Are known unknowns listed without pretending certainty?
- Is the final incident summary useful for future responders?
