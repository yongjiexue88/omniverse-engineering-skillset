# System Design Distributed Rate Limiter

## Purpose

Use this reference for systems that control request volume, prevent abuse,
protect downstream services, and enforce fair usage across users, IPs, API
keys, tenants, endpoints, or global traffic. The system decides whether each
incoming request should be allowed before expensive backend work begins.

This is a specialized case under Contention and Coordination, Scaling Writes,
Edge Traffic Protection, and Distributed Counters. Use it with
`system-design-pattern-recognition-playbook.md` and
`system-design-architecture-decision-playbook.md` when a design involves API
quotas, gateway throttling, HTTP 429, token buckets, sliding windows, Redis
counters, fail-open/fail-closed behavior, or overload protection.

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

The system must decide whether each incoming request should be allowed before it
reaches expensive backend services, while enforcing configurable limits across
many distributed gateway/application nodes with minimal latency and acceptable
consistency.

The tension:

- Correctness: limits should be globally meaningful.
- Latency: every request needs a check.
- Availability: the limiter must not become a single point of failure.
- Scalability: every request may update shared state.
- Fairness: multiple rules may apply and the strictest should win.

## When To Use

Use this pattern when:

- APIs need protection from abuse, bots, scrapers, or runaway clients.
- Backend systems need protection from spikes.
- Product rules require per-user, per-IP, per-API-key, per-tenant, endpoint, or
  global quotas.
- Excess traffic should receive HTTP 429 and useful retry headers.
- Many gateway/app nodes need a shared limit view.
- Some enforcement lag or approximation is acceptable.
- Availability is more important than perfect global consistency.
- Traffic should be shaped at the edge before app servers spend CPU, DB
  connections, or downstream calls.

## When Not To Use

Avoid or simplify this pattern when:

- There is one server and approximate in-memory limits are enough.
- Traffic is low and database-backed counters are acceptable.
- Limits are advisory and do not need central enforcement.
- Strong consistency across all nodes is required for every request.
- Every request needs deep business evaluation only the service can know.
- The hot path cannot tolerate Redis/cache dependency or any external state
  check.
- Quotas are long-term billing/accounting limits rather than request-level
  admission control; use durable usage metering for that.

## Default Architecture

Prefer edge/gateway enforcement when request context is enough:

```text
Client request
  -> Edge/API gateway
  -> Identify client: user, IP, API key, tenant, endpoint
  -> Load locally cached rule config
  -> Atomic Redis token bucket/sliding-window check
  -> Allow request to backend OR return 429 with headers

Rule config service
  -> Versioned rules
  -> Gateways cache with TTL/watch
  -> Canary rollout and rollback

Limiter state
  -> Redis/low-latency KV
  -> Sharded by rule_id + client_key
  -> TTL inactive buckets
```

Use service-level enforcement only when required context is unavailable at the
gateway.

## Core Design Rules

### 1. Put request-level limits at the edge when possible

Blocked requests should not reach application servers. Edge enforcement protects
backend CPU, connection pools, databases, and downstream dependencies.

Gateway context usually includes:

- IP.
- Headers.
- URL/path.
- API key.
- JWT claims.
- Query parameters.

Move rate limiting into services when the decision depends on internal business
state unavailable at the gateway.

### 2. Avoid per-instance counters for authoritative global limits

Local counters inside each gateway/app node enforce per-node limits, not global
limits, unless routing is sticky and carefully bounded.

Use local limits only as:

- Approximate prefilter.
- Emergency fallback.
- Single-node/simple deployment mechanism.

Use shared state for authoritative distributed enforcement.

### 3. Layer multiple rules and apply the most restrictive

A request may be subject to:

- User limit.
- IP limit.
- API key limit.
- Tenant limit.
- Endpoint limit.
- Global system capacity limit.

Model rules explicitly:

- `rule_id`
- scope/key template
- limit/window/refill rate
- burst capacity
- priority
- failure policy
- response headers

Return the decision from the blocking rule or the rule with lowest remaining
budget.

### 4. Choose algorithm by burst tolerance, accuracy, and memory

Common algorithms:

- Fixed window: simple, low memory, allows boundary bursts.
- Sliding window log: exact rolling window, memory-heavy.
- Sliding window counter: low-memory approximation, smoother than fixed window.
- Token bucket: burst capacity plus steady refill, practical API default.
- Leaky bucket: smooths egress rate, useful for shaping.

Default to token bucket for API request limiting unless exact rolling-window
fairness is required.

### 5. Use token bucket as the practical default

Token bucket state:

```text
rate:{rule_id}:{client_key} -> tokens, last_refill_ms
```

Each request:

1. Compute refill based on elapsed time.
2. Cap tokens at burst capacity.
3. Consume one token if available.
4. Store updated token count and timestamp.
5. Return allow/deny, remaining tokens, reset estimate.

This supports natural bursts while enforcing long-term rate.

### 6. Store shared state in Redis or equivalent low-latency storage

Gateway nodes need shared mutable state with low latency. Redis works well for
short-lived counters/buckets.

Guardrails:

- TTL inactive keys.
- Keep rule config separate and locally cached.
- Set short timeouts.
- Shard at high RPS.
- Define fallback policy before production.

### 7. Make check-and-update atomic

Rate-limit checks are read-modify-write operations. Separate GET/SET can
over-allow under concurrency.

Use:

- Redis Lua script.
- Redis transaction where appropriate.
- Atomic counters when algorithm permits.

The atomic operation should refill, consume, update TTL, and return decision in
one step.

### 8. Shard Redis by stable limiter key

At high throughput, rate limiting is a write-scaling problem. Shard by:

```text
hash(rule_id + client_key)
```

This works for per-client rules. Global rules are naturally hot and need a
separate design.

### 9. Handle hot keys explicitly

Hot keys include:

- Global limits.
- Large NATed IPs.
- High-volume tenants.
- Celebrity users.
- Abusive clients.

Strategies:

- Local gateway prefilters.
- Hierarchical limits.
- Per-shard partial counters.
- Per-gateway token leasing for global budgets.
- Emergency shedding.
- Approximate aggregation when exactness is not required.

### 10. Decide fail-open versus fail-closed per rule

If limiter state is unavailable:

- Fail-open preserves availability but may overload backends.
- Fail-closed protects downstream systems but can reject legitimate traffic.

Choose by endpoint/rule:

- Fail-open for low-risk availability-sensitive reads.
- Fail-closed for expensive writes, payment/security-sensitive actions, abuse
  controls, and backend-protection limits.
- Prefer degraded local budgets over binary open/closed where possible.

## Architecture Decision Rules

- If request context is enough, enforce at API gateway/load balancer.
- If deep business context is needed, enforce in the service.
- If multiple nodes receive traffic, avoid pure in-memory counters.
- If exact rolling-window fairness is required, use sliding window log.
- If low memory and approximate fairness are acceptable, use sliding window
  counter.
- If bursty API traffic is expected, use token bucket.
- If clients must never exceed quota exactly, avoid eventually consistent
  distributed counters.
- If RPS is high, shard Redis limiter state.
- If a rule creates a hot global key, use hierarchical budgets or token leasing.
- If Redis is unavailable during overload, avoid naive fail-open for protective
  rules.
- If rejecting legitimate traffic is worse than temporary overuse, fail-open
  with local emergency limits.
- If uncontrolled access is worse than downtime, fail-closed.
- If rule config changes frequently, cache configs locally with versioning.
- If clients need retry behavior, return 429 plus rate-limit headers.

## Production Guardrails

Atomicity:

- Use Redis Lua or transactions for refill + consume + TTL update.
- Avoid GET/SET races.
- Use trusted time or handle gateway clock skew carefully.

Timeouts and fallback:

- Set very short Redis timeouts.
- Do not let limiter dependency stall all APIs.
- Configure fail-open/fail-closed per rule.
- Add local fallback budgets for degraded mode.
- Add circuit breakers when Redis is slow.
- Use emergency static limits during outages.

Redis HA and sharding:

- Use Redis Cluster or managed HA.
- Monitor failover duration.
- Account for replica lag.
- Shard by stable limiter key.
- Keep one rule/client operation on one shard.
- Plan for rebalancing and key migration.

Hot-key protection:

- Identify hot global/tenant/IP keys.
- Use hierarchical budgets.
- Use local gateway prefilters.
- Use per-gateway token leasing for global limits.
- Alert on shard imbalance.

Memory management:

- TTL inactive buckets.
- Bound sliding logs.
- Avoid per-request timestamps unless required.
- Track memory and eviction rate.

Rule config:

- Store rules in central config service.
- Version rules.
- Cache rules locally.
- Roll out gradually.
- Include rule version in logs and metrics.

Response semantics:

- Return HTTP 429 for blocked requests.
- Include `Retry-After` when possible.
- Include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and
  `X-RateLimit-Reset` when useful.
- Avoid leaking sensitive rule internals.

Observability:

- Allowed/blocked count by rule.
- Redis latency and timeout rate.
- Fallback mode activations.
- Fail-open/fail-closed counts.
- Hot keys and shard imbalance.
- 429 rates by identity/endpoint.
- Rule version adoption.
- Token bucket remaining distribution.
- Backend error correlation during limiter degradation.

## Common Failure Modes

| Failure Mode | Cause | Mitigation |
|---|---|---|
| Limits bypassed across servers | Per-node counters only | Shared state or bounded sticky routing |
| Boundary burst | Fixed window reset edge | Token bucket or sliding window counter |
| Redis bottleneck | Every request hits one Redis instance | Shard by limiter key |
| Hot global counter | One global key | Hierarchical limits or token leasing |
| Over-allow under concurrency | Non-atomic read/write | Lua script or transaction |
| API latency spike | Redis slow on hot path | Short timeout, fallback, circuit breaker |
| Backend cascade | Fail-open during overload | Fail-closed for protective rules or local limits |
| Legitimate outage | Fail-closed too broadly | Per-rule policy and degraded budgets |
| Memory explosion | Sliding log stores timestamps | Token bucket/sliding counter and TTLs |
| NAT unfairness | Many users share IP | Prefer user/API key when available |
| IP rotation bypass | IP-only limits | Layer user/API-key/device/fingerprint limits |
| Bad config rollout | Rule pushed globally | Versioning, canary, rollback |
| Missing client guidance | 429 lacks reset headers | Return standard headers |
| Redis failover gap | Primary failure/promotion delay | HA setup, fallback policy, monitoring |

## Clarifying Questions

Ask:

1. What is request rate: average, peak, p95, and burst size?
2. What latency overhead is acceptable per request?
3. Are users authenticated?
4. Limits by user, IP, API key, tenant, endpoint, or global?
5. Are anonymous and authenticated users different?
6. Do premium/enterprise users have different quotas?
7. Which endpoints are expensive or abuse-prone?
8. Should reads and writes have different limits?
9. Is exact enforcement required or approximation acceptable?
10. Should bursts be allowed?
11. What happens when limiter store is unavailable?
12. Which endpoints fail-open or fail-closed?
13. How long can degraded mode last?
14. Is Redis acceptable as a hot-path dependency?
15. How many Redis shards are needed?
16. What hot keys are expected?
17. Do global limits need strict enforcement?
18. What headers should clients receive?
19. How are rules configured and rolled out?
20. How will bad rules be rolled back?
21. What metrics prove backend protection?
22. What false block rate is acceptable?

## Reusable Agent Instructions

When designing distributed rate limiting:

1. Identify the protected resource and client identity.
2. Decide per user, IP, API key, tenant, endpoint, global, or layered limits.
3. Prefer API gateway enforcement when request context is enough.
4. Avoid per-node local counters for authoritative global limits.
5. Choose algorithm by burst tolerance, memory, and fairness.
6. Default to token bucket for burst-friendly API limits.
7. Use sliding window counter for smoother low-memory approximation.
8. Use sliding log only for exact rolling-window enforcement.
9. Store shared state in Redis or equivalent low-latency store.
10. Make check-and-update atomic.
11. Set TTLs on inactive limiter keys.
12. Shard Redis by stable limiter key at high RPS.
13. Design global limits separately to avoid hot keys.
14. Define fail-open/fail-closed per rule.
15. Use short timeouts and degraded local fallback budgets.
16. Return 429 with helpful headers.
17. Version rule configs and support canary rollback.
18. Add metrics for block rate, Redis latency, fallback mode, hot keys, and
    backend protection.

## Condensed Memory

Use the Distributed Rate Limiter pattern when APIs need abuse prevention, quota
enforcement, fair usage, or backend overload protection. Prefer enforcing at the
API gateway/load balancer edge so blocked traffic never reaches application
servers. Identify clients from request context: user ID, IP, API key, tenant,
endpoint, and JWT claims. Real systems layer multiple rules and enforce the
most restrictive applicable rule. Avoid per-node in-memory counters for global
limits; use shared low-latency state such as Redis. Default to token bucket for
burst-tolerant API traffic; use sliding window counter for smoother low-memory
approximation; use sliding log only for exactness. Make refill/check/consume
atomic with Lua or transactions. TTL inactive buckets. At high RPS, shard Redis
by stable client/rule key and handle hot keys separately, especially global
limits. Explicitly choose fail-open or fail-closed per rule. Guardrails: short
Redis timeouts, local degraded budgets, circuit breakers, Redis HA, rule
versioning, canary rollout, 429 headers, hot-key monitoring, memory limits, and
observability for allow/block rates, Redis latency, fallback mode, and backend
protection.
