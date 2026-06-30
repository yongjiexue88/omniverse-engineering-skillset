# System Design Real-Time Market Data Proxy And Order State

## Purpose

Use this reference for brokerage/trading-style systems, or any system that
proxies expensive external real-time feeds to many clients while managing
user-initiated actions against an external authority.

Examples: stock/crypto apps, live sports with betting, ticketing over external
inventory, auction systems, logistics vendor feeds, IoT/device feeds with user
commands.

## Core Problem Pattern

Proxy high-volume external real-time data to many internal clients efficiently,
while managing user actions that require strong consistency, auditability,
idempotency, and reconciliation with an external source of truth.

Separate two planes:

- Real-time data plane: external feed ingestion, latest-value cache, pub/sub by
  topic, SSE/WebSocket fan-out. Low latency matters; intermediate display ticks
  may be coalesced.
- Transactional control plane: create/cancel/modify orders or commands, external
  authority confirmations, state machine, durable events, audit, reconciliation.
  Correctness matters more than display freshness.

## When To Use

Use this when:

- Many users subscribe to overlapping live external data.
- External feed connections are expensive, limited, or rate-limited.
- Clients need low-latency updates and mostly consume server-to-client data.
- User actions are routed to an external authority.
- User-visible transactional state must be strongly consistent and auditable.
- Polling the external source per client is wasteful.

Avoid this pattern when updates are rare, polling is acceptable, external calls
are cheap, there are few overlapping subscriptions, or the system owns the full
source of truth and does not need external reconciliation.

## Default Architecture

```text
External market/feed provider
  -> feed connector
  -> symbol/topic price processor
  -> latest-value cache
  -> internal pub/sub by symbol/topic
  -> connection service with local subscription sets
  -> SSE/WebSocket clients

Client order action
  -> API auth/authorization/idempotency
  -> order event + current state transaction
  -> external exchange/broker API
  -> async exchange events/feed
  -> state machine transition
  -> user order update stream
  -> reconciliation jobs
```

## Design Rules

### Clarify Authority First

Ask whether the system is an exchange/source of truth or a broker/proxy routing
to an external authority. Store external IDs and treat external confirmations or
events as authoritative when required.

### Do Not Let Every Client Poll The External Feed

Centralize external feed ingestion and fan out internally. Thousands of clients
watching the same symbol should not create thousands of external calls.

### Use Latest-Value Cache For Bootstrap

Keep the latest value per symbol/topic so reconnecting clients get an initial
snapshot before streaming updates.

### Prefer SSE For One-Way Updates

Use SSE when updates are server-to-client and the client does not need frequent
live messages on the same channel. Use WebSockets when bidirectional real-time
interaction is central.

### Use Topic Pub/Sub And Dynamic Subscriptions

Connection servers maintain local `topic -> connections` sets. Subscribe to an
internal topic only while at least one local client is interested. Unsubscribe
when the local set becomes empty.

### Coalesce Display Updates Under Load

For prices/live scores, latest state often matters more than every intermediate
tick. Drop or coalesce excessive display updates when clients cannot keep up.
Do not apply this rule to money/order state changes.

### Treat Orders As A State Machine

Orders are not CRUD rows. Validate transitions, store immutable events, update
current state transactionally, dedupe retries, and reconcile with the external
authority.

Example:

```text
CREATED -> SUBMITTED -> ACCEPTED -> PARTIALLY_FILLED -> FILLED
                         -> REJECTED
ACCEPTED/PARTIALLY_FILLED -> CANCEL_REQUESTED -> CANCELLED
```

### Use Integer Or Fixed-Precision Money

Use integer minor units or fixed-precision decimals for prices, cash, fees, and
quantities. Do not use floating-point arithmetic for financial values.

### Derive Identity From Auth Context

Never trust user ID, account ID, timestamps, or ownership from request bodies
for sensitive actions. Use session/JWT/auth context and verify order ownership.

## Architecture Decision Rules

- If clients only need one-way live updates, prefer SSE because it is simpler
  than WebSockets.
- If clients need bidirectional live messaging, use WebSockets.
- If many clients watch the same external data, proxy the feed internally.
- If update SLA is tight, avoid client polling because polling interval controls
  worst-case latency.
- If external connections are expensive, centralize ingestion and use internal
  pub/sub.
- If updates are keyed by topic/symbol, fan out by topic and active
  subscriptions.
- If an event is latest display state, cache/coalesce it.
- If an event changes user money/order state, persist it durably and never
  silently drop it.
- If create/cancel can be retried, require idempotency keys.
- If external events may be out of order, use sequence numbers/timestamps and
  state transition validation.
- If external calls time out, mark state pending/unknown and reconcile.

## Production Guardrails

Market data:

- Dedicated feed connectors; never expose vendor feed directly to clients.
- Latest-value cache for reconnect/bootstrap.
- SSE/WebSocket heartbeats, reconnect support, auth checks, idle timeouts.
- Subscription cleanup on disconnect.
- Dynamic topic subscribe/unsubscribe.
- Hot topic protection through sharding, coalescing, and backpressure.

Order state:

- Idempotency keys for create/cancel/replace actions.
- Immutable order event log and fast current-state projection.
- Atomic event + state update where possible.
- Internal order ID, external order ID, client order ID, and correlation IDs.
- Duplicate event handling by exchange event ID/order update ID.
- Out-of-order handling with sequence numbers and valid transition checks.
- Pending/unknown state for ambiguous external timeouts.
- Reconciliation jobs against external authority.
- Audit log for user action, request, response, external event, and transition.
- Integer/fixed-precision money values.
- Ownership and authorization checks on every order endpoint.

Observability:

- Price propagation latency, active connections, subscription count per topic.
- Dropped/coalesced display updates and hot topic load.
- Order create/cancel latency, external API errors, pending/unknown orders.
- Reconciliation mismatches, duplicate events, out-of-order events.

## Common Failure Modes

| Failure Mode | Cause | Mitigation |
|---|---|---|
| Excess external API usage | Clients poll provider directly | Central feed connector and internal fan-out |
| Slow updates | Client polling interval too long | SSE/WebSocket push |
| Client overwhelmed by hot topic | Too many ticks | Coalesce latest state, rate-limit, backpressure |
| Irrelevant updates on server | Subscribed to all topics | Dynamic topic subscription |
| Stale reconnect state | No initial snapshot | Bootstrap from latest-value cache |
| Duplicate order | Client retries after timeout | Idempotency key and unique constraint |
| Cancel races with fill | External fill while cancel in flight | State machine and reconciliation |
| Internal state diverges | Missed/late external event | Durable ingestion, replay, reconciliation |
| Stale event corrupts state | Out-of-order feed delivery | Sequence checks and transition validation |
| Money precision bug | Floating point arithmetic | Integer/fixed precision |
| Unauthorized cancel | User ID trusted from body | Auth context and ownership checks |
| Exchange outage | External API unavailable | Circuit breaker, pending/unknown status, retry/reconcile |

## Clarifying Questions

- Are we building an exchange, broker, or market-data viewer?
- Which external system is authoritative for state?
- Does the external system provide sync APIs, async events, or both?
- Do feed events include order IDs, event IDs, and sequence numbers?
- How many symbols/topics exist and how many can one client watch?
- What is the expected update rate and hottest topic rate?
- What latency SLA is required?
- Can clients tolerate dropped intermediate ticks if latest value arrives?
- What order lifecycle states, partial fills, and cancel semantics are required?
- What happens if an external request succeeds but our response times out?
- How are duplicate and out-of-order external events handled?
- What audit/compliance requirements apply?

## Reusable Agent Instructions

- Clarify whether the system is authoritative or routing externally.
- Separate real-time display data from high-consistency transactional state.
- Centralize external feed ingestion and fan out internally.
- Use SSE for one-way updates; WebSockets only for bidirectional live flows.
- Maintain latest-value cache for reconnect/bootstrap.
- Track subscriptions by topic and propagate only to interested clients.
- Coalesce display updates under overload, but never drop order state changes.
- Treat orders/actions as a state machine with immutable events.
- Use idempotency keys, audit logs, external ID mapping, and reconciliation.
- Use integer/fixed-precision money values and derive identity from auth context.
