# System Design Distributed Cache

## Purpose

Use this reference for systems that need a horizontally scalable in-memory
key-value layer with low-latency get/set/delete, TTL, eviction, partitioning,
replication, and high availability. The system should scale beyond one machine
while treating cached data as rebuildable from a source of truth.

This is a specialized case under Scaling Reads, Distributed Caching, Key
Partitioning, and Low-Latency Storage. Use it with
`system-design-pattern-recognition-playbook.md` and
`system-design-architecture-decision-playbook.md` when a design involves
Redis/Memcached-like caches, consistent hashing, virtual nodes, LRU, TTL,
eviction, cache node failure, hot keys, cache stampede protection, or topology
refresh.

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

The system must provide low-latency in-memory key-value access, scale beyond one
node by partitioning keys, handle node changes gracefully, evict under memory
pressure, and maintain acceptable availability despite node failures.

The design tension:

- Latency: cache access should be fast.
- Capacity: data exceeds one node's memory.
- Availability: node failure should not collapse the cache.
- Consistency: eventual consistency is usually acceptable.
- Operability: node joins/leaves, rebalancing, hot keys, and memory pressure
  must be managed.

## When To Use

Use this pattern when:

- A single-node cache cannot handle memory footprint.
- A single-node cache cannot handle throughput.
- Latency target is single-digit milliseconds.
- Cached data can be recomputed/refetched from source of truth.
- Eventual consistency is acceptable.
- Workload is read-heavy or read-latency-sensitive.
- TTL, eviction, and high availability are needed.
- Cache misses are acceptable but should be minimized.
- Durability is not the main requirement.
- Predictable key routing is needed without a central lookup bottleneck.

## When Not To Use

Avoid this pattern when:

- Data must be durable across restarts.
- Strong consistency is required.
- Transactions or complex queries are required.
- Data is small enough for local/single-node cache.
- Cache misses are catastrophic and origin cannot handle them.
- Stale reads are unacceptable.
- Extreme hot keys cannot be replicated, split, or mitigated.
- Operational complexity outweighs performance benefit.

## Default Architecture

Use client/proxy-side routing plus sharded cache nodes:

```text
Client/app
  -> topology map version
  -> consistent hash key to cache node
  -> pooled connection to target node
  -> get/set/delete with TTL

Cache node
  -> local hash map for lookup
  -> doubly linked list or policy structure for eviction
  -> expiry metadata per key
  -> active expiration/janitor

Cluster control plane
  -> membership changes
  -> topology version distribution
  -> virtual node assignment
  -> replication/failover metadata
```

## Core Design Rules

### 1. Separate local cache mechanics from cluster mechanics

Per-node storage needs fast lookup/eviction. Cluster design needs routing,
partitioning, replication, rebalancing, failure handling, and hot-key
mitigation.

A perfect local O(1) cache can still fail if shard balance, topology refresh,
connection management, or hot keys are poor.

### 2. Use hash map plus doubly linked list for local LRU

For O(1) lookup and O(1) access-order updates:

```text
map[key] -> node
node = { key, value, expiry, prev, next }
```

Move node to the head on get/set. Evict from the tail under memory pressure.
Pointer metadata increases memory overhead.

### 3. Combine lazy and active expiration

Lazy expiration on read leaves expired keys in memory if they are never read.
Use:

- Lazy expiration on get.
- Active sampling/janitor cleanup.
- Memory-pressure-triggered cleanup.
- TTL metadata per key.
- Metrics for expired-but-not-deleted backlog.

### 4. Use consistent hashing instead of modulo hashing

`hash(key) % N` remaps many keys when nodes are added/removed. Consistent
hashing minimizes key movement. Add virtual nodes to smooth distribution.

### 5. Avoid central routing in the hot path

Clients or lightweight proxies should compute key ownership from a versioned
topology map. Do not query a central routing service for every request.

Clients should refresh topology periodically and on routing errors.

### 6. Size by storage and throughput

Estimate:

```text
nodes_by_storage = total_cache_data / usable_memory_per_node
nodes_by_qps = peak_qps / sustainable_qps_per_node
required_nodes = max(nodes_by_storage, nodes_by_qps)
                 * replication_factor / utilization_target
```

Validate with benchmarks and realistic value sizes.

### 7. Use replication deliberately

Replication improves availability and hit rate during failure but costs memory,
write bandwidth, and consistency simplicity.

Pick replication factor based on:

- Origin miss cost.
- Desired hit rate during node failure.
- Stale-read tolerance.
- Write amplification budget.

### 8. Treat node failure as cache miss only if origin can survive

Cache data is not source-of-truth data. But if a node failure causes a miss
storm, the origin may fail too.

Protect origin with:

- Request coalescing/singleflight.
- Negative caching.
- Stale-while-revalidate.
- TTL jitter.
- Backpressure and circuit breakers.

### 9. Handle hot keys as first-class risks

One hot key maps to one shard regardless of good distribution. Mitigate with:

- Hot-key detection.
- Hot-key replication.
- Local near-cache for read-only hot values.
- Key splitting for write-heavy counters.
- Request coalescing.
- TTL jitter.
- Application/data-model changes when possible.

### 10. Reduce network overhead

At distributed-cache scale, network overhead dominates local hash-map speed.
Use:

- Persistent connection pools.
- Pipelining/batching for multi-key operations.
- Bounded batch size and wait time.
- Topology-aware clients to avoid extra hops.

## Architecture Decision Rules

- If data fits on one node and throughput is low, use a single-node cache.
- If capacity exceeds one node, shard.
- If nodes can change, use consistent hashing.
- If distribution is uneven, use virtual nodes.
- If availability matters more than memory efficiency, use replication.
- If origin can handle misses, treat node loss as cache miss.
- If origin cannot handle miss storms, add stampede protection.
- If TTL is required, combine lazy expiration and active cleanup.
- If eviction should approximate recent usefulness, use LRU.
- If workload has scan-like access, avoid pure LRU or add admission policy.
- If keys are read-hot, use replication or local near-cache.
- If keys are write-hot, avoid naive replication.
- If multi-key operations span shards, avoid requiring atomic cross-shard
  semantics.
- If tail latency matters, use connection pooling and batching.
- If strong consistency is required, do not use distributed cache as primary
  storage.

## Production Guardrails

Key routing:

- Use consistent hashing.
- Use virtual nodes.
- Version cluster topology.
- Refresh topology on membership changes and errors.
- Avoid central lookups per request.

Replication:

- Choose replication factor deliberately.
- Define primary/replica read policy.
- Handle replica lag/stale reads.
- Re-replicate after node failure.
- Track under-replicated keys.

Expiration and eviction:

- Lazy expiration on reads.
- Active expiration sampling.
- TTL jitter.
- Memory-pressure cleanup.
- O(1) LRU locally.
- Track eviction reasons: TTL, LRU, memory pressure, manual delete.
- Consider admission control for one-hit-wonder values.

Stampede protection:

- Request coalescing per key.
- Stale-while-revalidate where safe.
- Negative caching for repeated misses.
- Backpressure on origin fetches.
- TTL jitter.

Hot-key mitigation:

- Detect hot keys.
- Replicate read-hot keys.
- Use local near-cache.
- Split keys for counters.
- Aggregate at application layer.
- Rate-limit abusive hot keys.

Failure handling:

- Health checks.
- Graceful node drain.
- Bounded retries with jitter.
- Failover to replicas.
- Circuit breakers when cache is unhealthy.
- Origin protection during cache outage.

Performance:

- Connection pooling.
- Request batching/pipelining.
- Avoid unnecessary cross-node hops.
- Bound batch wait time.
- Track p50/p95/p99 latency.

Observability:

- Hit and miss rate.
- Eviction rate.
- Expired-key cleanup rate.
- Memory usage per node.
- Shard imbalance.
- Hot keys.
- Replication lag.
- Topology changes.
- Node failure/recovery.
- Origin load from cache misses.
- Tail latency.
- Connection pool saturation.

## Common Failure Modes

| Failure Mode | Cause | Mitigation |
|---|---|---|
| Massive key remapping | Modulo hashing after node change | Consistent hashing |
| Uneven shard load | Poor distribution/few nodes | Virtual nodes |
| Miss storm | Node failure or mass expiry | Replication, TTL jitter, request coalescing |
| Origin overload | Cache outage triggers DB fetches | Backpressure, circuit breaker, stale-while-revalidate |
| Hot key overload | Viral object or flash sale | Hot-key replication, local cache, key splitting |
| Expired-key memory leak | Lazy expiration only | Active janitor cleanup |
| Valuable data evicted by scan | Pure LRU under scan workload | Admission policy, segmented LRU, LFU-like policy |
| Stale reads | Replication lag or delayed invalidation | Versioning, TTL, explicit invalidation |
| Topology mismatch | Client has old ring map | Versioned topology and refresh-on-error |
| Retry storm | Aggressive cache retries | Bounded retries and jitter |
| Tail latency spike | Connection churn or tiny requests | Connection pooling and batching |
| Cross-shard operation failure | Multi-key operation spans nodes | Avoid atomic cross-shard operations or redesign keys |

## Clarifying Questions

Ask:

1. Total data size?
2. Average and p99 value size?
3. Peak QPS?
4. Read/write ratio?
5. p50/p95/p99 latency target?
6. Is durability required?
7. Is strong consistency required?
8. Acceptable stale-read window?
9. Read-through, write-through, write-back, or cache-aside?
10. What happens on miss?
11. Can origin handle miss storms?
12. Eviction policy expected?
13. Are TTLs required for all keys?
14. Are hot keys expected?
15. Are multi-key operations required?
16. Do multi-key operations need atomicity?
17. How often will nodes be added/removed?
18. Replication factor?
19. Should clients or proxies own routing?
20. How are topology updates distributed?
21. Failure policy when cache unavailable?
22. Is multi-region caching required?

## Reusable Agent Instructions

When designing distributed caches:

1. Start with semantics: source of truth, consistency, durability, TTL,
   eviction, miss behavior.
2. Use hash map plus doubly linked list for local O(1) LRU.
3. Store expiry metadata per key.
4. Combine lazy expiration with active cleanup.
5. Size by memory and QPS.
6. Use consistent hashing for routing.
7. Add virtual nodes.
8. Avoid central routing lookup on every request.
9. Use replication if node failure should not destroy hit rate.
10. Treat node loss as miss only if origin can absorb it.
11. Add stampede protection.
12. Detect and mitigate hot keys.
13. Use connection pooling and batching.
14. Keep multi-key operations shard-local when possible.
15. Avoid strong consistency/transactions unless explicitly required.
16. Add observability for hit rate, eviction, expiration, memory, hot keys, and
    tail latency.

## Condensed Memory

Use the Distributed Cache pattern when one-node cache capacity or throughput is
insufficient and low-latency key-value access is needed. Each node should use a
local hash map for O(1) lookup plus a doubly linked list for O(1) LRU eviction;
store TTL metadata per entry and combine lazy expiration with active cleanup.
Across nodes, use consistent hashing rather than modulo hashing so node changes
remap fewer keys; use virtual nodes for load balance. Size by both storage and
QPS, then apply utilization target and replication factor. Replication improves
availability and hit rate during failure but adds memory cost, write
amplification, and stale-read risk. Cache failure should degrade into misses
only if the origin can survive miss storms; otherwise add request coalescing,
stale-while-revalidate, negative caching, TTL jitter, and backpressure. Watch
hot keys because they overload one shard regardless of good hashing. Use
connection pooling and batching/pipelining. Guardrails: topology versioning,
graceful node drain, bounded retries, health checks, stampede protection,
memory-pressure eviction, hot-key metrics, replication lag metrics, shard
imbalance alerts, and p99 latency tracking.
