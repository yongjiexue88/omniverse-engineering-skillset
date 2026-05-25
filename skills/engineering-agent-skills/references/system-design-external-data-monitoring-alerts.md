# System Design External Data Monitoring And Alerts

## Purpose

Use this reference for systems that monitor external entities over time, store
historical observations, and notify users when a threshold or condition is met.

Canonical examples: price tracking, stock/inventory monitors, external status
monitors, marketplace listing trackers, compliance watchlists, and alerting
products built on data sources the system does not control.

## Core Problem Pattern

Collect fresh, trustworthy external data under rate limits and unreliable
sources; store append-only history; serve fast historical queries; and turn
validated state changes into timely, idempotent notifications.

The hardest part is usually not CRUD or alert delivery. It is obtaining
trustworthy external data with limited collection capacity.

## When To Use

Use this when:

- The system monitors external resources it does not control.
- External state changes over time and history matters.
- Users subscribe to threshold, rule-based, or condition alerts.
- Data freshness matters but can be eventually consistent.
- External APIs are missing, limited, rate-limited, expensive, or unreliable.
- User-facing clients can help observe external state with consent.
- Historical queries need time-range aggregation for charts or analytics.

Avoid the full pattern when a reliable webhook/API with enough quota exists,
the entity set is tiny, false positives are unacceptable without verification,
or the data is legally/audit-critical and must be strongly consistent.

## Default Architecture

```text
External source / API / pages
  -> priority crawler queues
  -> parser/collector
  -> observation validator
  -> current entity state + append-only time-series store
  -> state-change event
  -> alert evaluator
  -> notification queue
  -> email/push/SMS provider

User clients/extensions, when allowed
  -> reported observations
  -> schema validation + provenance
  -> trust/risk scoring
  -> accept, verify async, or hold for verification
```

Store:

- Operational DB: users, subscriptions, notification preferences, entity
  metadata, reporter reputation, sent notifications.
- Time-series store: observations, price points, status measurements, snapshots,
  provenance, and late/backfilled data.
- Event log/outbox: meaningful changes and notification work.

## Design Rules

### Treat Collection As The Scaling Problem

Do not assume uniform full crawling is feasible. Ask who owns the data, whether
an official API exists, rate limits, terms, change frequency, and which entities
matter most.

### Prioritize Crawling

Refresh by value and freshness need:

- Active subscriptions.
- Recent views/searches.
- Number of watchers.
- Volatility and last refresh age.
- Business value and notification engagement.
- Trending discovery or category coverage.

Long-tail entities can be stale when collection capacity is limited.

### Use Client-Assisted Collection Carefully

When clients naturally observe external pages, they can report entity ID, state,
metadata, and timestamp. This scales with user interest but requires explicit
consent, privacy boundaries, schema validation, provenance, rate limits,
reputation, and manipulation detection.

### Apply Trust-But-Verify

Classify observations by risk:

- Low risk: accept quickly.
- Medium risk: accept, then verify asynchronously.
- High risk: hold for crawler verification or adaptive consensus before
  notifying.

Risk increases with huge changes, low-reputation reporters, conflicting reports,
popular entities, or high-subscriber impact.

### Use Consensus Selectively

Consensus helps suspicious/high-impact updates but delays low-traffic entities
and flash changes. Use adaptive thresholds instead of requiring quorum for every
observation.

### Make Notifications Event-Driven

Do not periodically scan large tables asking what changed. Emit meaningful
state-change events, find affected subscriptions, and enqueue idempotent
notifications.

Use CDC, transactional outbox, or raw CDC plus downstream filtering when event
completeness and replay matter. Avoid unsafe dual writes.

### Use Time-Series Storage For History

Use append-optimized storage when observations are high-volume and queries are
mostly `entity_id + time range + bucket`. Use continuous aggregates,
compression, retention, and downsampling where chart latency requires it.

## Architecture Decision Rules

- If the external source is rate-limited, avoid uniform full crawling because it
  wastes capacity on low-value entities.
- If clients naturally observe the data, use client-assisted collection only
  with consent and validation.
- If client reports can trigger alerts, do not blindly trust them.
- If a change is low-risk, accept quickly because alert latency matters.
- If a change is high-impact, conflicting, or suspicious, verify before or soon
  after notification because false alerts damage trust.
- If an entity has many subscribers, refresh and verify it more aggressively.
- If notification logic scans large tables, replace it with state-change events.
- If app code publishes events, use transactional outbox to avoid lost events.
- If chart queries scan large raw histories, use time-series storage or
  pre-aggregated summaries.
- If duplicate delivery is possible, use notification idempotency keys and a
  sent-notification table.

## Production Guardrails

External collection:

- Per-domain/IP rate limits, crawl politeness, backoff, and compliance review.
- Priority queues, dedupe, last-seen/last-refresh timestamps, and parser change
  detection.
- Circuit breakers for blocks, errors, CAPTCHAs, and provider outages.

Client reporting:

- Consent, privacy boundaries, client version tracking, schema validation.
- Deduplicate by reporter/entity/time, rate-limit submissions, store provenance.
- Reputation scoring, abnormal reporter detection, and conflict detection.

Validation:

- Risk scoring, impossible-value quarantine, high-priority verification queue.
- Adaptive consensus for suspicious changes.
- Correction workflow for bad alerts.

Time-series storage:

- Partition/hypertable by time, index by `(entity_id, timestamp)`.
- Compression, retention/downsampling, late-arriving data handling.
- Query limits for maximum range and granularity.

Notification processing:

- Meaningful change events, idempotent notification keys, sent table.
- Suppression windows to avoid repeated alerts.
- Retries with backoff, DLQ, provider rate-limit handling, unsubscribe support.

Observability:

- Freshness by priority tier, crawl success rate, validation queue depth.
- False-positive alert rate, notification latency p50/p95/p99, duplicate rate.
- Event lag, time-series query latency, chart cache hit rate.

## Common Failure Modes

| Failure Mode | Cause | Mitigation |
|---|---|---|
| Full crawl takes too long | External rate limits and huge entity set | Priority crawling and client-assisted collection |
| Important entity stale | Uniform crawler wastes capacity | Prioritize by watchers, views, volatility |
| False alert | Malicious or wrong client report | Risk scoring, consensus, priority verification |
| Legitimate alert delayed | Validation too strict | Trust-but-verify and adaptive thresholds |
| Duplicate notifications | Retry or repeated change events | Idempotency key, sent table, suppression window |
| Notification scan overload | Periodic polling of large tables | Event-driven change processing |
| Lost event | Unsafe dual write | CDC or transactional outbox with replay |
| Slow chart query | Raw aggregation over long history | Time-series DB, continuous aggregates, downsampling |
| Parser breaks | External page changes | Versioned parsers, anomaly detection, fallback crawler |
| Storage explosion | Raw observations retained forever | Compression, retention, rollups |

## Clarifying Questions

- Is there an official API, webhook, feed, or partner data source?
- What are rate limits, terms, and compliance constraints?
- How many entities must be monitored, and how often do they change?
- Which entities matter most to users?
- What freshness SLA is required by entity tier?
- Can user clients help collect data, and what privacy constraints apply?
- What false-positive alert rate is acceptable?
- Should suspicious updates delay alerts or trigger corrections later?
- What changes are meaningful enough to notify?
- Should events use CDC, outbox, or application-level filtering?
- What chart ranges, granularities, and retention policies are required?
- How should the system recover when crawlers, consumers, or providers lag?

## Reusable Agent Instructions

- Identify external data collection as a first-class subsystem.
- Do not assume full or uniform polling is feasible.
- Prioritize collection by user value, subscriptions, volatility, and freshness.
- Treat client-reported data as useful but untrusted.
- Use trust-but-verify with risk-tiered validation.
- Use consensus only for high-risk or delay-tolerant updates.
- Replace polling scans with event-driven change processing.
- Prefer CDC or transactional outbox over unsafe dual writes.
- Make notification delivery idempotent and suppress duplicates.
- Store observations in time-series-optimized storage.
- Design correction and reconciliation workflows before trust is damaged.
