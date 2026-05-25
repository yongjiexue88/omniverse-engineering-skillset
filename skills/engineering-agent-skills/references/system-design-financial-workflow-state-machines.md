# System Design Financial Workflow State Machines

## Purpose

Use this reference for payment processors, checkout, refunds, disputes, wallet
transfers, payouts, subscription billing, marketplace escrow, bank transfers,
insurance claims, or any workflow where money or irreversible business state
changes hands.

This is a specialized case under Multi-Step Processes, Durable Workflows/Sagas,
Financial Integrity, External-System Coordination, Idempotency, Auditability,
and Reconciliation.

## Core Problem Pattern

The system must coordinate a high-value workflow across internal services and
unreliable/asynchronous external networks while guaranteeing retry safety, no
data loss, auditability, and correct final state.

The hard parts:

- Merchants and clients retry requests.
- Customers refresh pages.
- External systems respond late, ambiguously, or out of order.
- Webhooks/callbacks can arrive more than once.
- Money movement must be explainable months later.
- Internal state must not claim success unless financial state supports it.
- Status updates must be pushed without losing events.
- Every state transition must be explainable.

## When To Use

Use this pattern when:

- A request starts a workflow that may not complete immediately.
- External systems determine part of the final outcome.
- Retried requests must not duplicate side effects.
- Each attempt and state transition must be durable.
- The product exposes a simple status while hiding internal complexity.
- Auditability matters for disputes, compliance, support, or legal evidence.
- Webhook/push notifications are needed.
- Data loss is unacceptable.
- Financial integrity matters more than raw availability.

Avoid the full pattern when the operation is read-only, has no real-world side
effect, duplicate execution is harmless, the flow fits in one local transaction,
or no audit/reconciliation trail is required.

## Default Architecture

```text
Merchant API
  -> auth + idempotency check
  -> PaymentIntent / Workflow row
  -> Transaction / Attempt row
  -> immutable audit event
  -> external processor/network call
  -> callback/webhook importer
  -> state machine transition
  -> outbox event
  -> durable merchant webhook delivery
  -> reconciliation jobs
```

Separate:

- Intent/workflow: stable client-facing object and lifecycle summary.
- Attempt/transaction/operation: one record per external attempt or money
  movement.
- Audit event: immutable explanation of every important transition.
- Ledger entry: accounting movement when balances are in scope.
- Webhook event: durable merchant notification workflow.

## Core Design Rules

### Separate Intent From Attempts

A merchant wants to collect, refund, transfer, or pay out money. Internally, the
system may authorize, fail, retry, capture, reverse, reconcile, or dispute. Keep
the client-facing intent stable and record attempts as child records.

### Use Explicit State Machines

Payments and financial workflows are not CRUD rows. Define valid transitions and
reject invalid ones.

Example:

```text
created -> processing -> authorized -> captured/succeeded
                      -> failed
                      -> canceled
                      -> unknown/requires_reconciliation
```

Use separate states for `pending`, `processing`, `unknown`, and terminal failure.
A timeout is not proof of failure.

### Make Idempotency An API Contract

Require idempotency keys on side-effecting APIs. Store merchant/account scope,
request fingerprint, original response, associated intent/transaction, and
expiry.

Rules:

- Same key plus same request returns same result.
- Same key plus different request returns conflict.
- Scope keys by merchant/account.
- Store enough response data to replay safely.

### Keep Immutable Audit Events

Current state is not enough. Persist important events: intent created,
transaction created, authorization requested/approved/declined, capture
requested/succeeded, callback received, webhook sent/failed, reconciliation
mismatch detected, and manual adjustment applied.

### Design Reconciliation From The Start

External networks can time out after success, send duplicate callbacks, delay
settlement, or disagree with internal records. Reconcile internal transactions,
external processor reports, settlement files, and ledger balances.

### Treat Webhooks As Durable Delivery

Merchant notifications are reliable delivery workflows, not simple callbacks.
Generate events after durable state changes, sign payloads, retry with backoff,
track attempts, allow replay, and document idempotent merchant handling.

### Isolate Sensitive Payment Data

Minimize the number of services that can touch raw credentials. Prefer hosted
payment pages, secure iframes, tokenization, encryption, KMS/HSM, scoped
service access, redacted logs, and PCI boundary isolation.

### Use Ledger Entries For Balances

When balances, payouts, refunds, disputes, or transfers are in scope, use
append-only double-entry ledger entries rather than mutable balances alone.

Invariant:

```text
sum(debits) == sum(credits)
```

## Architecture Decision Rules

- If a workflow has real-world side effects, model it as a durable state
  machine.
- If clients can retry side-effecting calls, require idempotency keys.
- If one customer action can produce multiple attempts, separate intent from
  transaction.
- If current state must be auditable, keep immutable event history.
- If external systems participate, design reconciliation.
- If merchants need fulfillment automation, use durable signed webhooks.
- If webhooks are used, deliver them with retries and replay.
- If raw payment data is involved, isolate sensitive data handling.
- If money balances are tracked, use double-entry ledger entries.
- If external response is ambiguous, avoid marking terminal success/failure.
- If DB write and event publish must both happen, use outbox/event log.

## Production Guardrails

API and idempotency:

- Require idempotency keys for creation/confirmation/side-effecting calls.
- Scope idempotency by merchant/account.
- Store request fingerprint and original response.
- Reject same key with different request body.
- Generate server-side intent/transaction IDs.
- Use integer minor units and explicit currency.

State machine:

- Define valid transitions.
- Store transition reason and actor/source.
- Use optimistic locking/versioning on intent state.
- Keep terminal states stable unless explicitly reversible.
- Distinguish failed from unknown/pending external confirmation.
- Use server time for transitions.

Durability and auditability:

- Append immutable events for attempts, callbacks, webhooks, reconciliation, and
  admin changes.
- Never hard-delete financial records.
- Store external request/response references and processor IDs.
- Encrypt sensitive fields and redact logs.
- Require audit trail for support/manual operations.

External integrations:

- Use external idempotency/reference IDs when available.
- Set timeouts and classify retryable versus ambiguous failures.
- Do not retry ambiguous operations blindly.
- Verify callback signatures.
- Deduplicate callbacks by external event ID.
- Handle out-of-order callbacks with transition validation.
- Maintain unknown/reconciliation-needed state.

Webhooks:

- Generate webhook event after state commit using outbox/event log.
- Sign payloads and include event ID/timestamp.
- Retry with exponential backoff.
- Track delivery attempts and last error.
- Provide merchant event logs and replay.
- Move repeated failures to DLQ/manual review.

Ledger and accounting:

- Use double-entry rows for balances.
- Enforce debit/credit invariants transactionally.
- Model refunds, disputes, reversals, and payouts as separate movements.
- Use adjustment entries instead of mutable-only corrections.

Observability:

- Payment success/failure rate and authorization latency.
- External timeout and unknown-state counts.
- Retry count by error class.
- Idempotency conflict count.
- Webhook delivery latency/failure rate.
- Reconciliation mismatch count.
- Ledger imbalance alerts.
- Invalid transition count and queue/outbox lag.

## Common Failure Modes

| Failure Mode | Cause | Mitigation |
|---|---|---|
| Double charge from retry | Missing idempotency | Require idempotency keys and external reference IDs |
| Lost transaction record | External call before durable write | Persist intent/attempt/audit before or around external call |
| Timeout marked failed | Ambiguous external outcome | Use pending/unknown, callback, lookup, reconciliation |
| Duplicate callback | External retry | Deduplicate by external event ID |
| Out-of-order callback corrupts state | Late settlement/failure event | Transition validation and reconciliation |
| Merchant fulfills twice | Duplicate webhook | Event ID and idempotent merchant handling |
| Webhook lost after success | Dual-write failure | Outbox and retryable webhook delivery |
| Internal/external mismatch | Missed callback or manual adjustment | Reconciliation and exception workflow |
| Ledger imbalance | Partial accounting write | Transactional double-entry invariant checks |
| Sensitive data leak | Raw payload logging | Tokenization, redaction, PCI isolation |
| Manual change breaks audit | Direct current-state update | Append admin adjustment event |

## Clarifying Questions

- Is the workflow authorization-only, capture-only, auth-and-capture, refund,
  payout, dispute, transfer, or subscription?
- Can one intent have multiple attempts or partial outcomes?
- What states must clients/merchants see?
- What peak TPS and latency requirements apply?
- Which external systems are authoritative?
- Do external systems support idempotency/reference IDs?
- What happens on timeout or ambiguous response?
- Can callbacks arrive duplicate or out of order?
- What reconciliation source of truth exists?
- What audit retention is required?
- Are ledger balances, payouts, refunds, or disputes in scope?
- Where is sensitive payment data collected and tokenized?
- Do merchants need webhooks, replay, or event logs?
- What manual operations are allowed?

## Reusable Agent Instructions

- Model the user-facing request as an intent/workflow object.
- Model each internal money movement attempt as a separate transaction/operation.
- Treat the workflow as a durable state machine.
- Require idempotency keys for side-effecting APIs.
- Store immutable audit events for every attempt and transition.
- Never rely only on current status for auditability.
- Distinguish failed from unknown or pending external confirmation.
- Do not retry ambiguous external operations blindly.
- Deduplicate external callbacks and validate state transitions.
- Use durable signed webhooks for merchant automation.
- Use outbox/event log for reliable notification publication.
- Run reconciliation against external networks and settlement reports.
- Use double-entry ledger entries when balances/payouts are in scope.
- Minimize sensitive-data exposure with tokenization, encryption, scoped access,
  and redaction.

## Condensed Memory

Use this pattern for payment processors and high-integrity financial workflows.
Separate the merchant-facing intent from internal transaction attempts. Treat the
workflow as a durable state machine, require idempotency keys, store immutable
audit events, handle timeouts as ambiguous, dedupe callbacks, validate state
transitions, reconcile against external systems, and use durable signed webhooks
for merchant updates. When balances are in scope, use double-entry ledger
entries. Core guardrails are idempotency store, request fingerprints,
optimistic locking, outbox, retry/DLQ, webhook replay, reconciliation, ledger
invariants, tokenization/encryption, redacted logs, and audit trails.
