# Architecture Decision Review Checklist

Use this checklist for ADRs, RFC decisions, tradeoff analyses, and architecture proposals.

## Decision Framing

- Is the decision statement specific and actionable?
- Is the current context clear enough for future readers?
- Are constraints explicit: timeline, team ownership, cost, compliance, reliability, or platform limits?
- Are non-goals documented?
- Is the decision reversible, partially reversible, or effectively permanent?

## Options Considered

- Are at least two realistic alternatives compared?
- Is “do nothing” or incremental improvement considered when relevant?
- Are rejected options dismissed with evidence instead of preference?
- Are build-vs-buy and managed-vs-owned tradeoffs addressed where applicable?
- Are operational and migration costs included in each option?

## Tradeoffs

- Does the decision optimize for the right priority: correctness, speed, cost, reliability, developer experience, or user impact?
- Are short-term benefits and long-term costs both visible?
- Are failure modes and ownership burdens acknowledged?
- Are vendor, framework, or infrastructure lock-in risks understood?
- Are performance and scalability claims supported by estimates or evidence?

## Compatibility and Migration

- Does the decision preserve existing APIs, data contracts, and operational workflows?
- Is there a migration plan with sequencing and rollback?
- Are old and new systems expected to run concurrently?
- Are data backfills, dual writes, read repairs, or reconciliation needed?
- Are downstream teams or customers affected?

## Security and Compliance

- Does the decision change trust boundaries?
- Are auth, authorization, tenant isolation, and audit needs clear?
- Does it introduce new sensitive data handling or retention requirements?
- Are third-party dependencies or services acceptable under policy?
- Are compliance, privacy, and incident-response implications documented?

## Operability

- Who owns the system after the decision ships?
- What metrics, logs, traces, alerts, and runbooks are needed?
- Can operators detect and mitigate failure quickly?
- Are deployment, rollback, and disaster recovery considered?
- Are cost and capacity ownership clear?

## Validation

- What evidence would prove the decision is working?
- Are prototypes, benchmarks, load tests, security reviews, or design reviews needed?
- Are success metrics and review dates defined?
- What assumptions should be revisited later?
- Are open questions assigned to owners and deadlines?

## Decision Quality

- The decision should be easy to summarize in one sentence.
- The rationale should survive team turnover.
- The consequences should be explicit enough that future teams understand the cost of changing direction.
