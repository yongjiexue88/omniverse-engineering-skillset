# System Design Scarce Inventory Reservation Playbook

## Purpose

Use this reference for systems where many users browse or search a large catalog, but a much smaller set of scarce resources must be claimed exactly once.

Examples include event tickets, airline seats, hotel rooms, appointment slots, limited product drops, exam seats, parking spots, and reservation marketplaces.

This is a focused case combining high-contention booking, read scaling, search optimization, temporary holds, payment finalization, and admission control. Use `system-design-local-availability-inventory-consistency.md` when locality/serviceability is the dominant issue. Use this reference when checkout contention, scarce inventory, waiting rooms, TTL reservations, search, and payment finalization dominate.

## Table of Contents

- [Core Problem Pattern](#core-problem-pattern)
- [When To Use](#when-to-use)
- [When Not To Use](#when-not-to-use)
- [Default Architecture](#default-architecture)
- [Core Design Rules](#core-design-rules)
- [Production Guardrails](#production-guardrails)
- [Common Failure Modes](#common-failure-modes)
- [Clarifying Questions](#clarifying-questions)
- [Reusable Agent Instructions](#reusable-agent-instructions)
- [Condensed Memory](#condensed-memory)

## Core Problem Pattern

The system needs to support four pressures at once:

1. Massive read/search traffic.
   - Many users repeatedly view the same item, event, or resource group.
   - Read paths should prioritize availability, latency, and cacheability.
2. Scarce-resource booking.
   - Only one user can successfully claim a specific resource.
   - Booking must prioritize correctness over availability.
3. Temporary user intent.
   - Users need time to complete checkout.
   - The system must hold the resource temporarily without long-lived database locks.
4. Extreme traffic spikes.
   - Popular launches can send far more users into checkout than inventory can satisfy.
   - The system may need admission control before users reach scarce-resource paths.

The key design split:

- Discovery/search/read paths are availability and latency optimized.
- Final booking/claim paths are consistency and correctness optimized.

Cached availability is advisory. The database or authoritative owner must be the final correctness gate.

## When To Use

Use this pattern when:

- A resource can be claimed by only one user or transaction.
- Users need a checkout or confirmation window before final purchase.
- Demand can spike far beyond available inventory.
- Reads/searches are much more frequent than writes.
- Users expect near-real-time availability feedback.
- Search/discovery needs low latency and flexible matching.
- Reads can be slightly stale, but final booking must not double-sell.
- The business needs graceful degradation when cache, lock, queue, search, or payment infrastructure fails.

## When Not To Use

Avoid or simplify this pattern when:

- Inventory is abundant or overbooking is acceptable.
- Checkout is instantaneous and does not require temporary holds.
- There is no high contention on individual resources.
- Search is simple, small-scale, or admin-only.
- The system does not need interactive availability updates.
- Redis, queues, CDC, search indexes, and edge caching are not justified by scale.
- Strong serial consistency is required across the entire user journey, not only final booking.

## Default Architecture

Use separate paths for discovery, temporary reservation, final booking, payment, search, and admission control.

```text
Client
  -> CDN / edge cache
  -> Catalog or Event Service
  -> cache / read replicas / search index

Client
  -> Waiting room / admission service
  -> Booking Service
  -> TTL reservation store
  -> Payment provider
  -> Authoritative DB transaction
```

Reference responsibilities:

- Catalog/Event/Search service: serve stable metadata, search, and advisory availability.
- Reservation service: create temporary holds with TTL and ownership checks.
- Booking service: enforce admission, validate holder identity, and finalize booking in the authoritative DB.
- Payment handler: process payment callbacks idempotently and reconcile final state.
- Waiting room/admission service: throttle users into scarce-resource booking paths.
- Search/index pipeline: sync searchable catalog state from the source of truth through CDC/outbox.

## Core Design Rules

### 1. Split The System By Consistency Requirements

Do not treat read/search and booking paths the same way.

- Read/search path: optimize for availability, low latency, cacheability, and graceful staleness.
- Booking/claim path: optimize for correctness, atomic final state, and conflict handling.

Never rely on cached availability as the final source of truth. The final booking path must revalidate the resource before commit.

### 2. Use Short Transactions, Not Long-Lived Database Locks

Temporary checkout holds should not hold open database transactions while users fill forms or complete payment.

Long-running locks consume DB resources, increase contention, create deadlock risk, and fail poorly on user abandonment or network loss.

Instead, model a temporary reservation explicitly:

- reservation state in a table with expiration, or
- a TTL-based distributed lock used as the checkout hold.

Keep database transactions short and use them only to atomically check and update final state.

### 3. Model Temporary Reservations With TTL

Temporary reservations should expire automatically without requiring perfect cleanup.

For TTL locks, store:

- resource ID as the lock key
- user/session/booking ID as the lock value
- expiration as TTL

Example shape:

```text
SET reservation:{resource_id} {booking_id}:{user_id} NX EX 600
```

Final confirmation must verify that the holder still owns the reservation.

Tradeoffs:

- Longer TTL improves checkout success but holds inventory away from other users.
- Shorter TTL improves turnover but increases payment-race failures and refunds.
- Redis-style locks improve UX but add another state source.

### 4. Keep The Database As The Final Correctness Gate

Distributed locks improve checkout UX, but they are not enough for correctness.

Final booking must use one of:

- conditional update: `WHERE status = 'available'`
- optimistic version check
- unique constraint on resource ownership
- row-level lock inside a short transaction
- serializable transaction for critical sections

Example finalization shape:

```text
BEGIN TRANSACTION;
verify booking is pending and holder is valid;
claim resource with conditional update or lock;
mark booking confirmed;
COMMIT;
```

If Redis is unavailable or a TTL expires at the wrong time, the database still prevents double booking. UX may degrade, but correctness remains protected.

### 5. Make Multi-Resource Reservation All-Or-Nothing

When users reserve multiple resources together, partial reservation must be avoided or compensated immediately.

For group reservations:

- acquire locks in deterministic order
- use one booking ID across all resources
- release all acquired locks on any failure
- consider Lua or a reservation service when atomic multi-lock acquisition matters
- colocate resources in one shard when possible

Sequential locking is simpler but can create temporary partial holds. Atomic scripts reduce partial failure but are harder with sharded Redis.

### 6. Treat Payment Webhooks As Idempotent State Reconciliation

External payment callbacks can retry, arrive late, or arrive out of order. Payment success should trigger an idempotent finalization flow, not a blind write.

Webhook handler requirements:

- store external payment event ID and booking ID
- process only valid state transitions
- make repeated delivery safe
- update resource and booking status in one DB transaction
- handle failed finalization with refund or compensation

Use booking ID and external event ID as idempotency keys.

### 7. Design For Reservation Expiration During Payment

A reservation can expire while payment is still in progress. Treat this as a first-class failure mode.

Before choosing TTL, ask:

- average checkout duration
- payment processor latency
- user abandonment rate
- inventory scarcity
- acceptable refund rate

Options:

- choose a generous checkout TTL
- extend the lock when payment starts
- stop allowing extension after a max deadline
- rely on final DB transaction for the single winner
- automatically refund or compensate if payment succeeds but booking loses finalization

### 8. Make Reserved Inventory Visible To The Read Path

If temporary reservations live outside the database, the read model must still expose them as unavailable.

Options:

- Redis overlay read model: DB says sold/available; Redis says temporarily reserved.
- Write-through DB reservation: DB stores reserved status; Redis TTL controls expiration; sweeper cleans stale rows.
- Materialized availability view: precomputed seat/resource availability for hot pages.

Do not let final booking rely on the read model.

### 9. Use Admission Control For Extreme Demand

Real-time availability updates do not reduce contention. When demand massively exceeds inventory, limit who can enter the booking flow.

Use:

- virtual waiting room
- queue position updates
- admission tokens with TTL
- booking-service admission checks
- rate-limited dequeue based on downstream capacity and inventory

Queues introduce wait time and fairness concerns, but they protect the system and create a more understandable user experience.

### 10. Use Ordered Queues And Admitted-Session Gates

A waiting room needs both ordering and enforcement.

A typical Redis shape:

- sorted queue key per event/resource group
- score as enqueue timestamp or fairness priority
- admitted set/token with TTL
- server-side booking-service admission check

Guardrails:

- stable user/session identity
- reconnect handling
- bot protection
- rate limits
- position updates over SSE/WebSocket/polling
- anti-bypass checks at booking endpoints

### 11. Cache Stable Read Data Aggressively, Isolate Availability

Not all fields have the same freshness requirement.

Split read data into:

- static/cache-long: names, descriptions, venue layout, performer metadata, product details
- semi-static/cache-medium: event details, schedule changes, category data
- volatile/cache-short or overlay: availability, holds, sold status

Use cache tags or targeted invalidation for known updates. Use short TTL and final source-of-truth verification when precise invalidation is hard.

### 12. Keep Read Services Stateless

Read-facing services should be stateless so they scale behind load balancers.

Store shared state in caches, databases, search indexes, admission/session tokens, and reservation stores.

### 13. Use Search-Optimized Storage When SQL Search No Longer Fits

Use:

- standard DB indexes for exact filters and sorting
- database full-text indexes for moderate text search
- Elasticsearch/OpenSearch/Solr when fuzzy matching, relevance ranking, typo tolerance, faceting, high QPS, or complex filtering is required

Avoid plain wildcard SQL such as `LIKE '%term%'` at scale because it often causes full scans.

### 14. Sync Search Indexes With CDC Or Outbox

Search indexes are read models. Feed them reliably from the source of truth.

For search index sync:

- define DB as source of truth
- use CDC, outbox, or event stream
- make indexing idempotent
- track lag
- support reindex/backfill
- expose degraded behavior when index freshness falls behind

Avoid fragile app-level ad hoc dual writes.

### 15. Cache Search Results Only When Safe

Search result caching works best for repeated, non-personalized, stable queries.

Before caching search results, ask:

- Are results personalized?
- Are results location, user, permission, or session dependent?
- How often do matching records change?
- Can stale results be tolerated?
- Does the cache key include every relevant query parameter?
- Can invalidation be tag-based, event-driven, or TTL-only?

Do not edge-cache personalized results unless the cache key safely varies by all personalization dimensions.

## Production Guardrails

### Idempotency

- Idempotency key for reservation creation.
- Idempotency key for payment confirmation.
- Idempotent webhook handler keyed by booking ID and external payment event ID.
- Idempotent reservation release and retry flows.

### Final Consistency

- DB transaction for final booking confirmation.
- OCC version check, conditional update, row lock, serializable transaction, or unique constraint.
- Invariant preventing duplicate ownership.
- State machine for `pending`, `reserved`, `payment_started`, `confirmed`, `expired`, `cancelled`, `failed`, and `refunded`.

### TTL Reservation

- TTL lock or reservation expiry.
- Lock value includes user/session/booking ID.
- Confirming user must match lock owner.
- Support lock extension during payment.
- Release acquired locks on failed multi-resource reservation.
- Avoid infinite renewal.

### Failure Recovery

- Sweeper for stale DB reservation rows if write-through reservation state is used.
- Refund/compensation workflow if payment succeeds but final booking fails.
- Reconciliation job between payments, bookings, resources, and reservation state.
- DLQ for failed payment webhook events.
- Audit log for resource state transitions.

### Read Scaling

- Read-through cache for stable metadata.
- TTL split by data volatility.
- Cache tags or targeted invalidation.
- Cache stampede protection.
- Negative caching for missing resources with short TTL.
- Circuit breaker/fallback when cache is down.
- Keep volatile availability separate from long-lived metadata cache.

### Search

- CDC or outbox pipeline into search index.
- Index lag monitoring.
- Reindex/backfill tooling.
- Query timeout and result pagination.
- Query cache only for non-personalized results.
- Canonicalized cache keys for search parameters.

### Waiting Room

- Queue position stored server-side.
- Admission token/set with TTL.
- Booking Service validates admission.
- Session reconnect handling.
- Bot/rate-limit protection.
- Clear user feedback on queue position and estimated wait.
- Dequeue based on downstream capacity, not just time.

### Observability

- Reservation attempts, lock success/failure, checkout timeout, payment success, finalization failure, and refund count.
- Redis lock latency and error rate.
- DB contention, transaction retries, and OCC conflicts.
- Cache hit rate, stale reads, and cache invalidations.
- Search latency, index lag, and query cache hit rate.
- Waiting room queue length, dequeue rate, admission rejection, and wait-time accuracy.

### Timeouts And Backpressure

- Timeouts on Redis, DB, payment provider, search, and cache calls.
- Backpressure on booking service.
- Rate limiting on reservation attempts.
- Queue admission throttling based on downstream capacity.

## Common Failure Modes

| Failure Mode | Why It Happens | Mitigation |
|---|---|---|
| Double booking | Final write is not atomic | DB conditional update, OCC, row lock, unique constraint |
| Inventory stuck unavailable | Reservation cleanup fails | TTL-based holds; sweeper only as hygiene, not correctness |
| Hold expires during payment | Payment takes longer than reservation TTL | Extend lock on payment start; final DB check; automatic refund |
| Redis outage | Reservation store unavailable | Degrade UX; still enforce correctness with DB final transaction |
| Partial multi-seat hold | Some locks acquired, later lock fails | Release acquired locks; use deterministic order or atomic script |
| Stale seat map | Availability cached too long | Separate static metadata from volatile availability |
| Cache stampede | Hot key expires under heavy traffic | Request coalescing, soft TTL, prewarming |
| Search index stale | CDC lag or indexing failure | Monitor lag, replay CDC, fallback for critical paths |
| Duplicate webhook processing | Payment provider retries | Idempotency key and state-machine checks |
| Queue bypass | Client accesses booking endpoint directly | Server-side admission check with TTL token/set |
| Queue unfairness | Reconnects, multiple sessions, bots | Stable user/session identity, bot mitigation, rate limits |
| CDN serves wrong search result | Personalized query cached globally | Only edge-cache non-personalized queries; vary cache key |
| Overloaded booking service | Too many users admitted | Dequeue based on capacity and observed saturation |
| Refund storm | TTL too short or payment latency high | Tune TTL, extend lock during payment, monitor finalization failure |

## Clarifying Questions

Ask the few questions that materially affect the design:

1. What is the scarce resource, and what invariant must never be violated?
2. Is temporary reservation required, or can users directly purchase?
3. What is the expected checkout duration?
4. What is the acceptable reservation TTL?
5. Can a user reserve multiple resources in one transaction?
6. What happens if one resource in a group reservation fails?
7. What is the source of truth for final ownership?
8. Is the read availability view allowed to be stale?
9. How often does metadata change versus availability?
10. What is the read/write ratio?
11. What is expected peak traffic for one hot item/resource group?
12. Should extreme launches use a waiting room?
13. How is admission enforced server-side?
14. Are search results personalized?
15. Is fuzzy search, ranking, faceting, or typo tolerance required?
16. How will the search index stay synchronized?
17. What is the recovery plan for failed payment callbacks?
18. What happens if payment succeeds but booking finalization fails?
19. What metrics reveal contention before users complain?
20. How does the system degrade if Redis, cache, search, queue, or payment provider is unavailable?

## Reusable Agent Instructions

- Start by separating read/search flows from booking/claim flows.
- Optimize read/search for availability and latency.
- Optimize booking for correctness and atomic final state.
- Do not use long-running database transactions for user checkout.
- Use TTL-based reservations for temporary holds.
- Use Redis locks only as a reservation/UX layer, not as the only correctness layer.
- Always enforce final booking with a database transaction and concurrency control.
- Make payment callbacks idempotent.
- Treat reservation expiration during payment as a first-class failure mode.
- Add compensation/refund logic for paid-but-not-booked outcomes.
- For high-demand launches, consider admission control before real-time UI updates.
- Enforce queue admission at the server, not only in the client.
- Cache stable metadata aggressively.
- Keep volatile availability separate or short-lived.
- Use specialized search infrastructure only when SQL indexing no longer fits.
- Sync search indexes through CDC/outbox and monitor lag.
- Add observability for locks, booking conflicts, cache hit rate, search latency, queue wait time, and payment finalization failures.

## Condensed Memory

For scarce-resource booking systems, split the architecture into availability-optimized read/search paths and consistency-optimized booking paths. Use aggressive caching for stable metadata, but keep volatile availability short-lived or overlaid from reservation state. Avoid long-running DB locks during checkout; use TTL-based reservations, commonly Redis `SET NX EX`, with user/session/booking ID as lock value. Redis improves UX but must not be the final correctness mechanism: final booking must be enforced by a short DB transaction using OCC, row locks, conditional updates, or unique constraints. Payment callbacks must be idempotent, and payment-success/final-booking-failure needs compensation/refund. For extreme demand, prefer a virtual waiting room with server-side admission enforcement over pushing real-time updates to everyone. For search, move from SQL indexes to DB full-text search or Elasticsearch/OpenSearch when fuzzy matching, ranking, faceting, or high QPS require it; sync via CDC/outbox and monitor index lag. Core guardrails: idempotency, TTLs, retries, lock release, DB finalization, cache invalidation, queue admission checks, payment reconciliation, DLQs, observability, and graceful degradation.
