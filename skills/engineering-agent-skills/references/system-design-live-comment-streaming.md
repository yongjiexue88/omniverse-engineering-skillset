# System Design High-Scale Live Comment Streaming

## Purpose

Use this reference for systems that broadcast short-lived, high-volume events
from many producers to many concurrent viewers with low latency and eventual
consistency. The canonical example is live video comments where users post
comments, viewers see new comments while watching, and late joiners fetch recent
history.

This is a specialized case under Real-Time Updates, Fan-Out Streaming, and
Hot-Partition Management. Use it with
`system-design-pattern-recognition-playbook.md` and
`system-design-architecture-decision-playbook.md` when a design involves live
comments, livestream chat overlays, sports/event rooms, incident rooms, public
one-way event streams, hot live objects, or reconnect catch-up with bounded
history.

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

The system must accept high-volume writes for a live object, persist enough
history for late joiners, and broadcast new events to many concurrent
subscribers with low latency.

The hard parts are not `POST /comments`. The hard parts are:

- Preventing database overload from polling.
- Broadcasting to many viewers without one app server bottleneck.
- Handling hot live videos/rooms with extreme concentration.
- Supporting late joiners with historical comments.
- Handling reconnects without duplicates or gaps.
- Choosing polling, SSE, or WebSocket.
- Prioritizing availability and UX over strict global consistency.

## When To Use

Use this pattern when:

- Many viewers subscribe to a live object.
- Producers generate frequent small events.
- Consumers need low-latency one-way updates.
- Eventual consistency is acceptable.
- Late joiners need recent history.
- Events can be dropped, sampled, or degraded under extreme load as long as the
  system remains available.
- A few hot streams/rooms receive disproportionate traffic.

Common examples:

- Live video comments.
- Sports event comment streams.
- Incident rooms.
- Live dashboards with public event streams.
- Game room spectator comments.
- Public auction watch comments when comments are not durable per-recipient
  messages.

## When Not To Use

Avoid this pattern when:

- Every event must be durably delivered to every user.
- Each recipient needs independent delivery acknowledgement.
- Bidirectional low-latency communication is required for every client.
- The feed is personalized per viewer.
- Strong ordering and exactly-once delivery are required.
- Events are large binary payloads.
- Volume is low enough that polling is acceptable.
- Historical correctness matters more than live responsiveness.

For guaranteed per-user delivery, use the durable messaging pattern. For public
live comments, prioritize low-latency broadcast and graceful degradation.

## Default Architecture

Separate write/history from live fanout:

```text
POST /comments/{live_video_id}
  -> authenticate and validate live video is active
  -> generate monotonic/time-sortable comment_id
  -> persist comment
  -> publish comment event after commit/outbox
  -> return accepted comment metadata

GET /comments/{live_video_id}?cursor=...
  -> cursor-paginated historical reads from DB/cache

GET /comments/{live_video_id}/stream
  -> SSE stream
  -> event id = comment_id/sequence
  -> Last-Event-ID supports reconnect catch-up

Comment event
  -> pub/sub or stream
  -> realtime fanout service
  -> regional SSE/WebSocket clients
  -> clients dedupe by comment_id and order by sequence
```

Keep a bounded recent-comment cache for replay:

```text
comments:live:{id}:recent
score = sequence/timestamp
value = compact payload or comment_id
TTL = live duration + replay window
```

## Core Design Rules

### 1. Use push-based streaming for active live updates

Polling creates many empty requests and cannot meet low-latency targets without
excessive request/database load. Use push for active viewers and keep polling as
fallback/catch-up.

### 2. Prefer SSE for one-way live event streams

If updates are mostly server-to-client, prefer Server-Sent Events:

- HTTP-native.
- Simpler than WebSockets.
- Built-in reconnection behavior.
- Supports `Last-Event-ID`.

Use WebSockets when clients need frequent bidirectional low-latency commands.
Use polling for low-frequency or soft-real-time updates.

Typical endpoints:

```text
POST /comments/{live_video_id}
GET /comments/{live_video_id}
GET /comments/{live_video_id}/stream
```

### 3. Store comments durably, but broadcast from a streaming path

Late joiners need history, so comments must be stored. Active viewers need
low-latency updates, so comments must also flow through a push system.

Pipeline:

```text
Comment POST
  -> validate/authenticate
  -> persist comment
  -> publish event
  -> realtime servers fan out
  -> clients render/dedupe
```

Do not query the database for every active viewer update.

### 4. Use cursor pagination for history

Avoid offset pagination while comments are actively inserted. Use stable cursor
pagination by `comment_id` or `(created_at, comment_id)`.

Example:

```text
GET /comments/{live_video_id}?cursor={last_comment_id}&page_size=50
```

Data shape:

```text
PK: live_video_id
SK: comment_id or created_at_comment_id
```

Use time-sortable IDs such as Snowflake/ULID where possible.

### 5. Use pub/sub to decouple writes from fanout

Comment writers should not loop over viewers. Use:

```text
Comment service
  -> Comment DB
  -> Event bus / pub-sub / stream
  -> Realtime fanout service
  -> SSE/WebSocket clients
```

Broker choices:

- Redis Pub/Sub: low latency, best-effort.
- Redis Streams: short replay window with moderate complexity.
- Kafka/Kinesis/Pulsar: durable/replayable, more overhead.

### 6. Keep recent comments in shared cache

Any realtime server may receive reconnecting clients. Local server memory is not
enough.

Use Redis/list/sorted-set for:

- Last 5-10 minutes of replay.
- Reconnect gap fill.
- Late joiner warm history.
- Reducing database reads during reconnect storms.

Use DB for deep history, durable audit, and cache rebuild.

### 7. Use event IDs to repair gaps

Every streamed event needs a stable ordered ID. Client behavior:

```text
on event(comment):
  if comment.id <= last_seen_id: ignore
  if gap detected: fetch catch-up
  render
  last_seen_id = comment.id
```

On reconnect:

```text
GET /comments/{video_id}?since={last_seen_id}&limit=100
GET /comments/{video_id}/stream with Last-Event-ID
```

For long gaps, bound replay and show "missed comments" or "jump to live."

### 8. Design for hot live objects

Traffic is rarely even. Detect hot streams by:

- Comment rate.
- Viewer count.
- Connection count.
- Pub/sub lag.
- Fanout CPU/network.
- Cache/write partition metrics.

Normal stream:

- Single channel/partition by `live_video_id`.

Hot stream:

- Shard comment writes and fanout channels.
- Batch broadcasts.
- Regional relays.
- Per-video rate limits.
- Sampling/dropping/ranking when human-readable volume is exceeded.

### 9. Prefer availability over strict consistency

Live social comments should keep flowing even if viewers see slightly different
timing/order or miss low-value comments under extreme load.

Prefer:

- Eventual delivery over strict consensus.
- Per-video ordering over global ordering.
- Bounded replay over full replay.
- Graceful degradation over outage.
- Backpressure/drop policies over unbounded queues.

## Architecture Decision Rules

- If updates are one-way server-to-client, prefer SSE.
- If clients need bidirectional low-latency commands, use WebSockets.
- If latency target is under a few hundred milliseconds, avoid polling as the
  primary mechanism.
- If viewers need old comments, store comments durably and expose cursor
  pagination.
- If comments are constantly appended, avoid offset pagination.
- If any realtime server may handle reconnects, keep recent comments in shared
  cache.
- If a stream has many viewers, decouple write service from fanout.
- If a video becomes hot, shard or tier the fanout path.
- If strict per-viewer delivery is not required, prefer best-effort pub/sub plus
  replay.
- If pub/sub is at-most-once, use cursor catch-up and client dedupe.
- If reconnect gap is long, avoid replaying the full backlog.
- If comment volume exceeds readability, apply rate limits, batching, sampling,
  ranking, or slow mode.

## Production Guardrails

Write path:

- Authenticate from token/header, not request body.
- Validate live object exists and is active.
- Rate-limit by user, video, IP/device, and suspicious patterns.
- Generate monotonic or time-sortable IDs.
- Use idempotency keys for retry-safe comment creation.
- Persist comment before publishing.
- Use transactional outbox or stream after DB write if needed.
- Apply moderation/spam checks inline or async based on risk.
- Store minimal payload in the hot path.

Historical reads:

- Use cursor pagination.
- Partition by live object ID.
- Sort by stable comment ID or created-at-plus-ID.
- Enforce page size limits.
- Avoid scans and large offsets.
- Cache recent comment windows.
- Use DB for deep history or cache miss.

Realtime streaming:

- Prefer SSE for one-way broadcast.
- Include stable event ID on every event.
- Support `Last-Event-ID`.
- Send heartbeats to keep connections alive.
- Detect stale connections and close them.
- Enforce max connections per user/device.
- Bound per-connection output buffers.
- Disconnect slow clients and rely on catch-up.
- Use regional realtime servers.
- Drain connections gracefully during deploys.

Pub/sub and fanout:

- Decouple write service from fanout service.
- Publish only after durable write or outbox event.
- Partition by `live_video_id` for normal streams.
- Detect hot IDs and shard fanout.
- Monitor broker lag and subscriber counts.
- Use bounded queues.
- Apply backpressure when fanout lags.
- Use DLQ for malformed events.
- Dedupe by `comment_id`.
- Keep replay window in Redis or durable stream.

Reconnect and catch-up:

- Store client `last_seen_comment_id`.
- Use `Last-Event-ID` or explicit `since`.
- Replay only a bounded recent window.
- Coordinate HTTP catch-up and stream to avoid duplicates/gaps.
- Use client-side dedupe and small ordering buffer.
- For long disconnects, show missed-count/jump-to-live.

Hot stream protection:

- Detect hot streams early.
- Apply per-video comment rate limits.
- Batch comments before broadcast under load.
- Drop/sample/rank comments when UI cannot render all.
- Split fanout by region or shard.
- Avoid a single topic/partition for extreme streams.
- Autoscale by connections, egress, CPU, and pub/sub lag.
- Protect DB partitions from hot write keys.

Observability:

- Comment POST latency.
- End-to-end broadcast latency.
- SSE/WebSocket connection count.
- Reconnect rate.
- Heartbeat failures.
- Pub/sub publish latency and lag.
- Dropped/sampled/batched comments.
- Hot stream fanout pressure.
- DB write throttling by live object.
- Recent-comment cache hit rate.
- Duplicate/gap catch-up events.
- Client render latency and buffer size.

## Common Failure Modes

| Failure Mode | Cause | Mitigation |
|---|---|---|
| Polling overloads database | Clients frequently poll for no changes | SSE/WebSocket push; polling only fallback |
| Offset pagination duplicates/skips | New comments inserted during scroll | Cursor pagination with stable IDs |
| Hot stream overloads DB partition | All comments hit same key | Hot write sharding, time buckets, merge for reads |
| Realtime server crash disconnects viewers | Long-lived connections in memory | Reconnect, Last-Event-ID, shared recent cache |
| Pub/sub drops comments | Best-effort broker or subscriber restart | Persist first and catch up by last seen ID |
| Duplicate comments after reconnect | Catch-up overlaps live stream | Deduplicate by comment ID |
| Long reconnect floods user | Server replays too much | Bound replay and jump to live |
| Slow clients cause memory pressure | Unlimited output buffers | Buffer limits, drop/disconnect, catch-up |
| Order differs across viewers | Distributed fanout and eventual consistency | Per-video sequence IDs and small client reorder |
| UI unreadable | Comment rate exceeds human consumption | Batch, sample, rank, collapse, slow mode |

## Clarifying Questions

Ask:

1. Is the stream one-way or bidirectional?
2. Is SSE acceptable or are WebSockets required?
3. What is target p95/p99 broadcast latency?
4. How many concurrent live objects exist?
5. How many viewers can one hot object have?
6. What comments/sec for normal and hot streams?
7. How much history must late joiners see?
8. Is eventual consistency acceptable?
9. Can comments be dropped, sampled, batched, or delayed?
10. Is every comment equally important?
11. Do viewers need the exact same order?
12. What is ordering scope: per object, region, or global?
13. What happens after reconnect gaps of 5 seconds, 5 minutes, or 1 hour?
14. Should replay be automatic or user-controlled?
15. Do comments require moderation before broadcast?
16. What is retention after the live object ends?
17. What are database hot-partition limits?
18. Should hot streams use separate fanout infrastructure?
19. How should fanout be regionalized?
20. What broker semantics are required?
21. How are duplicates deduped?
22. What metrics define a stream as hot?
23. What is the degradation strategy during extreme spikes?

## Reusable Agent Instructions

When designing live comment streaming:

1. Treat it as fanout streaming, not a normal CRUD comment API.
2. Use durable storage for history and replay.
3. Use push-based streaming for active viewers.
4. Prefer SSE for mostly server-to-client updates.
5. Use WebSockets only for bidirectional live commands.
6. Avoid polling as the primary real-time mechanism.
7. Use cursor pagination for historical comments.
8. Partition history by live object ID and sort by stable comment ID.
9. Decouple creation from broadcast with pub/sub or streams.
10. Keep recent comments in shared cache for reconnect replay.
11. Use `Last-Event-ID` or explicit since catch-up.
12. Deduplicate on client by comment ID.
13. Bound replay windows and degrade gracefully for long disconnects.
14. Detect hot streams and apply special scaling behavior.
15. Add backpressure, batching, sampling, rate limits, and slow-client
    protection.
16. Prioritize availability and perceived realtime UX over strict consistency.

## Condensed Memory

High-scale live comments are a Real-Time Updates / Fan-Out Streaming pattern.
Persist comments for history, but broadcast new comments through a push-based
realtime path. Avoid polling as the main mechanism because it overloads the
database and cannot meet low-latency UX. Prefer SSE for one-way
server-to-client comment streams; use WebSockets only when bidirectional live
interaction is required. Use `Last-Event-ID` or `since={last_comment_id}` for
reconnect catch-up. Store recent comments in Redis/shared cache so any realtime
server can replay missed events; use durable DB for deeper history. Use cursor
pagination, not offset pagination. Decouple comment write service from fanout
using pub/sub/streams. Design for hot live objects explicitly: shard fanout,
detect hot keys, batch/sample/drop/rank comments under load, apply per-video
rate limits, and protect DB partitions. Eventual consistency is acceptable;
prioritize availability and perceived realtime UX. Guardrails: stable IDs,
idempotent writes, auth from token, cursor pagination, bounded replay, client
dedupe, heartbeats, connection draining, backpressure, slow-client disconnects,
pub/sub lag monitoring, hot-stream autoscaling, DLQ/replay, and observability.
