# System Design Recommendation Feed With Reciprocal Actions

## Purpose

Use this reference for systems where users consume a low-latency candidate feed
and perform directional actions that may create a reciprocal state, such as a
match, follow-back, friend connection, marketplace interest, pair approval, or
mutual opt-in.

This is a specialized case under Recommendation Feeds, Geospatial Candidate
Retrieval, Write-Heavy Actions, and Reciprocal Action Matching. Use it with
`system-design-pattern-recognition-playbook.md` and
`system-design-architecture-decision-playbook.md` when a design involves
Tinder-style stacks, swiping, candidate feeds, avoiding repeated profiles,
profile eligibility, feed cache refill, atomic matching, or immediate
notifications after mutual action.

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

The system must serve a personalized candidate feed quickly while recording user
actions durably and detecting reciprocal actions consistently enough to trigger
immediate user-visible outcomes.

There are two different workloads:

1. Feed retrieval path:
   - Read-heavy.
   - Latency-sensitive.
   - Uses preferences, location, ranking, exclusion lists, and freshness.
   - Can tolerate some staleness.
2. Action/match path:
   - Write-heavy.
   - Correctness-sensitive.
   - Needs idempotency and atomicity.
   - Often cannot tolerate missed reciprocal matches if UX promises immediate
     feedback.

The staff-level move is to separate these paths instead of forcing one database
or one service to solve both.

## When To Use

Use this pattern when:

- Users consume a stack, feed, or list of candidate entities.
- Candidate retrieval depends on location, preferences, filters, eligibility,
  ranking, or availability.
- Users perform directional actions such as like, pass, follow, request,
  approve, or bid.
- A reciprocal action creates a special state such as match, connection,
  friendship, agreement, or deal.
- First page/feed load must be fast, often under a few hundred milliseconds.
- The system must avoid showing candidates the user already acted on.
- Cached feeds may become stale because profiles, preferences, locations, or
  eligibility change.
- The action path has higher write volume than normal profile updates.
- UX requires immediate feedback when a reciprocal condition is met.

Common examples:

- Dating apps.
- Friend/follow-back systems.
- Marketplace mutual-interest flows.
- Job/candidate mutual approval.
- Pairing or matching workflows.

## When Not To Use

Avoid or simplify this pattern when:

- Candidate feed size is small and can be computed directly from the primary DB.
- Matching does not need immediate notification.
- Reciprocal matches can be discovered later through reconciliation.
- Location or preference filtering is not part of the product.
- Showing repeated candidates is acceptable.
- Users have low action volume.
- A simple SQL transaction can handle all action/match logic at expected scale.
- Feed freshness matters more than feed latency.
- Multi-device client behavior makes client-side filtering unreliable and there
  is no server-side sync.

## Default Architecture

Split feed generation from action consistency:

```text
Profile writes
  -> Profile DB
  -> CDC/event stream
  -> Search/index store with geo/preferences/eligibility

Feed request
  -> Feed service
  -> Read precomputed feed cache
  -> Revalidate critical eligibility when needed
  -> Apply action-history exclusions
  -> Return candidate stack
  -> Async refill when below threshold

Cache miss / refill
  -> Indexed candidate search
  -> Rank/filter/exclude
  -> Store candidate IDs in feed cache with TTL

Action request
  -> Swipe/action service
  -> Idempotency check
  -> Atomic pair-key operation for reciprocal detection
  -> Durable action history store
  -> Idempotent match creation when reciprocal
  -> Outbox notification event
```

Use Redis for low-latency atomic reciprocal checks when scale and latency demand
it, but keep durable action history in Cassandra, SQL, or an event log.

## Core Design Rules

### 1. Split feed generation from action consistency

Feed generation is read-heavy and can tolerate stale candidates. Swipe/action
processing is write-heavy and may require strong consistency.

Design separate components:

- Profile/candidate service.
- Feed builder service.
- Feed cache.
- Search/index store.
- Action/swipe service.
- Atomic match detector.
- Durable action history store.
- Notification publisher.

Do not force one primary database query to handle personalized candidate
retrieval, exclusions, ranking, write history, and reciprocal matching.

### 2. Use indexed search for real-time candidate retrieval

Use a search/index-optimized store for fast filtering by profile attributes,
preferences, eligibility, and geospatial constraints.

Options include:

- Elasticsearch/OpenSearch.
- PostGIS/full-text/trigram when scale and ranking are moderate.
- S2/geohash/geospatial partitioning.
- A specialized candidate retrieval service.

Keep the index synchronized from the primary profile store using CDC or event
streams. Monitor index lag because feed results are eventually consistent.

### 3. Combine precomputed feed cache with real-time indexed search

Precomputation alone becomes stale and may be exhausted by active users. Real-
time search alone may be too slow for first interaction.

Use a two-tier feed path:

1. Read from cached candidate stack.
2. When stack drops below threshold, asynchronously refill from indexed search.
3. On cache miss, query the index directly with degraded latency.
4. Apply exclusion filters before returning candidates.

This gives fast initial load plus recovery/refill when cached candidates run
out.

### 4. Make feed cache tunable

Expose operational knobs:

- Feed TTL.
- Number of candidates cached per user.
- Refill threshold.
- Which users get warmed feeds.
- Refresh schedule.
- Max index query latency.
- Cache miss fallback behavior.
- Candidate freshness threshold.

Tune these using cache hit rate, stale-candidate rate, feed exhaustion, index
latency, and background compute cost.

### 5. Warm feeds only for likely active users

Do not precompute feeds equally for all users. Precomputing inactive-user feeds
wastes compute and cache.

Use recent activity, session-open probability, notification interaction,
historical usage, or cohort priority to decide which users receive warm feeds.
Cold users may see slower first load, which is usually acceptable if active-user
latency improves.

### 6. Treat stale feeds as expected

Cached candidates may become invalid because:

- Candidate moved.
- Candidate updated preferences.
- Candidate became ineligible or deactivated.
- User changed filters.
- User already acted on the candidate from another device.

Use TTLs, event-triggered invalidation, background refresh, and optional
read-time revalidation for critical eligibility fields.

### 7. Put reciprocal actions on one consistency boundary

Two directional actions that can create a reciprocal result must be checked
atomically. Avoid this race:

```text
A likes B: checks for B->A, sees none
B likes A: checks for A->B, sees none
both actions are saved
match notification is missed
```

Create a canonical pair key:

```text
pair_key = min(user_a, user_b) + ":" + max(user_a, user_b)
```

Store or process both directions under that key so write and inverse-check share
one atomic boundary.

### 8. Prefer Redis atomic operations for low-latency match detection

Redis Lua scripts or transactions can atomically:

1. Record current user's action.
2. Read opposite user's action.
3. Return whether reciprocal match exists.
4. Create or mark match idempotently, or publish a match event.

Redis fits low-latency matching better than distributed transactions in many
wide-column stores. But Redis is memory-bound and operationally sensitive to
eviction, failover, and shard rebalancing.

### 9. Keep durable action history outside Redis

Redis can detect recent matches quickly, but durable storage must keep the
historical record.

Options:

- Write-through: durable store and Redis both updated on action request.
- Durable-first plus Redis update/event.
- Redis-first with background flush only when delayed durability is acceptable.

Add idempotency, retry, reconciliation, and event logs to handle dual-write
failure modes. Use durable history to rebuild Redis state when needed.

### 10. Add reconciliation even when immediate match is required

Immediate match detection should have a safety net. Run a scheduled job or
streaming consumer that scans durable action history for reciprocal pairs
without materialized matches.

Make match creation idempotent by canonical `pair_key` or `match_id` so
reconciliation does not create duplicates.

### 11. Use client-side recent-action cache only as optimization

Clients can filter recently acted-on candidates when backend replicas or search
indexes lag, but client cache is not authoritative.

It breaks down with:

- Multiple devices.
- App reinstall.
- Cache clearing.
- Malicious clients.
- Offline actions.

If users can use multiple devices, sync recent-action state server-side.

### 12. Use Bloom filters only for large exclusion sets

For users with huge action histories, Bloom filters can cheaply test "probably
already acted on." They have no false negatives, so they prevent re-showing
acted-on profiles, but false positives may hide valid candidates.

Use only when:

- Exact exclusion checks become too slow or memory-heavy.
- False positives are acceptable.
- Filters can be rebuilt from durable action history.
- False positive rate and memory size are tuned and monitored.

## Architecture Decision Rules

- If first-feed latency must be very low, use precomputed feed cache.
- If users exhaust cached feeds quickly, combine cache with real-time indexed
  search.
- If candidate filtering includes location, use geospatial indexes/search.
- If profile freshness matters, sync profile DB to index via CDC/events.
- If cached feeds may be stale, enforce TTL and refresh triggers.
- If precomputation is expensive, warm only active or likely active users.
- If immediate reciprocal match notification is promised, use atomic same-key or
  same-partition reciprocal checks.
- If reciprocal action state must be low-latency, use Redis Lua/atomic
  operations when operationally acceptable.
- If durable action history matters, write to Cassandra, SQL, or an event log.
- If Redis is used for matching, add reconciliation and rebuild paths.
- If users can use multiple devices, avoid relying only on client-side recent
  actions.
- If action history is small, use exact DB/query contains checks.
- If action history is huge, consider Bloom filters.
- If false positives are unacceptable, avoid Bloom filters.
- If repeated candidates are worse than hiding a few candidates, Bloom filters
  may be acceptable.

## Production Guardrails

Idempotency:

- Make action writes idempotent by `(actor_id, target_id, action_type/version)`.
- Make match creation idempotent by canonical `pair_key`.
- Deduplicate notification events by `match_id`.
- Ensure retrying an action does not create duplicate actions or notifications.

Atomicity:

- Use Redis Lua, Redis transaction, or single-partition transaction for
  reciprocal checks.
- Store both directions under canonical pair key.
- Ensure action write and inverse check happen in one atomic operation.

Durability:

- Persist all actions to durable storage.
- Store materialized matches separately from raw actions.
- Use event log/outbox for notifications.
- Periodically flush or stream Redis state if Redis is write-through cache.

Reconciliation:

- Find reciprocal actions missing match records.
- Repair Redis from durable store after cache loss.
- Rebuild Bloom filters from durable action history.
- Reconcile notification status for matches created but not delivered.

Feed freshness:

- Use TTLs for precomputed feeds.
- Invalidate cache on major profile, preference, eligibility, or location
  changes.
- Revalidate critical candidate eligibility before display when required.
- Track stale-candidate and repeat-candidate rates.

Backpressure:

- Limit feed rebuild frequency per user.
- Limit expensive index queries during cache miss storms.
- Rate-limit action writes per user/device.
- Queue and shed load for background feed generation.

Notifications:

- Use outbox pattern for match notification events.
- Retry push notifications with bounded retries.
- Store notification delivery status.
- Do not block match creation on APNS/FCM success.
- Make notification delivery at-least-once with dedupe.

Cache and index recovery:

- Rebuild feed caches asynchronously.
- Rebuild Bloom filters from durable history.
- Recover Redis match state from recent durable actions when possible.
- Keep cache/search failure from taking down durable action writes.

Observability:

- Feed cache hit rate.
- Feed generation latency.
- Feed exhaustion rate.
- Stale candidate rate.
- Repeat candidate rate.
- Action write latency.
- Match detection latency.
- Missed match reconciliation count.
- Duplicate notification count.
- Redis memory usage and eviction count.
- Search index lag.
- Bloom filter false positive estimate.

## Common Failure Modes

| Failure Mode | Cause | Mitigation |
|---|---|---|
| Missed reciprocal match | Check-then-write race | Atomic pair-key operation |
| Duplicate match | Retry or concurrent processing | Idempotent match key |
| Duplicate notification | At-least-once event delivery | Notification dedupe by `match_id` |
| Slow first feed load | Real-time query over large dataset | Precompute feed cache |
| Feed cache exhausted | User acts faster than refill | Refill threshold and async generation |
| Stale candidate | Profile/location/preference changed | TTL, invalidation, revalidation |
| Repeated candidate shown | Action history/index lag | Durable exclusion plus recent-action cache |
| Exact exclusion too slow | Huge action history | Bloom filter after threshold |
| Valid candidate hidden | Bloom false positive | Tune false positive rate |
| Redis memory pressure | Too many active pair keys | TTLs, memory planning, durable flush |
| Redis shard failure | Node loss or rebalancing | Durable history plus reconciliation |
| Search index stale | CDC lag or failed indexing | Lag monitoring and fallback |
| Hot key/partition | Very active user or pair | Sharding strategy and rate limits |
| Feed rebuild storm | Many cache misses at once | Request coalescing and backpressure |
| Multi-device inconsistency | Client cache only knows local actions | Server-side recent-action sync |

## Clarifying Questions

Ask:

1. What is the expected DAU?
2. How many actions/swipes per user per day?
3. What is the p95/p99 latency target for feed load?
4. What is the p95/p99 latency target for action write and match notification?
5. Does the product require immediate reciprocal match detection?
6. Is delayed reconciliation acceptable?
7. Can users use multiple devices simultaneously?
8. How bad is showing a repeated candidate versus hiding a valid candidate?
9. Which candidate filters are hard constraints versus ranking signals?
10. How frequently do users change location?
11. How frequently do profiles/preferences change?
12. Should candidates be strongly fresh or good enough?
13. How many candidates should be cached per user?
14. Which users should receive warmed feed caches?
15. What feed staleness TTL is acceptable?
16. What geospatial indexing strategy is available?
17. How will profile DB sync to the search index?
18. What index lag is acceptable?
19. What happens when Redis is down?
20. What happens when the search index is down?
21. What happens when notification delivery fails?
22. Are Bloom filter false positives acceptable?
23. How will Bloom filters be rebuilt after cache loss?
24. What privacy/security rules affect candidate visibility?

## Reusable Agent Instructions

When designing a recommendation feed with reciprocal actions:

1. Separate feed retrieval from action/match processing.
2. Optimize feed path for low-latency reads and acceptable freshness.
3. Optimize action path for idempotent writes and reciprocal consistency.
4. Do not use naive primary-database location scans at scale.
5. Use geospatial/search indexing for candidate discovery.
6. Use precomputed feed cache for instant initial load.
7. Use real-time indexed search for refill or cache miss.
8. Add TTLs and invalidation triggers for cached feeds.
9. Warm feeds only for likely active users.
10. Treat stale candidates as expected.
11. Use canonical pair keys for reciprocal action state.
12. Ensure reciprocal check and action write are atomic.
13. Prefer Redis Lua/atomic operations for low-latency matching when suitable.
14. Store durable action history outside Redis.
15. Add reconciliation to repair missed matches.
16. Make match creation and notification idempotent.
17. Use client-side recent-action cache only as optimization.
18. Use Bloom filters only for large exclusion sets where false positives are
    acceptable.
19. Include observability for feed latency, cache hit rate, stale candidates,
    match latency, missed matches, and duplicate notifications.

## Condensed Memory

Use this pattern when users consume a personalized candidate feed and perform
directional actions that may create a reciprocal state. Split the architecture
into a read-heavy feed path and write-heavy action/match path. For feed loading,
combine precomputed feed cache for instant first load with real-time
indexed/geospatial search for refill and cache miss. Use TTLs, background
refresh, active-user-only warming, and event-triggered invalidation for stale
feeds. For action consistency, store reciprocal action state under a canonical
pair key so both directions land on one atomic boundary. Prefer Redis
Lua/atomic operations for low-latency match detection while persisting durable
action history in Cassandra, SQL, or an event log. Add idempotent match
creation, notification dedupe, reconciliation jobs, Redis recovery, and durable
outbox. To avoid repeated candidates, combine durable action history with
client-side recent-action filtering when assumptions hold; use Bloom filters for
very large histories if false positives are acceptable.
