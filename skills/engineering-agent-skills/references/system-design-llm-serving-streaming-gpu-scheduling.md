# System Design LLM Serving With Streaming And GPU Scheduling

## Purpose

Use this reference for ChatGPT-like serving systems where users send prompts,
receive streamed AI responses, view chat history, and resume conversations with
prior context. Treat the model as a black-box worker unless model internals are
explicitly in scope.

This is a specialized case under Real-Time Updates, Long-Running Task
Management, GPU-Constrained Scheduling, LLM Serving, Context-Cost Control,
Streaming UX, Admission Control, and Fairness.

## Core Problem Pattern

The system must serve long-running AI generation requests with low
time-to-first-token, smooth streaming, fair access to scarce accelerators, and
bounded cost as user context grows.

This is not normal request/response CRUD. It combines:

- One-way token streaming.
- Long-running generation lifecycle.
- Expensive scarce compute scheduling.
- Admission control and fairness.
- Stateful generation tracking.
- Context loading, truncation, summarization, retrieval, and caching.
- Cancellation and partial failure handling.
- Final-message persistence rather than per-token durability.

## When To Use

Use this pattern when:

- Requests produce output incrementally over seconds.
- Time-to-first-result matters more than total task duration.
- Output can be streamed to the user.
- Compute is scarce, expensive, or accelerator-bound.
- User tiers require different priority or quotas.
- Admission control is needed under overload.
- User context grows over time and affects cost/latency.
- Cancellation is a first-class feature.
- Final response durability is required, but every streamed chunk does not need
  permanent storage.

Avoid the full pattern when responses are always fast enough for normal HTTP,
there is no streaming requirement, compute is cheap/homogeneous, every chunk
must be durably persisted, or context size does not grow.

## Default Architecture

```text
Client
  -> API Gateway: auth, rate limit, quota
  -> Chat Service: message write, context assembly, run creation
  -> Generation row: queued/streaming/done/cancelled/failed
  -> Inference Scheduler: admission, priority, worker selection
  -> GPU Inference Workers: prefill/decode, continuous batching
  -> token stream buffer keyed by runId
  -> Chat Service / SSE connection
  -> Client

On completion:
  -> persist final assistant message
  -> update generation usage/token counts
```

Use SSE at the browser edge for one-way token streaming. Use gRPC
server-streaming or another typed streaming RPC internally from worker to
orchestrator.

## Core Design Rules

### Separate Chat/API Tier From Inference Tier

Keep the user-facing chat service stateless and cheap. Isolate GPU/model
execution behind an inference scheduler and workers so ordinary API traffic and
accelerator-bound inference can scale independently.

### Optimize Time-To-First-Token

Track time-to-first-token separately from total generation time. A long response
can feel acceptable if tokens stream quickly; a blank screen feels broken.

Track:

- Time to first token.
- Queue wait.
- Token throughput.
- Stream gap/pause duration.
- Total generation time.
- Stream failure rate.

### Prefer SSE For Browser Token Streaming

LLM generation is usually request then server-to-client stream. SSE fits this
well. Use a separate HTTP endpoint for cancellation. Use WebSockets only if the
client must send frequent mid-stream messages.

### Use Typed Internal Streaming

Browser protocol and internal protocol can differ. Use gRPC server-streaming or
equivalent between inference workers and orchestration so token events,
sequence numbers, errors, and cancellation are explicit.

### Model Generation As A First-Class Entity

Create a `Generation` or `Run` record:

- `run_id`, `chat_id`, `message_id`, `user_id`, `model`.
- Status: `queued`, `streaming`, `done`, `cancelled`, `failed`.
- Input/output token counts.
- Created/started/finished/cancelled timestamps.
- Worker ID, queue priority, error reason.

Scheduling, billing, quotas, retries, and cancellation attach to this lifecycle.

### Avoid Pinning Streams To One Fragile Server

If the chat service instance owns the SSE connection and worker stream for the
full generation, deploys and pod crashes kill active responses. Use a temporary
stream buffer or broker keyed by `run_id`, plus reconnect with event IDs.

### Persist Final Messages, Not Every Token

Writing every token to the primary DB creates severe write amplification. Store
in-flight chunks in a temporary buffer for reconnect and persist the final
assistant message when complete. Persist coarse partial state only if product
requirements demand it.

### Schedule Scarce GPU Workers

Do not call GPU workers directly under load. Put queues, admission control,
priority, worker health/capacity tracking, and backpressure in front of workers.

### Use Continuous Batching

Batch compatible requests dynamically by model/config. Track prefill and decode
phases separately, add/remove requests as generations start/finish, and enforce
latency SLOs so batching does not starve smaller requests.

### Separate Fairness From Tier Priority

Use both:

- Per-user/account fairness: concurrency, request rate, token budgets.
- Tier priority: paid/free weights, queue priority, model access, degradation
  policy.

During scarcity, degrade low-priority/free traffic first with queueing,
throttling, smaller models, shorter max output, or try-later responses.

### Control Context Cost

Do not send full conversation history forever. Use a layered context policy:

- Recent messages verbatim.
- Older messages summarized.
- Important facts retrieved from memory/index.
- Prefix/KV caching for stable prefixes.
- Hard token budget enforcement.
- Model routing for cheaper/simple requests.

## Architecture Decision Rules

- If output is one-way stream from server to browser, prefer SSE.
- If clients need frequent mid-stream input, prefer WebSockets.
- If internal services stream chunks, prefer typed server-streaming RPC.
- If generation takes seconds, model it as a Generation entity.
- If GPU workers are scarce, use scheduler, queue, admission control, and
  backpressure.
- If user tiers exist, use weighted scheduling.
- If individual users can submit many prompts, enforce concurrency and token
  budgets.
- If streams must survive deploys, decouple token generation from connection
  holders.
- If per-token durability is not required, avoid writing chunks to the primary
  DB.
- If history/resume matters, persist final assistant messages.
- If conversations grow long, use truncation, summarization, retrieval, and
  prefix caching.
- If requests are simple or low-tier, route to cheaper models where acceptable.

## Production Guardrails

Generation lifecycle:

- Status table for queued, streaming, done, cancelled, failed.
- Idempotency keys for prompt submission retries.
- Ownership checks from auth context.
- Timeouts for queue wait, TTFT, generation duration, and idle streams.
- Stuck-generation repair jobs.

Streaming:

- SSE event IDs and sequence numbers.
- Temporary stream buffer by `run_id`.
- Reconnect/resume with last event ID.
- Heartbeats and slow-client backpressure.
- Clear UX for cancelled/failed partial answers.

Cancellation:

- Separate cancel endpoint.
- Propagate cancel to scheduler and worker.
- Stop decode, remove from batch, release GPU slot.
- Track cancellation rate and billing semantics.

Scheduling:

- Admission control by capacity.
- Per-tier queue limits and priorities.
- Per-user/account concurrency and token budgets.
- Worker health and capacity tracking.
- Continuous batching by model/config compatibility.
- Queue wait and GPU utilization metrics.

Context and cost:

- Input/output token accounting per run/user/tier/model.
- Context budget enforcement.
- Summarization/truncation policy.
- Retrieval/memory policy and scope.
- Prefix cache key includes exact prefix, model, tokenizer, and config.
- Model routing policy and cache bypass rules for sensitive/personalized prompts.

Persistence:

- Persist user messages before scheduling.
- Persist final assistant message after completion.
- Avoid per-token DB writes.
- Store final run token counts and model metadata.

Safety/security:

- Input moderation before scheduling where required.
- Optional chunk/output moderation before flushing or after completion depending
  on product policy.
- Redaction of prompts/responses in logs where needed.
- Tenant/org isolation and audit logs for enterprise contexts.

Observability:

- TTFT, queue wait, total generation time.
- Tokens/sec and stream gap duration.
- GPU utilization, batch size, KV/cache hit rate.
- Scheduler rejection/throttle counts.
- Cancellation rate and failed/stuck runs.
- Cost per run/user/tier/model.
- Context size distribution and truncation/summarization rate.

## Common Failure Modes

| Failure Mode | Cause | Mitigation |
|---|---|---|
| Blank screen before response | Full synchronous generation | SSE token streaming and TTFT SLO |
| Polling overload | Clients poll for chunks | Server push over SSE |
| Lumpy stream | Polling/buffering returns token batches | Stream tokens as produced |
| Stream dies during deploy | Client pinned to one pod | RunId stream buffer and reconnect |
| Duplicate prompt | Client retries POST | Idempotency key |
| GPU saturation | Direct worker calls | Scheduler, admission control, backpressure |
| Paid users starved | FIFO queue | Tier-weighted scheduling |
| One user hogs capacity | No per-user budget | Concurrency/token quotas |
| High GPU cost | Low utilization or oversized model | Continuous batching and model routing |
| Context too long | Full history every turn | Truncation, summarization, retrieval |
| Cancel does not stop billing | UI closes stream only | Propagate cancel to worker |
| Partial answer lost | Crash before final persistence | Temporary buffer and reconnect |
| DB overloaded by chunks | Every token written to DB | Persist final message only |
| Stuck queued runs | Worker/scheduler failure | Leases, timeouts, repair job |
| Unsafe output already streamed | Moderation too late | Chunk moderation or post-hoc policy |

## Clarifying Questions

- What is the target time-to-first-token?
- What full generation duration is acceptable?
- How many peak prompts/sec and concurrent in-flight streams?
- What user tiers, quotas, and model access rules exist?
- Is inference self-hosted or external API-backed?
- Are multiple models available, and is model routing allowed?
- Can low-tier/free users be delayed, downgraded, or rejected under load?
- What is max context length and context policy?
- Are partial outputs persisted or only final messages?
- How should cancellation behave and bill?
- Can users resume dropped streams?
- How long should chunks be buffered?
- What happens when GPU capacity is exhausted?
- Is output moderation required before tokens reach the user?

## Reusable Agent Instructions

- Treat the model as a black-box worker unless internals are in scope.
- Separate stateless chat/API tier from GPU-bound inference tier.
- Optimize TTFT separately from total generation time.
- Use SSE for one-way browser token streaming.
- Use gRPC/server-streaming internally for worker-to-service tokens.
- Create a first-class Generation/Run entity.
- Track lifecycle state, token counts, model, worker, and timestamps.
- Put queues, scheduling, and admission control before GPU workers.
- Use continuous batching for utilization.
- Separate per-user fairness from tier priority.
- Enforce concurrency and token budgets.
- Degrade low-priority traffic first during scarcity.
- Persist final assistant messages, not every token.
- Use a temporary stream buffer for reconnect/resume.
- Support cancellation and propagate it to workers.
- Control long-context cost with truncation, summarization, retrieval, and
  prefix caching.
- Route simple prompts to cheaper models when quality allows.
- Track TTFT, tokens/sec, queue wait, GPU utilization, batch size, cache hit
  rate, cancellation rate, and cost per run.

## Condensed Memory

LLM serving combines real-time streaming, long-running generation lifecycle,
scarce GPU scheduling, fairness, and context-cost control. Separate cheap
Chat/API services from GPU inference workers. Use SSE for browser token
streaming and typed server-streaming internally. Model each inference as a
Generation with lifecycle state, token counts, model, worker, and timestamps.
Avoid polling and avoid writing every token to the primary DB; persist final
assistant messages and keep in-flight chunks in a temporary stream buffer for
reconnect. Put scheduler, queues, admission control, tier priority, per-user
budgets, cancellation, and continuous batching before GPU workers. Manage long
context with truncation, summarization, retrieval, prefix caching, model
routing, and cost accounting.
