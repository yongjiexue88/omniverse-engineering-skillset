# System Design Pattern Recognition Playbook

## Purpose

Use this reference to recognize common system-design pressures and map them to practical architecture patterns. It complements `system-design-architecture-decision-playbook.md`: the architecture playbook helps choose technologies, while this reference helps identify the recurring problem shape.

Use it when a design scenario, RFC, architecture proposal, or implementation plan involves any of these seven patterns:

- Managing long-running tasks
- Handling large blobs
- Scaling reads
- Multi-step processes
- Scaling writes
- Dealing with contention
- Real-time updates

## Table of Contents

- [Pattern Triage](#pattern-triage)
- [Quick Pattern Map](#quick-pattern-map)
- [Managing Long-Running Tasks](#managing-long-running-tasks)
- [Handling Large Blobs](#handling-large-blobs)
- [Scaling Reads](#scaling-reads)
- [Multi-Step Processes](#multi-step-processes)
- [Scaling Writes](#scaling-writes)
- [Dealing With Contention](#dealing-with-contention)
- [Real-Time Updates](#real-time-updates)
- [Pattern Combinations](#pattern-combinations)
- [Common Mistakes](#common-mistakes)
- [Recommended Response Shape](#recommended-response-shape)

## Pattern Triage

Before choosing infrastructure, identify the dominant pressure:

1. Does the user-facing request take more than a few seconds?
   - Use managing long-running tasks.
2. Are large binary objects moving through app servers?
   - Use handling large blobs.
3. Is the bottleneck repeated reads of the same or similar data?
   - Use scaling reads.
4. Does the business action span many steps, services, callbacks, humans, or compensations?
   - Use multi-step processes.
5. Is the bottleneck sustained or bursty write volume?
   - Use scaling writes.
6. Are many actors competing for the same scarce resource or invariant?
   - Use dealing with contention.
7. Do clients need low-latency server-to-client updates?
   - Use real-time updates.

If several apply, name the primary pattern and the supporting patterns. For example, a video upload system often uses large blobs for transfer, long-running tasks for transcoding, multi-step processes for moderation/transcoding/publishing, scaling reads for playback metadata, and real-time updates for progress.

## Quick Pattern Map

| Signal | Pattern | Default Move | Avoid Jumping To |
|---|---|---|---|
| Slow work, request timeouts, CPU/GPU-heavy tasks, bulk exports | Long-running tasks | Return job ID, queue work, process in workers, expose status | Synchronous request/response |
| Files larger than normal API payloads, videos/images/docs, high transfer cost | Large blobs | Metadata in DB, bytes in object storage, presigned uploads, CDN downloads | Proxying all bytes through app servers |
| Read/write ratio is high, hot public data, DB read load rising | Scaling reads | Indexes/query tuning, denormalization, read replicas, cache/CDN | Sharding or cache before fixing queries |
| Order/payment/onboarding flow has retries, waiting, compensation | Multi-step processes | Durable workflow, event log, or state-machine backed by storage | Hand-rolled fragile orchestration in API servers |
| High write TPS, bursts, counters, telemetry, likes, location updates | Scaling writes | Measure, partition, queue bursts, shed low-value writes, batch/aggregate | Queue as a permanent fix for underprovisioned steady-state writes |
| Double-booking, double-spend, inventory conflicts, hot resources | Contention | Keep contended data together, transaction + lock/OCC/reservation | Distributed locks or 2PC before single-DB options |
| Chat, live dashboards, presence, progress, collaboration | Real-time updates | Choose polling/SSE/WebSocket/WebRTC by latency and directionality | WebSocket for every "live" feature |

## Managing Long-Running Tasks

### Recognition Signals

Use this pattern when:

- Work takes more than a few seconds and risks HTTP, load balancer, or client timeouts.
- Work is CPU, memory, GPU, IO, or external-API heavy.
- Request acceptance and request processing have different scaling needs.
- Users need progress, completion notification, or retry behavior.
- Examples include video transcoding, image processing, report generation, CSV import/export, bulk email, search indexing, fanout, ML inference, and third-party API workflows.

### Default Design

Use a two-phase design:

1. API validates the request.
2. API creates a job row with `pending` state and durable input metadata.
3. API enqueues a small message that references the job ID.
4. API returns immediately with job ID and status URL.
5. Worker leases the job, marks it `processing`, performs the work, stores output, and marks it `completed` or `failed`.
6. Client checks status through polling, long polling, SSE, WebSocket, push notification, or email.

Keep the queue payload small. Store full job inputs, metadata, and outputs in durable storage.

### Queue And Worker Choices

- Redis/Bull/BullMQ: simple startup-friendly queues, good for moderate workloads, weaker durability unless configured carefully.
- SQS or managed queues: good default for durable decoupling and low operational burden.
- RabbitMQ: useful for routing, priorities, and enterprise queue semantics; higher operational burden.
- Kafka: useful when high-throughput logs, replay, partition ordering, or fanout already matter.
- Long-running servers: simplest for jobs that need full control, GPUs, local tooling, or very long execution.
- Serverless functions: good for spiky short jobs, but watch runtime limits, cold starts, and local-storage constraints.
- Container workers: good middle ground for autoscaling, resource isolation, and deploy consistency.

### Design Checklist

- Define job states: `pending`, `processing`, `completed`, `failed`, `cancelled`, and optionally `retrying`.
- Use idempotency keys at submission time to prevent duplicate jobs from repeated clicks or retries.
- Make job execution idempotent because workers can crash after side effects but before acking.
- Use visibility timeouts, leases, or heartbeats so crashed workers do not hold jobs forever.
- Use bounded retries with exponential backoff and a dead-letter queue after repeated failures.
- Monitor queue depth, oldest job age, processing latency, retry count, DLQ count, and worker saturation.
- Use backpressure: reject, degrade, rate-limit, or defer new jobs when backlog exceeds what the system can serve.
- Separate fast and slow queues to avoid head-of-line blocking.
- Route jobs by resource needs when some need GPUs, high memory, or external rate limits.
- For dependent steps, start with chained jobs only when simple; use a workflow engine when branches, waits, or compensation grow complex.

### When Not To Use

- Simple CRUD or reads that finish comfortably inside normal request latency.
- Work that must be completed synchronously before the response can be correct.
- Very small jobs where queue overhead exceeds execution time.

### Deep-Dive Risks

- Poison messages can retry forever unless isolated in a DLQ.
- Autoscaling by CPU can be too late; scale workers by queue depth and age.
- Queue growth only helps bursts. If arrival rate stays above processing rate, the queue becomes delayed failure.
- Mixed workloads need separate queues or chunking.
- Status rows can drift from queue state; reconcile stuck `processing` and `pending` jobs.

## Handling Large Blobs

### Recognition Signals

Use this pattern when:

- Clients upload or download files larger than normal API payloads, often 10 MB or more.
- App servers are acting as byte pipes without adding business value.
- Upload/download traffic dominates CPU, memory, network, or load balancer capacity.
- The system stores videos, images, documents, backups, attachments, or generated reports.

### Default Design

Separate metadata from bytes:

1. Store file metadata in the primary database.
2. Store bytes in object/blob storage.
3. Generate server-side storage keys; never trust client-supplied object paths.
4. For upload, API validates user, quota, size, and content-type constraints, creates a `pending` metadata row, then returns a temporary scoped upload URL.
5. Client uploads directly to object storage.
6. Storage events confirm upload completion and update metadata status.
7. Reconciliation jobs check for stuck pending rows and orphaned objects.
8. For download, API authorizes access and returns a signed object-storage URL or signed CDN URL.

### Transfer Details

- Use presigned URLs, signed URLs, or SAS tokens for temporary scoped access.
- Include content-length and content-type restrictions in generated upload credentials.
- Use multipart/resumable uploads for large files so failed chunks can resume.
- Track part numbers, checksums, and upload session IDs on the client.
- Complete multipart uploads explicitly after all parts succeed.
- Add lifecycle rules to clean incomplete multipart uploads after a short window.
- Use CDN delivery for frequently downloaded files and range requests for resumable downloads.

### State Synchronization

Do not trust the client as the source of truth for completion. Prefer storage events as the primary signal and reconciliation as the safety net.

Maintain statuses such as:

- `pending`: metadata exists, upload URL issued.
- `uploading`: optional state while client is actively uploading.
- `uploaded`: object exists but is not yet safe for serving.
- `processing`: virus scan, transcoding, or validation is running.
- `available`: file passed checks and can be downloaded.
- `failed`: upload or processing failed.

### Abuse And Safety

- Put new uploads into quarantine storage before public access.
- Scan for malware, validate file type, enforce size limits, and run policy checks before marking available.
- Use rate limits and quotas by user/account.
- Do not let users overwrite arbitrary storage keys.
- Keep rich metadata in the database, not in object tags, when it must be queried.

### When Not To Use

- Small files where direct upload adds unnecessary two-step latency.
- Cases requiring synchronous byte-level validation before accepting the upload.
- Compliance environments where bytes must pass through certified inspection infrastructure.
- UX that needs immediate content-derived feedback and cannot tolerate async processing.

## Scaling Reads

### Recognition Signals

Use this pattern when:

- Read/write ratio is high, often 10:1, 100:1, or more.
- Many clients repeatedly read the same public or semi-public data.
- Database CPU, IO, or query latency rises with dataset size.
- Global latency matters for read-heavy pages.
- Examples include feeds, product pages, URL shorteners, video metadata, public profiles, search results, dashboards, and content catalogs.

### Scaling Sequence

Use this order unless requirements prove otherwise:

1. Fix query shape and add indexes for frequent filters, joins, ordering, grouping, and uniqueness.
2. Verify pagination, limits, and projection avoid expensive unbounded reads.
3. Use vertical scaling when it is cheaper and operationally simpler.
4. Denormalize or use materialized views for proven hot read paths where staleness is acceptable.
5. Add read replicas for read throughput while accounting for replication lag.
6. Add application cache for hot computed or entity reads.
7. Add CDN/edge caching for public or shared content.
8. Shard only when data size, operational limits, or regional requirements justify it.

### Read Replica Considerations

- Route read-after-write flows to the primary or use session stickiness until replicas catch up.
- Monitor replication lag and fail closed for correctness-sensitive reads.
- Decide whether stale reads are acceptable by endpoint.
- Read replicas improve read throughput but do not reduce total dataset size per replica.

### Cache Strategy

Before adding cache, answer:

- What key is hot?
- What is the hit-rate expectation?
- How stale can the data be?
- How will the cache be invalidated or versioned?
- What happens if the cache is unavailable?
- Could an index, query fix, or denormalized table solve it more simply?

Prefer TTLs based on explicit staleness requirements. Combine short TTLs with active invalidation for data that is important but not strictly transactional.

Useful patterns:

- Cache-aside for simple application-controlled caching.
- Versioned cache keys for entity data needing immediate visibility after updates.
- Request coalescing so one app server rebuilds a missing hot key while concurrent requests wait.
- Probabilistic early refresh or background refresh to prevent stampedes.
- Key fanout for extreme hot-key reads when one cache node cannot serve the traffic.
- Deleted-item filters for feeds/search where removing content must take effect faster than full invalidation.
- CDN caching for public, shared, global content.

### When Not To Use

- Write-heavy systems where writes, not reads, dominate.
- Small systems that a well-indexed database handles comfortably.
- Strictly consistent reads where stale data would cause real harm.
- Real-time collaboration where caching conflicts with immediate visibility.

### Deep-Dive Risks

- Cache stampedes when hot keys expire all at once.
- Hot keys that overload a single cache node despite good hit rate.
- Cache invalidation races where stale data is written after deletion.
- CDN invalidation propagation delays.
- Caching personalized data with poor hit rates and privacy risk.

## Multi-Step Processes

### Recognition Signals

Use this pattern when:

- A business action spans multiple services, external APIs, human tasks, or long waits.
- Each step needs retries, timeouts, branching, compensation, or auditability.
- The process must survive server restarts and deployments.
- The system needs to resume after callbacks or webhooks.
- Examples include order fulfillment, payment settlement, loan approval, account onboarding, ride matching, document signing, claims processing, and moderation pipelines.

### Design Options

Start simple, then escalate:

- Single-service orchestration: acceptable for short, simple, low-risk flows.
- State-machine in a database: useful when steps are limited and ownership is local.
- Event sourcing/durable log: useful when event history, replay, audit, and worker decoupling matter.
- Durable execution engine: useful for code-defined workflows with retries, timers, signals, and compensation.
- Managed workflow system: useful when a cloud-native declarative state machine integrates well with existing infrastructure.

Common tools include Temporal, Cadence, AWS Step Functions, Google Cloud Workflows, Airflow, and Azure Durable Functions.

### Workflow Design Checklist

- Persist workflow state outside API server memory.
- Make activities idempotent because successful side effects can be retried after ack failures.
- Pass identifiers instead of huge payloads through workflow history.
- Define compensation for steps that cannot be atomically rolled back.
- Use signals or callbacks for external events instead of polling.
- Set per-step timeouts and retry policies.
- Track workflow versioning for long-running executions.
- Keep history bounded with child workflows, continue-as-new patterns, or periodic compaction when supported.
- Expose workflow state for operations and support.

### Versioning And Migration

Long-running workflows may span deployments. Do not assume new code can safely resume old executions.

- Use workflow versions when old executions can finish under old logic.
- Use deterministic patches/migrations when running workflows must adopt new steps.
- Avoid non-deterministic workflow code when using replay-based engines.
- Keep business logic readable; do not hide critical compensation in scattered callbacks.

### When Not To Use

- Simple CRUD request/response flows.
- Single-step async jobs such as resizing one image or sending one email.
- High-frequency low-value operations where workflow overhead dominates.
- Latency-sensitive operations where the client must wait synchronously.

## Scaling Writes

### Recognition Signals

Use this pattern when:

- Sustained or bursty write volume approaches one server or one database limit.
- Writes are bottlenecked by disk IO, CPU, index maintenance, locks, or network.
- The workload includes metrics, logs, clicks, views, likes, counters, location updates, events, search indexing, or fanout writes.
- Traffic spikes exceed normal capacity and cannot be solved by instant autoscaling.

### Scaling Sequence

1. Estimate writes per second and data size. Confirm the bottleneck.
2. Use vertical scaling and database tuning while it remains cheaper and simpler.
3. Reduce write amplification by removing unnecessary indexes, triggers, or constraints from hot paths.
4. Choose write-optimized storage when the workload is append-heavy or time-series oriented.
5. Horizontally shard by a key that spreads writes and keeps common reads local.
6. Vertically partition data with different access patterns into separate tables or stores.
7. Use queues to absorb short bursts when delayed visibility is acceptable.
8. Use load shedding for low-value or replaceable writes.
9. Batch writes or aggregate hierarchically when many small writes can be combined.

### Partitioning Guidance

Good partition keys minimize variance in writes per shard and preserve common access locality.

- Usually good: `user_id`, `tenant_id`, `post_id`, `conversation_id`, `device_id`, `merchant_id`.
- Risky: country, status, timestamp-only keys, celebrity IDs, or any key with skew.

Ask:

- How many shards does the hottest read hit?
- How evenly do writes distribute?
- What happens when a key becomes hot?
- How will rebalancing or resharding work?

### Queues, Load Shedding, And Batching

Use queues for temporary bursts, not as a permanent fix for steady-state overload. If enqueue rate stays above processing rate, backlog becomes user-visible delay.

Use load shedding when later writes supersede earlier writes or low-value events can be dropped. Examples include location pings, impressions, telemetry, and presence updates.

Use batching when many writes can be combined without losing correctness. Examples include incrementing counters, aggregating likes, metrics rollups, and bulk database inserts. Validate that batching is actually effective for the key distribution and time window.

Use hierarchical aggregation when there is extreme fan-in or fan-out. Aggregate at edge or partition processors, then merge upward, and distribute downward through broadcast nodes.

### Hot-Key Handling

- Split all keys by a fixed factor when simplicity matters and read amplification is acceptable.
- Split only hot keys dynamically when skew is rare and detection is reliable.
- Ensure readers and writers agree on whether a key is split.
- Use aggregation only for data that can be merged safely, such as counts and metrics.

### Resharding

Use gradual migration:

- Add routing metadata for old and new shard locations.
- Dual-write during migration when necessary.
- Backfill old data to new shards.
- Prefer reads from the new shard once copied.
- Cut over after validation, then stop old writes.

## Dealing With Contention

### Recognition Signals

Use this pattern when:

- Multiple users/processes compete for the same scarce resource.
- Correctness depends on preventing double-booking, double-spend, lost updates, or overselling.
- Reads and writes can interleave around a business invariant.
- Examples include ticket seats, auctions, account balances, inventory, meeting rooms, driver matching, cart holds, rate limits, and average rating updates.

### Default Decision Path

Keep contended data in one database if possible. Single-database transactions, locks, and constraints are simpler and more reliable than distributed coordination.

1. Use atomic conditional writes for simple invariants.
2. Use pessimistic locking for high contention or scarce resources.
3. Use optimistic concurrency control when conflicts are rare.
4. Use serializable isolation when automatic conflict detection is worth the overhead.
5. Use reservations/holds for better user experience.
6. Move to distributed coordination only when data truly spans systems.

### Single-Database Checklist

- Put the invariant in the write predicate, not only in application code.
- Check affected row counts; a zero-row conditional update is not a database error.
- Use `UPDATE ... WHERE available > 0 RETURNING ...` or equivalent patterns to make success explicit.
- Keep locks narrow and short.
- Acquire multiple locks in a deterministic global order to prevent deadlocks.
- Set transaction timeouts and retry aborted transactions safely.
- Use dedicated monotonically increasing version columns for OCC when ABA is possible.

### Choosing A Technique

| Technique | Use When | Watch For |
|---|---|---|
| Pessimistic lock | Conflicts are common and correctness is critical | Lock duration, deadlocks, hot rows |
| Optimistic concurrency | Conflicts are rare and throughput matters | Retry storms, zero-row updates, ABA |
| Serializable isolation | You need database-managed conflict detection | Abort rate, overhead, engine differences |
| Reservation/hold | Users need time to complete a flow | TTL expiry, cleanup, payment timeout |
| Queue serialization | One hot resource must be strongly ordered | Latency and single-worker throughput |
| Distributed lock | One-at-a-time access across nodes | Expired locks, fencing tokens, coordination outage |
| 2PC | Atomic cross-system commit is mandatory | Blocking, coordinator recovery, availability loss |
| Saga | Cross-system workflow can tolerate pending states | Compensation correctness and user-visible inconsistency |

### Distributed Coordination

Use distributed coordination reluctantly.

- 2PC preserves atomicity but blocks during coordinator failure or network partitions.
- Distributed locks are simpler than 2PC but need TTLs, renewal, and fencing tokens to reject stale lock holders.
- Sagas avoid long-held locks by committing each step and compensating on failure, but expose temporary inconsistency.
- Workflow engines are often the durable coordinator for sagas.

### Hot Contention

When everyone wants one resource, normal scaling may not help. Sharding, load balancing, and read replicas do not remove a single-row write bottleneck.

Options:

- Change the product model, such as queue/waitlist/lottery/reservation window.
- Serialize writes through a dedicated queue for that resource.
- Split aggregate counters only when exact atomic state is not required.
- Rate-limit or shed low-priority attempts.

## Real-Time Updates

### Recognition Signals

Use this pattern when:

- Clients need to learn about changes soon after they happen.
- The product has chat, presence, progress, live dashboards, collaboration, auctions, streaming responses, driver locations, or live comments.
- The design needs server-to-client push or frequent bidirectional messages.

Real-time design has two hops:

1. Client-server connection protocol: how updates reach the client.
2. Source-to-endpoint propagation: how produced updates reach the server holding the client connection.

### Client-Server Protocol Choice

| Option | Use When | Avoid When |
|---|---|---|
| Simple polling | Latency tolerance is seconds and simplicity matters | Frequent updates or massive polling load |
| Long polling | Updates are infrequent but should arrive soon | High-frequency streams or many held requests |
| SSE | Server pushes one-way updates over HTTP | Client must send frequent real-time messages |
| WebSocket | Frequent bidirectional low-latency messages | Updates are one-way or infrequent |
| WebRTC | Audio/video, screen sharing, or peer-to-peer data is core | Normal CRUD, notifications, or simple chat |

Prefer polling or SSE unless bidirectional high-frequency traffic justifies WebSockets.

### Protocol Design Checklist

- Define message schema, sequence IDs, auth, authorization, and reconnect behavior.
- Use heartbeats to detect dead connections.
- Track last delivered event ID or sequence number so clients can catch up after reconnect.
- Plan deployment behavior: drain old connections or force reconnects safely.
- Monitor active connections, connection churn, message rate, send latency, backpressure, and reconnect storms.
- Choose load balancing based on connection shape: L7 for HTTP-style polling/SSE when supported, L4 or WebSocket-aware L7 for persistent connections.
- For WebSocket servers, keep endpoint servers thin and push heavy work to stateless services.

### Source-To-Endpoint Propagation

Use one of three patterns:

- Pull from database: simplest, but adds latency and DB read load.
- Consistent hashing: route each user/document/entity to a predictable connection server.
- Pub/sub: publish updates to topics and let endpoint servers forward to connected clients.

Use consistent hashing when connection-associated state is expensive and should live on one server. Use pub/sub when endpoint servers should stay lightweight and interchangeable.

### Consistent Hashing Notes

- Use a coordination service or routing metadata so servers agree on ownership.
- Use virtual nodes or equivalent balancing.
- During scale-up/down, move only affected connections where possible.
- During migration, route messages to old and new owners until transition completes.
- Expect connection state loss on server failure unless it is rebuildable.

### Pub/Sub Notes

- Useful for broadcasting to many clients or rooms.
- Endpoint servers can be balanced by least connections.
- Pub/sub can become the bottleneck or single point of failure.
- Shard topics by key when subscription count or throughput grows.
- Consider many-to-many connection overhead between pub/sub nodes and endpoint servers.

### Deep-Dive Risks

- Reconnect gaps can lose messages without sequence IDs or per-user streams.
- Message ordering is easiest when all related messages flow through one partition or server.
- WebSockets create stateful infrastructure; plan for deployment churn.
- Polling by millions of clients can become a read-scaling problem.
- Celebrity fanout needs hierarchical distribution, caching, batching, or pull-based feeds.

## Pattern Combinations

- Large blob upload plus long-running task: direct upload to object storage, then storage event triggers transcoding, scanning, indexing, or thumbnail workers.
- Long-running task plus real-time updates: workers update progress in DB/cache; clients use polling, long polling, SSE, or WebSocket for status.
- Multi-step process plus contention: workflow coordinates reservations, payments, fulfillment, and compensations, while single-DB locks/OCC protect scarce resources.
- Scaling writes plus contention: partition broad writes, but serialize or lock true hot resources.
- Scaling reads plus real-time updates: cache public state, but use event streams to invalidate or push changes where freshness matters.
- Large blobs plus scaling reads: store bytes in object storage, serve frequently accessed files through CDN with signed URLs and range requests.
- Scaling writes plus real-time updates: aggregate writes before broadcasting, otherwise fan-in/fan-out can overwhelm the system.

## Common Mistakes

- Choosing WebSocket just because the feature says "real-time."
- Adding Redis before proving a read bottleneck or defining invalidation.
- Using a queue to hide steady-state write overload.
- Sharding before fixing schema, indexes, hardware, and access patterns.
- Proxying large files through application servers without a validation reason.
- Trusting clients to mark uploads complete.
- Treating workflow engines as necessary for single-step jobs.
- Using distributed locks when one database transaction would work.
- Forgetting idempotency for retries, workers, activities, and payment-like side effects.
- Ignoring queue backpressure, DLQs, and poison messages.
- Ignoring replication lag after adding read replicas.
- Not checking affected row count for conditional writes.

## Recommended Response Shape

When using this reference, answer with:

```md
## Pattern recognized

- Primary pattern:
- Supporting patterns:
- Recognition signal:

## Recommendation

Start with ...

## Why this fits

- Requirement:
- Scale:
- Consistency:
- Latency:
- Operational simplicity:

## Key design details

- Data model:
- API/protocol:
- Queue/cache/storage/workflow:
- Idempotency and retries:
- Backpressure and failure handling:
- Observability:

## What I would not add yet

- ...

## Deep-dive risks

- ...

## Questions to confirm

1. ...
```
