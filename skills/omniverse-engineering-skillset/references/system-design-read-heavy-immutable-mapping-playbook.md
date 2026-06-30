# System Design Read-Heavy Immutable Mapping Playbook

## Purpose

Use this reference for systems that create a compact public key once and then serve massive low-latency lookups for that key. The canonical example is a URL shortener, but the reusable pattern is broader: durable `public_key -> target_value + metadata` mappings where reads greatly outnumber writes.

This is a specialized case under the Scaling Reads pattern. Use it with `system-design-pattern-recognition-playbook.md` and `system-design-architecture-decision-playbook.md` when the design involves short codes, public identifiers, redirect services, token-to-resource lookups, invite links, share links, referral codes, or other mostly immutable key-value mappings.

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

The system must create a durable mapping once, then serve many low-latency lookups for that mapping at massive read scale.

The generic problem:

> How do we create a unique compact key safely, then resolve it quickly and reliably under extremely high read traffic?

The hard parts are:

- Keeping the write path correct, unique, idempotent, and durable.
- Keeping the read path fast, highly available, and cache-friendly.
- Handling hot keys without overloading the database or origin service.
- Respecting expiration, deletion, policy blocks, and target updates despite caches.
- Choosing identifier generation based on uniqueness, compactness, predictability, and abuse risk.
- Avoiding premature sharding when cache offload and capacity math show one database is enough.

The staff-level insight: do not scale read-heavy systems symmetrically. Keep the write path simple and strongly validated; optimize the read path with cache, replication, CDN, or edge execution only where the traffic and latency targets justify it.

## When To Use

Use this pattern when:

- Reads are much more frequent than writes, often 100:1 to 1000:1 or higher.
- Mappings are mostly immutable after creation.
- Lookup latency is user-visible and must be low, such as sub-100 ms redirects.
- The data model is simple: `public_key -> target_value + lifecycle metadata`.
- Availability matters more than strict real-time consistency for most reads.
- The write path needs uniqueness, but write throughput is modest.
- Hot keys are likely, where a small subset of mappings receives a large share of traffic.
- The system can tolerate eventual cache propagation for non-critical metadata.
- Expiration, deletion, or policy changes are occasional but must be respected.

## When Not To Use

Avoid or adjust this pattern when:

- Writes are as frequent as reads.
- Mappings change frequently and cache invalidation becomes the dominant problem.
- Every read must reflect the latest write immediately.
- Public-key enumeration is unacceptable and cannot be mitigated.
- The target value contains sensitive data that should not be discoverable through public IDs.
- The system requires complex query patterns beyond key-based lookup.
- The mapping is not naturally cacheable.
- Regulatory, security, or abuse-prevention requirements dominate the design.
- CDN or edge behavior makes correctness harder than the latency benefit justifies.

## Default Architecture

Use separate creation, lookup, cache, and async side-effect responsibilities:

```text
Create request
  -> API validation and idempotency check
  -> ID generation
  -> Source-of-truth database with unique key constraint
  -> Optional cache warm
  -> Response with public key

Lookup request
  -> CDN/edge cache if justified
  -> Application cache
  -> Source-of-truth database fallback
  -> Redirect or target response
  -> Async analytics/event pipeline
```

Typical service boundaries:

- Create API: validates input, canonicalizes target, enforces idempotency, generates or accepts a key, and persists the mapping.
- Lookup API: resolves keys with a cache-aside path, validates lifecycle state, and returns redirects or target metadata.
- ID allocator: provides atomic counters, allocated ranges, random/hash key generation, or Snowflake-style IDs depending on requirements.
- Cache layer: stores hot mappings and short-lived negative lookups with TTLs aligned to mapping lifecycle.
- Analytics pipeline: records lookup events asynchronously so redirect latency is not coupled to event delivery.
- Abuse controls: rate limits creation and lookup, scans targets, detects enumeration, and applies policy blocks.

## Core Design Rules

### 1. Split write-path correctness from read-path performance

Creation and lookup have different optimization goals.

The write path needs:

- input validation
- canonicalization when deduplication is desired
- uniqueness checks
- idempotency keys
- durable persistence
- abuse and malware checks where public links are exposed

The read path needs:

- low latency
- high availability
- cache-first behavior
- bounded dependency timeouts
- hot-key protection
- clear stale-read rules

Tradeoff: this separation improves scalability but introduces cache consistency and invalidation complexity. When reviewing the design, require explicit write guarantees, read latency targets, cache behavior, and failure behavior when cache or storage is unavailable.

### 2. Use counter plus Base62 when compact collision-free IDs matter

A monotonically allocated integer encoded as Base62 gives compact URL-safe identifiers with no probabilistic collisions. Atomic counters such as Redis `INCR`, database sequences, or allocated ID ranges can provide unique values under concurrent requests.

Use this when:

- collision avoidance matters more than randomness
- keys do not need to be secret
- write throughput is manageable
- simplicity is valued

Tradeoffs:

- Plain sequential IDs are predictable and can be enumerated.
- A single global counter can become a dependency or bottleneck.
- Range allocation, sharded counters, or Snowflake-style IDs add complexity but improve throughput and resilience.

If enumeration risk matters, add reversible obfuscation, such as XOR with a secret, or use a non-sequential generation strategy with uniqueness enforcement.

### 3. Use random or hash identifiers only with collision guardrails

Random or hash-based short codes reduce predictability but do not guarantee uniqueness.

Required guardrails:

- unique database index on the public key
- bounded retry loop, usually 3 to 5 attempts
- collision metrics and alerts
- controlled fallback or error after repeated failure
- enough entropy for the stored mapping count and expected growth

Tradeoff: more entropy means longer codes. Shorter codes increase collision probability and insertion retries.

Never rely on probabilistic uniqueness alone. The database or source-of-truth store must enforce the invariant.

### 4. Choose redirect and cache semantics based on product control

For URL-shortener-style systems, temporary redirects usually preserve more product control than permanent redirects.

Prefer `302` or controlled cache headers when:

- links can expire
- links can be deleted or blocked
- targets can change
- analytics should record future visits
- abuse policy decisions must remain enforceable

Use `301` only when permanent browser caching is acceptable and future control is not required. A permanent redirect can cause browsers to bypass the service, which can break expiration, deletion, policy enforcement, and analytics.

### 5. Cache aggressively, but align TTL with lifecycle rules

Cache entries must not outlive the underlying mapping's validity.

For every cached mapping, define:

- TTL source
- maximum stale-read window
- expiration behavior
- negative-cache TTL
- invalidation mechanism
- behavior after delete, policy block, target update, or expiry

Useful cache patterns:

- Cache-aside lookup: cache first, database fallback, then populate cache.
- Negative caching: briefly cache missing keys to protect the database from repeated invalid lookups.
- Request coalescing: prevent many concurrent misses from rebuilding the same hot key.
- Jittered TTLs: avoid synchronized expiration.
- Stale-while-revalidate: serve known-safe values while refreshing in the background only when product rules allow it.

TTL should be less than or equal to the remaining mapping lifetime. For correctness-sensitive expiration, also store expiration metadata in the cache value and check it at read time.

### 6. Use CDN or edge only when latency and traffic justify the cost

Edge execution can reduce global p95/p99 latency and origin load for hot mappings, but it adds distributed correctness and observability complexity.

Recommend edge only when:

- users are geographically distributed
- latency requirements are strict
- hot-key traffic is high
- invalidation rules are simple
- stale-read tolerance is explicit
- observability covers edge behavior

Avoid aggressive CDN caching when immediate global invalidation is required. Propagation delay can serve stale redirects or blocked mappings.

### 7. Do capacity math before sharding

Large row counts do not automatically require sharding.

Estimate before recommending sharding:

- row size
- total rows
- index size
- write QPS
- read QPS after cache
- growth rate
- retention and expiration volume
- operational limits of the chosen database

For example, 1 billion mappings at roughly 500 bytes each is about 500 GB before indexes and overhead. With low write throughput and high cache hit rate, PostgreSQL, MySQL, DynamoDB, or another primary store can be viable without early sharding.

Sharding adds operational complexity, migration difficulty, query constraints, hot partition risk, and more failure modes. Add it only when capacity math or regional requirements prove it is needed.

## Architecture Decision Rules

- If reads are 100x to 1000x more frequent than writes, prefer a cache-first read path because the database should not serve every lookup.
- If mappings are mostly immutable, prefer long-lived cache entries because invalidation pressure is low.
- If mappings can expire or be deleted, set cache TTL less than or equal to mapping lifetime because stale cache entries can violate product rules.
- If future control, expiration, deletion, policy enforcement, or analytics matters, prefer `302` over `301` because permanent browser caching can bypass the service.
- If generated identifiers must be compact and collision-free, prefer counter plus Base62 because it guarantees uniqueness without collision retries.
- If identifiers must be hard to enumerate, avoid plain sequential counters or add obfuscation and rate limits because attackers can scan adjacent IDs.
- If using random or hash IDs, enforce uniqueness at the database layer because probability is not a correctness guarantee.
- If custom aliases are supported, separate custom and generated namespaces because user-chosen aliases can collide with generated codes.
- If global p99 latency matters, consider CDN or edge lookup because edge execution reduces physical distance and origin load.
- If correctness requires immediate invalidation globally, avoid aggressive CDN caching because propagation delay can serve stale data.
- If write throughput is low and data size fits on one machine, avoid sharding because sharding adds unnecessary operational complexity.
- If hot keys dominate traffic, prefer cache and CDN protection because read replicas alone may still overload origin paths.
- If abuse or security matters, avoid predictable public IDs or add obfuscation, rate limits, and scan detection because enumeration can expose public mappings at scale.

## Production Guardrails

### Key generation and writes

- Add a unique index on the public key or short code.
- Use atomic counters, ID ranges, or durable ID allocation to avoid duplicate IDs.
- Keep bounded retries for probabilistic ID generation.
- Define a fallback path if ID generation repeatedly fails.
- Separate custom aliases from generated keys, or reserve prefixes for generated keys.
- Validate target values before creating mappings.
- Canonicalize equivalent inputs before hashing if deduplication is desired.
- Use idempotency keys for create requests to avoid duplicate mappings from client retries.
- Store lifecycle metadata such as owner, creation time, expiration time, deletion state, policy state, and last target version.

### Lookup and cache

- Use cache-aside lookup: read cache first, fall back to database, then populate cache.
- Keep cache TTL no longer than mapping expiration.
- Use short negative-cache TTLs for not-found keys.
- Invalidate or update cache on delete, expiration, policy block, or target update.
- Store expiration metadata in cache values when stale expiry is unacceptable.
- Use request coalescing and jittered TTLs for hot keys.
- Apply strict timeouts to cache, database, and edge/origin calls.
- If cache fails, fall back to database only within known capacity limits.
- If database fails, serve known-safe cached entries only when product rules allow it.

### Operations, abuse, and analytics

- Rate-limit create and lookup endpoints under abuse or overload.
- Add bot detection, spam and malware scanning, domain blocklists, and scan-pattern detection for public links.
- Track cache hit rate, redirect latency, database latency, collision rate, generation failures, 404/410 rates, invalidation lag, and edge/origin split.
- Keep redirect analytics asynchronous with retries and a dead-letter queue.
- Run repair or replay jobs for async expiration cleanup, analytics events, and projection drift.
- Use periodic cleanup for expired rows, or retain tombstones when keys should not be reused.
- Load-test hot-key traffic, random-key traffic, cache cold start, and regional edge behavior.

## Common Failure Modes

| Failure Mode | Why It Happens | Mitigation |
|---|---|---|
| Duplicate public keys | Non-atomic generation or missing uniqueness constraints | Unique DB index, atomic counter, bounded retries |
| Hot-key overload | One mapping receives massive traffic | CDN, cache replication, request coalescing, rate limits |
| Stale redirects | Cache TTL exceeds mapping expiration or deletion | TTL alignment, invalidation, tombstones, read-time expiry check |
| Browser bypasses service | `301` causes permanent client-side caching | Use `302` when future control matters |
| Cache stampede | Many requests miss cache simultaneously | Request coalescing, jittered TTLs, stale-while-revalidate when safe |
| Enumeration attack | Sequential IDs reveal neighboring mappings | Obfuscate IDs, rate limit, monitor scan patterns |
| Custom alias collision | User alias overlaps generated code | Separate namespaces or reserve generated prefixes |
| Counter bottleneck | Single global counter becomes a critical dependency | Allocate ID ranges, shard counters, or use Snowflake-style IDs |
| Edge inconsistency | CDN nodes have stale or inconsistent state | Short TTLs, purge APIs, versioned records, edge observability |
| Cache cold start | Deployment or eviction sends traffic to the database | Warm popular keys, autoscale read capacity, protect origin with limits |
| Expiration race | Expired mapping remains in cache | Check expiration at read time or encode expiration in cache metadata |
| Analytics loss | Redirect path prioritizes latency and drops side effects | Async event pipeline with retries, DLQ, and replay |

## Clarifying Questions

- What is the expected read/write ratio?
- What are the p50, p95, and p99 latency targets?
- Are mappings immutable after creation?
- Can mappings expire, be deleted, blocked, or updated?
- Is public-key enumeration a security concern?
- Are custom aliases allowed?
- Should the same target value always return the same public key?
- Is deduplication desired, or should each user get independent mappings?
- What is the expected number of total mappings?
- What is the average mapping size?
- What is the daily write volume?
- How many reads are expected per day?
- Are reads globally distributed?
- Are there hot keys?
- Is analytics required on every read?
- Can analytics be eventually consistent?
- Should expired or deleted keys be reusable?
- What is the acceptable stale-read window?
- What happens if cache is down?
- What happens if the database is down?
- What abuse, spam, or malware protections are required?

## Reusable Agent Instructions

When designing this pattern:

1. Identify whether the system is read-heavy, write-heavy, or balanced.
2. Separate write-path correctness from read-path performance.
3. Define the mapping entity and lifecycle metadata.
4. Choose an ID generation strategy based on uniqueness, compactness, predictability, and throughput.
5. Enforce uniqueness in the source-of-truth database.
6. Add bounded retries for probabilistic ID generation.
7. Use cache-aside lookup for high-volume reads.
8. Align cache TTL with expiration and deletion semantics.
9. Choose redirect or response cache behavior based on whether future control is required.
10. Add CDN or edge only after confirming latency, geography, and traffic justify the cost.
11. Avoid sharding until capacity math proves one database is insufficient.
12. Add observability before scaling layers hide failures.
13. Treat custom aliases as a separate namespace or reserve generated prefixes.
14. Design for abuse prevention if public identifiers can be scanned.
15. Document stale-read tolerance and invalidation behavior.

## Condensed Memory

Use this pattern when a system creates a compact public key once and serves massive low-latency lookups many times. Separate write-path correctness from read-path performance. Counter plus Base62 gives compact collision-free keys but is predictable; random or hash IDs reduce predictability but require unique DB constraints, bounded retries, and collision metrics. Prefer `302` when future control, expiration, deletion, policy enforcement, or analytics matters; avoid `301` if browser caching would bypass the service. Cache aggressively, but TTL must be no longer than mapping expiration. Use CDN or edge only when global latency or hot-key traffic justifies the invalidation, observability, and debugging cost. Do capacity math before sharding; if writes are low and data fits in one database, keep storage simple and let cache absorb reads. Production guardrails include unique indexes, idempotent create, cache invalidation, negative caching, TTL alignment, rate limits, observability, retry limits, DLQ for async side effects, and repair jobs.
