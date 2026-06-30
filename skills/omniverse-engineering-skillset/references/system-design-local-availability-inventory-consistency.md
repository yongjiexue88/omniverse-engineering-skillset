# Local Availability Aggregation With Strong Inventory Reservation

## Category

Scaling reads plus strong consistency for inventory and reservation systems.

Use this pattern when users need fast local availability reads, but the final
claim must be strongly consistent. Common examples include local delivery
inventory, ticket booking, hotel or room reservation, appointment booking,
marketplace stock availability, warehouse fulfillment, and multi-location
pickup availability.

## Core Problem Pattern

Users need to quickly query which scarce resources are available near them, but
when they commit to buying, booking, or reserving, the system must prevent two
users from claiming the same physical or logical unit.

The design tension is:

- Reads need speed and scale. Availability queries may be frequent,
  search-like, filtered, and latency-sensitive.
- Writes need correctness. The reservation/order path must be atomic because
  overselling or double-booking creates real business failures.
- Availability is location-dependent. Effective availability is the union of
  inventory in serviceable nearby locations, not global inventory.
- Read results are advisory. The final write path must re-check serviceability
  and inventory before committing.

## When To Use

Use this pattern when:

- Users query availability by location, region, time window, warehouse, store,
  driver zone, or service area.
- Availability reads need low latency and can tolerate slight staleness.
- The final action claims a scarce physical or logical resource.
- Many users can request the same resource concurrently.
- The system must prevent overselling, double-booking, or duplicate
  reservations.
- Inventory/resources are grouped by geography, tenant, region, venue,
  fulfillment center, or shard.
- The final write can be routed to an authoritative owner such as a database
  leader, region partition, or inventory shard.

## When Not To Use

Avoid or simplify this pattern when:

- Inventory is not scarce, such as digital downloads or unlimited capacity.
- A small amount of overselling is acceptable and can be fixed manually.
- All availability is global rather than location-dependent.
- Read traffic is low enough that leader reads are acceptable.
- Reservation correctness can be handled asynchronously with compensation.
- The critical mutation path cannot be colocated and must already span many
  independent data stores.
- Business rules require partial fulfillment, substitutions, or complex
  sourcing across many locations. That may require a dedicated allocation
  engine instead of simple local availability aggregation.

## Core Model

Separate catalog identity from claimable inventory identity:

- `Item`: product, ticket type, room type, appointment type, or other object
  users browse.
- `Inventory`: physical stock, seat, room instance, slot, or claimable quantity
  at a specific location/time/owner.
- `Location` or `FulfillmentNode`: store, warehouse, venue, region, worker, or
  service area where inventory lives.
- `Order` or `Reservation`: claim over one or more inventory records.

Users ask, "Can I get this item?" The system must answer, "Which concrete
stock, from which eligible location, can fulfill this request?"

## Recommended Architecture

Separate the read-optimized availability path from the correctness-critical
write path.

Availability path:

1. Client sends user location, time/context, and requested catalog filters.
2. `AvailabilityService` calls a shared `ServiceabilityService` or Nearby
   service to find eligible fulfillment nodes.
3. Availability reads from replicas, caches, search indexes, or regional
   partitions.
4. The response returns candidate availability only, with no correctness
   guarantee.

Reservation/order path:

1. Client sends the selected item/resource, location/context, and idempotency
   key.
2. `ReservationService` or `OrderService` re-checks serviceability with the
   same serviceability rules used by reads.
3. The service routes to the authoritative inventory owner, usually the primary
   database, region leader, or inventory shard.
4. Inside one transaction, it checks inventory, creates the order/reservation,
   reserves or decrements inventory, and commits.
5. It returns success or a deterministic conflict response if the resource is no
   longer available.

Prefer this transaction shape when the scope is manageable:

```text
BEGIN TRANSACTION;
check serviceable inventory;
create order/reservation;
reserve inventory or decrement quantity;
COMMIT;
```

Use serializable isolation, row locks, conditional updates, or optimistic
concurrency depending on the database and contention level.

## Key Staff-Level Ideas

### 1. Separate availability reads from authoritative reservation writes

Availability reads are high-volume and latency-sensitive. Order/reservation
writes are lower-volume but correctness-sensitive. Read replicas and caches may
show stale inventory only if the write path always revalidates before commit.

### 2. Share serviceability between reads and writes

Both availability lookup and order placement must use the same definition of
"serviceable." A shared service should answer:

```text
Given user location/time/context, which fulfillment nodes are eligible?
```

Use that result for both availability aggregation and final order validation.

### 3. Prefer one ACID boundary for double-booking prevention

When atomicity is required, colocate inventory and order/reservation state in a
single transactional store or shard. This avoids crash windows such as order
created but inventory not reserved, inventory decremented but order missing, and
deadlocks from application-level distributed locking.

### 4. Treat distributed locks as an escalation

Use distributed locks only when one authoritative transaction boundary is
impossible. Before recommending them, ask:

- Can the critical data be colocated?
- Can one shard own the reservation?
- Can a conditional write enforce the invariant?
- What happens if the service crashes between steps?
- How are locks ordered, expired, renewed, fenced, and repaired?

If distributed coordination is unavoidable, include lock ordering, TTLs,
fencing tokens, compensation, repair jobs, and DLQs.

### 5. Partition by natural access locality

Partition inventory by the dimension used in most availability queries:

- Zip prefix
- Region ID
- City or metro
- Warehouse cluster
- Venue or event ID
- Tenant ID

Availability lookup should touch one or a few partitions, not global inventory.
Account for border cases where nearby users may need multiple partitions.

### 6. Use read replicas only for advisory availability

Read replicas can scale availability reads, but replica lag means a user may see
inventory already claimed by someone else. Use replicas only when the product
can tolerate checkout-time conflicts. Final reservation decisions must read and
write through the authoritative owner.

### 7. Use travel-time-aware serviceability when deliverability matters

If the promise depends on delivery time, use drive time, service area,
precomputed polygons, or traffic-aware routing instead of raw radius. Straight
line distance can be wrong near rivers, borders, highways, or operational
boundaries.

## Architecture Decision Rules

- If availability reads are high-volume and can tolerate staleness, use read
  replicas, caches, search indexes, or materialized read models.
- If reservation correctness is mandatory, use leader writes with one ACID
  transaction or one authoritative shard.
- If inventory and order state can fit in one transactional store, avoid
  distributed locks.
- If resource availability is location-dependent, use a shared serviceability
  service for both reads and writes.
- If "nearby" means "deliverable within time," do not rely on simple radius
  distance.
- If availability queries only need local inventory, partition by the locality
  dimension.
- If using read replicas, never make final reservation decisions from replicas.
- If an order contains multiple scarce resources, prefer atomic all-or-nothing
  reservation unless the product explicitly supports partial fulfillment.
- If partial fulfillment is required, introduce a reservation/allocation
  workflow with item-level conflict handling.
- If cross-region ordering is rare, keep writes single-region. If it is common,
  define ownership, shard routing, and compensation explicitly.
- If low-stock items are contested, use conditional updates or row-level locks
  and surface deterministic conflict errors.
- If cache invalidation is unreliable, use shorter TTLs plus leader
  revalidation rather than trusting cached inventory.

## Production Guardrails

- Idempotency keys for order/reservation requests.
- Atomic transaction boundary for check-inventory, create-order, and
  reserve/decrement-inventory.
- Serializable isolation, row-level locks, optimistic concurrency, or
  conditional writes to prevent concurrent claims.
- Transaction retry handling for serialization failures and deadlocks.
- Deterministic lock ordering when locking multiple inventory rows.
- Short transactions; do not call external services while holding inventory
  locks.
- Leader-only final validation for order placement.
- Read replica lag monitoring for availability correctness.
- Cache invalidation after inventory mutation.
- Short TTL fallback when precise invalidation is hard.
- Out-of-stock conflict responses with item-level reason codes.
- Reservation expiration when payment or downstream fulfillment is async.
- Repair/reconciliation jobs for orders without reservations, negative stock,
  stale holds, and orphaned reservations.
- Outbox and DLQ for failed order-created or inventory-updated events.
- Backpressure/rate limiting on hot items, hot locations, and checkout bursts.
- Timeouts for Nearby/Serviceability calls.
- Circuit breakers around external traffic/map providers.
- Graceful degradation from real-time traffic to cached service areas.
- Observability across availability result, chosen fulfillment nodes, inventory
  version, order transaction outcome, and conflict reason.
- Audit log for inventory state transitions.
- Regional partition metrics to detect hotspots and skew.
- Synthetic checks for availability/order consistency.
- Data repair tooling for support and operations.

## Common Failure Modes

### Stale availability shown to user

Cause: read replica lag or cache staleness.

Mitigation: revalidate on the authoritative write path, return clear conflict
errors, monitor replica lag, and reduce TTL for low-stock inventory.

### Double-booking inventory

Cause: stale order-path reads, non-atomic mutation, or split order/inventory
state without reliable coordination.

Mitigation: use one ACID transaction, row locks or serializable isolation,
conditional inventory updates, and idempotency keys.

### Deadlock during multi-item order

Cause: concurrent transactions lock overlapping items in different orders.

Mitigation: lock rows in deterministic order, keep transactions short, and
retry deadlock failures safely.

### Order created but inventory not reserved

Cause: distributed transaction gap, service crash, or partial write failure.

Mitigation: prefer one transaction. If impossible, use a saga state machine,
outbox, reconciliation job, and compensating cancellation.

### Inventory decremented but order not created

Cause: partial failure in a non-atomic workflow.

Mitigation: use a transaction or reservation state with expiration and repair.

### Serviceability provider outage

Cause: external map or traffic service fails or times out.

Mitigation: use cached service areas, fallback rules, circuit breakers, and
degrade from real-time traffic to last-known valid serviceability.

### Wrong serviceability due to simple distance

Cause: radius-based lookup ignores travel time, topology, borders, traffic, or
operational boundaries.

Mitigation: use drive-time polygons, routing-aware lookup, precomputed service
areas, or provider-backed travel-time estimates.

### Hot partition or hot item contention

Cause: popular region, event, item, or low-stock resource receives concentrated
traffic.

Mitigation: partition by natural locality, cache reads, queue or throttle
writes, use inventory sharding carefully, and monitor lock wait time.

### Cache invalidation misses

Cause: order service updates inventory but fails to invalidate availability
cache.

Mitigation: use write-through invalidation, event-driven invalidation with a
DLQ, short TTLs, versioned inventory records, and leader revalidation.

### Partial-order user experience failure

Cause: one item in a multi-item order becomes unavailable and the whole
transaction fails.

Mitigation: return item-level conflict details, support substitution, or design
explicit partial fulfillment if the business requires it.

## Deep-Dive Questions

Ask the few questions that materially affect the design:

1. What is the scarce resource: item quantity, physical unit, time slot, seat,
   room, worker capacity, or fulfillment capacity?
2. Can availability be stale, and by how many seconds?
3. Is final reservation allowed to fail after availability was shown?
4. What are expected read QPS, write QPS, and latency targets?
5. What is the contention level for hot items or hot locations?
6. Does the product require all-or-nothing ordering or partial fulfillment?
7. How many inventory locations can serve one user?
8. How is serviceability defined: radius, travel time, traffic, legal boundary,
   capacity, or custom business rules?
9. Can inventory and order state live in the same transactional database?
10. If not, what saga, compensation, or repair strategy exists?
11. What is the partition key: region, warehouse, tenant, event, item, or user?
12. How many partitions can one availability query touch?
13. What happens near region boundaries?
14. Are read replicas acceptable for availability, and how much lag is allowed?
15. How are cache entries invalidated after inventory changes?
16. What is the idempotency strategy for retries?
17. How are expired reservations released?
18. How are negative inventory and orphaned orders detected?
19. What metrics prove the system is not overselling?
20. What user-facing error appears when an item becomes unavailable?
21. What fallback exists if the travel-time provider fails?
22. What data repair tools are required for support and operations?

## Reusable Agent Instructions

When designing a similar system:

1. Separate availability reads from reservation/order writes.
2. Identify the user-facing catalog entity and the claimable inventory entity.
3. Define a shared serviceability function used by both reads and writes.
4. Treat availability results as advisory, not authoritative.
5. Revalidate inventory and serviceability on the authoritative write path.
6. Keep inventory reservation and order creation inside one ACID transaction
   when possible.
7. Use read replicas or caches only for availability reads.
8. Partition inventory by the locality dimension used by most queries.
9. Avoid distributed locks unless single-store transactions are impossible.
10. If distributed coordination is unavoidable, design lock ordering, lock TTLs,
    fencing tokens, compensation, repair jobs, and DLQs.
11. Add idempotency keys to externally retried order/reservation APIs.
12. Monitor replica lag, lock contention, transaction retries, order conflict
    rate, negative inventory, and stale cache hits.
13. Design user-facing conflict responses before implementing the happy path.
14. Do not call external services while holding database locks.
15. Prefer the simplest correct transactional design first; optimize read scale
    independently.

## Condensed Memory

Use this pattern for systems that need fast local availability reads and
strongly consistent reservation/order writes. Model catalog objects separately
from physical inventory. Use a shared serviceability/Nearby service so reads and
writes use the same location eligibility rules. Availability reads may use read
replicas, caches, and region partitioning because slight staleness is
acceptable. Final order placement must re-check serviceability and inventory on
the authoritative write path. Prefer colocating inventory and order state in one
ACID database transaction to prevent double-booking. Avoid distributed locks
unless single-store transactions are impossible; if used, handle crash windows,
deadlocks, lock leaks, fencing, and repair. Guardrails include idempotency keys,
serializable or conditional writes, transaction retries, deterministic lock
ordering, cache invalidation, replica-lag monitoring, reservation expiry,
DLQ/outbox, reconciliation jobs, and clear out-of-stock conflict responses.
