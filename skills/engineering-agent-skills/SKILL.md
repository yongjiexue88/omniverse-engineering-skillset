---
name: engineering-agent-skills
description: Use this skill to review software engineering work before shipping and guide implementation quality. It helps with system design review, backend architecture technology choices, system design pattern recognition including large blob/file sync, local search, durable messaging, sandboxed task execution, recommendation feeds, timeline fan-out, coding guidelines, low-level design, commit messages, architecture decisions, API documentation, missing tests, risk areas, and reviewer questions.
---

# Engineering Agent Skills

## Purpose

Review software engineering work before it ships and guide implementation quality when requested. Use this skill to find correctness gaps, production risks, unclear decisions, weak documentation, weak low-level design, missing tests, and reviewer questions. Keep the review practical: identify what matters, explain why it matters, and propose concrete fixes.

## When to use

Use this skill when the user asks for help with any of these tasks:

- Reviewing a system design, architecture proposal, design doc, ADR, RFC, or technical plan.
- Choosing backend/system architecture technologies such as API style, database type, indexing strategy, caching, queues, sharding, load balancing, or consistency model.
- Recognizing common system design patterns such as long-running tasks, large blob handling, file storage/sync, read scaling, write scaling, multi-step workflows, contention handling, or real-time updates.
- Designing large file upload/download, object storage, signed URL, multipart/resumable upload, CDN delivery, Dropbox-style file sharing, or multi-device sync systems.
- Designing local search, geo search, Yelp-style review systems, derived review aggregates, or search-index synchronization.
- Designing durable real-time messaging, chat, WebSocket delivery, offline inbox sync, per-recipient delivery state, or media attachments in messaging.
- Designing sandboxed long-running task execution, online compilers, code judging, CI/build runners, browser automation jobs, or live leaderboards.
- Designing recommendation feeds, candidate stacks, swiping/matching, reciprocal actions, or low-latency geospatial feed refill.
- Designing social timelines, follower feeds, notification inboxes, hybrid fan-out, or celebrity-account feed materialization.
- Designing inventory, booking, reservation, local availability, serviceability, scarce-resource, waiting-room, or admission-control systems that need fast reads and strong final consistency.
- Writing, reviewing, or refactoring code while avoiding overcomplication, broad edits, hidden assumptions, or unverifiable success criteria.
- Writing or improving a Git commit message.
- Reviewing API documentation, integration docs, endpoint specs, or SDK docs.
- Guiding implementation, refactoring, module boundaries, state ownership, concurrency/resource safety, or testable low-level design.
- Combining any of the above into one pre-ship review.

## Inputs to inspect

Inspect only the inputs relevant to the request:

- User-provided text, design notes, API docs, diffs, or code snippets.
- Local repository files when the user asks to review the current project or branch.
- Git diff, commit history, tests, docs, configuration, and release files when available and relevant.
- Reference files in `references/` only when they match the selected workflow.

If a critical input is missing, state the assumption and continue with the strongest review possible. Ask a focused question only when the missing detail changes the likely recommendation.

## Workflow selection

Choose the workflow from the request:

- If the user provides a system design or architecture proposal, use `references/system-design-checklist.md`.
- If the user asks to design or choose backend/system architecture involving networking, APIs, data modeling, database choice, indexing, caching, sharding, consistent hashing, CAP tradeoffs, capacity estimates, or technology selection, use `references/system-design-architecture-decision-playbook.md`.
- If the user asks for system design pattern recognition, architecture pattern selection, or a design involving long-running tasks, large blobs, read scaling, write scaling, multi-step processes/workflows, contention, or real-time updates, use `references/system-design-pattern-recognition-playbook.md`; combine it with `references/system-design-architecture-decision-playbook.md` when technology choices or scaling paths need deeper justification.
- If the user asks about large file upload/download, file storage, file sharing, Dropbox-style sync, object/blob storage, signed URLs, multipart/resumable upload, CDN file delivery, durable change feeds for sync, or client-side chunking/deduplication, use `references/system-design-large-blob-file-sync.md`; combine it with `references/system-design-pattern-recognition-playbook.md` for the broader large-blob and real-time update pattern fit and `references/system-design-architecture-decision-playbook.md` for storage, CDN, queue, database, and consistency choices.
- If the user asks about local business search, Yelp-style local discovery, geo/text/category search, reviews, ratings, average-rating aggregates, one-review-per-user constraints, PostGIS/trigram search, Elasticsearch/OpenSearch as a read model, or named-location polygons, use `references/system-design-local-search-review-aggregates.md`; combine it with `references/system-design-pattern-recognition-playbook.md` for read-scaling and contention fit.
- If the user asks about chat, durable messaging, WebSockets, offline message delivery, per-recipient inboxes, client acknowledgements, reconnect sync, multi-device delivery state, pub/sub socket routing, or messaging media attachments, use `references/system-design-durable-real-time-messaging.md`; combine it with `references/system-design-pattern-recognition-playbook.md` for real-time update choices.
- If the user asks about online code execution, code judging, CI/build runners, untrusted sandboxing, worker queues, polling status APIs, long-running submission states, or Redis leaderboard materialization, use `references/system-design-sandboxed-long-running-task-execution.md`; combine it with `references/system-design-pattern-recognition-playbook.md` for long-running task choices.
- If the user asks about recommendation feeds, Tinder-style swiping, candidate stacks, reciprocal matches, follow-back/friend-match flows, avoiding repeated candidates, feed cache refill, geospatial candidate retrieval, or atomic pair-key matching, use `references/system-design-recommendation-feed-reciprocal-actions.md`; combine it with `references/system-design-pattern-recognition-playbook.md` for feed/read-scaling and contention fit.
- If the user asks about social timelines, follower feeds, notification inboxes, fan-out-on-write, fan-out-on-read, hybrid fan-out, celebrity producer handling, follow graph storage, or timeline materialization, use `references/system-design-hybrid-feed-fanout-timeline.md`; combine it with `references/system-design-feed-aggregation-playbook.md` only when the feed is also an external/content aggregation pipeline.
- If the user asks about local availability, serviceability/nearby lookup, inventory, stock, booking, reservations, ticket seats, pickup/delivery availability, overselling, or double-booking, use `references/system-design-local-availability-inventory-consistency.md`; combine it with `references/system-design-pattern-recognition-playbook.md` for the read-scaling/contention pattern fit and `references/system-design-architecture-decision-playbook.md` for database, cache, shard, and consistency choices.
- If the user asks about scarce inventory, checkout holds, TTL reservations, ticket/product drops, seat maps, waiting rooms, admission control, high-contention booking, payment finalization, or search under booking contention, use `references/system-design-scarce-inventory-reservation-playbook.md`; combine it with `references/system-design-local-availability-inventory-consistency.md` when locality/serviceability matters.
- If the user asks about high-scale feeds, content aggregation, feed delivery, infinite scroll, ordered activity/news/product/event feeds, or read-heavy feed projections, use `references/system-design-feed-aggregation-playbook.md`; combine it with `references/system-design-pattern-recognition-playbook.md` for broader pattern selection.
- If the user asks about URL shorteners, short codes, low-latency redirects, invite/share/referral links, compact public identifiers, or read-heavy immutable key-value mappings, use `references/system-design-read-heavy-immutable-mapping-playbook.md`; combine it with `references/system-design-pattern-recognition-playbook.md` for broader read-scaling context.
- If the user provides an architecture decision, ADR, RFC decision, or tradeoff analysis, use `references/architecture-decision-checklist.md`; combine it with `references/system-design-architecture-decision-playbook.md` when the decision is about backend/system architecture technology choices.
- If the user asks for a Git commit message, commit wording, or commit review, use `references/commit-message-guidelines.md`.
- If the user provides API docs, endpoint specs, SDK docs, or integration docs, use `references/api-doc-review-checklist.md`.
- If the user asks for implementation, refactoring, class/module design, state ownership, dependency boundaries, concurrency/resource handling, or testable code structure, use `references/low-level-design-coding-principles.md`; combine it with `references/coding-guidelines.md` for behavioral coding guardrails.
- If the user specifically asks for coding guidelines, avoiding LLM coding mistakes, simplicity, surgical changes, explicit assumptions, or verifiable success criteria, use `references/coding-guidelines.md`.
- If the request is mixed, combine the relevant workflows and avoid duplicating findings.

## General review workflow

1. Identify the artifact type, audience, shipping context, and risk level.
2. Load only the reference files needed for the selected workflow.
3. Review for correctness, edge cases, backward compatibility, security/auth, error handling, observability, performance, maintainability, testing, documentation clarity, user-facing impact, and production risk.
4. Separate blocking issues from improvements and wording suggestions.
5. For each important issue, explain the impact and give a concrete remediation.
6. Call out missing information, assumptions, and reviewer questions.
7. End with a concise ship/no-ship recommendation when the context supports it.

## Output formats

For reviews, use:

```md
## Summary

## Blocking Issues

## Non-Blocking Improvements

## Missing Tests

## Risk Areas

## Reviewer Questions

## Recommendation
```

For backend architecture technology choices or "which tool should we use?" decisions, use the recommendation format in `references/system-design-architecture-decision-playbook.md`.

For common system design pattern recognition, architecture pattern selection, or designs involving long-running tasks, large blobs, read scaling, write scaling, multi-step workflows, contention, or real-time updates, use the response shape in `references/system-design-pattern-recognition-playbook.md`.

For large blob storage, file sharing, multipart/resumable upload, signed URL transfer, CDN file delivery, Dropbox-style sync, or multi-device file sync designs, use the specialized guidance in `references/system-design-large-blob-file-sync.md`.

For local business search, geo/text/category search, Yelp-style reviews, derived rating aggregates, PostGIS/trigram search, Elasticsearch/OpenSearch read models, or named-location polygon designs, use the specialized guidance in `references/system-design-local-search-review-aggregates.md`.

For durable chat or messaging systems with WebSockets, offline delivery, per-recipient inboxes, client acknowledgements, reconnect sync, routing pub/sub, multi-device state, or media attachments, use the specialized guidance in `references/system-design-durable-real-time-messaging.md`.

For sandboxed code execution, online judges, CI/build runners, long-running submission processing, worker queues, polling status APIs, or Redis leaderboard materialization, use the specialized guidance in `references/system-design-sandboxed-long-running-task-execution.md`.

For recommendation candidate feeds, swiping/matching, reciprocal action consistency, feed cache refill, geospatial candidate search, repeated-candidate exclusion, or Bloom-filter action history designs, use the specialized guidance in `references/system-design-recommendation-feed-reciprocal-actions.md`.

For social timelines, follower feeds, notification inboxes, fan-out-on-write/read, hybrid feed materialization, celebrity producer handling, follow graph adjacency, or post cache hydration designs, use the specialized guidance in `references/system-design-hybrid-feed-fanout-timeline.md`.

For local availability, inventory, booking, reservation, serviceability, pickup/delivery availability, overselling, or double-booking designs, use the specialized guidance in `references/system-design-local-availability-inventory-consistency.md`.

For scarce inventory, checkout holds, TTL reservations, ticket/product drops, seat maps, waiting rooms, admission control, high-contention booking, payment finalization, or booking search designs, use the specialized guidance in `references/system-design-scarce-inventory-reservation-playbook.md`.

For high-scale feed aggregation, feed delivery, content aggregation, or infinite-scroll designs, use the specialized guidance in `references/system-design-feed-aggregation-playbook.md`.

For URL shorteners, short codes, low-latency redirects, invite/share/referral links, or compact public identifier mapping designs, use the specialized guidance in `references/system-design-read-heavy-immutable-mapping-playbook.md`.

For Git commit messages, use the format and rules in `references/commit-message-guidelines.md`.

For low-level design or coding guidance, use the response structure in `references/low-level-design-coding-principles.md` when the task is non-trivial.

For small requests, keep the output shorter and include only the sections that add value.

## Style rules

- Be direct, specific, and evidence-based.
- Prefer actionable findings over generic advice.
- Label severity clearly when reviewing code or production-impacting changes.
- Do not invent facts that are not present in the artifact.
- Preserve the user’s intent and improve clarity without overengineering.
- Keep examples short and focused.
- Avoid praise-heavy review language; focus on correctness and risk.

## Final checks

Before responding, verify:

- The selected workflow matches the user’s artifact.
- High-risk issues are clearly separated from minor improvements.
- Security, auth, data integrity, observability, rollout, rollback, and testing were considered when relevant.
- The output gives the user a concrete next step.
- Any assumptions or missing inputs are explicit.
- The response avoids speculative scope, names verification steps, and keeps suggested changes surgical when code changes are involved.
