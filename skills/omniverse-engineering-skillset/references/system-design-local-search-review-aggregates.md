# System Design Local Search With Review Aggregates

## Purpose

Use this reference for read-heavy local discovery systems where users search and
browse entities much more often than they write reviews or updates. The
canonical example is Yelp-style business search with name, category, location,
rating, reviews, and one-review-per-user constraints.

This is a specialized case under Scaling Reads, Geo Search, Search Indexing,
Derived Aggregates, and Persistence-Layer Constraints. Use it with
`system-design-pattern-recognition-playbook.md` and
`system-design-architecture-decision-playbook.md` when a design involves local
business search, location-aware catalogs, review aggregates, rating counts,
nearby filtering, text search, or database-vs-search-engine choices.

## Table of Contents

- [Core Problem Pattern](#core-problem-pattern)
- [When To Use](#when-to-use)
- [When Not To Use](#when-not-to-use)
- [Default Architecture](#default-architecture)
- [Core Design Rules](#core-design-rules)
- [Architecture Decision Rules](#architecture-decision-rules)
- [Production Guardrails](#production-guardrails)
- [Common Failure Modes](#common-failure-modes)
- [Clarifying Questions](#clarifying-questions)
- [Reusable Agent Instructions](#reusable-agent-instructions)
- [Condensed Memory](#condensed-memory)

## Core Problem Pattern

The system must support low-latency search across text, geography, category,
and ranking signals while writes are comparatively rare but still update fields
that appear in hot read paths.

The generic problem:

> How do we keep local search fast while preserving durable review writes,
> aggregate correctness, and hard business constraints?

The design tension:

- Search is read-heavy, multidimensional, and latency-sensitive.
- Review writes are lower-volume but correctness-sensitive.
- Search results need cheap access to derived fields such as average rating and
  review count.
- Entity detail pages need fast reads of primary entity data plus user content.
- Rules such as "one user can review one entity once" must be enforced
  reliably.
- Search/read models can usually be eventually consistent, but the source of
  truth cannot be.

The staff-level lesson: do not overbuild the write path just because the read
path is massive. Scale search, detail reads, and review writes according to
their own shape.

## When To Use

Use this pattern when:

- Users frequently search or view entities, but writes are rare.
- Search combines text, geo, category, rating, filters, and ranking signals.
- Derived values are shown in hot read paths.
- Eventual consistency is acceptable for search indexes or read models.
- Writes must enforce durable business constraints.
- The system has local or geographic discovery behavior.
- The design must choose between database-native indexing and a separate search
  engine.
- You need to avoid unnecessary queues, microservice splits, or sharding.

Common examples:

- Yelp-style business search.
- Local services marketplace.
- Nearby restaurants, stores, venues, or providers.
- Location-aware content catalogs.
- Review/rating search for products, rentals, classes, or professionals.

## When Not To Use

Avoid or simplify this pattern when:

- The dataset is small and indexed SQL queries already meet latency targets.
- Search is exact-match only and does not require geo/text ranking.
- Writes are high-volume enough that aggregate updates become hot-key
  bottlenecks.
- Aggregates must be strongly consistent across distributed shards.
- Search results must reflect every write immediately.
- The organization cannot operate Elasticsearch/OpenSearch reliably.
- Geo data is not important enough to justify spatial indexing.
- User-generated content requires heavy moderation, fraud detection, or abuse
  pipelines before becoming visible.

## Default Architecture

Use separate source-of-truth, search, and review write responsibilities:

```text
Business/profile writes
  -> Primary DB
  -> CDC/outbox
  -> Search index or DB-native indexed read model

Review create/update
  -> Review service/API
  -> Primary DB transaction:
       insert/update review
       enforce unique (user_id, business_id)
       update rating_sum/review_count/average_rating
  -> CDC/outbox
  -> Search index and cache refresh

Search request
  -> Search service
  -> Postgres + PostGIS/trigram/full-text OR Elasticsearch/OpenSearch
  -> Optional hydration from primary DB/cache
```

Start with Postgres extensions when they meet scale and relevance needs. Move to
Elasticsearch/OpenSearch when fuzzy matching, advanced ranking, faceting,
autocomplete, or very high search QPS justify the operational overhead.

## Core Design Rules

### 1. Split by scaling shape, not by nouns

Keep search and entity detail behavior together when both are tightly coupled
and read-heavy. Split review creation only when its write path, ownership,
failure isolation, or scaling profile is materially different.

Do not create a microservice or database just because a new entity exists. Ask:

- Are these operations coupled in user workflows?
- Do they share the same read/write ratio?
- Do they need to scale independently?
- Would separation force expensive cross-service joins?

### 2. Estimate write volume before adding queues

If review writes are tiny compared with reads, a synchronous transaction may be
simpler and more reliable than a queue. A 1000:1 read/write ratio with 100M
daily users may still imply roughly one review write per second, which a modern
database can handle.

Use a queue when write spikes, expensive moderation, downstream index fanout, or
external side effects need decoupling. Do not add Kafka/SQS only to make the
write path look scalable.

### 3. Precompute hot derived fields

Do not calculate average rating, review count, favorite count, availability
summary, or score during every search. Store hot derived fields with the parent
entity or search document and update them when source events happen.

Prefer storing:

- `rating_sum`
- `review_count`
- `average_rating`
- aggregate `version` or `updated_at`

For editable/deletable reviews, storing sum and count is safer than only storing
average because edits and deletes must subtract old values.

### 4. Update aggregates incrementally with concurrency protection

For append-only reviews:

```text
new_average = (old_average * old_count + new_rating) / (old_count + 1)
```

Protect synchronous aggregate updates with one of:

- Atomic DB expressions such as `rating_sum = rating_sum + :rating`.
- Optimistic locking with `WHERE version = :expected_version`.
- Expected-count checks with bounded retries.
- Queue serialization or sharded counters when contention is high.

If an optimistic update affects zero rows, re-read, recalculate, retry with a
bounded max attempt count, and emit conflict metrics.

### 5. Enforce hard business constraints in the database

Rules such as one review per user/business belong in the persistence layer.
Application-level "check then insert" has race conditions and can be bypassed by
other writers.

Use:

```sql
UNIQUE (user_id, business_id)
```

or a partial unique index when only active/approved rows count. Treat app-layer
checks as UX optimization only. Handle duplicate-key errors gracefully and make
client retries idempotent.

### 6. Match indexes to query shape

Choose indexes by access pattern:

- Exact category/status filters: B-tree or keyword index.
- Text search: inverted index, trigram, or full-text index.
- Geo radius/polygon search: spatial index, geohash, quadtree, R-tree, or
  PostGIS.
- Ranking/relevance: search-engine scoring model.
- Time ranges: time/partition index.

Simple B-tree indexes on latitude and longitude are usually poor for 2D spatial
queries because they lack spatial awareness and struggle with multidimensional
ranges.

### 7. Reduce search space early

Use a multi-stage search pipeline:

1. Candidate retrieval using the most selective cheap index.
2. Exact filtering and second-pass distance/polygon checks.
3. Ranking/scoring.
4. Cursor or `search_after` pagination.
5. Hydration from primary store/cache if needed.

When not using Elasticsearch, discuss query sequencing explicitly. Location or
distance often reduces the candidate set before expensive name/category/ranking
logic runs.

### 8. Treat search engines as read models

Elasticsearch/OpenSearch are optimized for retrieval, not transactional
integrity. Keep the primary database as source of truth and update the search
index via CDC/outbox.

Required search-index guardrails:

- Idempotent indexing.
- Versioned documents to reject out-of-order updates.
- Index-lag monitoring.
- Failed-event DLQ.
- Replay and full reindex/backfill tooling.

Never perform critical writes only in the search index.

### 9. Model named locations as polygons or memberships

Human location names such as cities and neighborhoods are irregular regions, not
circles around a point. Use a location dataset with name, type, aliases,
boundary polygon, source, and version.

For mostly static entities, precompute stable location membership at write time:

- `bay_area`
- `san_francisco`
- `mission_district`

Store membership IDs as indexed keywords and recompute when coordinates or
boundary versions change.

## Architecture Decision Rules

- If read traffic greatly exceeds write traffic, optimize search/detail reads
  first and keep review writes simple until write scale proves otherwise.
- If write throughput is tiny, avoid adding a queue just to look scalable.
- If a derived aggregate is shown in search results, precompute and store it.
- If the aggregate is append-only and low contention, update it synchronously
  with incremental math and optimistic locking or atomic DB expressions.
- If aggregate contention is high, avoid naive optimistic locking; consider
  atomic updates, queue serialization, or sharded counters.
- If a business rule must never be violated, enforce it with a database
  constraint.
- If search combines text, geo, filters, and high QPS, use a search-optimized
  index.
- If the dataset is moderate and consistency/simplicity matter, prefer Postgres
  PostGIS plus trigram/full-text search before Elasticsearch.
- If search requires fuzzy matching, faceting, autocomplete, advanced ranking,
  or very high QPS, use Elasticsearch/OpenSearch as a read model.
- If named locations are irregular regions, avoid radius-only search.
- If coordinates and boundaries rarely change, precompute location membership.
- If reviews and entity details are tightly coupled and data volume is
  manageable, keep them in the same database.

## Production Guardrails

Derived aggregate correctness:

- Store `rating_sum` and `review_count` when possible.
- Use optimistic locking, atomic update expressions, or serialized updates.
- Add bounded retries and retry metrics.
- Recalculate aggregates from source reviews in a reconciliation job.
- Track aggregate drift.

Review write integrity:

- Unique constraint on `(user_id, entity_id)`.
- Idempotency key for client retries.
- Graceful duplicate-review response.
- Rating range validation at API and DB layer.
- Transactionally insert review and update aggregate when consistency matters.

Search infrastructure:

- Correct indexes for text, geo, category, and ranking.
- Query timeout and max page size.
- Cursor pagination or `search_after` for deep pagination.
- No unbounded wildcard queries.
- Normalized search terms, categories, and location names.

Elasticsearch/OpenSearch:

- Sync from primary DB using CDC/outbox.
- Make index writes idempotent.
- Monitor index lag and failed indexing events.
- Maintain DLQ and replay tooling.
- Support full reindex/backfill.
- Version documents to avoid out-of-order corruption.

Postgres search/extensions:

- Use PostGIS for geo queries.
- Use trigram/full-text indexes for text search.
- Analyze query plans under realistic data.
- Add composite indexes for structured filters.
- Monitor index bloat and vacuum behavior.

Geo search:

- Store coordinates in a proper spatial type when available.
- Use bounding-box/geohash/quadtree/R-tree candidate retrieval.
- Run second-pass exact distance filtering.
- Handle poles, dateline, and boundary edges.
- Store named-location polygons with source/version metadata.
- Recompute memberships when boundaries change.

Caching/read scaling:

- Cache entity details separately from reviews if freshness differs.
- Cache popular business pages and search results carefully.
- Avoid globally caching personalized search results.
- Use TTLs and invalidation on review/aggregate updates.
- Add cache stampede protection.

Observability:

- Search latency by query type.
- Result count and empty-result rate.
- Query-plan regressions and index hit/miss behavior.
- Review write rate and duplicate constraint error rate.
- Optimistic lock conflict/retry rate.
- Aggregate drift.
- CDC lag and indexing DLQ size.
- Cache hit rate and stale-read complaints.

## Common Failure Modes

| Failure Mode | Cause | Mitigation |
|---|---|---|
| Average rating incorrect | Concurrent aggregate updates overwrite each other | Atomic updates, optimistic locking, reconciliation |
| Duplicate reviews | App-layer check races or is bypassed | DB unique constraint on `(user_id, entity_id)` |
| Search latency spikes | Full scan, wildcard search, bad geo query | Specialized indexes, query plans, search engine |
| Search index stale | CDC lag or failed consumer | Lag monitoring, DLQ, replay, reindex |
| Elasticsearch inconsistency | Search engine used as source of truth | Keep primary DB as source of truth |
| Over-engineered write path | Queue introduced despite tiny write volume | Estimate write throughput; use sync transaction when enough |
| Hot aggregate row contention | Many writes to same entity | Atomic update, queue per entity, sharded counters |
| Wrong named-location results | Radius used for irregular regions | Polygon boundaries or precomputed memberships |
| Slow polygon queries | Polygon checks done per request over huge set | Spatial index, candidate filtering, precomputed IDs |
| Deep pagination slow | Offset pagination over large results | Cursor or `search_after` pagination |
| Cache serves stale rating | Aggregate update does not invalidate cache | Targeted invalidation, short TTL, event refresh |
| Cross-service join latency | Reviews split unnecessarily from entity DB | Keep coupled data together until scale requires split |

## Clarifying Questions

Ask:

1. What is the read/write ratio?
2. Which fields must be strongly consistent and which can be eventual?
3. Is search exact match, fuzzy text, geo, category, ranking-heavy, or mixed?
4. What is the p95/p99 search latency target?
5. What is the dataset size now and expected in 2-3 years?
6. Are writes low enough to update aggregates synchronously?
7. Can users edit or delete reviews?
8. Is average rating computed from all reviews or only approved reviews?
9. Is there moderation before reviews become visible?
10. How strict is the one-review-per-entity rule?
11. Are there multiple writers or backfill jobs that bypass app logic?
12. Is Postgres with extensions enough before Elasticsearch?
13. Does search need fuzzy matching, ranking, faceting, autocomplete, or typo
    tolerance?
14. How will the search index stay in sync with the primary DB?
15. How much index lag is acceptable?
16. Are location names ambiguous, localized, or aliased?
17. Do named locations need polygons or is radius enough?
18. How often do entity coordinates or boundaries change?
19. Can search results be cached safely, or are they personalized?
20. What is the fallback when search infrastructure is degraded?

## Reusable Agent Instructions

When designing this kind of system:

1. Estimate read/write ratio before adding queues or complex write pipelines.
2. Keep related read-heavy behavior together unless independent scaling or
   ownership justifies separation.
3. Do not calculate hot aggregates during every read.
4. Store derived aggregate fields with the parent entity or search document.
5. Use incremental aggregate updates when source events are append-only.
6. Protect aggregate updates with OCC, atomic DB expressions, or serialization.
7. Enforce hard uniqueness rules in the database.
8. Choose indexes based on query shape.
9. Prefer Postgres extensions when they meet requirements.
10. Use Elasticsearch/OpenSearch as a read model only.
11. Sync search indexes with CDC/outbox and make indexing replayable.
12. Model named locations as polygons or precomputed location IDs.
13. Add repair jobs for derived data and search indexes.
14. Include observability for search latency, index lag, aggregate conflicts,
    duplicate constraints, and cache freshness.

## Condensed Memory

For read-heavy local discovery systems, split search/view paths from rare write
paths by scaling shape, not entity nouns. Keep entity search/detail reads
together when both are read-heavy; separate review writes only when behavior or
ownership justifies it. Do not recompute hot aggregates like average rating at
read time. Store `rating_sum`, `review_count`, and `average_rating`, and update
them synchronously with incremental math when write volume is low. Protect
concurrent aggregate updates with optimistic locking or atomic DB updates.
Enforce hard uniqueness rules such as one review per user/entity with database
constraints. Match index type to query shape: B-tree for exact filters,
full-text/trigram/inverted index for text, spatial index for geo. Prefer
Postgres plus PostGIS and trigram/full-text search at moderate scale; use
Elasticsearch/OpenSearch only when ranking, fuzzy search, faceting, or very high
QPS requires it. For named locations, use polygons or precomputed location
identifiers instead of naive radius search. Guardrails: idempotent writes, DB
constraints, aggregate reconciliation, index lag monitoring, DLQ/replay for
indexing, query timeouts, pagination, cache invalidation, and geo boundary
versioning.
