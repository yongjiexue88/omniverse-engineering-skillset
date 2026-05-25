# System Design Real-Time Dispatch And Provider Matching

## Purpose

Use this reference for systems that match demand with nearby available supply in
real time: ride-hailing, food delivery, courier dispatch, field-service
assignment, warehouse task assignment, on-call routing, marketplace fulfillment,
or similar provider/resource assignment workflows.

## Core Problem Pattern

Continuously track ephemeral provider availability/location, find nearby
candidates quickly, reserve exactly one provider, and run a multi-step
assignment workflow with notifications, accept/decline, timeouts, retries, and
eventual success or failure.

Keep four concerns separate:

- Durable business state: ride/order/task lifecycle, quote, assignment history,
  payment/audit.
- Ephemeral real-time state: provider location, availability, heartbeat,
  pending reservation.
- Matching/ranking: proximity, ETA, eligibility, fairness, score, acceptance
  likelihood.
- Durable workflow: offer, wait, timeout, release, try next candidate, fail.

## When To Use

Use this when:

- Requests must be matched to nearby available workers, devices, or resources.
- Provider location/status changes frequently.
- Matching latency is measured in seconds or less.
- One provider must not be assigned multiple active requests.
- Providers can accept, decline, ignore, timeout, or disconnect.
- Workflows must survive service restarts and queue delays.
- Demand can concentrate in one geographic area.

Avoid this pattern when matching is offline, location is irrelevant, double
assignment is acceptable, response/acceptance is not required, or one
synchronous database transaction is enough.

## Default Architecture

```text
Provider app heartbeat/location
  -> location ingestion
  -> ephemeral geo index with TTL
  -> optional async location history stream

Rider/user request
  -> durable ride/order row
  -> dispatch workflow
  -> geo search fresh available providers
  -> rank bounded candidate set
  -> atomic provider reservation/lease
  -> send offer
  -> accept/decline/timeout signal
  -> accepted, try next, cancelled, or failed_no_provider
```

State machine example:

```text
REQUESTED -> OFFERING -> ACCEPTED -> PICKUP -> IN_PROGRESS -> COMPLETED
                        -> DECLINED/TIMED_OUT -> OFFERING_NEXT
                        -> FAILED_NO_PROVIDER
                        -> CANCELLED
```

## Design Rules

### Separate Ephemeral Location From Durable State

Do not write every location update to the primary transactional database. Use
Redis GEO, geohash, S2, H3, quadtrees, or a specialized geospatial index for
current active providers. Store only sampled/audit location history
asynchronously if needed.

### Keep Only Fresh Available Providers In The Hot Index

Location freshness is a correctness constraint. Store
`last_location_update_at`, use TTLs, and filter stale heartbeats before offering
work.

### Use Bounded Geo Search And Ranking

Search a nearby radius/cell first, expand within limits, rank a bounded set by
ETA/score/eligibility, and stop once accepted or exhausted. Do not solve global
optimal matching synchronously when user latency matters.

### Reserve Before Offering

Candidate selection does not guarantee availability. Acquire a provider-level
reservation/lease before sending an offer:

```text
provider:{provider_id}:reservation = { request_id, offer_id, expires_at }
```

Use atomic compare-and-set or equivalent. Release on decline, timeout,
cancellation, or workflow completion.

### Treat Dispatch As A Durable Workflow

Matching is complete only when a provider accepts or the workflow reaches a
terminal failure. Use a persisted state machine, delay queues, or a workflow
engine such as Temporal/Step Functions when dropped assignments are
unacceptable.

### Make Timeout Handling Idempotent

Timeouts can race with accepts. When a timeout fires, check the current ride
state, offer ID, and reservation owner before releasing or trying the next
provider.

### Do Not Trust Client Business Facts

Clients can send intent and coordinates, but identity, timestamps, fare/quote,
permissions, and provider ownership should come from authenticated server-side
state.

## Architecture Decision Rules

- If location updates are high-frequency, store current state in an ephemeral
  geo index because the primary DB will be overwhelmed.
- If location history is required, write it asynchronously because hot-path
  matching should stay fast.
- If nearby lookup is required, use a geo index because raw lat/lon scans do not
  scale.
- If double booking must be prevented, use atomic provider reservation/lease.
- If providers can ignore offers, use timeout-driven reassignment.
- If service crashes must not drop requests, use durable queues/workflows.
- If workflow complexity is small, delay queues can be enough; if business
  impact is high, prefer durable workflow orchestration.
- If demand is geographically concentrated, partition by geo cell/region and
  apply backpressure/spillover.
- If global optimal matching is too slow, use bounded local candidate ranking.
- If Redis/geo state is lost, rebuild from provider heartbeats or fallback state
  because ephemeral state is not audit truth.

## Production Guardrails

Idempotency:

- Ride/order creation by client request ID.
- Accept/decline by `(request_id, provider_id, offer_id)`.
- Timeout handler by `(workflow_id, offer_attempt)`.
- Provider notifications by `offer_id`.

Atomicity:

- Provider reservation before offer.
- Atomic transition from `OFFERING` to `ACCEPTED`.
- Compare current state before timeout, decline, reassignment, or cancellation.

Timeouts and leases:

- Offer response timeout, provider heartbeat timeout, total matching timeout.
- Reservation TTL, renewal when pending, release on terminal paths.
- Cleanup expired/stuck reservations.

Backpressure:

- Queue requests during peak demand.
- Limit matching attempts and radius expansion.
- Cap candidate count and fail explicitly within SLA.
- Use surge/failure response when supply is exhausted.

Observability:

- Location update rate, geo index latency, geo search latency.
- Stale provider count, reservation conflict rate, double-book prevention count.
- Time to first offer, time to match, accept/decline/timeout rates.
- Queue depth by geo cell, no-provider failure rate, stuck workflows.

Repair:

- Reconcile ride state with provider reservation state.
- Release expired provider locks.
- Rebuild geo index from fresh heartbeats.
- Detect rides stuck in `OFFERING` and providers marked available while
  assigned.

## Common Failure Modes

| Failure Mode | Cause | Mitigation |
|---|---|---|
| Provider double-booked | No atomic reservation | Provider-level lock/lease |
| Ride waits forever | Missing timeout/retry | Durable workflow or delay queue |
| Timeout reassigns accepted ride | Timeout races with accept | Idempotent state check by offer ID |
| Stale nearby provider | Old heartbeat/location | TTL and freshness filter |
| Primary DB overwhelmed | Every location update written durably | Ephemeral geo store + async history |
| Geo hotspot | Peak requests in one area | Geo sharding, backpressure, spillover |
| Dropped request | Service crash mid-dispatch | Durable request row and workflow |
| Duplicate ride | Client retry after timeout | Idempotency key |
| Accept after lease expiry | Slow network/client | Validate offer ID and reservation ownership |
| Fare manipulation | Client sends fare estimate | Fetch quote server-side |

## Clarifying Questions

- What is the matching SLA and acceptable time to fail?
- How often do providers send location updates?
- How many active providers and requests exist at peak?
- Are peak requests geographically concentrated?
- How stale can provider location be?
- What search radius starts matching, and how far can it expand?
- Are offers sequential or parallel/batched?
- How long does a provider have to accept?
- Can providers receive multiple pending offers?
- What happens if a provider accepts after timeout or rider cancels mid-match?
- Is greedy local matching acceptable, or is global optimization required?
- How should maps/ETA failures degrade?
- Is location history needed for compliance, support, or fraud?

## Reusable Agent Instructions

- Separate durable order/ride state from ephemeral location/availability state.
- Use a geospatial index for nearby fresh available providers.
- Apply TTLs and heartbeat freshness filters.
- Rank a bounded candidate set; avoid synchronous global optimization unless
  required.
- Reserve providers atomically before offers.
- Model dispatch as a state machine or durable workflow.
- Use timeout, retry, and lease cleanup paths.
- Make accept, decline, timeout, cancel, and retry handlers idempotent.
- Validate every transition against current state and offer ID.
- Do not trust client identity, timestamps, or prices.
- Add geo partitioning, backpressure, repair jobs, and explicit no-provider
  failure behavior.
