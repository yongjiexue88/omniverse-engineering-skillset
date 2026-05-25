# System Design High-Contention Bidding With Real-Time Updates

## Purpose

Use this reference for systems where many users concurrently compete to update
the same scarce or contested state, the accepted order matters, and viewers need
near-real-time state updates. Canonical examples include online auctions, ticket
bidding, flash-sale claims, seat upgrades, marketplace offers, ad bidding, game
item auctions, reservation waitlists, and real-time price discovery.

This is a specialized case under Dealing With Contention, Durable Ordered
Writes, and Real-Time Updates. Use it with
`system-design-pattern-recognition-playbook.md` and
`system-design-architecture-decision-playbook.md` when a design involves bids,
auction state, current winner, ordered per-entity processing, hot contested
resources, or live highest-bid broadcasts.

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

Many users concurrently compete to update one entity. The system must preserve a
correct ordering of updates, reject invalid stale updates, durably record every
attempt, and broadcast the latest accepted state quickly.

The generic problem:

> How do we accept contested writes without losing attempts, determine the
> correct accepted state, and push committed changes to viewers in near real
> time?

This is not CRUD. It combines:

- Contention control.
- Durable write ingestion.
- Per-entity ordering.
- Strong consistency for accepted state.
- Near-real-time fanout.
- End-state orchestration.

For auctions, consistency is a business requirement. A stale or inconsistent
bid can cause the wrong user to win, a valid bid to be lost, a bidder to be
charged incorrectly, or seller revenue to be reduced.

## When To Use

Use this pattern when:

- Many users can update the same resource concurrently.
- Only one update can be considered the current winner/state.
- Update order matters for fairness.
- The system cannot drop writes.
- Users need fast feedback on whether their update succeeded.
- The current state is displayed to many viewers.
- State changes rapidly near deadlines or hot events.
- The correctness cost of inconsistency is high.
- A natural partition key exists, such as `auction_id`, `ticket_id`,
  `item_id`, `match_id`, or `listing_id`.

## When Not To Use

Avoid or simplify this pattern when:

- Updates are low-frequency and simple database transactions are enough.
- The resource is not scarce or contested.
- Lost or late updates are acceptable.
- The current state does not need live display.
- Event ordering does not matter.
- The product can tolerate eventual consistency for accepted state.
- The system is internal/admin-only with low concurrency.
- Strong consistency adds more business complexity than value.

## Default Architecture

Use durable ingestion, per-entity ordered processing, and post-commit fanout:

```text
Bid request
  -> Bid API validates auth, shape, auction ID, amount, eligibility
  -> Durable bid log/queue keyed by auction_id
  -> Return bid_received / submission_id when async

Bid processor
  -> Consumes bids in auction_id order
  -> Reads authoritative auction state
  -> Validates open/closed state, bid amount, increment rules
  -> Records bid attempt status
  -> Updates auction.current_highest_bid/current_winner/version if accepted
  -> Commits
  -> Emits accepted_bid/highest_bid_changed event

Realtime path
  -> Outbox/pub-sub/fanout gateway
  -> WebSocket/SSE clients
  -> Clients apply only newer auction versions

Auction close workflow
  -> OPEN -> CLOSING -> CLOSED_PENDING_PAYMENT -> SOLD
                         -> PAYMENT_EXPIRED -> OFFER_NEXT_BIDDER
                         -> CANCELED / NO_SALE
```

For moderate contention, a single database transaction with row locks or
optimistic concurrency may be enough. For high-value/high-spike auctions,
persist bids to a durable ordered log before processing.

## Core Design Rules

### 1. Treat bidding as a contention problem

A bid is not just a row insert. It is a conditional state transition on a
contested auction:

```text
accepted_bid.amount > current_highest_bid
```

If two bids conflict, only the valid bid according to amount, receive time,
sequence, and tie-break rules wins. Choose one of:

- Row-level lock.
- Optimistic concurrency control.
- Conditional update / compare-and-swap.
- Single-threaded per-key queue consumer.
- Actor per entity.

### 2. Cache current winning state on the parent entity

Do not compute `MAX(bid)` from history on every auction page load. Store fast
current state on the auction/listing entity:

- `current_highest_bid`
- `current_winner_id`
- `auction_version`
- `status`

Keep durable bid attempts separately for audit. Update bid status and auction
summary in one transaction or deterministic ordered processing step.

### 3. Keep critical sections short

The critical section should only:

1. Read current auction state.
2. Validate auction is open.
3. Validate bid amount/increment/eligibility.
4. Record bid status.
5. Update current state if accepted.
6. Commit.

Do not send WebSocket messages, call payment systems, send emails, or perform
external work while holding the lock.

### 4. Use OCC when conflicts are usually rare

Optimistic concurrency avoids lock overhead for normal auctions:

```sql
UPDATE auctions
SET current_highest_bid = :new_bid,
    current_winner_id = :bidder_id,
    version = version + 1
WHERE id = :auction_id
  AND version = :expected_version
  AND status = 'OPEN'
  AND current_highest_bid < :new_bid;
```

If zero rows update, reload state and reject stale bids or retry with a bounded
attempt count. For hot auctions, OCC retry storms can increase load; use
single-writer processing or row locks.

### 5. Persist bids durably before processing when loss is unacceptable

For high-value systems:

```text
API receives bid
  -> validate basic auth/shape
  -> write to durable queue/log
  -> return bid_received
  -> ordered consumer accepts/rejects
  -> persist result
  -> notify client
```

Durable receipt is not the same as accepted bid. The UI must distinguish
`received`, `pending`, `accepted`, and `rejected`.

### 6. Partition streams by contested entity

Ordering is required per auction, not globally. Use:

```text
Kafka topic: bids
partition key: auction_id
consumer group: bid-processors
```

This preserves per-auction ordering and allows parallel processing across
auctions. A single hot auction can still bottleneck one partition; handle that
explicitly rather than breaking order casually.

### 7. Use queues as durability and spike buffers

Popular auctions surge near the end. A queue absorbs spikes, avoids dropping
bids, and gives operational signals:

- Queue depth.
- Oldest message age.
- Consumer lag by partition.
- Hot auction partition pressure.

Lag affects UX. Show pending states and define cutoff rules for bids received
before close but processed later.

### 8. Match consistency to business risk

If money, legal ownership, or user trust depends on the result, prefer
correctness over availability for bid acceptance. Real-time views can be
eventually consistent, but accepted state and final winner should not be.

### 9. Avoid database polling for hot live state

Polling highest bid from the database for every viewer is wasteful and slow.
Use:

```text
accepted bid commit
  -> highest_bid_changed event
  -> WebSocket/SSE/pub-sub fanout
  -> clients update local view
```

Polling can remain as fallback or reconnect snapshot fetch.

### 10. Separate attempted state from accepted state

Store every bid attempt with status:

- `RECEIVED`
- `PENDING`
- `ACCEPTED`
- `REJECTED_TOO_LOW`
- `REJECTED_AUCTION_CLOSED`
- `REJECTED_DUPLICATE`
- `REJECTED_INVALID`
- `SYSTEM_FAILED`

Store receive timestamp, processing timestamp, current max observed, auction
version, rejection reason, and idempotency key for audit and dispute handling.

### 11. Treat auction ending as a workflow

Closing races with bids, retries, queue lag, dynamic extensions, and payment.
Use server-authoritative time and a conditional state transition so only one
close worker wins.

Model close explicitly:

```text
OPEN -> CLOSING -> CLOSED_PENDING_PAYMENT -> SOLD
                  -> PAYMENT_EXPIRED -> OFFER_NEXT_BIDDER
                  -> CANCELED / NO_SALE
```

Define handling for delayed valid bids, late invalid bids, dynamic extensions,
payment failures, and next-bidder offers.

## Architecture Decision Rules

- If multiple users update the same entity concurrently, use OCC, row locking,
  conditional writes, or per-key ordered processing.
- If money or legal ownership depends on the result, use strong consistency for
  accepted state.
- If a bid must never be lost, write it to a durable queue/log before
  processing.
- If ordering matters only within one entity, partition by entity ID.
- If volume is high across many auctions, process different auctions in
  parallel.
- If one auction becomes extremely hot, consider actor-per-auction,
  single-writer routing, or a durable sequencer.
- If conflicts are rare, prefer OCC.
- If conflicts are frequent, prefer short row locks or single-writer per key.
- If users need instant visual updates, use WebSockets/SSE/pub-sub fanout.
- If bid submission is async, return `bid_received` separately from
  `bid_accepted`.
- If auction close races with bids, use explicit state transitions and
  server-authoritative receive time.
- If storing current highest bid, update it atomically with bid status.

## Production Guardrails

Bid ingestion:

- Generate bid IDs server-side.
- Use idempotency keys for retry-safe bid submission.
- Never trust client-provided `user_id`, timestamp, auction status, or current
  bid.
- Validate auction ID, amount, currency, increment rules, and eligibility.
- Write bid attempt to durable queue/log quickly.
- Return clear status: received, pending, accepted, rejected.
- Rate-limit per user, auction, IP/device.
- Add fraud/abuse throttling.

Ordering and processing:

- Partition bid events by `auction_id`.
- Preserve per-auction ordering.
- Make consumers idempotent.
- Store processing attempt count.
- Use DLQ for poison messages.
- Track consumer lag and hot partitions.
- Use deterministic tie-breaking.
- Use server receive time, not client time.

Database correctness:

- Maintain `auction.current_highest_bid`.
- Record every bid attempt with final status.
- Update bid status and auction current state atomically.
- Use row locks or OCC conditional updates.
- Keep lock duration short.
- Avoid external calls inside transactions.
- Add lock timeout and retry policy.
- Store rejection reason codes and auction version observed.
- Preserve audit trails.

Real-time updates:

- Publish only after bid acceptance commits.
- Prefer outbox/event relay for commit-to-publish reliability.
- Include monotonic auction version in payload.
- Let clients ignore stale/out-of-order updates.
- Use WebSocket/SSE gateway or pub/sub fanout for hot auctions.
- Support reconnect with snapshot fetch.
- Backpressure slow clients.
- Coalesce rapid updates if UI can tolerate it.
- Use polling fallback.

Auction closing:

- Use server-authoritative end time.
- Model closing as a state machine.
- Prevent accepted bids after close unless extension rules apply.
- Handle dynamic extension rules explicitly.
- Ensure only one close worker wins.
- Drain/process valid pre-close bids before selecting winner.
- Handle delayed queue messages with cutoff logic.
- Move winner to payment window.
- Offer to next eligible bidder if payment expires.
- Store final winning bid and close reason immutably.

Observability and repair:

- Accepted/rejected bid counts.
- Bid processing latency.
- Queue lag and oldest unprocessed bid.
- OCC retry rate and lock wait time.
- WebSocket/SSE fanout latency.
- Client stale update drops.
- Auction close failures.
- Replay tooling from durable bid log.
- Audit/export for disputes.
- Reconcile auction highest bid from bid history periodically.

## Common Failure Modes

| Failure Mode | Cause | Mitigation |
|---|---|---|
| Lost bid | API acknowledges before durable persistence | Persist to durable queue/log before receipt ack |
| Double winner or wrong highest bid | Concurrent writes without synchronization | Row lock, OCC, conditional update, or single-writer |
| Lower bid overwrites higher bid | Last-write-wins update | Conditional update requiring higher amount and expected version |
| OCC retry storm | Many concurrent bids conflict | Per-auction ordered consumer/actor and backpressure |
| Queue lag causes stale UI | Ingestion outpaces consumers | Scale consumers, show pending, prioritize closing auctions |
| Uncommitted bid broadcast | Event published before DB commit | Publish after commit, preferably via outbox |
| Out-of-order client updates | Network/reconnect reorders events | Version/sequence payload; client applies only newer |
| Valid bid stuck behind close | Close ignores pre-deadline queued bids | Server receive timestamp and explicit close cutoff rules |
| Multiple close workers pick winners | Concurrent close jobs race | Conditional transition from OPEN/CLOSING to CLOSED |
| Hot auction overloads one partition | All bids for one auction share one key | Accept bottleneck or specialized sequencer; do not break order |
| Bid history and summary diverge | Bid insert and max update split | Same transaction or reconciliation from bid log |
| Client shows stale highest bid | Missed push or long polling interval | Reconnect snapshot and versioned updates |

## Clarifying Questions

Ask:

1. Is money changing hands?
2. What is the cost of accepting the wrong winner?
3. What are average and peak bids per second?
4. How many concurrent auctions exist?
5. How many watchers can one hot auction have?
6. Does ordering depend on receive time, processing time, amount, or sequence?
7. What is the tie-breaker for equal bids?
8. Are bid increments required?
9. Can users retract bids?
10. Are bids synchronous or asynchronous from the user perspective?
11. Can a bid be pending after auction close?
12. How are late-but-valid bids handled?
13. Are auctions fixed-end or dynamically extended?
14. What clock is authoritative?
15. What durable queue/log is used?
16. What is the queue partition key?
17. What happens if one auction becomes a hotspot?
18. Is OCC enough or is single-writer processing needed?
19. How are rejected bids stored?
20. How are disputes audited?
21. Are WebSockets/SSE required or is polling acceptable?
22. Can clients recover missed updates?
23. How is payment handled after winning?
24. What happens if the winner does not pay?
25. Can the final winner be recomputed from the bid log?

## Reusable Agent Instructions

When designing auction-like systems:

1. Treat the core as high-contention state transition, not CRUD.
2. Define the business invariant before choosing technology.
3. Persist every bid attempt durably before processing when loss is unacceptable.
4. Partition bid events by contested entity ID.
5. Preserve ordering per contested entity, not globally.
6. Store bid attempts separately from accepted current state.
7. Keep current highest bid on the auction row/entity.
8. Use row locking, OCC, conditional updates, or single-writer processing.
9. Keep database transactions short and avoid external calls while locked.
10. Publish real-time updates only after committed accepted bids.
11. Include monotonic version/sequence numbers in client updates.
12. Use WebSockets/SSE/pub-sub for hot live state; polling only when delay is
    acceptable.
13. Model auction closing as a server-authoritative workflow.
14. Handle delayed bids, clock drift, dynamic extensions, and concurrent close.
15. Add idempotency, retry handling, DLQ, audit logs, replay, and reconciliation.

## Condensed Memory

Use this pattern for auctions, bidding, flash sales, and other high-contention
systems. The core is not bid insertion; it is a strongly consistent conditional
state transition on a contested entity. Persist bid attempts durably as early as
possible, often through a queue/log. Partition by `auction_id` so bids for one
auction preserve order while different auctions process in parallel. Maintain
bid history plus a materialized current highest bid on the auction entity. Use
row locks, OCC conditional updates, or single-writer per auction to prevent
races. Publish highest-bid updates only after commit, with monotonic version
numbers so clients ignore stale messages. Use WebSockets/SSE/pub-sub for hot
real-time views; polling is only acceptable when delay is low-risk. Treat
auction close as a workflow with server-authoritative time, delayed bid
handling, dynamic extension rules, payment windows, and fallback to the next
bidder. Guardrails: idempotency, durable queue, partition ordering, short
transactions, lock/OCC retries, DLQ, fanout backpressure, audit log, replay, and
reconciliation.
