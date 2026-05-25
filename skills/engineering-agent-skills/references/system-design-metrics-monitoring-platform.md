# System Design Metrics Monitoring Platform

## Purpose

Use this reference for systems that collect high-volume metric datapoints, store
them as time series, support dashboard queries, evaluate alert rules, and notify
users when thresholds are breached.

This is a specialized case under Scaling Writes, Scaling Reads, Time-Series
Analytics, Observability Infrastructure, Alerting, Cardinality Control, and
Multi-Tenant Platform Design.

## Core Problem Pattern

The system must absorb massive append-only metric volume, organize data as time
series, control cardinality, support fast aggregations over time ranges, and
reliably evaluate alerts without silently dropping critical signals.

Separate:

1. Collection: agents, SDKs, exporters, sidecars.
2. Ingestion: collectors, gateways, durable queue.
3. Processing: validation, aggregation, rollups, alert windows.
4. Storage: time-series database, indexes, retention tiers.
5. Query: dashboard API, aggregation engine, cache.
6. Alerting: rule evaluator, checkpointed state, notification pipeline.

## When To Use

Use this pattern when:

- Systems emit CPU, memory, latency, throughput, error-rate, or custom metrics.
- Data is timestamped numeric values.
- Users need dashboards over time ranges.
- Users need aggregation by labels such as service, host, region, endpoint,
  tenant, or status.
- Alerts are based on thresholds, moving windows, percentiles, burn rates, or
  error budgets.
- Ingestion volume makes direct DB writes risky.
- Late or out-of-order datapoints are expected.
- Retention differs between raw and aggregated data.

Avoid the full pattern for full-text log search, distributed tracing/span
causality, tiny datasets, strong transactional queries, arbitrary joins, or
business ledger data that must be perfectly durable/accounted.

## Default Architecture

```text
Agents / SDKs / exporters
  -> local buffer
  -> collectors / ingest gateways
  -> validation + cardinality control
  -> durable queue/log
  -> write processors / rollup processors
  -> time-series storage
  -> query API + dashboard cache

Alert rules
  -> query-based evaluator or stream/window evaluator
  -> checkpointed alert state
  -> durable alert event
  -> notification delivery
```

Core models:

- Metric: name and type.
- Label set: dimensions.
- Series: unique metric name plus label set.
- Sample: timestamped numeric datapoint.
- Alert rule: condition, window, labels, threshold.
- Alert state: firing/resolved/pending/silenced and evaluation checkpoint.
- Notification: durable delivery event.

## Core Design Rules

### Treat Cardinality As The Main Scaling Risk

Series count, not just datapoints/sec, determines storage, memory, index size,
query fanout, and alert cost. Control unbounded labels such as user ID, request
ID, session ID, raw URL, trace ID, or full error message.

Add cardinality budgets, per-tenant quotas, label allow/deny lists, and
quarantine/drop policies.

### Decouple Ingestion With A Durable Queue

Agents and collectors should not synchronously write every sample into the TSDB.
Use Kafka/Pulsar/Kinesis or equivalent to buffer bursts and allow replay.
Monitor lag as a first-class SLO.

### Degrade Freshness, Not Correctness

Prefer local buffering, durable queues, retries, and delayed dashboards over
silent sample loss. Define explicitly where lossy sampling is acceptable.

### Use Time-Series Storage

Metrics need append-heavy writes, time-range scans, compression, retention,
rollups, and aggregation. Use TSDB/columnar time-series storage instead of
generic OLTP storage when scale requires it.

### Store Raw Short-Term And Rollups Long-Term

Do not retain high-resolution raw metrics forever. Keep raw data briefly, then
store 1m/5m/1h rollups for longer ranges. Preserve count/sum/min/max and
histogram buckets when percentiles matter.

### Choose Alert Evaluation Path By Latency And Scale

Scheduled query-based alerting can be fine for minute-level alerts. Use
stream/window processing when alert latency must be low, rule count is high, or
query path load would starve dashboards.

### Checkpoint Alert State

Alerting is stateful: "for 5 minutes" windows, silence/dedupe state, last
notification, firing/resolved state, and offsets must survive crashes.

### Make Notifications Durable And Idempotent

Write alert events durably before external Slack/PagerDuty/email delivery.
Deduplicate notification delivery by alert instance and state transition.

### Handle Late And Out-Of-Order Data

Define allowed lateness and whether late points update rollups, trigger alert
re-evaluation, or are stored but excluded after a cutoff.

### Monitor The Monitoring System

Add meta-monitoring for ingestion lag, dropped samples, query latency, alert
evaluator lag, notification failures, missing heartbeat metrics, cardinality
growth, and rollup lag.

## Architecture Decision Rules

- If ingestion exceeds direct storage capacity, use durable queue ingestion.
- If label values are unbounded, reject, rewrite, or quarantine them.
- If dashboards span long ranges, use rollups/downsampling.
- If percentile queries are required, store histograms/sketches; do not average
  p95 values.
- If alert latency is around one minute, query-based alerts may be enough.
- If alert latency is low or alert volume is high, use stream/window processing.
- If tenants share infrastructure, enforce per-tenant ingest, query, and series
  budgets.
- If data can arrive late, use event-time handling and a correction policy.
- If alert delivery uses external systems, use durable alert events and retries.
- If query latency threatens alerts, isolate alert evaluation capacity from
  dashboard capacity.

## Production Guardrails

Cardinality:

- Per-tenant series budgets.
- Per-metric label allowlist/denylist.
- Cardinality estimator before accepting new series.
- Quarantine/drop policy for abusive streams.
- Dashboards for top metrics, labels, and cardinality growth.

Ingestion:

- Agent-side local buffering.
- Bounded retries with backoff.
- Durable broker replication.
- Idempotent sample identity such as `(series_id, timestamp, source)`.
- Backpressure signals to agents/collectors.
- DLQ/quarantine path for malformed metrics.

Storage:

- Partition by time and tenant/series hash.
- Compress chunks and separate hot/cold tiers.
- Retention policies by resolution.
- Rollup and compaction jobs.
- Series metadata index separate from samples.

Query:

- Precomputed rollups and dashboard cache.
- Query fanout limits, max range, max series scanned.
- Automatic downsampling for long-range charts.
- Admission control and tenant query budgets.

Alerting:

- Checkpoint alert state and evaluation offsets.
- Track evaluation lag.
- Dedupe firing/resolved notifications.
- Store alert events before external delivery.
- Retry with backoff, grouping, silence, escalation, and secondary channels.
- Hysteresis or "for" windows to prevent flapping.

Late/out-of-order:

- Allowed lateness and correction window.
- Late sample rate by source.
- Reject samples too far in the past/future.
- Define whether late data can fire alerts.

Meta-monitoring:

- Agent heartbeat and missing data watchdogs.
- Ingestion QPS and dropped sample count.
- Broker lag and storage write latency.
- Query p95/p99.
- Alert evaluation lag.
- Notification failure rate.
- Rollup lag and cardinality growth rate.

## Common Failure Modes

| Failure Mode | Cause | Mitigation |
|---|---|---|
| Cardinality explosion | Unbounded labels | Label policy, series quotas, estimator |
| Ingestion backlog | Storage/broker slow | Backpressure, autoscaling, partitioning |
| Silent data loss | Agent/collector drops on failure | Local buffer, durable queue, retry |
| Duplicate samples | Retry without idempotency | Deterministic sample identity/upsert |
| Slow dashboards | Raw scans over long windows | Rollups, query limits, caching |
| Alert delay | Queue lag or slow query path | Lag metrics, capacity isolation, stream alerts |
| Missed alert after crash | Evaluator state not persisted | Checkpoint alert state |
| Duplicate notification | Retry without dedupe | Notification idempotency key |
| Alert fatigue | No grouping/hysteresis/silence | Grouping, silence, for-window |
| Wrong percentile | Averaging p95 values | Histograms/sketches |
| Noisy tenant | Huge cardinality/query load | Tenant quotas and isolation |
| Late data corrupts windows | No event-time policy | Allowed lateness and correction rules |
| Monitoring fails silently | No meta-monitoring | Watchdogs and self-observability |

## Clarifying Questions

- How many hosts/services are monitored?
- How many metrics per host per interval?
- What average and peak ingest rate is expected?
- What label cardinality is expected?
- Which labels are allowed, and which are forbidden?
- What raw and rollup retention periods are required?
- What query latency SLO is required?
- What alert latency SLO is required?
- Are alerts based on raw samples, rollups, or stream windows?
- Are percentile alerts required?
- How much late/out-of-order data is expected?
- Is multi-tenancy required, and how are quotas enforced?
- Is dropping metrics ever acceptable?
- How are notification retries and escalations handled?
- How does the monitoring system monitor itself?

## Reusable Agent Instructions

- Model metric, label, series, sample, alert rule, alert state, and notification.
- Ask about ingest rate, series cardinality, retention, query latency, and alert
  latency.
- Treat cardinality explosion as the main scaling risk.
- Reject or control unbounded labels.
- Use a durable queue between ingestion and storage.
- Make ingestion writes idempotent.
- Use time-series storage optimized for append-heavy writes and range scans.
- Partition by tenant, time, and series hash.
- Use rollups/downsampling for long-range queries.
- Store histograms or sketches for percentiles.
- Use query alerts only when latency tolerance allows.
- Use stream/window processing for low-latency or high-scale alerts.
- Checkpoint alert evaluator state.
- Write alert events durably before notification.
- Deduplicate notifications and handle late/out-of-order data explicitly.
- Add tenant quotas, isolation, and meta-monitoring.
- Prefer delayed freshness over silent data loss.

## Condensed Memory

Use the Metrics Monitoring Platform pattern for high-scale metrics ingestion,
time-series storage, dashboards, and alerting. The central risk is series
cardinality explosion from metric name plus labels. Use agents/collectors with
local buffers, durable queue ingestion, cardinality controls, TSDB/columnar
time-series storage, raw short-term retention, rollups long-term, query limits,
and alert evaluators with checkpointed state. Write alert events durably before
external notification. Guardrails include label budgets, tenant quotas,
idempotent sample writes, queue lag monitoring, histograms for percentiles,
late-data policy, alert dedupe, notification retry, and meta-monitoring.
