# System Design Offline-First Activity Tracking

## Purpose

Use this reference for mobile/browser systems where the client continuously
generates high-frequency sensor or state updates, needs immediate local
correctness, may lose network connectivity, and only sometimes needs backend or
remote near-real-time visibility. The canonical example is Strava-like running
or cycling activity tracking.

This is a specialized case under Scaling Writes, Offline-First Sync, Sensor
Event Ingestion, and Predictable Near-Real-Time Updates. Use it with
`system-design-pattern-recognition-playbook.md` and
`system-design-architecture-decision-playbook.md` when a design involves GPS
activity tracking, offline field-work apps, delivery/driver tracking, local
telemetry collection, crash-resumable capture, or intermittent connectivity.

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

A client device continuously generates sensor or state updates. It must show
accurate local state immediately, may lose network connectivity, and does not
always need every raw update persisted server-side in real time.

The staff-level insight:

> This is not primarily a backend ingestion problem unless remote viewers or
> centralized safety/compliance requirements need live server visibility.

Treat the client as:

- A compute node.
- A temporary durable store.
- The local source of truth during active capture.
- A sync agent when connectivity returns.
- A reducer/aggregator that avoids unnecessary backend writes.

## When To Use

Use this pattern when:

- The client generates frequent updates.
- The user needs accurate local feedback immediately.
- Network connectivity may be unreliable.
- Backend consistency can lag until sync.
- The client has enough compute/storage to process locally.
- Remote users do not need strict real-time updates.
- The system must scale to many concurrent sessions.
- Sending every raw update to the backend would be expensive or unnecessary.
- Battery, bandwidth, and offline functionality matter.
- The backend mostly needs finalized or periodically checkpointed data.

Common examples:

- Fitness tracking.
- GPS route recording.
- Offline field-work apps.
- Delivery/driver tracking.
- Mobile note/audio/video capture.
- Local telemetry collection.
- Browser/mobile apps with intermittent connectivity.

## When Not To Use

Avoid pure local-first/deferred sync when:

- Remote viewers must see updates in true real time.
- Safety-critical monitoring requires server-side visibility.
- Compliance requires immediate server persistence.
- Client devices are untrusted and data must be verified continuously.
- Data loss from device crash is unacceptable without frequent checkpointing.
- Multiple devices concurrently edit the same activity/session.
- The server must coordinate the session live.
- Business logic cannot safely run on the client.
- Centralized fraud detection is required during capture.

## Default Architecture

Use separate local active-session and backend sync paths:

```text
Local active path
  -> Sensors emit GPS/time/state samples
  -> Client validates and appends to local durable log
  -> Client computes distance/time/pace locally
  -> UI updates synchronously
  -> Optional local compaction/checkpoints

Backend sync path
  -> Upload activity metadata and route chunks on completion or checkpoint
  -> Server dedupes chunks by activity_id + chunk_id/sequence
  -> Server validates ordering and recalculates summary metrics
  -> Store raw route points separately from activity summary
  -> Mark activity complete only after required chunks arrive

Optional live sharing
  -> Client periodically uploads summarized live state every few seconds
  -> Remote viewers poll or subscribe based on freshness requirements
```

## Core Design Rules

### 1. Treat the client as an active system component

Do not automatically push every live sensor update to the backend. Modern
clients can compute local stats, persist route points, handle offline mode, and
sync later.

Before designing backend ingestion, ask:

- Can the client compute this locally?
- Does anyone remote need this data immediately?
- Can the server receive summarized/finalized data later?
- What happens when the client goes offline?

### 2. Separate local correctness from backend sync

For active mobile sessions, local user-facing correctness and backend
persistence are different concerns.

Design two paths:

- Local active path: sensor updates, distance/time calculation, pause/resume
  state, UI updates.
- Backend sync path: checkpoint/final upload, retries, idempotent writes,
  reconciliation.

Network dependency should not determine whether the athlete sees accurate local
distance/time during a run.

### 3. Model activity time as state transitions

A single `start_time` cannot correctly handle pause/resume. Use an event log:

```json
[
  { "state": "STARTED", "timestamp": "..." },
  { "state": "PAUSED", "timestamp": "..." },
  { "state": "RESUMED", "timestamp": "..." },
  { "state": "STOPPED", "timestamp": "..." }
]
```

Compute active duration from valid active intervals. Preserve transition history
for analytics, repair, and later features.

### 4. Store raw route points separately from derived metrics

Separate append-heavy raw samples from display-friendly summaries:

- `Activity`: owner, type, state, started/ended, summary distance/duration.
- `ActivityStateEvent`: state transition log.
- `RoutePoint`: `activity_id`, sequence, timestamp, lat/lng, accuracy,
  altitude.
- `ActivitySummary`: denormalized list-view fields.

Raw GPS can be reprocessed when algorithms change. Summary fields keep list
views cheap.

### 5. Prefer deferred/batched sync

Do not upload every coordinate if no remote consumer needs it immediately. Use:

- Local append-only route log.
- Periodic local checkpoints.
- Upload on completion.
- Retry queue for failed sync.
- Optional periodic backend checkpoint for long sessions.
- Idempotent chunk upload using sequence numbers.

This reduces backend write load and preserves offline UX.

### 6. Add real-time server updates only for remote visibility

A user seeing their own live stats does not require WebSockets, SSE, or backend
streaming. Friends watching the activity might.

For live sharing, periodically sync summarized state such as latest location,
distance, elapsed time, and activity status. Keep local logic as source for the
athlete UI.

### 7. Prefer polling for predictable soft real-time sharing

If observer updates arrive every 2-5 seconds and precision is soft, polling can
be simpler than WebSockets/SSE.

Use polling when:

- Update cadence is predictable.
- A few seconds of delay is acceptable.
- Observer count per activity is small/moderate.
- Simplicity and mobile reliability matter.

Use SSE/WebSockets only when remote updates are unpredictable, high-frequency,
or require low-latency push to many observers.

### 8. Scale writes by reducing writes first

If 10M active sessions upload every 2 seconds, the backend sees 5M writes/sec.
If clients sync on completion or in chunks, backend load drops dramatically.

Before proposing Kafka, sharding, or massive write clusters, ask:

- Can the client aggregate?
- Can updates be compressed?
- Can we upload deltas/chunks?
- Can we upload only completed sessions?
- Can the product tolerate delayed backend visibility?

## Architecture Decision Rules

- If only the athlete needs live stats, compute locally.
- If friends need live progress, add periodic backend sync.
- If update cadence is predictable and delay is acceptable, prefer polling.
- If updates are unpredictable or require low-latency push, consider SSE or
  WebSockets.
- If connectivity is unreliable, persist local events before upload.
- If activity can pause/resume, store state transition events.
- If route data is high-volume, upload bounded chunks with sequence numbers.
- If retries are possible, make uploads idempotent.
- If client data is trusted for UX but not integrity, validate server-side.
- If list views need to be fast, store denormalized activity summaries.
- If route detail is rarely requested, keep route points out of list endpoints.
- If battery matters, adapt sampling rate.
- If GPS accuracy is poor, filter noisy points.
- If privacy matters, require explicit live-sharing permissions.

## Production Guardrails

Local durability:

- Persist route points and state events locally before upload.
- Use an append-only route log.
- Restore in-progress activities after app restart.
- Track local sync status: unsynced, syncing, partial, complete, failed.
- Compact or simplify route points when safe.

Sync protocol:

- Use `activity_id`, `chunk_id`, `sequence_start`, `sequence_end`, or point
  sequence numbers.
- Upload route data in bounded chunks.
- Deduplicate duplicate chunks and state events.
- Detect missing/out-of-order sequences.
- Retry with exponential backoff when connectivity returns.
- Mark complete only after required chunks arrive.
- Keep partial activities visible as syncing/incomplete.

State and metrics:

- Validate transitions such as `STARTED -> PAUSED -> RESUMED -> COMPLETE`.
- Compute local stats synchronously for UI.
- Recompute/verify summary metrics server-side.
- Store route detail separately from summaries.
- Run repair jobs when algorithms change or uploads are repaired.

GPS and battery:

- Drop low-accuracy points and impossible jumps.
- Smooth stationary noise.
- Detect impossible speeds.
- Adjust sampling by activity type, battery, movement, and app state.
- Limit background work according to mobile OS constraints.

Privacy and safety:

- Require explicit permission for live sharing.
- Enforce viewer access checks.
- Avoid sharing precise live location by default.
- Redact sensitive route segments when product requires it.

Observability:

- Sync success rate.
- Upload lag after completion.
- Dropped/duplicate chunks.
- Missing sequence rate.
- Invalid state transitions.
- GPS accuracy and filtered point rate.
- Backend write QPS by live/checkpoint/final upload.
- Live polling load.
- Crash recovery success.

## Common Failure Modes

| Failure Mode | Why It Happens | Mitigation |
|---|---|---|
| Activity lost after crash | Route points only stored in memory | Local durable append log |
| Duplicate route points | Retry uploads without idempotency | Chunk IDs and sequence dedupe |
| Incorrect active time | Single start timestamp ignores pauses | State transition log |
| Overcounted distance | GPS jitter creates false movement | Accuracy filtering, smoothing, speed checks |
| Backend write overload | Every client uploads every few seconds | Local-first batching and upload on completion |
| Stale friend view | Polling interval or upload delay | Define freshness SLA and tune interval |
| WebSocket overengineering | Live local UI mistaken for remote push need | Prefer polling for predictable soft real time |
| Huge upload fails | Entire route uploaded as one payload | Chunked upload with resume |
| Out-of-order updates | Mobile retry/chunk arrival variance | Sequence numbers and ordering validation |
| Fake routes | Client controls GPS data | Server validation and anomaly detection |
| Battery drain | Sampling too frequently | Adaptive sampling |
| Privacy leak | Live location shared too broadly | Opt-in sharing and access checks |
| Incomplete activity shown complete | Finalization before chunks arrive | Completion protocol and sync status |
| List endpoint too heavy | Full route loaded for summaries | Summary fields and detail endpoint |

## Clarifying Questions

Ask:

1. Does the app need to work fully offline?
2. Who needs live data: only the user or remote viewers too?
3. How fresh must remote viewer data be?
4. What sync delay after completion is acceptable?
5. What is the GPS/sensor sampling interval?
6. How many concurrent active sessions are expected?
7. What is average and max activity duration?
8. How large is a typical route payload?
9. Can the client be trusted to compute distance/duration?
10. Should the server recompute or verify stats?
11. How should pause/resume be modeled?
12. How should crash recovery work?
13. Should upload happen only on completion or periodically?
14. What if the device is offline for days?
15. What data should list views return versus detail views?
16. Are live activities opt-in or visible by default?
17. Is polling good enough for live sharing?
18. What are battery and bandwidth constraints?
19. How should noisy GPS points be filtered?
20. How should duplicate or missing chunks be repaired?

## Reusable Agent Instructions

When designing offline/sensor-based mobile systems:

1. Do not default to sending every sensor update to the backend.
2. Treat the client as compute, storage, and sync participant.
3. Separate local active-session correctness from backend synchronization.
4. Use a local durable event log for transitions and sensor samples.
5. Model pause/resume/complete as validated transitions.
6. Compute local stats synchronously for user-facing UI.
7. Upload data in idempotent chunks with sequence numbers.
8. Sync on completion or connectivity return unless live sharing is required.
9. Add checkpoints only when data-loss risk justifies extra writes.
10. Prefer polling for predictable near-real-time observer updates.
11. Use WebSockets/SSE only when low-latency push is required.
12. Store route detail separately from summaries.
13. Recompute/validate derived metrics server-side.
14. Design offline retry, crash recovery, dedupe, and repair.
15. Add privacy/access checks before live location sharing.

## Condensed Memory

Use this pattern when a mobile/browser client generates frequent sensor or state
updates, needs immediate local correctness, and may lose connectivity. Treat the
client as an active compute/storage/sync participant, not just a thin frontend.
For activity tracking, compute distance/time/route locally, persist an
append-only route/state log on device, and sync to the backend on completion or
when online. Model pause/resume with state transition events instead of one
start timestamp. Upload route data in idempotent chunks with sequence numbers;
dedupe retries and validate order server-side. Store raw route points separately
from derived activity summaries. Only reintroduce periodic backend updates when
live sharing with remote viewers is required. Polling may be better than
WebSockets/SSE when updates are predictable and a few seconds of delay is
acceptable. Guardrails: local durable queue, crash recovery, offline retry,
idempotent sync, GPS filtering, server validation, adaptive sampling, privacy
controls, partial upload handling, observability, and repair jobs.
