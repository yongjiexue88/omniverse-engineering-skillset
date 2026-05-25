# System Design Sandboxed Long-Running Task Execution

## Purpose

Use this reference for systems that accept user-submitted work, process it
outside the request path, execute untrusted or resource-heavy tasks safely, and
return results through status polling or near-real-time materialized views.

This is a specialized case under Managing Long-Running Tasks, Secure Untrusted
Code Execution, Queue-Based Backpressure, and Near-Real-Time Materialized Views.
Use it with `system-design-pattern-recognition-playbook.md` and
`system-design-architecture-decision-playbook.md` when a design involves online
compilers, code judging, CI/build runners, file conversion, AI inference jobs,
browser automation, media/document processing, batch validation, or live
leaderboards.

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

A user submits work that may be slow, unsafe, CPU-heavy, memory-heavy, or
unpredictable. The system must execute it safely, return feedback quickly,
protect workers from abuse, and optionally update near-real-time aggregate
views.

The generic problem:

> How do we accept user work immediately, execute it safely outside the API
> server, expose status, and serve live derived results without crushing the
> primary database?

The design tensions:

- UX wants instant feedback.
- Execution may exceed normal request latency.
- Submitted work may be malicious or buggy.
- Workers must be protected from CPU, memory, filesystem, network, and
  infinite-loop abuse.
- Peak load may arrive suddenly during contests, traffic bursts, or batch
  submissions.
- Aggregated results such as leaderboards should feel live without repeated DB
  sorting.
- Strict consistency may not be worth the cost for engagement-only views.

## When To Use

Use this pattern when:

- Users submit work processed by backend workers.
- Execution may take hundreds of milliseconds, seconds, or longer.
- Workload can spike suddenly.
- The system needs isolation from user code, scripts, documents, browser jobs,
  models, or inputs.
- The API server should not block on heavy processing.
- The system needs status tracking such as `PENDING`, `RUNNING`, `SUCCESS`,
  `FAILED`, `TIMEOUT`, or `SYSTEM_ERROR`.
- Users can tolerate polling or delayed results.
- Results feed a near-real-time derived view such as leaderboard, ranking,
  dashboard, or progress page.
- The primary database remains source of truth while Redis/cache serves fast
  reads.

Common examples:

- Code judging platforms.
- CI/build runners.
- Online compilers.
- Document, video, image, or file conversion services.
- AI inference jobs.
- Browser automation jobs.
- Competition scoring systems.

## When Not To Use

Avoid or simplify this pattern when:

- Work is consistently tiny, safe, and well under request timeout.
- The user must receive the result synchronously and latency is reliably
  bounded.
- Workload is so low that a queue adds unnecessary operational complexity.
- Submitted work is trusted internal code and does not need sandboxing.
- Strong consistency is legally or financially required for aggregate views.
- Polling delay is unacceptable and true push is required.
- Worker startup latency would break the product requirement and there is no
  warm-pool strategy.

## Default Architecture

Use the API server as orchestrator, not executor:

```text
Client
  -> POST /submissions
  -> API validates request and auth
  -> Create durable Submission/Job row in PENDING
  -> Enqueue small job message with submission_id
  -> Return submission_id and status URL

Worker
  -> Lease queue message
  -> Atomically transition PENDING -> RUNNING
  -> Execute in isolated container/serverless sandbox
  -> Capture bounded output/result
  -> Store canonical result in DB
  -> Update derived views, such as Redis sorted set leaderboard
  -> Mark terminal state

Client
  -> Poll GET /submissions/:id/status
  -> Stop polling at terminal state
```

For leaderboards:

```text
Canonical submission result in DB
  -> outbox/event or worker update
  -> Redis sorted set materialized view
  -> leaderboard API reads top N with ZRANGE/ZREVRANGE
  -> periodic rebuild/reconciliation from DB
```

## Core Design Rules

### 1. Never run untrusted or heavy user work inside the API server

The API server should validate, persist, route, and expose status. It should not
execute unsafe or expensive user-submitted code directly.

Running user code inside request handlers risks:

- Process crashes.
- Infinite loops.
- Memory exhaustion.
- Fork bombs.
- Filesystem abuse.
- Network exfiltration.
- Secret leakage.
- Total service compromise.

Use a separate execution layer:

```text
Client -> API Server -> Job Record / Queue -> Isolated Worker Runtime -> Result Store
```

### 2. Choose sync versus async based on duration and spike behavior

Synchronous execution is acceptable only when work reliably completes quickly
and capacity is predictable.

Use this rule:

- Reliably sub-second to around one second: sync may be acceptable.
- Several seconds, variable runtime, or request timeout risk: async.
- Spiky load or constrained workers: queue plus status endpoint.
- Expensive workers: scale from queue depth and oldest message age.

Async systems require job state, polling/status APIs, retries, idempotency, and
eventual result handling, but they provide backpressure and durability.

### 3. Model tasks as explicit state machines

Once work is asynchronous, the system must survive client disconnects, retries,
worker crashes, and delayed completion.

Use durable states:

```text
PENDING -> RUNNING -> SUCCESS
                  -> FAILED
                  -> TIMEOUT
                  -> SYSTEM_ERROR
                  -> CANCELED
```

Store:

- `submission_id`
- `user_id`
- target such as `problem_id`, `build_id`, or `job_type`
- runtime/language/config
- status
- result
- error type
- timestamps: created, started, completed
- `worker_id`
- `attempt_count`
- idempotency key or client submission ID

Use atomic state transitions so duplicate workers or retries do not overwrite
terminal results incorrectly.

### 4. Prefer polling before WebSockets for short-lived status

Default API:

```text
POST /jobs -> { job_id, status: "PENDING" }
GET /jobs/:id/status -> current status/result
```

Polling every second for short-lived jobs is usually simpler, easier to scale,
and easier to debug than WebSockets.

Use WebSockets/SSE only when:

- Many updates happen per job.
- Latency must be sub-second.
- Users stay on a live page for a long time.
- Polling volume becomes more expensive than connection management.

### 5. Use containers or serverless as execution boundaries

Use containers when:

- Latency must be predictable.
- Runtime volume is steady.
- Warm pools matter.
- Fine-grained sandbox control is required.
- Runtimes need local tools or dependencies.

Use serverless when:

- Traffic is bursty or unpredictable.
- Operational simplicity matters.
- Cold starts are acceptable.
- Runtime and resource limits fit the task.

Containers avoid cold starts but require capacity management. Serverless scales
easily but has runtime limits, cold starts, and less sandbox control.

### 6. Protect sandboxes with layered restrictions

Do not rely on one isolation mechanism. Require defense in depth:

- Fresh isolated sandbox per job, or carefully cleaned reusable worker.
- Read-only filesystem for code and test files.
- Temporary writable directory with cleanup.
- CPU limit.
- Memory limit.
- Wall-clock timeout.
- Process/fork limit.
- Network disabled by default.
- No host mounts.
- No privileged containers.
- Non-root execution.
- Restricted syscalls when possible.
- Runtime dependency allowlist.
- Output and input size caps.
- Kill entire process tree on timeout.
- Remove secrets from environment.

### 7. Use queueing for backpressure, not only durability

The queue is a pressure valve between user traffic and worker capacity. It
prevents the API server from holding requests and lets the system smooth spikes.

Use queues when:

- Worker capacity is limited.
- Traffic spikes are expected.
- Jobs are expensive.
- Lost submissions are unacceptable.
- Retry and DLQ semantics are needed.

Scale workers based on:

- Queue depth.
- Oldest message age.
- Worker CPU/memory.
- Success/failure/timeout rate.
- P95/P99 processing time.

If enqueue rate remains above processing rate, queueing only delays failure.
Add autoscaling, admission control, rate limits, or load shedding.

### 8. Serve live rankings from Redis sorted sets

For high-read leaderboards, use a materialized view optimized for sorted reads
instead of querying and sorting the primary database on every poll.

Redis sorted set pattern:

```text
Key: competition:leaderboard:{competition_id}
Score: total score / ranking score / score-time composite
Member: user_id

ZADD competition:leaderboard:{id} {score} {user_id}
ZRANGE competition:leaderboard:{id} 0 N-1 REV WITHSCORES
```

Keep canonical submission results in the database. Treat Redis as a rebuildable
view.

### 9. Match consistency guarantees to business risk

For engagement leaderboards, a few seconds of staleness is often acceptable if
the view can be rebuilt from source-of-truth data.

Ask:

- Is money changing hands?
- Is there a legal requirement?
- Is the inconsistency temporary or permanent?
- Can the view be rebuilt from canonical data?
- Is stale state user-visible but harmless?
- Would strong consistency materially improve the product?

If ranking determines prizes, payment, legal outcomes, or irreversible
decisions, avoid Redis-only eventual consistency.

### 10. Keep source of truth separate from derived views

For rankings, dashboards, and counters:

- Write canonical result to the database.
- Update Redis/materialized view.
- Make the view rebuildable from database.
- Add reconciliation or periodic refresh.
- Accept temporary stale/missing view only when product risk is low.

## Architecture Decision Rules

- If user-submitted work can crash, hang, or consume resources, use isolated
  workers.
- If work reliably completes under normal request latency and load is
  predictable, synchronous execution may be simpler.
- If work may take seconds or spike, use queue plus workers plus status polling.
- If result visibility can tolerate a one-second delay, prefer polling over
  WebSockets.
- If updates must be pushed instantly to many clients, use WebSockets or SSE.
- If runtime traffic is bursty and cold starts are acceptable, prefer
  serverless.
- If latency must be predictable and volume is steady, prefer warm containers.
- If leaderboard data is high-read and frequently refreshed, use Redis sorted
  sets.
- If leaderboard consistency is low-risk and rebuildable, avoid distributed
  transactions.
- If ranking affects money, prizes, legal outcomes, or irreversible decisions,
  require stronger consistency than a Redis-only view.
- If jobs can be retried, make processing idempotent.
- If jobs are untrusted, disable network and privileged access by default.
- If queue depth grows beyond SLO, scale workers, admit fewer jobs, or shed load.
- If Redis leaderboard is lost, rebuild from canonical submission data.

## Production Guardrails

Submission API and lifecycle:

- Generate `submission_id` server-side.
- Never trust client-provided `user_id`, timestamps, score, runtime, or status.
- Store durable submission records before enqueueing work.
- Use idempotency keys for retries.
- Track explicit states and terminal outcomes.
- Store attempt count and worker ID.
- Add status polling endpoint.
- Return structured errors such as compile error, runtime error, wrong answer,
  timeout, and system error.
- Enforce per-user, per-IP, per-problem, and per-competition limits.

Queue and workers:

- Use visibility timeout longer than expected max runtime.
- Extend visibility for long jobs if needed.
- Use DLQ for repeated failures.
- Make workers idempotent.
- Add worker heartbeat.
- Detect stuck jobs.
- Requeue or mark failed when heartbeat expires.
- Autoscale by queue depth and oldest message age.
- Apply backpressure when queue is too deep.
- Use priority queues when interactive work should beat batch work.
- Separate queues by runtime/language when resource profiles differ.

Sandbox execution:

- Run each job in a fresh sandbox or fully cleaned reusable worker.
- Use read-only filesystem plus temporary writable directory.
- Enforce CPU, memory, wall-clock, process, input, and output limits.
- Disable network by default.
- Remove secrets from environment.
- Avoid privileged containers and host mounts.
- Run as non-root.
- Kill entire process tree on timeout.
- Capture stdout/stderr safely.
- Sanitize logs to avoid leaking test cases or secrets.
- Maintain runtime images and dependency allowlists.

Results and status delivery:

- Poll at bounded intervals.
- Use exponential backoff for long-running jobs.
- Stop polling after terminal state.
- Return cached result after completion.
- Keep result payload small.
- Store large artifacts separately.
- Index status endpoint by `submission_id`.

Leaderboard:

- Use database as source of truth.
- Use Redis sorted set as materialized ranking view.
- Use deterministic scoring formula.
- Store tie-breakers explicitly.
- Make Redis rebuildable from database.
- Add periodic reconciliation.
- Add TTL/lifecycle cleanup for competition keys.
- Avoid full DB sorting on every leaderboard poll.
- Cache top pages when needed.
- Monitor Redis memory and command latency.

Observability:

- Queue depth.
- Oldest queued job age.
- Job runtime by language/runtime.
- Compile/runtime/timeout/system-error rates.
- Worker crash rate.
- Sandbox kill reasons.
- API polling QPS.
- Leaderboard refresh latency.
- Redis hit/miss and command latency.
- Trace correlation from submission to worker to result update.

## Common Failure Modes

| Failure Mode | Cause | Mitigation |
|---|---|---|
| API server executes unsafe work | User code runs in request handler | Move execution to sandboxed workers |
| Infinite loop or fork bomb exhausts resources | Missing timeout/process/CPU/memory limits | Set strict limits and kill process tree |
| Worker crashes after picking job | Runtime crash or host termination | Queue visibility timeout, heartbeat, idempotent retry |
| Duplicate job execution | At-least-once queue or client retry | Idempotency keys, unique submissions, atomic state transitions |
| Queue backlog slows feedback | Traffic exceeds worker capacity | Autoscale, alerts, priority queues, rate limits |
| Cold starts violate SLO | Serverless/container creation overhead | Warm pools, prewarmed runtimes, dedicated workers |
| Sandbox leaks data or network | Secrets exposed, host mounts, network enabled | Remove secrets, disable network, restrict filesystem |
| Stale leaderboard | Redis view update delay | Accept if low-risk, show freshness, rebuild/reconcile |
| Leaderboard overloads DB | Every poll sorts DB records | Use Redis sorted sets/materialized pages |
| Polling overloads API | Clients poll too frequently | Bound intervals, backoff, stop on terminal state |
| DB result and leaderboard diverge | Worker writes DB but fails before Redis update | Outbox/event pipeline, periodic rebuild |
| Test cases leak | Logs or stdout expose private tests | Cap/redact output, split public/private result views |

## Clarifying Questions

Ask:

1. What is the expected P50/P95/P99 execution time?
2. What is the result latency SLO?
3. Can the client tolerate polling delay?
4. Is processing synchronous or asynchronous?
5. What is the peak submission rate?
6. Are peaks predictable, such as scheduled contests?
7. How many runtime languages or job types are supported?
8. Are runtimes prewarmed or created on demand?
9. What resource limits are needed per runtime?
10. Can user code access the network?
11. Can user code write files?
12. How are dependencies installed or restricted?
13. How are infinite loops killed?
14. How are fork bombs prevented?
15. How is stdout/stderr captured and capped?
16. What states can a submission enter?
17. Are submission retries allowed?
18. How are duplicates deduplicated?
19. What happens if the worker crashes mid-job?
20. What is the queue retry and DLQ policy?
21. How are stuck jobs detected?
22. What is the source of truth for results?
23. Is the leaderboard legally/financially important or just engagement?
24. How fresh must leaderboard data be?
25. Can Redis leaderboard be rebuilt from the database?
26. What is the tie-breaker logic for ranking?
27. How many users may poll during a live event?
28. Is WebSocket complexity justified?
29. What is the degradation plan if Redis is down?
30. What metrics prove the system is healthy?

## Reusable Agent Instructions

When designing a sandboxed long-running task system:

1. Do not execute untrusted or expensive user work inside the API server.
2. Create a durable job/submission record before starting execution.
3. Decide sync versus async based on duration, predictability, and peak load.
4. Use a queue when spikes, retries, or backpressure matter.
5. Expose a polling status API before choosing WebSockets.
6. Treat every job as a state machine with terminal states.
7. Make workers idempotent because queue delivery may duplicate.
8. Run untrusted work in containers, serverless functions, or hardened sandboxes.
9. Enforce read-only filesystem, CPU/memory/process limits, timeout, output
   cap, and network restrictions.
10. Keep secrets and internal test data out of the sandbox.
11. Use Redis sorted sets for high-read ranking views.
12. Keep the database as source of truth and Redis as rebuildable view.
13. Match consistency guarantees to business risk.
14. Add DLQ, reconciliation, worker heartbeat, and stuck-job cleanup.
15. Monitor queue depth, oldest job age, execution latency, timeout rate,
   worker crashes, and leaderboard freshness.

## Condensed Memory

Use this pattern for systems that execute user-submitted or long-running work.
Never run untrusted code in the API server. Create a durable job record, then
execute in isolated containers/serverless workers with CPU, memory, process,
filesystem, network, timeout, and output limits. Use synchronous execution only
for reliably short jobs; use queue plus workers plus polling status API when
execution can take seconds or spike. Prefer polling before WebSockets when
near-real-time feedback is enough. Model job states explicitly: `PENDING`,
`RUNNING`, `SUCCESS`, `FAILED`, `TIMEOUT`, `SYSTEM_ERROR`. Use idempotency keys,
visibility timeouts, retries, DLQ, worker heartbeat, and stuck-job repair. For
leaderboards or ranking views, store canonical results in the database and serve
fast near-real-time rankings from Redis sorted sets as a rebuildable materialized
view. Accept eventual consistency for low-risk engagement features; require
stronger consistency when money, legal outcomes, or irreversible decisions
depend on the ranking.
