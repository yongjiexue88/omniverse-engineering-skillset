# System Design Streaming Top-K With Windowed Aggregation

## Purpose

Use this reference for systems that continuously compute and serve Top-N/Top-K
rankings from high-volume event streams.

Examples: most-viewed videos, trending posts, top songs, search trends,
leaderboards, fraud counters, top products, active users, and real-time
analytics dashboards.

## Core Problem Pattern

Ingest a massive event stream and serve highest-ranked entities for specific
time windows with low read latency, without scanning raw events at request time.

The design tension:

- Writes are huge: every event may affect a counter.
- Reads must be fast: users expect Top-K in milliseconds.
- Window semantics matter: tumbling, sliding, all-time, or arbitrary ranges.
- Freshness has a budget: late events and processing delay are normal.
- Precision is a product decision: exact Top-K costs more than approximate.

## When To Use

Use this when:

- Event ingestion volume is high.
- Ranked results are queried frequently.
- Query latency must be low.
- Supported windows are known in advance.
- `K` is bounded, such as top 100 or top 1,000.
- Slight serving staleness is acceptable.
- Results are global or partitioned by predictable dimensions like region,
  category, tenant, or time window.

Avoid this pattern when data is small enough for direct DB queries, users need
arbitrary filters/ranges, results can be fully offline, `K` is unbounded, or an
approximate sketch is sufficient and much cheaper.

## Requirement Clarifications First

Ask before designing storage:

- Does "last hour" mean the last completed hour, the last 60 minutes from now,
  or arbitrary start/end?
- Is Top-K global or per region/category/user/tenant?
- What is max `K`?
- What read latency and freshness lag are required?
- Must results be exact, or are approximate heavy hitters acceptable?
- What timestamp defines the window: client event time, server receive time, or
  processing time?
- How late can events arrive, and are late corrections required?

## Default Architecture

```text
Events
  -> durable stream/log
  -> stream processors
  -> event-time window counters / local aggregation
  -> Top-K builder per supported window
  -> materialized snapshots in Redis/read store
  -> read API serves from snapshot/cache only
```

Separate:

- Ingestion: schema validation, dedupe IDs, durable log.
- Aggregation: event-time windows, counters, watermarks, checkpoints.
- Materialization: local Top-N, global merge, versioned snapshots.
- Serving: cache/read store lookup, max `K` enforcement, `as_of` timestamp.

## Design Rules

### Clarify Window Semantics

Tumbling windows are fixed buckets like `09:00-10:00`. Sliding windows are
relative to now. Arbitrary ranges require more general time-series/OLAP
infrastructure. Do not use tumbling windows when product means "last N minutes
from now."

### Bound K And Query Shapes

Support fixed windows such as `1h`, `1d`, `1mo`, and `all_time`; enforce a max
`K`. A request for a million rows is an export, not a Top-K serving request.

### Precompute Materialized Top-K

Do not scan event tables or counter tables on user reads. Reads should fetch a
versioned precomputed list from Redis, memory, CDN/edge cache, or a
read-optimized table.

### Use Freshness Budget As A Lever

A budget like one minute allows batching, watermarks, cache warming, correction
handling, and cheaper recomputation. Align batch interval, cache TTL, and
watermark delay to the product freshness SLA.

### Avoid Per-Event Database Counter Updates At Scale

Use stream processing, local aggregation, batch increments, and checkpointed
state. Per-event writes to a database counter and sorted index create write
amplification and hot keys.

### Use Hierarchical Top-K

Compute local Top-N per shard/partition/window, then merge candidates into
global Top-K. Overfetch beyond `K` when needed to avoid missing global winners.

### Handle Hot Keys

For extremely popular entities, use key salting, local partial counters, batch
increments, adaptive hot-key detection, and downstream merge.

### Define Exact vs Approximate

Use exact aggregation when rankings are user-visible, monetized, audited, or
correctness-sensitive. Use Count-Min Sketch, Space-Saving, Heavy Hitters, or
sampling only when error near the cutoff is acceptable or sketches are just
candidate generation.

### Use Event-Time Watermarks

Separate event time from processing time. Define allowed lateness, watermark
delay, provisional/finalized windows, and correction/backfill policy.

## Architecture Decision Rules

- If read latency is tens of milliseconds, serve precomputed snapshots because
  raw scans cannot meet the SLO.
- If windows are fixed, prefer tumbling windows because they are simpler to
  precompute.
- If users need "last N minutes from now," use sliding-window aggregation or
  bucket composition.
- If users need arbitrary historical ranges, use OLAP/time-series query
  infrastructure instead of fixed precomputed-only snapshots.
- If event volume is massive, avoid per-event database updates.
- If one entity is hot, salt and merge partial counts.
- If cache expiry falls back to expensive recomputation, use proactive warming,
  soft TTL, hard TTL, and stale-while-revalidate.
- If late events are common, use watermarks and correction.
- If raw events are retained, support replay/backfill for aggregation bugs.

## Production Guardrails

Event ingestion:

- Durable log, event ID, event time, processing time, schema validation.
- Partition by entity ID or salted entity ID.
- Consumer lag monitoring and raw retention for replay.

Aggregation:

- Event-time windows, watermarks, allowed lateness.
- Duplicate-event handling where exactness matters.
- Local aggregation before remote writes.
- Checkpoint stream state and use deterministic tie-breakers.
- Store window start, end, finalized status, version, and generated timestamp.

Materialization:

- Precompute Top-K for each supported window/dimension.
- Warm cache before serving; use soft/hard TTL and stale-while-revalidate.
- Version snapshots and keep the previous snapshot as fallback.
- Rebuild materialized views from source events or trusted counters.

Serving:

- Validate window and enforce max `K`.
- Serve from cache/read store on hot path.
- Return `generated_at` or `as_of`.
- Avoid deep pagination beyond bounded `K`.

Observability:

- Events/sec, unique entities per window, stream lag, watermark delay.
- Top-K generation latency, cache hit rate, stale response rate.
- Late-event count, hot-key distribution, ranking churn.
- Discrepancy between raw counts and materialized snapshots.

## Common Failure Modes

| Failure Mode | Cause | Mitigation |
|---|---|---|
| Read latency too high | Raw scans or on-demand sort | Precompute materialized Top-K |
| Cache stampede | Cache expires and recomputation is expensive | Proactive warming, single-flight, stale-while-revalidate |
| DB write overload | Every event updates counter/index | Stream aggregation, batching, local counters |
| Hot entity overload | Partitioning by entity concentrates traffic | Salt hot keys and merge partial counts |
| Window counts wrong | Processing-time windows or no allowed lateness | Event-time windows, watermarks, correction |
| Duplicate events inflate ranks | At-least-once delivery or client retries | Event IDs and dedupe windows |
| Approximation surprises users | Sketch error near cutoff | Exact final aggregation or documented tolerance |
| Arbitrary query appears late | Fixed windows assumed | Clarify early; use OLAP/bucket composition if required |
| Materialized view diverges | Pipeline bug or failed cache update | Replay, rebuild, reconcile, version snapshots |
| Ranking unstable | Ties near cutoff | Deterministic tie-breaker |

## Reusable Agent Instructions

- Clarify window semantics, max `K`, precision, freshness, event volume, and
  cardinality first.
- Do not scan raw events on user reads.
- Use durable ingestion, stream aggregation, and materialized Top-K snapshots.
- Serve reads from cache/read-optimized storage and return `as_of`.
- Use watermarks, allowed lateness, and correction for late events.
- Warm caches and prevent stampedes.
- Watch for hot keys; split and merge them.
- Use exact aggregation when correctness matters; sketches only when error is
  acceptable.
- Keep raw events or enough intermediate state to replay and rebuild.
