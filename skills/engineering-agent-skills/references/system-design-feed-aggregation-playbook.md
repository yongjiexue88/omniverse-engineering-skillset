# System Design Feed Aggregation Playbook

## Purpose

Use this reference for high-scale read-optimized feed aggregation systems: systems that ingest content from internal or external sources, normalize it, and serve ordered feeds with low latency under massive read traffic.

This reference is a specialized case under the Scaling Reads pattern. Use it with `system-design-pattern-recognition-playbook.md` and `system-design-architecture-decision-playbook.md` when the design involves feeds, content aggregation, infinite scroll, feed delivery, ordered activity logs, notifications, news, products, events, or similar read-heavy content lists.

## Table of Contents

- [Core Problem Pattern](#core-problem-pattern)
- [When To Use](#when-to-use)
- [When Not To Use](#when-not-to-use)
- [Default Architecture](#default-architecture)
- [Core Design Rules](#core-design-rules)
- [Production Guardrails](#production-guardrails)
- [Common Failure Modes](#common-failure-modes)
- [Clarifying Questions](#clarifying-questions)
- [Reusable Agent Instructions](#reusable-agent-instructions)
- [Condensed Memory](#condensed-memory)

## Core Problem Pattern

The system must collect content from many sources, normalize and store it internally, and serve a constantly changing feed to many users with stable pagination and low latency.

The generic problem:

> How do we serve a fast, stable, read-heavy feed when new items are continuously inserted at the top and users scroll through older content?

The hard parts are:

- Prevent duplicate or missing feed items during infinite scroll.
- Avoid database reads on every feed request at high QPS.
- Keep feeds reasonably fresh without relying only on TTL cache refresh.
- Survive upstream source failures.
- Keep media assets fast and reliable even when external publishers are slow or unavailable.
- Prefer availability and low latency over strict freshness for non-transactional content.

## When To Use

Use this pattern when:

- Reads massively outnumber writes.
- Users consume ordered feeds: news, posts, events, products, activity logs, or notifications.
- New items are inserted frequently at the top of the feed.
- Infinite scroll must not duplicate or skip items.
- Feed latency matters more than perfect freshness.
- External content sources are unreliable or have variable latency.
- The system can tolerate slightly stale content but not unavailable content.
- Feed variants are bounded enough to precompute, such as by region, category, tenant, language, or another coarse segment.

## When Not To Use

Avoid this pattern when:

- The feed is strongly personalized per user and cannot be efficiently grouped.
- Freshness must be strict and every read must reflect the latest committed write.
- Write volume is so high that updating many precomputed feeds per item creates fanout pressure.
- The dataset is small enough that indexed database queries already meet latency targets.
- Users require random access to arbitrary page numbers instead of forward/backward cursor traversal.
- Feed ordering depends on expensive real-time ranking that changes per request.

## Default Architecture

Use separate ingestion, projection, serving, and media responsibilities:

```text
External sources / internal writers
  -> Ingestion service
  -> Source database
  -> CDC or event stream
  -> Feed projection workers
  -> Redis sorted sets / materialized feed store
  -> Feed service
  -> API clients

External media URL
  -> Media worker
  -> Object storage
  -> CDN
  -> Feed clients
```

Typical service boundaries:

- Ingestion service: fetch, validate, normalize, deduplicate, and store content.
- Feed projection workers: consume CDC/events and update read-optimized feed views.
- Feed service: paginate, read precomputed feed slices, apply bounded ranking, and return responses.
- Media service/workers: fetch, validate, resize/transcode, store, and serve assets.

## Core Design Rules

### 1. Use Composite Cursors, Not Offset Pagination

For mutable ordered feeds, use a stable cursor made from the primary ordering field plus a unique tie-breaker, such as `(published_at, article_id)`.

Offset pagination breaks when new items are inserted above the user's current page. Users may see duplicates or miss items. Timestamp-only cursors are better, but still fail when multiple items share the same timestamp. A composite cursor creates a total order.

Generic query shape:

```sql
WHERE (sort_time, id) < (:cursor_time, :cursor_id)
ORDER BY sort_time DESC, id DESC
LIMIT :limit
```

Required index:

```sql
CREATE INDEX idx_feed_order ON items (sort_time DESC, id DESC);
```

Tradeoffs:

- Composite cursors are less human-readable than page numbers.
- They require careful index design.
- They make arbitrary page-number jumps harder.

### 2. Precompute Read Paths When Read Traffic Dominates

Do not compute a high-QPS feed from raw tables on every request. Precompute feed slices and serve them from a fast ordered read store once direct database reads become too expensive or unpredictable.

Good precompute keys are bounded segment dimensions:

- region
- category
- tenant
- language
- topic
- audience tier

Tradeoffs:

- Precomputation improves read latency.
- It adds freshness, invalidation, duplicate handling, replay, and repair complexity.
- It can become expensive if feed variants approach one unique feed per user.

### 3. Use CDC Or Events To Update Feed Projections

Use database change events or an application event stream to update cached/materialized feeds when new content arrives.

Preferred pipeline:

```text
Source DB write
  -> CDC/event
  -> Feed projection worker
  -> Redis/materialized feed update
  -> Feed API reads from projection
```

Use TTL as a safety net, not the main freshness mechanism. TTL-only caching creates stale windows, cache misses, and tail-latency spikes during refresh.

Guardrails:

- Make projection updates idempotent.
- Track CDC/event lag.
- Support replay from the event log.
- Run reconciliation from source DB to projection store.
- Alert when feed freshness exceeds its target.

### 4. Store Critical External Media Internally

Do not serve critical user-facing media directly from third-party origins. Fetch, normalize, store, and serve it from your own object storage/CDN when feed reliability and UX consistency matter.

Media pipeline:

```text
External media URL
  -> async fetch
  -> validate content type, size, dimensions, and safety
  -> resize/transcode
  -> store in object storage
  -> serve through CDN
```

Tradeoffs:

- Internal media handling costs storage, bandwidth, processing, and legal/compliance review.
- It gives the system control over latency, availability, dimensions, thumbnails, and cacheability.
- Use placeholders or degraded feed cards if media processing fails.

### 5. Separate Ingestion From Serving

Ingestion and serving have different SLOs and scaling profiles.

- Ingestion is background, batch, event-driven, retry-heavy, and dependent on external sources.
- Feed serving is latency-sensitive, read-heavy, and user-facing.

Separate these responsibilities when one path should not degrade the other.

### 6. Use Hybrid Source Ingestion

Prefer push/webhooks for freshness, but keep polling as fallback when not every source can push.

Recommended ingestion tiers:

1. Authenticated webhook push for trusted or high-volume partners.
2. RSS/API polling for normal sources.
3. Scraping fallback only when allowed, stable, and operationally safe.

All ingestion paths should converge into the same validation, deduplication, and processing pipeline.

Webhook guardrails:

- Authenticate with shared secrets, signatures, API keys, or mTLS.
- Validate publisher ownership.
- Rate-limit and quota by publisher.
- Quarantine suspicious payloads.
- Deduplicate against polling/API results.

### 7. Serve Stale-But-Valid Data For Availability

For non-transactional content feeds, stale-but-valid data is usually better than no feed.

Graceful degradation options:

- Serve cached feed if DB or projection refresh is slow.
- Serve last-known-good regional/category feed if projection workers lag.
- Hide or replace broken media.
- Degrade ranking or personalization before failing the base feed.
- Return partial feed results when safe.

## Production Guardrails

### Pagination

- Use opaque cursor tokens, not raw client-editable SQL values.
- Include every ordering field in the cursor.
- Use deterministic ordering; never sort only by non-unique timestamp.
- Add a composite index matching the query order.
- Enforce max page size.
- Add cursor expiration/versioning if ranking or ordering logic changes.
- Support backward-compatible cursor decoding during migrations.

### Feed Projection Store

- Use Redis sorted sets or an equivalent ordered read store for precomputed feeds.
- Use CDC or event streams to update materialized feeds.
- Make projection updates idempotent.
- Track CDC lag and feed freshness.
- Add replay from event log for rebuilds.
- Add periodic reconciliation from source DB to projection store.
- Keep last-known-good feed snapshots.
- Apply backpressure to feed generation workers.
- Use DLQ for poison events.
- Alert on projection failure, cache update lag, and stale feed age.
- Trim feed sets to a bounded hot window and archive older items elsewhere.

### Ingestion

- Authenticate publisher webhooks.
- Rate-limit publisher writes.
- Validate schema, content type, URL, timestamp, publisher identity, and duplicate articles.
- Deduplicate by canonical URL, publisher ID, normalized title, content fingerprint, and publish timestamp.
- Retry publisher API/RSS failures with exponential backoff.
- Use circuit breakers for failing publishers.
- Track per-publisher freshness and failure rate.
- Keep fallback polling even when webhooks exist.

### Media Handling

- Fetch media asynchronously.
- Validate file size, MIME type, dimensions, and safety.
- Resize/transcode thumbnails into standard formats.
- Store assets in object storage.
- Serve through CDN.
- Use placeholder images when processing fails.
- Do not block article ingestion on thumbnail processing unless media is required.

### Availability And Degradation

- Serve stale cached feed on database/cache refresh failure.
- Degrade personalization/ranking before failing base feed.
- Use regional/category fallback feeds if a personalized or segment feed is unavailable.
- Return partial feed results instead of hard failures when safe.
- Add timeout budgets between API gateway, feed service, cache, DB, and media service.

### Observability

- Track p50/p95/p99 feed latency.
- Track cache hit rate by region/category/feed type.
- Track cursor pagination duplicate/missing reports.
- Track feed freshness age.
- Track CDC/event lag.
- Track source ingestion lag.
- Track webhook validation failures.
- Track Redis memory and sorted-set cardinality.
- Track media processing success/failure.
- Trace from content ingestion to feed appearance.

## Common Failure Modes

### Duplicate Or Missing Items During Infinite Scroll

Cause: offset pagination or timestamp-only cursor.

Mitigation: use composite cursor with deterministic ordering and matching composite index.

### Timestamp Collision At Cursor Boundary

Cause: multiple items share identical `published_at`.

Mitigation: use `(published_at, id)` or `(score, id)` as the total ordering key.

### Feed API Tail Latency Spikes

Cause: database reads on cache miss, lazy cache refresh, or large offset scans.

Mitigation: precompute feed projections, use cursor pagination, warm caches, enforce request timeouts, and use stale-while-revalidate.

### Feed Projection Stale Beyond Target

Cause: CDC worker lag, event consumer failure, or broken projection update.

Mitigation: monitor freshness age, replay events, run reconciliation jobs, and rebuild affected segments from source data.

### Cache Stampede During Breaking News

Cause: many users request the same feed while cache is cold or invalidated.

Mitigation: use request coalescing, stale-while-revalidate, prewarming, CDN caching, and cache update batching.

### Source Outage Or Slow RSS/API Response

Cause: external dependency failure.

Mitigation: use per-source circuit breakers, retry/backoff, ingestion deadlines, and last-known-good source state.

### Webhook Spam Or Forged Source Events

Cause: unauthenticated public webhook endpoint.

Mitigation: require signatures/API keys, validate source ownership, rate-limit, and quarantine suspicious payloads.

### Duplicate Content Across Ingestion Paths

Cause: the same item arrives through webhook, RSS, API, or scraping.

Mitigation: use canonical URL normalization, publisher-scoped IDs, content fingerprinting, and idempotent upsert.

### Media Breaks Feed Rendering

Cause: external images disappear, load slowly, are unsafe, or have inconsistent dimensions.

Mitigation: process media into internal object storage, serve via CDN, and use placeholders on failure.

### Redis Memory Growth

Cause: unbounded sorted sets per region/category/feed variant.

Mitigation: trim feed sets to a bounded window, archive older items in DB/object storage, and monitor cardinality.

### Cursor Migration Breaks Old Clients

Cause: cursor format or ordering logic changes.

Mitigation: version cursor tokens and support old cursor decoding during rollout.

## Clarifying Questions

Ask only the questions needed for the decision:

- What are expected DAU, QPS, and feed refreshes per user per day?
- What are the p95/p99 latency targets?
- Is stale content acceptable? If yes, what is the maximum stale window?
- Are feeds global, regional, category-based, tenant-based, or personalized per user?
- How many feed variants exist?
- What is the write rate of new content?
- Can multiple items share the same timestamp or score?
- What is the canonical feed ordering: time, score, relevance, or hybrid?
- Do users need random page access or only infinite scroll?
- How often does ranking change after insertion?
- Can upstream sources push webhooks?
- What fallback is required for sources that only support polling?
- What is the acceptable time from source publication to feed visibility?
- How should duplicate content across sources be detected?
- Should media be stored internally or linked externally?
- What is the retention window for hot feed cache?
- What happens if Redis/cache is unavailable?
- What happens if CDC or projection workers lag or fail?
- Are click analytics required for ranking, billing, or recommendations?
- What repair/rebuild strategy exists for corrupted projections?

## Reusable Agent Instructions

- Prefer cursor pagination for mutable ordered feeds.
- Never use offset pagination for high-scale infinite scroll unless the dataset is static or tiny.
- Build cursors from a full deterministic ordering key.
- Add a unique tie-breaker to every cursor.
- Match cursor query order with a composite database index.
- Separate ingestion from serving when write and read workloads have different SLOs.
- Precompute read-heavy feed views when database reads cannot meet latency or cost targets.
- Use CDC or event streams to update materialized feeds.
- Treat caches as projections that need replay, reconciliation, and monitoring.
- Serve stale-but-valid feed data when availability is more important than strict freshness.
- Use webhooks for low-latency partner ingestion, but keep polling fallback.
- Normalize all ingestion paths into one validation/deduplication pipeline.
- Store critical external media internally and serve it through CDN.
- Add idempotency, retries, backpressure, DLQ, and replay to ingestion/projection workers.
- Monitor feed freshness, cache hit rate, CDC lag, cursor errors, and p99 latency.
- Design graceful degradation before scaling optimizations become necessary.

## Condensed Memory

High-scale feed aggregation is a Scaling Reads pattern: ingest external or internal content asynchronously, normalize it, and serve massive read traffic through stable cursor pagination and precomputed feed projections. For mutable infinite scroll, avoid offset pagination; use composite cursors such as `(published_at, id)` with matching composite indexes to prevent duplicates and missing items. When read QPS is high, avoid querying the database on every feed request; precompute regional/category feeds in Redis sorted sets or a similar ordered read store. Use CDC/events to update cached feeds instead of relying only on TTL. Separate ingestion from feed serving because ingestion is background/event-driven while serving is latency-sensitive. Prefer availability over strict consistency for content feeds: serve stale-but-valid data rather than failing. Use webhooks for real-time source ingestion, with RSS/API polling as fallback. Store critical external media internally in object storage/CDN to control reliability, latency, and formatting. Guardrails include idempotent ingestion, dedupe, retries/backoff, DLQ, replay, cache rebuilds, CDC lag monitoring, stale-feed alerts, cursor versioning, cache stampede protection, bounded sorted sets, and graceful degradation.
