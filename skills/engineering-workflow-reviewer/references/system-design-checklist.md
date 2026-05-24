# System Design Review Checklist

Use this checklist for system design docs, design proposals, RFCs, and architecture sketches.

For technology-choice decisions involving protocols, API styles, databases, indexing, caching, sharding, consistent hashing, CAP tradeoffs, or capacity estimates, also use `system-design-architecture-decision-playbook.md`.

## Problem and Scope

- Is the problem statement concrete and tied to user or business impact?
- Are functional and non-functional requirements separated?
- Are explicit non-goals listed to prevent scope creep?
- Are assumptions called out, especially around traffic, data volume, latency, availability, and compliance?
- Is the target audience clear: users, operators, developers, or another system?

## Correctness and Data Flow

- Does the design cover the full request/data lifecycle from entry point to persistence and response?
- Are source-of-truth boundaries clear?
- Are read/write consistency expectations explicit?
- Are duplicate, delayed, reordered, or partial events handled?
- Are idempotency keys, retries, and deduplication considered where needed?

## Edge Cases and Failure Modes

- What happens when dependencies time out, return bad data, or are partially unavailable?
- Are queue backlogs, cache misses, cold starts, and thundering herds considered?
- Are empty states, large payloads, malformed input, and boundary values covered?
- Is graceful degradation defined for non-critical dependencies?
- Are recovery paths described after job failure, deployment failure, or data corruption?

## Backward Compatibility

- Does the design preserve existing API contracts, schemas, events, and user workflows?
- Are migrations forward- and backward-compatible during rolling deploys?
- Are old clients, old producers, or old consumers supported during the transition?
- Is there a versioning strategy for APIs, events, schemas, or SDKs?
- Is rollback safe after partial data migration?

## Security and Auth

- Are authentication and authorization boundaries explicit?
- Are tenant isolation, ownership checks, and least privilege enforced?
- Are secrets, tokens, PII, and sensitive logs protected?
- Are abuse cases, rate limits, replay attacks, and permission escalation considered?
- Are audit logs required for sensitive operations?

## Observability and Operations

- Are key metrics defined for traffic, latency, errors, saturation, and business outcomes?
- Are logs structured and safe from sensitive data leakage?
- Are traces or correlation IDs available across service boundaries?
- Are alerts tied to user impact instead of noisy internals?
- Are runbooks, dashboards, and on-call ownership identified for new production surfaces?

## Performance and Scale

- Are capacity estimates and growth assumptions stated?
- Are latency budgets allocated across components?
- Are expensive operations bounded, cached, paginated, batched, or made asynchronous?
- Are database indexes, query patterns, and hot partitions considered?
- Are concurrency limits, connection pools, and rate limits sized realistically?

## Maintainability

- Is the design simpler than plausible alternatives?
- Are component responsibilities and ownership boundaries clear?
- Are configuration, feature flags, and operational knobs documented?
- Does the design avoid unnecessary coupling between teams or services?
- Are future extension points justified by near-term needs?

## Testing and Rollout

- Are unit, integration, contract, load, migration, and failure-injection tests identified?
- Is the rollout incremental, observable, and reversible?
- Are feature flags, canaries, dark launches, or shadow traffic useful here?
- Is there a data backfill or migration validation plan?
- Are acceptance criteria measurable?

## Documentation and User Impact

- Does the design explain user-visible behavior changes?
- Are API, SDK, operational, and support docs accounted for?
- Are known limitations explicit?
- Are open questions assigned to owners?
- Is the final recommendation clear enough for reviewers to approve or reject?
