
# System Design Architecture Decision Playbook

## Purpose

Use this reference to make practical architecture decisions for real projects and coding agents.

The goal is **not** to memorize every technology. The goal is to help the agent:

1. Ask the right clarification questions.
2. Start with the simplest correct design.
3. Use requirements, scale, access patterns, and consistency needs to choose technologies.
4. Explain tradeoffs clearly.
5. Avoid premature distributed-system complexity.
6. Recommend an incremental scaling path instead of jumping straight to sharding, Kafka, GraphQL, WebSockets, or microservices.

## When to Use This Reference

Use this reference when the user asks about:

- Designing a service, API, backend feature, database schema, or system architecture.
- Reviewing whether a project should use REST, GraphQL, gRPC, WebSocket, SSE, WebRTC, Redis, CDN, SQL, NoSQL, sharding, queues, or distributed cache.
- Evaluating performance, scalability, consistency, latency, or reliability tradeoffs.
- Choosing indexes, pagination, caching strategy, shard key, database type, or load balancing strategy.
- Estimating whether the current scale justifies more infrastructure.
- Preparing system design interview answers.
- Reviewing a PR/design and asking: "Is this over-engineered?" or "What is missing?"

## Core Principle

**Do the math before adding complexity.**

Default to boring, reliable architecture first:

- HTTPS + REST for public/client APIs.
- PostgreSQL/MySQL as the source of truth for structured business data.
- B-tree and composite indexes based on query patterns.
- Stateless app servers behind load balancers.
- Read replicas and caching before sharding.
- Sharding only when a single well-tuned database is no longer enough.
- Timeouts, retries with backoff/jitter, idempotency, and circuit breakers for production network calls.

Only add specialized tools when a real requirement demands them.

## Required Agent Behavior

Before recommending architecture, check whether enough information is known.

If key information is missing, ask focused clarification questions. Do not ask every possible question. Ask the few that materially affect the decision.

If the user wants an answer without more questions, state assumptions clearly and proceed.

## Clarifying Questions Checklist

Ask these when needed.

### Product and API Scope

- Is this API public, partner-facing, browser/mobile-facing, or internal service-to-service?
- Is the feature mostly CRUD, real-time updates, streaming, search, analytics, or background processing?
- Who are the clients, and do we control them?
- Do clients need flexible data shapes, or are the endpoints fixed and predictable?
- Does the client need server push, bidirectional real-time communication, or audio/video?

### Scale and Capacity

- Current and expected DAU/MAU?
- Peak QPS and average QPS?
- Read/write ratio?
- Daily writes/events/logs/messages?
- Expected row/document size?
- Total data size now and expected growth per month/year?
- Retention period?
- Number of concurrent connections?
- Payload size and bandwidth requirements?
- Latency/SLA target?

### Data and Access Patterns

- What are the main entities?
- What are the most common queries?
- Which fields are filtered, sorted, joined, grouped, or paginated?
- Are queries mostly by user, account, tenant, merchant, device, conversation, time, or region?
- Are there hot keys or celebrity users?
- Is the workload read-heavy, write-heavy, or balanced?
- Is the data mostly structured, flexible/nested, append-only, graph-like, or full-text searchable?

### Consistency and Correctness

- What data must be strongly consistent?
- Is stale data acceptable? If yes, for how long?
- What would be bad if duplicated or lost?
- Are there payment, inventory, booking, account-balance, or order-state invariants?
- Do writes need transactions across multiple entities or services?
- Can the system use eventual consistency, async processing, or reconciliation?

### Operations and Constraints

- What infrastructure already exists?
- What does the team know how to operate?
- Is this a managed service or self-hosted?
- What is the cost sensitivity?
- What monitoring/logging/alerting exists?
- What is the failure fallback?
- Are there compliance, PII, audit, or data residency constraints?

## Decision Workflow

Use this sequence.

### 1. Define the requirement

Summarize what the system must do.

Avoid starting with technology.

### 2. Identify the dominant pressure

Pick the main design pressure:

- Correctness / consistency
- Read latency
- Write throughput
- Search
- Real-time communication
- Global latency
- Large data volume
- Operational simplicity
- Cost
- Team familiarity

### 3. Start with the boring default

Prefer the simplest architecture that satisfies the current known scale.

### 4. Pressure-test with numbers

Use rough capacity math before recommending cache, queue, sharding, or distributed storage.

### 5. Choose targeted complexity only where needed

Add one layer at a time:

1. Better schema/indexes.
2. Read replicas.
3. Cache/CDN.
4. Async queue.
5. Partitioning/sharding.
6. Specialized database/search engine.
7. Multi-region or distributed consistency system.

### 6. Explain tradeoffs

For every recommendation, include:

- Why it fits.
- What it costs.
- When it would fail.
- What to monitor.
- What to use instead if requirements change.

### 7. Produce an architecture decision

Use this output structure:

```md
## Recommendation
...

## Assumptions / Missing Inputs
...

## Why this fits
...

## Tradeoffs
...

## Alternatives considered
...

## Scaling path
...

## Failure handling
...

## Questions to confirm
...
```

## Default Decision Table

| Situation | Default Choice | Upgrade Only If |
|---|---|---|
| Public/client-facing API | HTTPS + REST | Need flexible client-driven data -> GraphQL; bidirectional real-time -> WebSocket |
| Internal service call | REST first | High throughput, strong contracts, streaming, owned clients -> gRPC |
| Structured business data | PostgreSQL/MySQL | Schema varies wildly, write volume huge, graph traversal, or full-text search dominates |
| Indexing | B-tree | Full-text -> inverted index; geo -> geohash/R-tree; write-heavy storage -> LSM |
| Simple list pagination | Offset pagination | Large/changing feeds -> cursor pagination |
| Hot read path | Redis cache-aside | Static/global media -> CDN; write-heavy async -> queue |
| Scale issue | Indexes/read replicas/cache first | Storage/write throughput/ops limits exceed one DB -> sharding |
| Consistency-critical writes | SQL transaction / CP choice | Stale data acceptable -> AP/eventual consistency |
| Server-to-client updates | SSE | Client also sends frequent real-time messages -> WebSocket |
| Audio/video | WebRTC | Normal chat/CRUD -> WebSocket/REST |
| Load balancing HTTP APIs | L7 LB | Raw TCP/WebSocket-heavy persistent connections -> L4 LB |
| Failure handling | Timeout + retry/backoff + idempotency + circuit breaker | Never retry non-idempotent writes blindly |

## Networking and Protocol Decisions

### TCP

Use when reliability and ordering matter.

Good for:

- REST APIs
- Web apps
- Databases
- Internal services
- Payments
- File uploads
- Most business systems

Avoid when:

- Lowest latency matters more than perfect delivery.
- Late packets are useless.
- Live audio/video/game state can tolerate packet loss.

### UDP

Use when newer data is more valuable than old data.

Good for:

- Live audio/video
- VoIP
- Gaming
- DNS
- High-volume lossy telemetry

Avoid for:

- Payments
- User data writes
- Order creation
- Database operations
- Any "must arrive exactly once/correctly" workflow

### QUIC / HTTP/3

Use when:

- Modern web performance matters.
- Connection setup latency matters.
- HTTP/3 is supported by infrastructure.
- Head-of-line blocking is a concern.

Avoid when:

- A basic HTTP/REST design is enough.
- Tooling/support/ops maturity is uncertain.
- It distracts from larger bottlenecks.

### HTTP / HTTPS

Use for:

- Public APIs
- Web/mobile clients
- CRUD
- Login
- Admin APIs
- Partner integrations

Important rule:

**HTTPS encrypts traffic. It does not mean the client is trustworthy.**
Always validate identity, authorization, permissions, and input server-side.

### REST

Use when:

- API is resource-based.
- Endpoints are predictable.
- Clients are public or partner-facing.
- Debuggability and simple integration matter.
- CRUD/admin workflows dominate.

Avoid when:

- Client data shapes vary heavily.
- Backend performance requires binary RPC.
- The core feature is streaming or real-time bidirectional messaging.

### GraphQL

Use when:

- Multiple clients need different data shapes.
- Mobile needs small payloads but web/dashboard needs richer payloads.
- Over-fetching/under-fetching is a real product problem.
- Frontend teams need flexibility.

Avoid when:

- APIs are simple and fixed.
- Backend performance needs strict control.
- Resolver complexity, N+1 queries, caching, or field-level auth would become painful.
- You are only choosing it because it sounds modern.

### gRPC

Use when:

- Internal service-to-service calls are frequent.
- Services are owned by the same organization.
- Performance, type safety, codegen, deadlines, or streaming matter.
- Payloads are frequent or large.

Avoid when:

- The API is public, browser-first, or partner-facing.
- Human-readable/debuggable JSON matters.
- Unknown clients need easy integration.

Strong framing:

> REST externally, gRPC internally if performance or strong contracts justify it.

### SSE

Use when:

- Server pushes one-way updates.
- Client mostly listens.
- Updates are low/medium frequency.

Good for:

- Notifications
- Job progress
- Dashboards
- Live feeds
- Status updates

Avoid when:

- Client must send frequent real-time messages back.
- You need full-duplex communication.

### WebSocket

Use when:

- Client and server both send frequent messages.
- Low-latency bidirectional communication matters.

Good for:

- Chat
- Multiplayer
- Collaboration
- Live trading
- Audio streaming
- Real-time dashboards with active client messages

Avoid when:

- Normal HTTP polling or SSE is enough.
- The feature says "real-time" but update frequency is low.
- You do not want to manage stateful connection scaling.

Scaling notes:

- Use connection-aware load balancing.
- Consider L4 LB or WebSocket-aware L7 LB.
- Track connection count, message rate, reconnect storms, idle timeouts, and backpressure.
- Design explicit message protocol and error handling.

### WebRTC

Use when:

- Audio/video calling or peer-to-peer media is core.
- Low-latency media matters.
- Browser-native media capture is required.

Avoid when:

- The system is normal chat, CRUD, notifications, or collaboration without media.
- WebSocket/SSE/REST solves the problem.
- You are not ready for signaling, STUN, TURN, NAT traversal, and TURN relay cost.

### STUN and TURN

Use STUN for WebRTC peer connection discovery.

Use TURN as fallback when direct peer-to-peer fails.

Avoid treating STUN alone as guaranteed connectivity. Avoid using TURN as the default media path when direct peer-to-peer works, because it adds cost and latency.

## Load Balancing Decisions

### L4 Load Balancer

Use for:

- TCP services
- WebSockets
- Persistent connections
- High-performance connection-level routing

Avoid when:

- You need routing by path, header, cookie, auth, or request body.

### L7 Load Balancer

Use for:

- REST APIs
- Web apps
- HTTP path/header routing
- API gateways
- Application health checks

Avoid as the default for:

- Heavy raw TCP
- Very high-volume persistent WebSocket traffic unless the LB supports it well

### Load Balancing Algorithm

| Algorithm | Use When | Avoid When |
|---|---|---|
| Round robin | Stateless services with similar capacity | Request cost or server capacity varies a lot |
| Random | Simple stateless services at scale | Need sticky sessions or load awareness |
| Least connections | WebSockets/SSE/long polling | Short HTTP requests where round robin is enough |
| Least response time | Backend latency varies | Measurements are noisy or simplicity is enough |
| IP hash | Session affinity needed | Service is stateless or NAT creates uneven load |

## API Design Decisions

### REST Resource Modeling

Use nouns, not actions:

- Good: `POST /bookings`
- Avoid: `POST /bookTicket`

Use plural resources:

- `/users`
- `/events`
- `/orders`
- `/devices`

Use nesting only for strong ownership:

- Good: `/events/{event_id}/tickets`
- Prefer query filters for optional relationships: `/tickets?event_id=123&section=VIP`

### Path, Query, Body Rule

- Path = which required resource?
- Query = how should it be filtered/sorted/paginated?
- Body = what data is being created/updated?

### HTTP Method Rule

| Method | Use For | Retry Safety |
|---|---|---|
| GET | Read | Safe/idempotent |
| POST | Create or command | Not idempotent by default |
| PUT | Full replace | Idempotent |
| PATCH | Partial update | Depends on operation |
| DELETE | Remove | Idempotent final state |

For POST writes that can be retried, use idempotency keys.

### Status Codes

Use simple, consistent codes:

- `200 OK`
- `201 Created`
- `400 Bad Request`
- `401 Unauthorized`
- `403 Forbidden`
- `404 Not Found`
- `409 Conflict`
- `429 Too Many Requests`
- `500 Internal Server Error`

### Pagination

Use offset pagination when:

- Dataset is small/medium.
- Data does not change much during pagination.
- Admin UI needs page numbers.

Use cursor pagination when:

- Feed/list is large.
- New rows are frequently inserted.
- Infinite scroll is used.
- Stable pagination matters.

### Versioning

Prefer URL versioning for public/interview-friendly APIs:

- `/v1/events`
- `/v1/users`

Use header versioning only when clients are controlled and the organization prefers it.

### API Security

Authentication answers: **Who are you?**
Authorization answers: **What are you allowed to do?**

Use:

- JWT/session tokens for user-facing APIs.
- API keys for machine-to-machine or partner/developer access.
- RBAC when roles are simple.
- ABAC/policy-based access when permissions depend on ownership, geography, tenant, sensitivity, or dynamic context.
- Rate limiting on public, login, expensive, booking, and payment endpoints.

## Data Modeling Decisions

### Default Database Choice

Use PostgreSQL/MySQL by default when:

- Data is structured.
- Entities and relationships are clear.
- Transactions matter.
- Correctness matters.
- You need joins, constraints, migrations, reporting, and flexible queries.

Avoid SQL as the only/main store when:

- The workload is extreme key-value lookup at massive scale.
- Schema varies wildly per record.
- Workload is massive append-only telemetry/logging.
- Deep graph traversal is the main operation.
- You only need a cache/session/token store.

### Document Database

Use when:

- Data is naturally nested.
- Schema varies by record.
- You often fetch the whole document.
- Product requirements change fields frequently.

Good for:

- User profiles with variable fields
- CMS/content blocks
- Product catalog with variable attributes
- App settings/config
- Mobile app backends

Avoid when:

- Relationships are central.
- Joins/reporting are important.
- Strong consistency across records matters.
- SQL schema is stable and simpler.

### Key-Value Store

Use for:

- Cache
- Session storage
- Feature flags
- Rate limits
- Token lookup
- Exact ID lookup
- Hot data

Avoid for:

- Complex filtering
- Joins
- Reporting
- Strong multi-entity consistency
- Querying by many fields

Default framing:

> PostgreSQL is the source of truth. Redis caches or stores hot temporary lookup data.

### Wide-Column / LSM-Oriented Store

Use when:

- Writes are huge.
- Data is append-heavy.
- Query patterns are known.
- Time-series/event data dominates.

Good for:

- Logs
- Metrics
- IoT events
- Clickstream
- Audit/event history

Avoid when:

- You need joins, ad hoc queries, or strong transactions.
- The dataset is small/medium.
- Query patterns are unknown.

### Graph Database

Use when:

- Deep relationship traversal is the main workload.
- Multi-hop graph queries are common.
- Fraud rings, knowledge graphs, dependency graphs, or graph recommendations matter.

Avoid when:

- You only have simple relationships.
- A relational join table is enough.
- You are building normal CRUD.
- You just see the word "social graph."

Strong framing:

> A social network does not automatically need a graph database. A `follows` table with indexes may be enough unless deep multi-hop traversal is core.

## Schema Design Decisions

### Entity Modeling

Always start with:

- Core entities
- System-generated IDs
- Relationships
- Access patterns
- Consistency requirements
- Scaling path

Prefer system-generated IDs over mutable business identifiers like email.

### Foreign Keys and Constraints

Use DB constraints when:

- Data correctness matters.
- Scale is not extreme.
- You want DB-level protection against bad writes.

Be careful when:

- Write volume is extremely high.
- Data is sharded.
- Foreign key checks become a bottleneck.
- You intentionally enforce integrity at the application layer.

### Normalization

Normalize by default when:

- Starting a design.
- Correctness matters.
- Data changes over time.
- You need one source of truth.

Relax normalization when:

- Read latency is critical.
- Data rarely changes.
- You need precomputed views.
- Event/audit snapshots must preserve historical values.

### Denormalization

Use when:

- Read-heavy endpoint is hot.
- Joins/counts are too expensive.
- Slight staleness is acceptable.
- Precomputed counters/snapshots improve latency.

Good examples:

- `posts.like_count`
- `orders.customer_email_snapshot`
- `feed_items.author_name`
- Search document copies

Avoid when:

- Data changes frequently.
- Strong consistency is required.
- There is no proven read bottleneck.

## Indexing Decisions

### General Rule

Indexes speed up reads but slow down writes and cost storage.

Add indexes for frequent:

- `WHERE`
- `JOIN`
- `ORDER BY`
- `GROUP BY`
- `UNIQUE`

Do not index every column.

### B-Tree Index

Default index for most app queries.

Use for:

- Equality lookup
- Range queries
- Sorting
- Unique constraints

Examples:

- `users(email)`
- `orders(customer_id)`
- `posts(created_at)`
- `posts(user_id, created_at)`

Avoid relying on B-tree alone for:

- Full-text contains search
- Nearby geo search
- Extreme write ingestion
- Leading wildcard search like `LIKE '%term%'`

### Composite Index

Use when queries filter/sort by multiple columns together.

Examples:

- `posts(user_id, created_at)`
- `orders(status, created_at)`
- `messages(conversation_id, created_at)`

Rules:

- Column order matters.
- Match the leftmost prefix.
- Put equality filters before range/sort fields when appropriate.
- Avoid large composite indexes without a matching query.

### Inverted Index

Use for:

- Full-text search
- Search posts/messages/docs/logs/products
- Fuzzy search
- Relevance ranking

Avoid for:

- Exact ID lookup
- Range queries
- Transactional consistency-critical lookups

### Geospatial Index

Use geohash when:

- Nearby point search is needed.
- Simplicity and explainability matter.
- You can search neighboring cells and then do exact distance filtering.

Use R-tree/PostGIS when:

- Polygon/shape queries matter.
- GIS accuracy matters.
- Production spatial DB support exists.

Avoid naive separate latitude/longitude B-tree indexes for true nearby search.

### LSM Tree

Use for write-heavy append workloads:

- Logs
- Metrics
- Time-series
- Events
- IoT telemetry

Avoid for:

- Read-heavy low-latency apps.
- Complex secondary-index queries.
- Workloads where B-tree is simpler and enough.

### Hash Index

Use only for exact match where no range/sort is needed:

- `session_id`
- `token`
- `cache_key`

Usually B-tree is more flexible and still good enough.

## Caching Decisions

### Do Not Add Cache First

Before adding cache, identify:

- What data is hot?
- How often is it read?
- How often does it change?
- Is stale data acceptable?
- What is the TTL/invalidation strategy?
- What happens if Redis fails?
- Could an index or query fix solve the issue first?

### Redis / External Cache

Use for:

- Hot profiles
- Feed fragments
- Product pages
- Expensive DB queries
- Session/token lookup
- Rate limiting
- Temporary metadata

Avoid when:

- Data must be immediately fresh.
- The DB is not a bottleneck.
- Data is rarely read again.
- Cache invalidation is unclear.
- Cache would hide a bad schema/query.

### CDN

Use for:

- Images
- Videos
- Thumbnails
- Static files
- Public pages
- Global static/cacheable content

Avoid for:

- Private personalized data.
- Strongly fresh data.
- Real-time user-specific responses.

### Cache Patterns

| Pattern | Use When | Avoid When |
|---|---|---|
| Cache-aside | Default app-controlled Redis caching | Need cache to be always updated on write |
| Read-through | Cache layer owns DB read on miss | You want app-level control/simple implementation |
| Write-through | Need cache and DB updated together | Write latency matters |
| Write-behind | High write throughput and async persistence okay | Data loss/consistency risk unacceptable |
| Refresh-ahead | Predictable hot keys need low latency | Access pattern is unpredictable |
| CDN caching | Static/global content | Private or constantly changing content |

### Cache Failure Modes

Always consider:

- Cache stampede / thundering herd
- Hot keys
- Cache penetration
- Cache avalanche
- Stale data
- Redis outage causing DB traffic spike
- TTL too short or too long
- Memory eviction behavior
- Distributed invalidation

## Sharding Decisions

### Do Not Shard Early

Do not shard when:

- One DB can handle the load.
- Dataset is hundreds of GB or a few TB.
- Writes are only a few thousand per second.
- Indexes are not optimized.
- Read replicas/caching solve the issue.
- Access patterns are not clear.

Consider sharding when:

- Dataset approaches/exceeds tens of TB.
- Writes exceed single-primary limits.
- Read replicas are not enough.
- Backup/recovery windows are too large.
- You need geographic distribution.
- One DB becomes an operational bottleneck.

### Shard Key Rules

Choose shard key by primary access pattern.

Good shard keys:

| Access Pattern | Shard Key |
|---|---|
| Posts by user | `user_id` |
| Orders by merchant | `merchant_id` |
| Messages by conversation | `conversation_id` |
| Device events by device | `device_id` |
| Tenant-scoped SaaS | `tenant_id` |

Avoid shard keys that cause:

- Hot shards
- Cross-shard joins
- Cross-shard transactions
- Too many fanout queries
- Hard future migrations

Avoid naive time-range sharding for write-heavy current traffic because all new writes hit the current shard.

### Sharding Tradeoffs

Pros:

- More storage capacity
- More write throughput
- More parallel reads if query routes to one/few shards
- Failure isolation

Cons:

- Cross-shard queries are expensive
- Rebalancing is hard
- Transactions are harder
- Hot shards can break the system
- Schema changes/backups/migrations become harder
- Operational complexity increases

## Consistent Hashing Decisions

Use consistent hashing when:

- Keys must be distributed across changing nodes.
- Adding/removing nodes should move only a small portion of keys.
- You are building distributed cache, storage, routing, partition ownership, or load distribution.
- Node membership changes regularly.

Good for:

- Distributed cache
- Redis/Memcached-like clusters
- Dynamo-style storage
- Request routing
- Partition assignment

Use virtual nodes to reduce uneven distribution.

Avoid when:

- A simple fixed cluster is enough.
- You have a managed system that already handles partitioning.
- Strong transactions or relational queries are the main concern.
- You need range queries by key order.
- Operational simplicity matters more.

Important distinction:

- Sharding decides **how data is split**.
- Consistent hashing decides **how keys are mapped to nodes and remapped when nodes change**.

## CAP Theorem Decisions

### Practical CAP Rule

In distributed systems, network partitions can happen. Partition tolerance is required.

The real decision is:

> During a network partition, should the system prefer consistency or availability?

### Choose CP When Incorrect Data Is Unacceptable

Use consistency-first behavior when:

- Duplicate booking is bad.
- Overselling is bad.
- Wrong balance is bad.
- Incorrect payment/order state is bad.
- Legal/financial correctness matters.

Good for:

- Payments
- Banking
- Inventory
- Seat booking
- Order placement
- Account balance

Behavior:

- Reject, block, or delay requests during partition rather than return incorrect data.

### Choose AP When Stale Data Is Acceptable

Use availability-first behavior when:

- Slightly stale data is okay.
- Uptime and low-latency user experience matter more.
- Data can reconcile later.

Good for:

- Feeds
- Likes/views
- Profiles
- Restaurant info
- Product descriptions
- Analytics/metrics
- Recommendations

Behavior:

- Continue serving responses even if they may be temporarily stale.

### Do Not Apply CAP Blindly

CAP only matters when:

- The system is distributed.
- There is a partition.
- You must choose between serving possibly stale data or refusing requests.

For single-node DB design, the better discussion is usually transactions, replication, failover, and durability.

## Numbers to Know / Capacity Heuristics

These are rough heuristics, not hard laws.

Use them to avoid premature over-engineering.

### Database Scale

A single well-tuned relational DB can often handle much more than candidates assume.

Usually okay with one relational DB plus indexes/replicas when:

- Data is GB to low/mid TB scale.
- Writes are under DB limits.
- Queries are indexed.
- Read replicas can scale reads.
- Backups/restores are manageable.

Consider sharding/distributed DB when:

- Dataset approaches/exceeds roughly tens of TB.
- Sustained writes are around or above 10k-20k TPS.
- Read replicas are not enough.
- Backup/recovery windows are impractical.
- Geographic distribution is required.

### App Server Scale

Modern app servers can often handle:

- 100k+ concurrent connections per optimized instance, depending on workload.
- 8-64 CPU cores.
- 64-512 GB memory commonly.
- 25 Gbps network standard; 50-100 Gbps high-end.
- Container startup around 30-60 seconds.

Common scale triggers:

- CPU > 70-80%
- Memory > 70-80%
- Latency above SLA
- Network close to limit
- Queue backlog growing
- Error rate increasing

### Cache Reality Check

Add cache when:

- Same data is read repeatedly.
- DB query is expensive.
- Latency matters.
- Staleness is acceptable.

Do not add cache when:

- Query is already indexed and fast.
- Data is rarely reused.
- Strong freshness matters.
- Cache invalidation is harder than the problem.

### Queue Reality Check

Add a queue when:

- Work can be async.
- You need durable retries.
- You need spike buffering.
- You need decoupling between services.
- External dependency latency should not block user flow.

Do not add queue when:

- The write must be synchronous.
- Load is low/simple.
- Direct DB writes are enough.
- Queue semantics would make correctness harder.

## Architecture Review Red Flags

Watch for these mistakes:

- Choosing GraphQL because it is modern, not because clients need flexible data.
- Choosing WebSocket just because the feature says "real-time."
- Choosing Kafka/queue before proving async processing or buffering is needed.
- Choosing MongoDB because "schema may change" when the data is actually relational.
- Choosing graph DB just because the domain has relationships.
- Adding Redis before fixing missing indexes.
- Caching data that must be immediately consistent.
- Sharding before optimizing schema/indexes/read replicas.
- Sharding by time when all current writes go to the latest shard.
- Using blind retries for non-idempotent writes.
- Skipping timeouts on network/database calls.
- Ignoring auth/authorization/rate limiting for public APIs.
- Designing for FAANG scale when the actual system is internal/small/medium.
- Not stating assumptions.

## Recommended Answer Format for Coding Agent

When asked to design or evaluate a system, respond like this:

```md
## My recommendation

I would start with ...

## Why this is the right default

- Requirement:
- Scale:
- Access pattern:
- Consistency:
- Operational simplicity:

## What I would not add yet

- I would not add sharding because ...
- I would not add caching unless ...
- I would not use GraphQL/WebSocket/etc. unless ...

## Clarifying questions

1. What is the expected DAU/QPS/data size?
2. What are the main read/write access patterns?
3. Is stale data acceptable?
4. What is the latency/SLA target?
5. Is this public/partner/internal?

## Scaling path

1. Start with ...
2. Add indexes ...
3. Add read replicas ...
4. Add cache ...
5. Add queue ...
6. Shard only if ...

## Failure handling

- Timeout:
- Retry/backoff:
- Idempotency:
- Circuit breaker:
- Monitoring:
```

## Mini Prompt for Using This Reference

Use this prompt with a coding agent:

```txt
Use the engineering-workflow-reviewer skill with the system design architecture decision playbook.

Before recommending architecture, identify missing requirements around scale, access patterns, consistency, latency, data size, read/write ratio, and operational constraints.

Start with the simplest correct design. Do not add caching, sharding, queues, GraphQL, WebSockets, gRPC, or NoSQL unless the requirements justify them.

For every technology recommendation, explain:
- when to use it,
- when not to use it,
- tradeoffs,
- failure modes,
- and the migration/scaling path.
```
