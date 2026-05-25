# System Design Collaborative Editing With Real-Time Convergence

## Purpose

Use this reference for Google Docs-like systems where multiple clients
concurrently mutate the same shared object, see updates in real time, and must
eventually converge on the same durable state. The system needs low-latency
bidirectional updates, conflict resolution, operation persistence, snapshots,
presence/cursor fanout, and reconnect replay.

This is a specialized case under Real-Time Updates, Collaborative Editing,
Distributed Convergence, and Shared Mutable State. Use it with
`system-design-pattern-recognition-playbook.md` and
`system-design-architecture-decision-playbook.md` when a design involves
collaborative documents, shared whiteboards, multiplayer design tools,
collaborative spreadsheets, shared code editors, OT, CRDT, operation logs, or
presence/cursor state.

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

Multiple clients concurrently mutate the same shared object. The system must
propagate changes in real time, resolve conflicts deterministically, preserve
durability, and ensure all clients eventually converge on the same state.

This is harder than real-time messaging because messages are not independent.
Each edit changes shared state, and concurrent edits can conflict.

The system needs:

- Low-latency bidirectional communication.
- Concurrent mutation ordering.
- Conflict resolution.
- Durable operation persistence.
- Snapshot/recovery.
- Cursor/presence fanout.
- Bounded per-document coordination.
- Reconnect and missed-operation replay.

## When To Use

Use this pattern when:

- Multiple users edit the same object concurrently.
- Updates must appear in near real time.
- Clients and server both send frequent events.
- Temporary divergence is acceptable but convergence is required.
- The object has ordered/structured content such as text, rows, shapes, layers,
  or canvas elements.
- Users need presence/cursor awareness.
- Durable shared state must survive restarts.
- Conflicting edits can happen.
- Active collaborators per object are bounded.

## When Not To Use

Avoid this pattern when:

- Only one user edits at a time.
- Updates are append-only and do not conflict.
- Polling or refresh-based collaboration is enough.
- Shared object does not need durable mutation history.
- Eventual convergence is unacceptable.
- Last-write-wins is safe enough.
- Users only need presence, not collaborative mutation.
- Offline editing is out of scope and locking is acceptable.

For simple systems, document locks or a single-writer workflow may be much
cheaper than OT/CRDT.

## Default Architecture

For centralized online collaboration, use an authoritative document session:

```text
Client
  -> WebSocket connect document_id, last_seen_version
  -> Receives snapshot/operations after last_seen_version
  -> Applies local edits optimistically
  -> Sends operation with operation_id and base_version

Document coordinator/session
  -> Owns active document version
  -> Transforms operation against accepted operations since base_version
  -> Persists accepted operation atomically with version update
  -> Broadcasts canonical operation after commit
  -> Stores ephemeral presence in memory/TTL cache

Persistence
  -> DocumentSnapshot(document_id, version, content)
  -> DocumentOperation(document_id, version, base_version, op, author, idempotency_key)
```

## Core Design Rules

### 1. Separate durable content from ephemeral collaboration state

Document edits and cursor/presence updates are different classes of state.

Use separate logical message types:

- `document.operation`: durable edit.
- `document.snapshot`: durable checkpoint.
- `presence.update`: ephemeral cursor/user state.
- `presence.leave`: disconnect/timeout cleanup.

Presence can live in memory or short-TTL cache. Edits need durable storage.

### 2. Use WebSockets for bidirectional collaboration

Collaborative editing needs frequent client-to-server and server-to-client
events. WebSockets fit when:

- Clients send frequent edits.
- Server broadcasts accepted operations.
- Latency target is low.
- Presence/cursors need live fanout.

SSE is better for one-way updates, not frequent collaborative mutation.

### 3. Use an authoritative per-document coordination path for OT

Operational Transformation works best when a server/session serializes
operations and transforms them against concurrent edits.

Per active document:

- Route clients to document coordinator/session.
- Track current version.
- Accept operations with base version.
- Transform against operations since base version.
- Persist accepted operation.
- Broadcast canonical operation.
- Let clients acknowledge/rebase local pending edits.

### 4. Choose OT or CRDT by constraints

Prefer OT when:

- Central server is acceptable.
- Active editors per document are bounded.
- Low memory overhead matters.
- Offline editing is limited.
- Operation ordering can be enforced through the server.

Prefer CRDT when:

- Offline editing matters.
- Peer-to-peer or multi-master editing matters.
- Operations can arrive in arbitrary order.
- Convergence matters more than central control.

CRDTs often carry more metadata/tombstones and require compaction strategy.

### 5. Persist operation logs and compact into snapshots

Store operations for replay/recovery, but snapshot to avoid infinite replay.

Use:

- `DocumentSnapshot(document_id, version, content, created_at)`
- `DocumentOperation(document_id, version, base_version, operation, author_id,
  idempotency_key, created_at)`
- Snapshot every N operations or M minutes.
- On load, fetch latest snapshot plus operations after snapshot version.

### 6. Route by document ID

All active editors for the same document need coordinated ordering. Route by
`document_id` using:

- Consistent hashing.
- Sticky session routing.
- Document session ownership.
- Lease/fencing for active coordinator.
- Pub/sub after canonical operation ordering is decided.

Different documents can distribute across many servers.

### 7. Treat presence as lossy and rate-limited

Cursor movement can be frequent and should not pollute durable history.

For presence/cursors:

- Send at bounded frequency.
- Coalesce updates.
- Drop stale frames.
- Store with short TTL.
- Remove users on heartbeat timeout.
- Never block document edits on presence delivery.

### 8. Use optimistic local editing

Clients should apply local edits immediately for responsiveness, then reconcile
with server-confirmed order.

Client flow:

1. User edits locally.
2. Client creates operation with base version.
3. Client applies optimistically.
4. Client sends operation.
5. Server transforms/accepts and returns canonical version.
6. Client acknowledges or rebases pending local operations.

### 9. Design reconnect and missed-operation replay

On reconnect, client sends:

- `document_id`
- `client_id`
- `last_seen_version`
- pending operations

Server returns:

- operations after `last_seen_version`, or latest snapshot if gap is too large.
- accepted/rejected pending operations.

### 10. Discuss convergence explicitly

A staff-level design should explain:

- How operations are ordered.
- How conflicts are transformed/resolved.
- How state survives restart.
- How clients catch up.
- How presence differs from edits.
- How hot documents are handled.

## Architecture Decision Rules

- If users only view updates, prefer SSE.
- If users collaboratively edit and send frequent updates, use WebSockets.
- If offline-first or peer-to-peer editing is required, prefer CRDT.
- If a central authoritative server is acceptable, prefer OT.
- If concurrent editors per document are bounded, use document-level
  coordination.
- If concurrent editors are unbounded, avoid one coordinator without partitioning.
- If presence/cursor state is needed, keep it ephemeral.
- If edits are accepted, persist before broadcasting.
- If latency matters, allow optimistic local edits.
- If clients disconnect, store versions and operations for replay.
- If replay grows long, create snapshots.
- If using CRDTs, plan tombstone/metadata compaction.
- If using OT, validate base versions and transform stale operations.
- If a document server owns active sessions, add ownership/lease recovery.
- If edits and presence share a socket, prioritize document operations.

## Production Guardrails

Document operations:

- Unique operation IDs/idempotency keys.
- Monotonic document versions.
- Base version validation.
- Transform/rebase stale operations.
- Durable operation log.
- Atomic accept path: persist operation and update version.
- Broadcast after commit.
- Idempotent retries.
- Rebuild content from snapshot plus log.

Snapshots and recovery:

- Periodic snapshots.
- Snapshot version metadata.
- Replay from latest snapshot.
- Snapshot instead of replay when gap is too large.
- Compaction/tombstone strategy for CRDT.

Routing and coordination:

- Route active editors of same document to coordinator/session.
- Coordinator ownership/lease with fencing.
- Failover reloads from snapshot/log.
- Hot document editor limits.
- Downgrade overflow users to read-only when necessary.

Reconnect:

- Resume from `last_seen_version`.
- Detect gaps.
- Rebase pending local edits.
- Reject/resolve duplicate operation IDs.
- Full snapshot fallback.

Presence:

- Presence TTL.
- Heartbeats.
- Cursor throttling/coalescing.
- Drop presence before document edits under load.
- Clean up ghost collaborators.

Backpressure and observability:

- Per-connection output buffers.
- Disconnect slow clients.
- Operation latency.
- Broadcast latency.
- Reconnect rate.
- Replay size.
- Snapshot age.
- Document hot spots.
- Operation log growth.
- Transform failures/rejected operations.
- Rebase frequency.

Testing:

- Property/fuzz tests for OT/CRDT convergence.
- Invariant tests for operation ordering.
- Replay/recovery tests from snapshots.
- Disconnect/reconnect tests.

## Common Failure Modes

| Failure Mode | Why It Happens | Mitigation |
|---|---|---|
| Document divergence | Clients apply concurrent edits differently | OT/CRDT convergence rules |
| Lost accepted edit | Broadcast before durable write then crash | Commit before broadcast |
| Duplicate edit | Client retries same operation | Operation idempotency key |
| Incorrect cursor positions | Cursors not transformed with edits | Transform cursors or relative presence |
| Ghost users | Disconnect not cleaned | Heartbeats and TTL |
| Replay too slow | Long log without snapshots | Periodic snapshots/compaction |
| Hot document overload | Too many editors | Editor limits, read-only overflow, partition if possible |
| Stale client corrupts state | Operation from old version | Base version check and transform/rebase |
| Failover loses active state | Session only in memory | Durable log, leases, reload from snapshot/log |
| Cursor traffic overload | High-frequency cursor updates | Throttle/coalesce/drop presence |
| Slow client collapse | Unbounded send buffers | Buffer limits and disconnect policy |
| CRDT memory bloat | Tombstones/metadata accumulate | Compaction and garbage collection |
| OT transform bug | Complex concurrent operations mishandled | Property tests and fuzzing |
| Split brain coordinator | Two servers accept operations | Strong lease/ownership and fencing |

## Clarifying Questions

Ask:

1. Is the object plain text, rich text, tree, spreadsheet, or canvas-like?
2. How many concurrent editors per document?
3. Are readers separate from editors?
4. Is offline editing required?
5. Is peer-to-peer editing required?
6. Is document history/versioning required?
7. Are permissions/collaboration levels in scope?
8. Is central authoritative server allowed?
9. Latency target for local and remote edits?
10. What happens when users edit same position?
11. Preserve intent or only guarantee convergence?
12. Snapshot frequency?
13. Operation log retention?
14. Reconnect behavior?
15. Idempotent retry behavior?
16. Slow-client behavior?
17. Hot document handling?
18. Cursor position transformation?
19. Durable versus ephemeral state?
20. Behavior during server failover?

## Reusable Agent Instructions

When designing collaborative editing systems:

1. Separate durable edits from ephemeral presence/cursor state.
2. Use WebSockets for bidirectional low-latency collaboration.
3. Decide OT vs CRDT early.
4. Prefer OT with central server and bounded active editors.
5. Prefer CRDT for offline-first or multi-master editing.
6. Route active editors through a coordinated document session.
7. Give every operation an idempotency key and base version.
8. Persist accepted operations before broadcasting.
9. Maintain monotonically increasing document version.
10. Store operation logs and compact into snapshots.
11. Support reconnect replay from last seen version.
12. Apply local edits optimistically, then reconcile.
13. Throttle/coalesce cursor and presence.
14. Use heartbeats and TTL for ghost cleanup.
15. Add fuzz/property tests for convergence.

## Condensed Memory

Use this pattern when multiple users concurrently mutate the same shared object
and must converge with low latency. Separate durable document edits from
ephemeral presence/cursor state. Use WebSockets because collaborative editing is
bidirectional. Choose OT when there is a central authoritative document server
and bounded concurrent editors; choose CRDT when offline-first, peer-to-peer, or
multi-master editing matters. For OT, route active editors of a document to a
coordinator, track versions, require base versions, transform stale operations,
persist accepted operations, then broadcast. For CRDT, plan metadata/tombstone
compaction. Store operation logs and periodic snapshots for durability, replay,
and recovery. Support optimistic local edits, idempotent retries, reconnect from
last seen version, heartbeat cleanup, cursor throttling, hot-document editor
limits, and server failover recovery.
