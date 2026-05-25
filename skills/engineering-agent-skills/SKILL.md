---
name: engineering-agent-skills
description: Use this skill to review engineering work before shipping and guide system design, backend architecture decisions, low-level design, code quality, API docs, ADRs, commit messages, and implementation risk. It includes reference playbooks for common distributed-system patterns such as large blobs, feeds, real-time updates, contention, workflows, caching, search, analytics, monitoring, scheduling, payments, LLM serving, and related production tradeoffs.
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
- Designing video/audio upload, async media processing, transcoding, adaptive bitrate streaming, manifests, segments, or CDN playback systems.
- Designing local search, geo search, Yelp-style review systems, derived review aggregates, or search-index synchronization.
- Designing durable real-time messaging, chat, WebSocket delivery, offline inbox sync, per-recipient delivery state, or media attachments in messaging.
- Designing distributed job schedulers, delayed execution, recurring CRON jobs, visibility-timeout workers, or at-least-once scheduled tasks.
- Designing sandboxed long-running task execution, online compilers, code judging, CI/build runners, browser automation jobs, or live leaderboards.
- Designing streaming Top-K, trending rankings, most-viewed/most-active leaderboards, windowed counters, or precomputed analytics rankings.
- Designing recommendation feeds, candidate stacks, swiping/matching, reciprocal actions, or low-latency geospatial feed refill.
- Designing social timelines, follower feeds, notification inboxes, hybrid fan-out, or celebrity-account feed materialization.
- Designing media-heavy social feeds that combine direct uploads, async image/video processing, CDN variants, and feed fan-out.
- Designing web crawlers, URL frontiers, fetch/parse pipelines, robots.txt politeness, crawl-delay enforcement, DNS-aware crawling, or content deduplication.
- Designing external data monitoring, priority crawling, client-assisted collection, time-series history, trust validation, or threshold alerts.
- Designing real-time clickstream/ad click aggregation, event-time stream processing, signed impression IDs, deduplication, hot-key stream partitioning, or OLAP analytics dashboards.
- Designing metrics monitoring platforms, time-series ingestion, cardinality control, dashboard queries, alert evaluation, rollups, or observability infrastructure.
- Designing real-time dispatch, provider/driver matching, geospatial assignment, location heartbeats, provider reservations, or offer workflows.
- Designing real-time market data proxies, external feed fan-out, SSE/WebSocket subscription services, high-consistency order state, or externally authoritative workflows.
- Designing payment processors, checkout, refunds, payouts, wallet transfers, financial workflow state machines, idempotency, audit trails, ledgers, webhooks, or reconciliation.
- Designing LLM serving, ChatGPT-like token streaming, GPU inference scheduling, SSE streams, generation lifecycle tracking, context-cost control, or model routing.
- Designing auctions, bidding, contested state transitions, ordered per-entity write processing, or live highest-bid updates.
- Designing offline-first activity tracking, mobile sensor capture, GPS route sync, local durable queues, or intermittent-connectivity clients.
- Designing high-scale live comment streaming, SSE/WebSocket fan-out, reconnect catch-up, hot live rooms, or recent-event replay caches.
- Designing distributed rate limiting, API gateway throttling, token buckets, sliding windows, Redis counters, or fail-open/fail-closed traffic protection.
- Designing distributed caches, consistent hashing, LRU/TTL eviction, cache replication, hot-key handling, or cache stampede protection.
- Designing collaborative editing, OT/CRDT convergence, shared document operation logs, presence/cursor state, or real-time co-editing.
- Designing custom inverted-index search, posting-list storage, hot/cold search tiers, approximate ranking, or search without Elasticsearch/OpenSearch.
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
- If the user asks about video/audio upload, YouTube-style media processing, transcoding, adaptive bitrate streaming, manifests, segments, thumbnails, partial media readiness, CDN playback, or media processing pipelines, use `references/system-design-large-blob-media-streaming.md`; combine it with `references/system-design-large-blob-file-sync.md` for upload mechanics and `references/system-design-pattern-recognition-playbook.md` for large-blob/async processing fit.
- If the user asks about local business search, Yelp-style local discovery, geo/text/category search, reviews, ratings, average-rating aggregates, one-review-per-user constraints, PostGIS/trigram search, Elasticsearch/OpenSearch as a read model, or named-location polygons, use `references/system-design-local-search-review-aggregates.md`; combine it with `references/system-design-pattern-recognition-playbook.md` for read-scaling and contention fit.
- If the user asks about chat, durable messaging, WebSockets, offline message delivery, per-recipient inboxes, client acknowledgements, reconnect sync, multi-device delivery state, pub/sub socket routing, or messaging media attachments, use `references/system-design-durable-real-time-messaging.md`; combine it with `references/system-design-pattern-recognition-playbook.md` for real-time update choices.
- If the user asks about distributed job schedulers, delayed execution, future jobs, recurring CRON/interval schedules, job materialization, delayed queues, visibility timeout, at-least-once scheduled execution, or scheduler scanner/backfill, use `references/system-design-distributed-job-scheduler.md`; combine it with `references/system-design-sandboxed-long-running-task-execution.md` only when jobs execute untrusted or sandboxed work.
- If the user asks about online code execution, code judging, CI/build runners, untrusted sandboxing, worker queues, polling status APIs, long-running submission states, or Redis leaderboard materialization, use `references/system-design-sandboxed-long-running-task-execution.md`; combine it with `references/system-design-pattern-recognition-playbook.md` for long-running task choices.
- If the user asks about streaming Top-K, most-viewed/trending rankings, high-volume event counters, time-windowed leaderboards, hot-key counters, watermarks, or precomputed ranking snapshots, use `references/system-design-streaming-top-k-windowed-aggregation.md`; combine it with `references/system-design-pattern-recognition-playbook.md` for scaling reads/writes and `references/system-design-architecture-decision-playbook.md` for stream-processing/storage choices.
- If the user asks about recommendation feeds, Tinder-style swiping, candidate stacks, reciprocal matches, follow-back/friend-match flows, avoiding repeated candidates, feed cache refill, geospatial candidate retrieval, or atomic pair-key matching, use `references/system-design-recommendation-feed-reciprocal-actions.md`; combine it with `references/system-design-pattern-recognition-playbook.md` for feed/read-scaling and contention fit.
- If the user asks about social timelines, follower feeds, notification inboxes, fan-out-on-write, fan-out-on-read, hybrid fan-out, celebrity producer handling, follow graph storage, or timeline materialization, use `references/system-design-hybrid-feed-fanout-timeline.md`; combine it with `references/system-design-feed-aggregation-playbook.md` only when the feed is also an external/content aggregation pipeline.
- If the user asks about Instagram/TikTok-style media feeds, photo/video posts, direct uploads plus feed generation, media processing readiness before fan-out, CDN media variants, or user-generated media social feeds, use `references/system-design-media-heavy-social-feed.md`; combine it with `references/system-design-large-blob-file-sync.md` for upload/blob details and `references/system-design-hybrid-feed-fanout-timeline.md` for fan-out details.
- If the user asks about web crawlers, large-scale crawling, URL frontiers, external page fetching, robots.txt, crawl-delay, polite crawling, DNS-aware crawling, fetch/parse pipelines, URL deduplication, content hashing, or crawler traps, use `references/system-design-web-crawler-pipeline.md`; combine it with `references/system-design-external-data-monitoring-alerts.md` only when the crawl exists to monitor known external entities and emit alerts.
- If the user asks about price tracking, external data monitoring, priority crawling, browser-extension/client-assisted collection, trust validation, time-series history, threshold alerts, CDC/outbox notifications, or stale-but-available monitoring, use `references/system-design-external-data-monitoring-alerts.md`; combine it with `references/system-design-feed-aggregation-playbook.md` only when the monitored data also becomes a user-facing content feed.
- If the user asks about real-time clickstream analytics, ad clicks, impression tracking, event aggregation, signed impression IDs, dedupe caches, event-time windows, hot ad/campaign partitions, OLAP advertiser dashboards, or stream-processing analytics, use `references/system-design-realtime-clickstream-aggregation.md`; combine it with `references/system-design-streaming-top-k-windowed-aggregation.md` only when the output is specifically a Top-K/trending ranking.
- If the user asks about metrics monitoring platforms, observability metrics, time-series ingestion, label cardinality, rollups/downsampling, dashboard queries, alert rules, alert state, notification delivery, or meta-monitoring, use `references/system-design-metrics-monitoring-platform.md`; combine it with `references/system-design-realtime-clickstream-aggregation.md` only when product analytics events also need dashboard-style aggregation.
- If the user asks about ride-hailing, delivery dispatch, provider/driver matching, geospatial assignment, high-frequency location updates, offer accept/decline workflows, provider leases, or preventing double assignment, use `references/system-design-realtime-dispatch-provider-matching.md`; combine it with `references/system-design-pattern-recognition-playbook.md` for real-time updates, contention, and durable workflow choices.
- If the user asks about brokerage/trading apps, market-data feeds, external live score/vendor feeds, topic-based feed fan-out, SSE price updates, order create/cancel state, externally authoritative transactional state, or reconciliation with an external authority, use `references/system-design-market-data-proxy-order-state.md`; combine it with `references/system-design-durable-real-time-messaging.md` only if client delivery must be durable/offline per recipient.
- If the user asks about payments, checkout, refunds, disputes, chargebacks, wallet transfers, merchant payouts, subscriptions, marketplace escrow, financial workflow state machines, idempotency keys, immutable audit events, double-entry ledgers, durable webhooks, or external reconciliation, use `references/system-design-financial-workflow-state-machines.md`; combine it with `references/system-design-market-data-proxy-order-state.md` only when real-time external feed proxying is also central.
- If the user asks about LLM serving, ChatGPT-like systems, token streaming, time-to-first-token, SSE generation streams, GPU scheduling, continuous batching, inference queues, generation lifecycle state, cancellation, context truncation/summarization/retrieval, prefix caching, model routing, or AI chat history persistence, use `references/system-design-llm-serving-streaming-gpu-scheduling.md`; combine it with `references/system-design-durable-real-time-messaging.md` only for chat persistence contrasts, not for token-stream durability.
- If the user asks about auctions, bidding, current highest bid, contested state updates, ordered bid processing, per-auction queues, auction close workflows, or live highest-bid fanout, use `references/system-design-high-contention-bidding-realtime.md`; combine it with `references/system-design-pattern-recognition-playbook.md` for contention and real-time update fit.
- If the user asks about offline-first mobile tracking, Strava-style activity recording, GPS route points, sensor event capture, pause/resume state, local durable queues, idempotent chunk sync, or intermittent-connectivity clients, use `references/system-design-offline-first-activity-tracking.md`; combine it with `references/system-design-pattern-recognition-playbook.md` for write-scaling and sync choices.
- If the user asks about live comments, livestream chat overlays, high-scale one-way event streaming, SSE, hot live rooms/videos, recent-comment replay, reconnect catch-up, or best-effort fan-out, use `references/system-design-live-comment-streaming.md`; combine it with `references/system-design-durable-real-time-messaging.md` only when per-recipient guaranteed delivery is required.
- If the user asks about API rate limiting, gateway throttling, token bucket, sliding window, Redis counters, distributed quota enforcement, HTTP 429 headers, hot global limits, or fail-open/fail-closed policy, use `references/system-design-distributed-rate-limiter.md`; combine it with `references/system-design-pattern-recognition-playbook.md` for contention/write-scaling context.
- If the user asks about distributed caches, Redis/Memcached-like systems, consistent hashing, virtual nodes, LRU, TTL expiration, cache eviction, cache replication, hot keys, cache stampedes, or cache topology changes, use `references/system-design-distributed-cache.md`; combine it with `references/system-design-pattern-recognition-playbook.md` for read-scaling context.
- If the user asks about collaborative editing, Google Docs-like systems, shared mutable documents, OT, CRDT, real-time co-editing, document operation logs, snapshots, presence/cursor state, or convergence after concurrent edits, use `references/system-design-collaborative-editing-convergence.md`; combine it with `references/system-design-durable-real-time-messaging.md` only for transport/offline delivery contrasts.
- If the user asks about custom keyword search, inverted indexes, posting lists, search without Elasticsearch/OpenSearch, hot/cold index tiers, approximate popularity ranking, phrase indexes, or index write amplification, use `references/system-design-custom-inverted-index-search.md`; combine it with `references/system-design-architecture-decision-playbook.md` when comparing against managed search engines.
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

For code, design, documentation, or release reviews, default to:

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

For system design pattern recognition, use the response shape in `references/system-design-pattern-recognition-playbook.md`.

For specialized system designs, use the reference selected in `Workflow selection`; do not duplicate routing rules here.

For Git commit messages, use the format and rules in `references/commit-message-guidelines.md`.

For low-level design or coding guidance, use `references/low-level-design-coding-principles.md` when the task is non-trivial.

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
