# System Design Distributed Job Scheduler

## Purpose

Use this reference for systems that schedule one-time or recurring jobs, execute
them close to their intended time, and recover safely from worker failures. The
system supports immediate, future, and recurring schedules; job status
monitoring; high availability; near-time execution precision; high throughput;
and at-least-once execution.

This is a specialized case under Long-Running Task Management, Delayed
Execution, Distributed Scheduling, and At-Least-Once Processing. Use it with
`system-design-pattern-recognition-playbook.md` and
`system-design-architecture-decision-playbook.md` when a design involves CRON,
future jobs, delayed queues, recurring schedules, job materialization,
visibility timeouts, DLQs, or idempotent scheduled side effects.

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

The system must persist job definitions, materialize due executions, dispatch
them near their scheduled time, and guarantee at-least-once execution despite
worker crashes, queue failures, and retries.

The hard parts:

- Finding jobs due soon without scanning all jobs.
- Supporting recurring schedules without evaluating every CRON expression
  constantly.
- Meeting precision without excessive DB polling.
- Handling worker failure during execution.
- Avoiding duplicate side effects under at-least-once execution.
- Tracking job status accurately.
- Scaling dispatch/execution to thousands of jobs per second.

Mental model:

```text
Job definition != Job execution instance
Schedule scanning != Near-time dispatch
Queue delivery != Business idempotency
At-least-once execution != Exactly-once side effects
```

## When To Use

Use this pattern when:

- Users need to schedule work now, later, or repeatedly.
- Jobs may execute seconds, minutes, hours, or days in the future.
- Recurring schedules such as CRON are required.
- Execution precision matters.
- Job execution can be retried.
- Workers may crash mid-job.
- Job status must be visible to users.
- Availability is preferred over perfect consistency.
- Duplicate execution is tolerable when task handlers are idempotent.

Examples:

- Email/report schedulers.
- Billing/subscription renewal jobs.
- Background workflow triggers.
- Notification delivery.
- Batch maintenance tasks.
- Data pipeline scheduling.
- Reminder systems.
- Distributed task runners.

## When Not To Use

Avoid this full pattern when:

- Jobs are simple fire-and-forget background tasks with no scheduled time.
- The system only needs immediate async processing.
- A managed scheduler such as EventBridge, Cloud Scheduler, or Temporal already
  fits.
- One database poller and worker are enough.
- Execution precision does not matter.
- Jobs cannot be safely retried.
- The business requires true exactly-once external side effects.

For small systems, a cron process polling due rows may be enough. For complex
multi-step workflows, use a workflow engine instead of building a scheduler.

## Default Architecture

Use durable schedule storage plus near-time dispatch:

```text
Create/update schedule
  -> validate task type, params, timezone, recurrence
  -> write JobDefinition and/or JobExecution rows

Scheduler scanner/materializer
  -> periodically query executions due in next lookahead window
  -> expand recurring definitions into JobExecution rows
  -> conditionally mark due executions ENQUEUED
  -> send delayed queue message with delay = scheduled_at - now

Worker
  -> receives visible message near scheduled_at
  -> marks execution RUNNING
  -> executes task with idempotency key
  -> updates status SUCCEEDED/FAILED/RETRYING/DLQ
  -> deletes/acks message only after durable status update
```

## Core Design Rules

### 1. Separate job definitions from execution instances

A recurring definition is not the executable unit. Store reusable schedules
separately from concrete occurrences.

Example entities:

```text
JobDefinition:
  job_id
  user_id
  task_type
  schedule_type: ONCE | CRON | INTERVAL
  schedule_expression
  timezone
  params
  status

JobExecution:
  execution_id
  job_id
  scheduled_at
  status: SCHEDULED | ENQUEUED | RUNNING | SUCCEEDED | FAILED | RETRYING | DLQ
  attempt_count
  idempotency_key
  locked_until / queue_message_id
```

Materialize upcoming execution instances ahead of time. Use
`unique(job_id, scheduled_at)` to prevent duplicate recurring occurrences.

### 2. Use a two-layer scheduler

Use the database as durable source of truth for long-term schedules and a
delayed queue/timestamp priority queue for near-term dispatch.

Do not rely only on a coarse cron poller when precision matters. Do not put all
future jobs directly into a normal FIFO/log queue, because due-sooner jobs may
sit behind older messages.

### 3. Use delayed queues for near-time precision

A scheduler needs a dispatch mechanism where messages become visible at or near
`scheduled_at`.

Options:

- SQS delay queue for near-term delayed delivery.
- Redis sorted set as custom priority queue by timestamp.
- RabbitMQ delayed messages / TTL + DLX if already operating RabbitMQ.
- Database polling only for low scale or loose precision.

Delayed queues usually guarantee "not before", not exact timing. Measure lag.

### 4. Prefer managed visibility semantics

Worker failure is hard. Prefer queue visibility timeout/ack semantics over
custom distributed leases when possible:

```text
receive message
  -> message hidden for visibility_timeout
  -> worker processes
  -> worker deletes message on success
  -> if worker crashes, message becomes visible again
```

For long jobs, extend visibility with heartbeat. If heartbeat stops, another
worker retries.

### 5. Design for at-least-once and idempotent tasks

Duplicate execution is normal under at-least-once delivery.

Every task should define:

```text
idempotency_key = execution_id or business_key
side_effect_dedupe_key = task_type + target_id + scheduled_at
```

Prefer:

- Set state to desired value.
- Insert if not exists.
- Send with idempotency key.
- Charge with idempotency key.
- Mark completed conditionally.

Avoid blind increments, sends, charges, or duplicate appends.

### 6. Treat queue delay as an SLO, not a guarantee

Track:

```text
schedule_lag = actual_start_time - scheduled_at
enqueue_lag = enqueued_at - scheduled_at
```

Queue delay, worker polling, worker capacity, and downstream latency all affect
precision.

### 7. Use lookahead windows

If the delayed queue supports short delays, continuously materialize near-term
executions:

```text
Every 30s:
  find SCHEDULED executions where scheduled_at <= now + 5m
  UPDATE ... SET status='ENQUEUED'
    WHERE execution_id=? AND status='SCHEDULED'
  enqueue with delay
```

Use overlapping windows, conditional updates, and backfill for scanner outages.

### 8. Materialize recurring schedules safely

Recurring jobs are infinite. Generate bounded future executions and ensure
scanner/worker crashes cannot skip or duplicate future occurrences.

Approaches:

- Rolling lookahead materialization.
- Completion-driven next occurrence.

Define missed-run and overlapping-run semantics explicitly.

## Architecture Decision Rules

- If jobs can be scheduled far in the future, store schedules durably in a DB.
- If jobs must execute near scheduled time, use DB plus delayed queue.
- If the queue is FIFO/log-based, avoid using it directly as a scheduler.
- If jobs are due within a lookahead window, use delayed delivery queues.
- If using SQS, keep delay within the supported max and scan ahead.
- If workers can crash, use visibility timeout plus heartbeat extension.
- If execution can exceed visibility timeout, extend visibility periodically.
- If tasks have external side effects, require idempotency keys.
- If recurring jobs exist, separate definitions from executions.
- If scanners overlap, use conditional state transitions.
- If exact timing matters, measure schedule lag.
- If a job fails repeatedly, send it to DLQ.
- If per-tenant/user/resource ordering matters, shard or serialize by that key.
- If jobs are long-running multi-step workflows, consider a workflow engine.

## Production Guardrails

Job model and state:

- Separate `JobDefinition` from `JobExecution`.
- Use explicit states: `SCHEDULED`, `ENQUEUED`, `RUNNING`, `SUCCEEDED`,
  `FAILED`, `RETRYING`, `DLQ`.
- Unique `(job_id, scheduled_at)` for recurring jobs.
- Store scheduled, started, finished, attempt count, last error, next retry.
- Store immutable task parameters per execution.
- Store idempotency key on every execution.
- Version task definitions and parameters.

Scanner/materializer:

- Use lookahead windows.
- Run frequently enough for precision SLO.
- Use overlapping windows.
- Use conditional updates to avoid duplicate enqueue.
- Record checkpoints for large scans.
- Handle clock skew.
- Shard scanning by time bucket, tenant, or job hash.
- Monitor scan and enqueue lag.
- Backfill missed windows.

Queue/dispatch:

- Use delayed delivery for near-term execution.
- Treat delay as minimum, not exact.
- Configure max receive count and DLQ.
- Use visibility timeout for worker ownership.
- Heartbeat/extend visibility for long jobs.
- Keep messages small.
- Include execution ID and idempotency key.
- Make enqueue idempotent.
- Monitor queue depth, oldest message age, redrive count.

Worker execution:

- Make handlers idempotent.
- Ack/delete only after successful task completion and status update.
- Retry with exponential backoff and jitter.
- Set timeout per task type.
- Limit concurrency by tenant/user/resource.
- Use circuit breakers for dependencies.
- Gracefully stop receiving and finish/checkpoint in-flight work.
- Distinguish retryable from non-retryable failures.

Recurring jobs:

- Parse/validate CRON on creation.
- Store timezone explicitly.
- Define DST behavior.
- Prevent duplicate occurrences.
- Define missed execution behavior: skip, run once, or catch up.
- Define overlapping-run behavior.
- Recompute schedule safely after edits/cancellations.

Idempotency and side effects:

- Use execution ID for downstream idempotency.
- Prefer conditional writes/upserts.
- Store side-effect completion markers.
- Use outbox pattern where needed.
- Make status updates monotonic where possible.
- Reconcile ambiguous outcomes after timeout.

Observability:

- Schedule lag.
- Enqueue lag.
- Execution duration by task type.
- Success/failure/retry/DLQ rates.
- Queue depth and oldest age.
- Worker saturation.
- Visibility timeout extensions.
- Duplicate execution attempts.
- Idempotency dedupe hits.
- Scanner lag and missed windows.
- Recurring materialization errors.
- Downstream dependency failures.

## Common Failure Modes

| Failure Mode | Cause | Mitigation |
|---|---|---|
| Job executes late | Coarse scanner, queue backlog, insufficient workers | Short scanner interval, lookahead, autoscaling, lag SLO |
| Job missed entirely | Scanner crash or non-overlapping windows | Overlapping scans, durable DB, conditional enqueue, backfill |
| Job executes twice | At-least-once queue, timeout, ambiguous retry | Idempotency keys, dedupe tables, visibility heartbeat |
| Worker crashes mid-job | Node/process failure | Visibility timeout makes job visible again; DLQ repeated failures |
| Worker loses connectivity | Network partition | Assume duplicate execution; idempotency and short leases |
| Message visible while running | Visibility timeout too short | Extend visibility periodically |
| DLQ fills | Poison jobs or bad params | Classify errors, stop non-retryable retries, alert and replay |
| Duplicate recurring executions | Multiple scanners materialize same occurrence | Unique `(job_id, scheduled_at)` |
| Recurring occurrence skipped | Materializer outage or next-run bug | Backfill scan, last materialized time, catch-up policy |
| DST breaks schedule | No timezone/DST policy | Store timezone and explicit DST behavior |
| Retry storm | Many jobs retry immediately | Backoff, jitter, retry budgets, circuit breakers |
| Status page wrong | Queue state and DB status diverge | DB as source of truth and reconciliation |

## Clarifying Questions

Ask:

1. Schedule types: immediate, one-time future, interval, CRON?
2. Execution precision: seconds, minutes, or best effort?
3. Average and peak jobs/sec?
4. Maximum future scheduled jobs?
5. How long can jobs run?
6. CPU-heavy, IO-heavy, or external API-heavy?
7. Are tasks idempotent today?
8. What side effects can jobs perform?
9. What means success per task type?
10. What after repeated failure?
11. Is at-least-once enough or is exactly-once expected?
12. Can duplicate emails/charges/notifications happen?
13. Retry policy by task type?
14. Missed recurring runs: skip or catch up?
15. Can recurring jobs overlap?
16. Timezone and DST semantics?
17. How do users monitor status?
18. Job history retention?
19. Are jobs cancelable/reschedulable?
20. Max scheduling horizon?
21. Which managed schedulers/queues are allowed?
22. Are jobs tenant-isolated?
23. Per-user/per-tenant rate limits?
24. What if scanner is down for 30 minutes?
25. What if side effect succeeds but status update fails?

## Reusable Agent Instructions

When designing distributed schedulers:

1. Separate job definitions from execution instances.
2. Treat DB as durable source of truth for schedules and status.
3. Use DB for long-term schedules and delayed queue for near-term dispatch.
4. Do not rely on coarse cron polling when precision matters.
5. Do not use normal FIFO/log queues as schedulers for out-of-order due times.
6. Materialize recurring schedules into bounded execution instances.
7. Use unique keys to prevent duplicate occurrences.
8. Use delayed queues or timestamp-priority queues.
9. Use queue visibility timeout or leases for worker ownership.
10. Prefer managed visibility semantics over custom distributed locks.
11. Heartbeat/extend visibility for long jobs.
12. Assume at-least-once execution; make tasks idempotent.
13. Include idempotency keys in downstream side effects.
14. Use retries with backoff and DLQ.
15. Track schedule lag, enqueue lag, execution duration, retry rate, and DLQ.
16. Define timezone, DST, missed-run, and overlapping-run semantics.
17. Add reconciliation/backfill for scanner outages and stuck executions.

## Condensed Memory

A distributed job scheduler is a Long-Running Task / Delayed Execution pattern.
Separate `JobDefinition` from `JobExecution`: definitions store reusable
schedules such as CRON, while executions are concrete scheduled instances. Use
the database as durable source of truth and a near-time delayed queue for
dispatch. A coarse cron scanner alone can miss or delay jobs; a normal FIFO/log
queue is also wrong because jobs due sooner can sit behind older messages. Use a
two-layer architecture: scanner queries jobs due in the next lookahead window,
conditionally marks them enqueued, and sends delayed messages so workers see
them near `scheduled_at`. SQS is a strong managed option for near-term delays,
visibility timeout, retry, and DLQ; Redis ZSET can work but needs more
operational ownership. Worker failure should be handled with visibility timeout
plus heartbeat extension. The system provides at-least-once execution, so task
handlers must be idempotent. Recurring jobs need bounded materialization, unique
`(job_id, scheduled_at)`, timezone/DST rules, and missed-run semantics.
Guardrails: idempotent enqueue, conditional state transitions, retries with
backoff, DLQ, visibility heartbeat, scanner backfill, status tracking,
schedule-lag SLOs, duplicate detection, and reconciliation for stuck jobs.
