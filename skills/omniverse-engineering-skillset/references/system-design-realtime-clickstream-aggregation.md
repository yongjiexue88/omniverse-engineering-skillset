# System Design Real-Time Clickstream Aggregation

## Purpose

Use this reference for systems that ingest high-volume user events, deduplicate
them, aggregate them by time window and dimensions, and expose low-latency
analytics queries.

Canonical examples include ad click aggregation, impression tracking, product
analytics, campaign dashboards, telemetry aggregation, and experiment analytics.

This is a specialized case under Scaling Writes, Stream Processing, Real-Time
Analytics, High-Cardinality Aggregation, Deduplication, and OLAP serving.

## Core Problem Pattern

The system must collect a high-volume event stream, avoid losing or
double-counting events, aggregate by time window and dimensions, and serve fast
analytical queries.

The hard parts:

- The click/event path must be very fast.
- Raw writes are high-volume and bursty.
- Dashboards need aggregates, not raw scans.
- Metrics must be near-real-time.
- Duplicate events must not inflate counts.
- Hot keys can overload stream partitions.
- Late/out-of-order events must land in the correct bucket.
- Query path must stay sub-second across many dimensions.

## When To Use

Use this pattern when:

- The system ingests high-volume append-only events.
- Raw events must be retained or replayable.
- Users need near-real-time dashboards.
- Queries are mostly aggregations over time windows.
- Duplicate events are possible.
- Metrics need minute-level or similar granularity.
- Dimensions include high-cardinality keys such as ad, campaign, advertiser,
  region, device, placement, or segment.

Avoid the full pattern when volume is low, hourly/daily batch freshness is
enough, raw event loss is acceptable, there is no deduplication need, or a
managed analytics product already satisfies the use case.

## Default Architecture

```text
User click/event
  -> fast tracking endpoint
  -> validate/signature/dedupe check
  -> durable event stream
  -> stream processor with event-time windows
  -> aggregate sink / OLAP store
  -> dashboard query API

Raw event stream/store
  -> replay / batch reconciliation / backfill
```

For ad clicks:

```text
GET /click?impression_id=...
  -> verify signed impression ID
  -> check dedupe cache
  -> write click event to durable stream
  -> mark impression ID seen
  -> return 302 Location: advertiser_url
```

Keep the synchronous path to validate, dedupe, enqueue, and redirect. Do not run
aggregation or OLAP writes before redirect.

## Core Design Rules

### Use Server-Side Redirect For Reliable Click Tracking

If the click must be counted reliably, route it through your server and return a
302 redirect after recording or enqueueing. Client-side tracking can be
bypassed.

### Do Not Query Raw Events For Dashboards

Raw events are for durability, audit, and replay. Query-facing metrics should be
pre-aggregated by time bucket and dimensions.

### Use Streaming For Near-Real-Time Freshness

Batch processing is useful for recomputation, reconciliation, corrections, and
fraud-adjusted metrics. Use Kafka/Kinesis/Pulsar plus Flink/Spark Streaming or
similar when dashboards need near-real-time windows.

### Use Event Time And Watermarks

Aggregate by the server click/event timestamp, not processor receive time. Define
allowed lateness, watermark delay, preliminary/finalized windows, and correction
behavior for very late events.

### Use OLAP For High-Cardinality Query Serving

Use OLAP/columnar stores for advertiser/campaign/time/dimension queries. TSDBs
fit simpler low-cardinality metric timelines; ad analytics usually needs
multi-dimensional slicing.

### Partition By Natural Key, Split Hot Keys

Partition by a natural aggregation key such as `ad_id` or `campaign_id`. If one
key becomes hot, sub-shard it:

```text
ad_id:0
ad_id:1
...
ad_id:N
```

Then strip/merge the suffix before final aggregates.

### Prefer Recoverable Duplicates Over Lost Events

If forced to choose, write the event to the durable stream before marking a
dedupe cache entry as seen. Rare duplicates can be corrected through replay and
reconciliation; lost events cannot be recovered.

### Sign Impression Or Event IDs

Do not trust client-provided IDs. Sign impression IDs with HMAC and include ad,
campaign, issued-at, expiry, and signature version. Validate signature and
expiry before accepting the event.

## Architecture Decision Rules

- If click tracking must be reliable, prefer server-side redirect because
  client-side tracking can be bypassed.
- If redirect latency is user-facing, keep the synchronous path minimal.
- If write throughput is high, avoid OLTP writes plus query-time `GROUP BY`.
- If freshness can lag by minutes or hours, batch pre-aggregation may be enough.
- If freshness must be near-real-time, use stream processing.
- If events can arrive late/out of order, use event-time windows and watermarks.
- If dimensions are high-cardinality, prefer OLAP over a generic TSDB.
- If one ad/campaign dominates traffic, sub-shard hot keys and merge later.
- If duplicate clicks are possible, use signed IDs, dedupe cache, raw retention,
  and reconciliation.
- If metrics affect billing, keep immutable raw events and replay tooling.
- If cache dedupe is used, TTL keys by the valid click/replay window.

## Production Guardrails

Click/event ingestion:

- Server-side redirect for clicks when reliability matters.
- Minimal redirect path: validate, dedupe, write stream, redirect.
- Globally unique event/click IDs.
- Signed impression/event IDs with expiry and key versioning.
- Backpressure and overload behavior defined explicitly.
- Rate limits for suspicious sources.

Deduplication:

- Unique impression ID per impression.
- HMAC-signed payload including ad/campaign context.
- Redis/Redis Cluster or equivalent dedupe store with TTL.
- Write stream before marking dedupe cache when event loss is worse than
  duplicate.
- Downstream dedupe by click ID or impression ID.
- Monitor dedupe hit rate, cache errors, and replay rate.

Stream processing:

- Durable stream with retention for replay.
- Partition by ad/campaign key; sub-shard hot keys.
- Event-time windowing, watermarks, allowed lateness.
- Checkpoints and state backend.
- Idempotent or exactly-once-capable sink writes.
- DLQ for malformed events.
- Consumer lag and watermark lag alerts.

Aggregation and serving:

- Aggregate by minute/hour buckets and required dimensions.
- Store preliminary/finalized metrics if needed.
- Use merge-safe upserts.
- Partition/cluster OLAP tables by advertiser/campaign/time.
- Precompute rollups for common dashboard ranges.
- Enforce query bounds and max dimensions.
- Track ingestion-to-query-visible freshness.

Fault tolerance:

- Raw event stream replay.
- Batch reconciliation comparing raw and aggregate counts.
- Backfill missed windows.
- Correction policy for advertisers when data changes after display.

Observability:

- Ingestion QPS and redirect latency.
- Stream publish failures.
- Dedupe cache latency/error rate.
- Duplicate/replay rate.
- Stream partition lag and hot-key distribution.
- Checkpoint failures and watermark delay.
- Aggregate sink latency.
- OLAP p95/p99 query latency.
- Freshness lag from event time to dashboard visibility.
- Reconciliation deltas.

## Common Failure Modes

| Failure Mode | Cause | Mitigation |
|---|---|---|
| User reaches advertiser but click not counted | Client-side tracking fails or is bypassed | Server-side redirect |
| Redirect becomes slow | Too much work in click path | Only validate, dedupe, stream, redirect |
| OLTP database collapses | Raw events queried with `GROUP BY` | Stream/store raw events and pre-aggregate |
| Dashboard stale under spike | Batch falls behind | Streaming aggregation |
| Events in wrong bucket | Processing-time windows | Event-time windows and watermarks |
| Hot partition | One ad/campaign dominates | Sub-shard hot keys and merge |
| Duplicate clicks inflate metrics | Retries/replay/attacks | Signed IDs, dedupe, reconciliation |
| Valid clicks lost | Marked dedupe before stream write | Write stream first, then mark seen |
| Slow dashboard query | Poor OLAP partitioning or unbounded dimensions | Partition/cluster by advertiser/time; query limits |
| Late events mutate old metrics | Late corrections not modeled | Preliminary/final states and correction policy |
| Processor crash creates gap | No checkpoint/replay | Durable stream, checkpoints, idempotent sinks |

## Clarifying Questions

- What are average and peak event QPS?
- What freshness lag is acceptable?
- Are metrics for billing, reporting, or both?
- Can duplicates be tolerated temporarily? Can lost events be tolerated?
- Which dimensions are required?
- What minimum time granularity is needed?
- Are queries per ad, campaign, advertiser, or all of the above?
- How many active ads/campaigns exist?
- Are hot ads/campaigns expected?
- How are impression/event IDs generated and signed?
- What is the dedupe window?
- How long are raw events and aggregates retained?
- How should late events and corrections be exposed?
- What happens if the stream processor or OLAP sink is unavailable?

## Reusable Agent Instructions

- Treat clickstream aggregation as a high-write event pipeline, not CRUD.
- Use server-side redirect when click counting must be reliable.
- Keep the synchronous path fast: validate, dedupe, enqueue, redirect.
- Store raw events in a durable stream/log.
- Do not serve dashboards from raw event scans.
- Pre-aggregate by time bucket and dimensions.
- Use stream processing for near-real-time freshness.
- Use batch jobs for backfill and reconciliation.
- Use event-time windows, watermarks, and allowed lateness.
- Use OLAP for high-cardinality multi-dimensional queries.
- Partition by natural aggregation key and sub-shard hot keys.
- Use signed IDs and TTL dedupe.
- Prefer recoverable duplicates over unrecoverable losses.
- Make aggregate sink writes idempotent and merge-safe.
- Track freshness lag, stream lag, late events, duplicate rate, hot partitions,
  and query p99.

## Condensed Memory

Real-time click aggregation is a high-write stream-processing analytics pattern.
Reliable click tracking should use a fast server-side endpoint that validates,
dedupes, writes to a durable stream, and redirects. Do not scan raw events for
dashboards; pre-aggregate by event-time windows into OLAP serving tables. Use
watermarks and allowed lateness for late events, raw retention plus batch
reconciliation for corrections, signed impression IDs for tamper resistance,
TTL dedupe, idempotent aggregate upserts, and hot-key sub-sharding for popular
ads/campaigns.
