# System Design Durable Real-Time Messaging

## Purpose

Use this reference for systems that need low-latency delivery over persistent
connections while also guaranteeing that messages or events are recoverable when
recipients are offline, disconnected, or connected to different servers/devices.

This is a specialized case under Real-Time Updates, Durable Messaging, Fan-Out
Delivery, and Long-Running Connections. Use it with
`system-design-pattern-recognition-playbook.md` and
`system-design-architecture-decision-playbook.md` when a design involves chat,
offline delivery, WebSockets, push channels, client acknowledgements,
per-recipient delivery state, group messaging, media attachments, or reconnect
sync.

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

The system must deliver messages in real time when users are online while still
guaranteeing delivery or recovery when users are offline, disconnected, or on a
different server/device.

The important insight:

> Real-time delivery and durable delivery are different layers.

Use separate paths:

- Real-time path: WebSocket, TCP connection, SSE, push channel, or mobile push.
- Durable path: message store plus per-recipient inbox/outbox.
- Recovery path: reconnect and sync undelivered messages.
- Media path: object/blob storage, not the chat server or message DB.
- Scaling path: connection routing, pub/sub, partitioning, and backpressure.

The socket is only a fast delivery mechanism. It must not be the source of
truth.

## When To Use

Use this pattern when:

- Users expect messages or events to arrive immediately.
- Recipients may be offline or temporarily disconnected.
- Delivery must be guaranteed, at-least-once, or recoverable.
- Users can have multiple devices or clients.
- The system needs long-running bidirectional connections.
- The system needs fan-out to multiple recipients.
- Messages need per-recipient delivery state.
- Server-side retention is bounded, such as 7 days, 30 days, or until acked.
- Large binary media is attached to small metadata messages.

Common examples:

- Chat systems.
- Collaboration apps.
- Live support tools.
- Notification systems with offline sync.
- Device command/control systems.
- Real-time workflow updates.
- Multiplayer coordination events where missed commands must be recovered.

## When Not To Use

Avoid or simplify this pattern when:

- Delivery does not need to be immediate.
- Users can poll periodically without hurting UX.
- Lost events are acceptable.
- The system only needs fire-and-forget updates.
- There are no offline recipients.
- Fan-out size is extremely large and should use feed-style distribution
  instead of per-recipient delivery records.
- Messages are analytical events, not user-visible delivery objects.
- The product requires strict global ordering across many partitions.

For simple status updates, polling or SSE may be enough. For massive public
broadcasts, use pub/sub, CDN, or feed-cache patterns instead of durable
per-recipient inbox rows.

## Default Architecture

Design the durable path first:

```text
Sender client
  -> Messaging API / Chat server
  -> Primary DB transaction:
       create Message
       create DeliveryRecord/Inbox rows for recipients
       dedupe by sender_id + client_message_id
  -> Sender server_ack
  -> Publish routing event
  -> Owning connection server forwards over socket
  -> Recipient client delivery_ack
  -> Mark DeliveryRecord delivered or advance client cursor

Recipient reconnect
  -> Authenticate
  -> Resume token / last seen sequence
  -> Fetch undelivered inbox records within retention window
  -> Deliver idempotently
  -> Ack and clean up
```

Keep media off the hot path:

```text
Client asks for upload target
  -> API returns pre-signed upload URL
  -> Client uploads to object storage
  -> Client sends message with attachment metadata/reference
  -> Recipients download through authorized URL/CDN
```

## Core Design Rules

### 1. Separate durable delivery from real-time delivery

Persist messages and per-recipient delivery records before attempting real-time
delivery. The safe order is:

```text
write durable message
  -> create recipient inbox records
  -> acknowledge sender
  -> attempt real-time delivery
  -> recipient ack removes or marks delivered inbox record
```

This prevents the classic loss bug:

```text
send over socket -> socket/server fails -> message lost forever
```

WebSocket and pub/sub delivery are performance optimizations. The database,
durable log, or inbox is the reliability mechanism.

### 2. Use per-recipient inbox state for offline delivery

A global message table proves that a message exists, but it does not tell the
system who still needs it. Model these separately:

- `Message`: immutable content and metadata.
- `DeliveryRecord` or `Inbox`: recipient-specific delivery state.
- `ClientAck`: device/client-specific receipt state when needed.

Per-recipient rows increase write amplification, but they make retry, offline
sync, deletion, acknowledgement, expiration, and support tooling much simpler.

### 3. Make acknowledgements first-class

Define ack semantics explicitly:

- `server_ack`: server durably accepted the sender's message.
- `delivery_ack`: recipient device received the message.
- `read_ack`: recipient user opened/read the message.
- `media_ack`: recipient downloaded required attachment.

Do not overload one acknowledgement to mean all states. A server-side send over
a socket does not prove client receipt.

### 4. Use pub/sub for routing, not durability

When users are connected to different servers, use pub/sub or a routing registry
to route messages to the server that owns the recipient connection. Publish only
after durable writes succeed.

Useful split:

```text
Database / durable log = source of truth
Pub/Sub = low-latency routing hint
WebSocket = delivery transport
Reconnect sync = correctness recovery
```

Redis Pub/Sub is fast and lightweight but at-most-once. It can drop messages
when nobody is subscribed, during transient failures, or during node issues.
That is acceptable only if reconnect sync reads from durable delivery state.

Kafka is durable but can be too heavy as one topic/channel per user or chat at
massive scale. Use it when a durable event log and replay are central to the
architecture, not as a naive socket-routing channel per user.

### 5. Choose routing partitions by fan-out shape

Ask for group-size distribution before choosing the routing key.

- Mostly 1:1 or small groups: route by recipient/user channel.
- Many large active groups: route by chat/topic channel.
- Mixed workload: adaptive routing with careful migration windows.

For adaptive routing, publish to both old and new channels briefly while servers
update subscriptions. Deduplicate by message ID.

### 6. Track connection ownership and lifecycle

A distributed real-time system must know which server currently owns each active
connection or must subscribe endpoint servers to the right routing topics.

Define:

- How connections are authenticated and registered.
- How stale connections are removed.
- How messages route to the owning server.
- What happens when a server dies.
- How clients reconnect and resume.
- How rolling deploys drain active sockets.

In-memory maps are fine inside one connection server, but they are not durable.
After a server crash, clients reconnect and inbox sync repairs missed delivery.

### 7. Treat users and devices separately when needed

A user may have multiple devices with different delivery state. Decide product
semantics:

- User-level delivery: once any device receives it, the user is delivered.
- Device-level delivery: every device must receive or independently sync.
- Hybrid: urgent notifications to all devices, durable sync by user history.

For chat-like systems, model `Client` or `Device` explicitly when each device
must remain in sync.

### 8. Keep large media off the chat server hot path

Messages should carry metadata and references. Large binary media should go to
object storage through authorized upload/download URLs.

Required media concerns:

- Pre-signed upload/download URLs.
- MIME type, size, malware, and encryption validation.
- Upload completion tracking before exposing attachments.
- TTL or lifecycle cleanup for temporary media.
- Placeholder/failure state if upload fails.

Do not route large files through WebSocket or store them in the primary message
database unless files are tiny and scale is limited.

### 9. Tie retention to delivery and product semantics

If the requirement is offline delivery for 30 days and short centralized
retention, delete or expire state accordingly:

- Delete inbox records after ack or expiration.
- Expire undelivered messages after the offline-delivery window.
- Expire attachments after all required recipients receive/download them or
  after TTL.
- Keep metadata only when required for abuse, audit, compliance, or billing.

## Architecture Decision Rules

- If delivery must be guaranteed, persist before socket delivery.
- If recipients can be offline, create per-recipient delivery records.
- If recipients must confirm receipt, require client acknowledgements.
- If low latency and bidirectional updates matter, use WebSockets or another
  persistent connection.
- If updates are one-way and infrequent, prefer polling/SSE before WebSockets.
- If users connect across many servers, use pub/sub or a routing registry.
- If using Redis Pub/Sub, write durably first because it is at-most-once.
- If using Kafka, avoid one topic per user/chat at massive scale.
- If most conversations are 1:1, prefer user-level routing channels.
- If large groups dominate, prefer chat/topic-level routing channels.
- If only rare large groups cause stress, use adaptive routing.
- If clients have multiple devices, track device/client delivery state when
  product semantics require it.
- If messages contain media, use object storage with pre-signed URLs.
- If media has bounded lifetime, use TTL and cleanup jobs.
- If a connection server crashes, rely on reconnect plus inbox sync.

## Production Guardrails

Durable message write path:

- Generate idempotency keys for send requests.
- Use deterministic `message_id` or a client-generated temporary ID mapping.
- Deduplicate by `(sender_id, client_message_id)`.
- Write message and recipient delivery records atomically where possible.
- Use transactional outbox or repair jobs when atomic writes are not available.
- Return sender success only after durable persistence succeeds.
- Make send retries idempotent.
- Apply per-user and per-chat rate limits.

Delivery and acknowledgements:

- Require recipient/client ack for reliable delivery.
- Store ack state separately from message content.
- Define ack timeout and retry behavior.
- Retry undelivered messages on reconnect.
- Make client delivery idempotent.
- Include monotonically increasing sequence numbers per chat or recipient stream.
- Detect gaps and trigger sync.
- Separate delivered, read, and media-download acknowledgements.

Offline sync:

- Maintain per-recipient or per-device inbox records.
- On reconnect, fetch undelivered records within retention window.
- Support pagination/cursor sync for large offline backlogs.
- Expire undelivered records after TTL.
- Add reconciliation jobs to repair missing inbox records.
- Track offline backlog size per user/device.

WebSocket connection management:

- Authenticate socket connections.
- Track connect, heartbeat, disconnect, reconnect.
- Use heartbeat/ping-pong to detect stale connections.
- Enforce max connections per user/device.
- Handle backpressure on slow clients.
- Bound per-connection buffers.
- Drop or degrade non-critical events before critical messages.
- Keep heavy work off connection server event loops.
- Use graceful server draining before deploys.
- Force reconnect with resume token during rolling deploys when needed.

Pub/sub routing:

- Publish only after durable writes succeed.
- Treat pub/sub as best-effort unless using a durable broker.
- Shard channels by user/chat using consistent hashing.
- Monitor publish errors, subscriber counts, and lag when available.
- Add fallback polling or reconnect sync.
- Publish to both old and new routing paths during adaptive transitions.
- Avoid hot channels caused by large groups or celebrity users.
- Add circuit breakers for pub/sub outages.

Ordering:

- Define ordering scope: per chat, per sender, per recipient, or global.
- Use per-chat sequence numbers if chat ordering matters.
- Use server timestamps for display, not strict ordering.
- Reorder and deduplicate client-side based on sequence/message ID.
- Handle retries without changing message order.

Media:

- Use pre-signed URLs for upload/download.
- Validate MIME type, size, malware risk, and encryption requirements.
- Store only attachment metadata in message records.
- Add object-storage lifecycle rules.
- Avoid routing large blobs through chat servers.
- Track upload completion before recipient exposure.
- Use placeholder/failure state if upload fails.

Observability:

- Send latency: client send to durable write to sender ack.
- Delivery latency: durable write to recipient socket delivery to ack.
- Offline sync latency and backlog size.
- WebSocket connection count by server.
- Reconnect rate, heartbeat failures, and disconnect reasons.
- Pub/sub publish errors and subscriber counts.
- Duplicate send attempts and idempotency hits.
- Undelivered message age.
- DLQ and repair job volume.
- Media upload/download success rate and object-storage cost.

## Common Failure Modes

| Failure Mode | Cause | Mitigation |
|---|---|---|
| Message lost after socket send | Socket delivery happens before durable persistence | Persist message and inbox records first |
| Sender sees success but recipient never gets message | Success returned before delivery records exist | Ack sender only after durable writes |
| Duplicate messages after retry | Client timeout triggers duplicate send processing | Use idempotency key or `(sender_id, client_message_id)` uniqueness |
| Connected recipient misses message | Redis Pub/Sub drops event | Treat pub/sub as best-effort; reconnect sync reads inbox |
| Server crash loses connection mapping | Ownership is only in memory | Clients reconnect; server resubscribes; inbox sync repairs |
| Large group creates hot fan-out | One message creates many writes and publishes | Limit group size, batch writes, chat-level routing, adaptive partitioning |
| Adaptive routing loses messages | Servers subscribed to different old/new channels | Publish both paths during transition and dedupe |
| Multiple devices fall out of sync | Ack tracked only at user level | Track device/client sync cursor when required |
| Inbox grows without bound | Missing acks, abandoned accounts, cleanup failure | TTL, max backlog thresholds, cleanup and reconciliation |
| Media overwhelms chat servers | Upload/download routed through WebSocket or service | Use object storage and pre-signed URLs |
| Blob storage cost leak | Attachments never deleted | Lifecycle policies, TTL cleanup, cost alerts |
| Slow client causes memory pressure | Server buffers too many pending messages | Bound buffers, backpressure, disconnect, rely on sync |

## Clarifying Questions

Ask:

1. Is delivery guaranteed, best-effort, or at-least-once?
2. What does "delivered" mean: server accepted, device received, or user read?
3. Do we need per-user or per-device delivery tracking?
4. How many devices can one user have?
5. What is the offline delivery window?
6. What happens after offline messages expire?
7. Is message history permanent or retained only until delivery?
8. What is expected message QPS?
9. What percentage of chats are 1:1 versus groups?
10. What is the maximum group size?
11. Are there celebrity users or unusually hot groups?
12. Is ordering required globally, per chat, per sender, or per recipient?
13. Can messages be edited, deleted, or recalled?
14. Should acks be delivered/read/media-specific?
15. What duplicate-delivery behavior is acceptable?
16. What should clients do when they detect a sequence gap?
17. Should pub/sub be best-effort or durable?
18. What is the reconnect/resume protocol?
19. How long can clients remain connected?
20. How should rolling deploys drain active sockets?
21. Can media upload directly to object storage?
22. What media size limits and validation rules are required?
23. Does the system require end-to-end encryption?
24. How does encryption affect server storage, search, moderation, and media
    scanning?
25. What metrics prove messages are not silently stuck?

## Reusable Agent Instructions

When designing durable real-time messaging:

1. Design the durable delivery path before the real-time path.
2. Never rely on WebSocket delivery as the source of truth.
3. Persist message and recipient delivery records before sender success.
4. Use client-generated idempotency keys for send retries.
5. Require client acknowledgements for reliable delivery.
6. Track delivery state separately from message content.
7. Use per-recipient inbox records for offline delivery.
8. Use per-device delivery state when devices must sync independently.
9. Use WebSockets only when bidirectional low-latency delivery is needed.
10. Use pub/sub only for routing to connection owners unless the broker is the
    durable source.
11. Treat Redis Pub/Sub as best-effort.
12. Use reconnect sync to repair missed real-time deliveries.
13. Choose user-level, chat-level, or adaptive routing by group-size
    distribution.
14. Keep large media out of the message DB and socket hot path.
15. Add TTL cleanup for messages, inbox records, and attachments.
16. Add backpressure, heartbeats, reconnect, retry, dedupe, DLQ, repair jobs,
    and delivery observability.

## Condensed Memory

Durable real-time messaging requires separating durability from real-time
transport. Persist messages and per-recipient inbox/delivery records before
attempting socket delivery; return sender success only after durable writes
succeed. WebSockets provide low-latency bidirectional delivery, but they are not
the source of truth. Use client acknowledgements to mark delivery and reconnect
sync from the inbox to repair missed socket/pub-sub events. Redis Pub/Sub is
useful for routing messages to the chat server that owns a recipient connection,
but it is at-most-once, so publish only after durable persistence. Choose routing
by workload: user-level for mostly 1:1 chats, chat-level for large groups, and
adaptive routing for rare hot groups. Model users, clients/devices, chats,
messages, and delivery records separately. Keep media off the chat server hot
path through pre-signed object-storage URLs. Guardrails: idempotency keys,
per-recipient inbox, acks, retry/reconnect sync, sequence numbers, dedupe,
backpressure, heartbeats, stale connection cleanup, pub/sub sharding, TTL
cleanup, DLQ/repair jobs, and delivery latency/backlog observability.
