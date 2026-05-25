# System Design Hybrid Feed Fan-Out Timeline

## Purpose

Use this reference for personalized feed/timeline systems where users create
posts, follow producers, view reverse-chronological or ranked feeds, and page
through recent results with low latency.

This is a specialized case under Scaling Reads, Feed Generation, Fan-Out, and
Timeline Materialization. Use it with
`system-design-pattern-recognition-playbook.md` and
`system-design-architecture-decision-playbook.md` when a design involves social
feeds, activity feeds, notification inboxes, follower/subscriber timelines,
celebrity accounts, fan-out-on-write, fan-out-on-read, or hybrid feed
materialization.

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

The system must build a personalized stream from many producers to many
consumers while keeping reads fast, writes reliable, and fan-out cost bounded.

The generic problem:

> How do we serve a fast personalized feed when users follow many producers,
> producers have uneven follower counts, and most reads only need the newest
> page?

The hard part is fan-out:

- A user may follow many producers.
- A producer may have many followers.
- Most producers are normal, but some create extreme fan-out.
- Most users read only the newest page or first few pages.
- The system can tolerate small freshness delays, but not slow feed reads.

The staff-level solution is usually hybrid fan-out: precompute feeds for normal
producers, but pull high-follower producer posts at read time.

## When To Use

Use this pattern when:

- Users consume a personalized stream built from entities they follow.
- Feed reads are much more frequent than post creation.
- Newest items matter most.
- The product can tolerate eventual consistency.
- Feed read latency is user-visible.
- Producer follower counts are highly uneven.
- Some users follow very large numbers of producers.
- Most reads access only the first few pages.
- Ordering is reverse chronological, ranked, or a hybrid.
- Feed query patterns should be isolated from post creation and relationship
  management.

Common examples:

- Social media timelines.
- Activity feeds.
- Notification inboxes.
- Follower/subscriber feeds.
- Team/project event streams.
- Marketplace or content subscription feeds.
- Personalized dashboards.

## When Not To Use

Avoid or simplify this pattern when:

- Every feed read must be strictly consistent with the latest post.
- The user base is small enough that on-demand querying is cheap.
- The feed is rarely read.
- Follower counts are uniformly small.
- Posts are frequently edited/deleted and must update instantly everywhere.
- Feed ranking changes per request and cannot be precomputed cheaply.
- There is no clear read/write skew.
- Storage amplification is unacceptable.
- Users need deep historical pagination with strict correctness.

## Default Architecture

Separate post storage, relationship storage, and feed serving:

```text
Post create
  -> Post service writes post to source DB
  -> Transactional outbox / durable event
  -> Feed fan-out workers
  -> For normal producers:
       write post_id into follower feed stores
  -> For high-follower producers:
       skip materialization; mark for read-time merge

Follow graph
  -> Follow table by follower -> followee
  -> Reverse index by followee -> followers
  -> Optional flag on follow edge: precomputed or read-time merge

Feed read
  -> Feed service reads materialized feed entries for user
  -> Fetches recent posts from non-precomputed followees
  -> Merge, dedupe, sort
  -> Hydrate post IDs from post cache/source
  -> Return page with composite cursor
```

Store post IDs in feed entries unless full snapshots are required. Hydrate hot
post objects from cache.

## Core Design Rules

### 1. Separate post, relationship, and feed access paths

Post creation, follow relationships, and feed reads have different query shapes.
Combining all three into one generic service creates poor indexes and unclear
scaling boundaries.

Use:

- Post service/table for durable post objects.
- Follow service/table for adjacency queries.
- Feed service/table/cache for read-optimized timeline retrieval.

Follow graph access usually needs:

- Who does user X follow?
- Who follows user Y?
- Does X follow Y?

These are adjacency lookups, not deep graph traversal.

### 2. Avoid graph databases unless traversal is required

A follow graph does not automatically require a graph database. Key-value,
wide-column, or relational tables with the right indexes often handle adjacency
lookups better and more simply.

Consider graph databases only when multi-hop traversal, recommendations,
relationship analytics, or embedding workflows are central requirements.

### 3. Use cursor pagination, not offset pagination

Feeds should page using a stable cursor based on ordering field plus tie-breaker
ID.

Use deterministic ordering:

```text
ORDER BY created_at DESC, post_id DESC
cursor = opaque(created_at, post_id)
```

Offset pagination is expensive and unstable as new items arrive. Timestamp-only
cursors can duplicate or skip items when multiple posts share a timestamp.

### 4. Start with fan-out-on-read as the baseline

Fan-out-on-read computes the feed at request time:

1. Fetch followees.
2. Fetch recent posts for each followee.
3. Merge/sort.
4. Return the page.

Use it only when:

- Follow graph is small.
- Read traffic is low.
- Freshness must be high.
- Write amplification is unacceptable.

Reject it at scale when users follow many producers or feed reads must stay
under tight latency.

### 5. Use fan-out-on-write to make normal feed reads fast

Fan-out-on-write pushes a new post ID into each follower's materialized feed
asynchronously.

Use it when:

- Read latency matters more than write latency.
- Most producers have manageable follower counts.
- Eventual consistency is acceptable.
- Feed storage amplification is acceptable.
- Workers can process feed updates asynchronously.

Reads become simple timeline lookups, but writes are amplified by follower
count.

### 6. Use hybrid fan-out for celebrity producers

Do not force one strategy on every producer.

- Normal producer: fan-out-on-write into follower feeds.
- High-follower producer: skip precomputation and merge recent posts at read
  time.

This avoids writing one celebrity post into millions of feeds while keeping
normal reads fast.

Implementation options:

- Mark high-follower accounts as non-precomputed.
- Store a flag on follow edges indicating whether that producer is precomputed
  for the follower.
- Workers ignore fan-out for non-precomputed producers.
- Feed service fetches recent posts from non-precomputed followees and merges
  them with materialized feed entries.

### 7. Tune fan-out behavior per account

The best feed system is not one-size-fits-all. Classify producers by follower
count, activity, read impact, and worker cost.

Start with:

```text
if follower_count < threshold:
    precompute into follower feeds
else:
    merge at read time
```

Refine threshold using:

- Worker queue lag.
- Feed freshness SLA.
- Average and p99 followers per author.
- Read frequency of followers.
- Celebrity post frequency.
- Feed cache hit rate.
- Read-time merge cost.

### 8. Cache hot post objects separately

Materialized feeds should usually store post IDs, not full post bodies. Popular
posts may be read repeatedly by many users, creating hot partitions or uneven
read load on the post store.

Cache recent and high-fan-out post objects by `post_id`. Use TTLs or
write-through invalidation if posts can be edited/deleted.

### 9. Decouple posting latency from feed materialization

Do not make post creation wait for all follower feed updates.

On post creation:

1. Persist post.
2. Emit durable fan-out event.
3. Return success.
4. Workers consume event and update feed stores.
5. Track queue lag as feed freshness.

Use a transactional outbox or equivalent reliable event publishing to avoid
losing fan-out events after post creation.

### 10. Surface the real bottlenecks

The value in feed design is not listing REST APIs. Spend design attention on:

- Fan-out strategy.
- Celebrity problem.
- Hot keys.
- Worker throughput.
- Queue lag and freshness.
- Read/write amplification.
- Cache strategy.
- Idempotent workers.
- Repair/replay.
- Pagination correctness.

## Architecture Decision Rules

- If users follow only a small number of producers, fan-out-on-read may be
  enough.
- If feed reads must be very fast and frequent, use fan-out-on-write for normal
  producers.
- If producer follower counts are highly uneven, use hybrid fan-out.
- If an author has very high follower count, avoid precomputing into every feed.
- If an author has normal follower count, precompute to keep reads fast.
- If feed freshness can tolerate delay, use async workers.
- If strict freshness is required, avoid pure async materialization.
- If users mostly read the first page, materialize recent entries.
- If post bodies are large or frequently reused, store IDs in feeds and hydrate
  from post cache.
- If posts can be edited/deleted, avoid long-lived immutable post caches without
  tombstones or invalidation.
- If pagination uses offset, replace it with composite cursor pagination.
- If timestamp collisions are possible, use `(timestamp, id)` cursors.
- If relationship data only needs adjacency lookups, avoid graph databases.
- If recommendation or multi-hop traversal is core, consider graph or
  recommendation infrastructure.
- If a queue item represents huge variable work, split or prioritize tasks.
- If workers retry feed writes, make updates idempotent.

## Production Guardrails

- Persist post before fan-out event.
- Use transactional outbox or reliable event publishing.
- Make feed writes idempotent with `(user_id, post_id)` uniqueness or
  deterministic upsert.
- Retry transient feed update failures.
- Send poison events to DLQ.
- Monitor queue lag as product freshness.
- Dynamically classify high-follower accounts.
- Autoscale workers by queue depth, lag, and write throughput.
- Split high-follower fan-out into batches when precomputing is still needed.
- Apply backpressure when downstream stores are saturated.
- Rate-limit post and follow APIs.
- Use stable composite cursors.
- Deduplicate feed entries from retries or hybrid merges.
- Cache recent/high-fan-out post objects.
- Invalidate post cache on edits/deletes.
- Store only recent N entries or a bounded time window in materialized feeds.
- Add repair jobs to rebuild feeds after worker failures, follow changes, or
  data corruption.
- Gracefully degrade by serving stale feed plus a "new posts available" marker
  when materialization lags.
- Archive old feed entries and use historical pull queries for deep pagination.
- Define acceptable staleness and product behavior.

Observability:

- Feed read latency.
- Post creation latency.
- Queue lag and oldest fan-out event age.
- Fan-out size distribution.
- Worker failures and retry rate.
- Cache hit rate.
- Hot keys and hot posts.
- Duplicate feed entries.
- Hybrid merge cost.
- Materialized feed length.
- Follow/unfollow repair volume.

## Common Failure Modes

| Failure Mode | Why It Happens | Mitigation |
|---|---|---|
| Feed reads are slow | Pulling posts from all followees at read time | Precompute feeds and cache recent entries |
| Post creation is slow | Synchronous fan-out to followers | Persist post, enqueue fan-out, return early |
| Celebrity post overloads workers | One post creates millions of writes | Hybrid fan-out and high-follower exclusion |
| Worker queue lag | Fan-out throughput below event volume | Autoscale, batch writes, prioritize normal jobs |
| Duplicate feed entries | Retry processes same event | Idempotent upserts and unique `(user_id, post_id)` |
| Missing feed entries | Event lost after post write | Transactional outbox and replay jobs |
| Hot post DB partition | Popular post read by millions | Post cache and request coalescing |
| Stale feed | Async materialization delay | Freshness metrics, lag alerts, read-time merge fallback |
| Incorrect pagination | Offset or timestamp-only cursor | Composite opaque cursor |
| Follow/unfollow inconsistency | Feed entries not updated after relationship change | Lazy read-time filtering, repair jobs, bounded feed windows |
| Deleted post appears | Feed/cache still contains post ID | Tombstones, visibility checks, cache invalidation |
| Storage explosion | Full post duplicated into many feeds | Store post IDs and cap materialized feed length |
| Queue starvation | Large fan-out jobs block smaller jobs | Chunk jobs, separate queues by fan-out size |
| Read-time merge too expensive | Too many non-precomputed followees | Tune threshold, cap merge set, cache merged results |

## Clarifying Questions

Ask:

1. What is expected DAU/MAU?
2. What is feed read QPS?
3. What is post creation QPS?
4. What is average and p99 followees per user?
5. What is average and p99 followers per producer?
6. How many celebrity/high-follower accounts exist?
7. What freshness delay is acceptable?
8. Is ordering reverse chronological, ranked, or hybrid?
9. Do posts support edit/delete?
10. Do privacy or visibility rules exist?
11. Do follows/unfollows need immediate feed effects?
12. How deep do users paginate?
13. Should feeds include only recent posts or full history?
14. Should feed entries store post IDs or full snapshots?
15. What are post size and media metadata size?
16. What duplicate/missing item behavior is acceptable?
17. How should feed repair/rebuild work?
18. How should the system degrade when workers lag?
19. How should hot posts and hot authors be detected?
20. Can high-follower accounts be treated differently?
21. Are notifications/activity feeds using the same pipeline?

## Reusable Agent Instructions

When designing a feed/timeline system:

1. Identify whether the feed is chronological, ranked, or hybrid.
2. Quantify read QPS, write QPS, follower distribution, followee distribution,
   and freshness SLA.
3. Separate post storage, relationship storage, and feed serving.
4. Start with fan-out-on-read as a baseline, then explain why it fails at scale.
5. Use fan-out-on-write for normal producers when read latency matters.
6. Use hybrid fan-out for high-follower producers.
7. Use async workers and queues to decouple posting from materialization.
8. Make worker processing idempotent.
9. Store post IDs in materialized feeds unless full snapshots are required.
10. Cache hot post objects and recent feed pages.
11. Use cursor pagination with stable composite cursors.
12. Monitor queue lag as product freshness.
13. Add repair/replay paths for missing feed entries.
14. Protect against hot keys, celebrity events, and queue starvation.
15. Define graceful degradation for stale or partially available feeds.

## Condensed Memory

Use this pattern for social feeds, notification inboxes, activity streams,
dashboards, or any personalized stream built from followed producers. Start
with fan-out-on-read to expose bottlenecks, but for high-scale read-heavy feeds,
precompute recent feed entries with fan-out-on-write using async workers. The
staff-level solution is hybrid fan-out: normal producers are precomputed into
follower feeds, while celebrity/high-follower producers are excluded from
precomputation and merged at read time. This avoids extreme write amplification
while keeping normal feed reads fast. Use query-oriented follow indexes instead
of graph databases unless traversal/recommendation is required. Store post IDs
in feed entries, hydrate from post cache, use composite cursor pagination, make
feed writes idempotent, monitor worker queue lag, cache hot posts, deduplicate
hybrid merges, and provide repair/replay jobs for missed events. Guardrails:
durable post write before fan-out, reliable event publishing, DLQ, backpressure,
dynamic fan-out thresholds, worker autoscaling, cache invalidation, bounded feed
storage, graceful degradation, and strong observability.
