# Low-Level Design Coding Principles

## Purpose

Use this reference to make coding agents produce production-shaped code instead of code that only works for the happy path.

The goal is not to force textbook OOP or design-pattern names. The goal is to produce code that is:

- scoped to the actual requirement
- easy to understand
- easy to change
- explicit about state and ownership
- safe around concurrency and limited resources
- tested around the happy path and edge cases

## When to Use

Use this reference when the user asks to:

- implement a feature
- refactor existing code
- design classes, modules, services, controllers, or handlers
- add API behavior
- model business rules or state transitions
- review code quality
- make code easier to extend
- reason about concurrency, queues, locks, workers, pools, or shared state

Do not over-apply it to tiny one-line fixes. For small fixes, keep the change minimal and still run the final checklist mentally.

## Core Rule

Before coding, understand the requirement, identify the state, assign ownership, then implement the smallest clean design that satisfies the current need.

Prefer simple composition, focused modules, and explicit state transitions over inheritance-heavy designs, speculative abstractions, or pattern-driven code.

## Required Workflow

### 1. Scope the Requirement

Before writing code, identify:

- **Primary capabilities**: What operations must the code support?
- **Rules and completion conditions**: What counts as success, failure, done, cancelled, expired, invalid, etc.?
- **Invalid inputs and error behavior**: What should be rejected, normalized, retried, ignored, or surfaced?
- **Scope boundaries**: What is in scope now, and what should not be built yet?
- **External dependencies**: Database, Redis, HTTP clients, queues, files, sockets, feature flags, config, third-party services.

If information is missing but the likely behavior is obvious, make a clear assumption and continue. Ask a question only when the missing detail would materially change the design.

### 2. Identify Entities and Relationships

List the main concepts before coding.

A concept likely deserves its own class/module if it:

- owns changing state
- enforces business rules
- has meaningful behavior
- coordinates a workflow
- hides a dependency or implementation detail

A concept is probably just a field/value object if it is only information attached to another object.

For each entity/module, identify:

- **Owner of durable state**
- **Orchestrator of the main workflow**
- **Dependencies**: has-a, uses, contains, calls
- **Rules owned by that entity**
- **Public methods it exposes**
- **Private helpers it hides**

### 3. Design State and Behavior Together

For every class/module/service, define:

- What state does it need to remember?
- What invariants must always remain true?
- What methods can change state?
- What methods only query state?
- What dependency should be injected rather than created internally?
- What should be private to protect the internal model?

Avoid anemic designs where data is in one place and all rules are scattered elsewhere. Also avoid overloaded classes with unrelated responsibilities.

### 4. Implement the Happy Path First

Implement the normal flow in a direct, readable order:

1. Validate or normalize inputs.
2. Load required state/dependencies.
3. Check business rules and current state.
4. Perform the operation.
5. Persist or publish changes if required.
6. Return a clear result.

Keep the first version simple. Make the code correct and readable before extracting abstractions.

### 5. Add Edge Cases and State Transitions

After the happy path, handle:

- invalid inputs
- missing resources
- duplicate requests
- illegal state transitions
- stale/expired tokens or sessions
- dependency failures
- retries or idempotency concerns
- cleanup on failure
- partial success/rollback behavior

For stateful workflows, write the allowed transitions explicitly. Illegal transitions should fail clearly.

Example:

```text
REQUESTED -> DRIVER_ASSIGNED -> IN_PROGRESS -> COMPLETED
REQUESTED -> CANCELLED
DRIVER_ASSIGNED -> CANCELLED
IN_PROGRESS -> CANCELLED or COMPLETED
COMPLETED -> terminal
CANCELLED -> terminal
```

### 6. Check Extensibility Without Building the Future

Design so reasonable future changes have a place to go, but do not implement features that were not requested.

Good answer:

> I will keep this validation inside the service for now. If a second or third flow needs the same rule, I will extract a shared validator.

Bad answer:

> I will create a full plugin architecture, factory registry, observer system, and configuration DSL because we might need it later.

## Practical Design Principles

Start with the simplest design that satisfies the current requirement.

Avoid:

- deep inheritance trees
- unnecessary factories
- unnecessary generic abstractions
- clever code that hides intent
- large rewrites when a local change works
- speculative features or future scenarios the user did not request

Reduce duplication when the same business rule or logic appears in multiple places and is likely to change together. Do not create an abstraction just because two blocks look similar today. A little duplication is often better than a bad shared abstraction.

Keep separate responsibilities in separate places. Common boundaries include validation vs business logic, business logic vs persistence, transport/controller code vs service code, formatting/serialization vs domain behavior, configuration vs runtime behavior, and logging/metrics vs core logic.

## Law of Demeter

Do not reach deeply into another object's internals.

Prefer:

```text
order.cancel()
```

Over:

```text
order.getStatus().getTransitionRules().getCanceller().cancel(order)
```

Hide internal structure behind meaningful methods.

## SOLID, Used Practically

Apply the lesson, not the acronym.

- **Single Responsibility**: one class/module should have one main reason to change.
- **Open/Closed**: support variation through interfaces/composition when variation is real.
- **Liskov Substitution**: subclasses must honor parent expectations. If not, use composition.
- **Interface Segregation**: keep interfaces small and focused.
- **Dependency Inversion**: depend on stable abstractions for external services or interchangeable behavior.

## OOP Guidance

### Encapsulation

Hide state. Expose behavior.

Use private/internal fields where possible. Let methods enforce invariants instead of letting callers mutate state directly.

### Abstraction

Use interfaces or boundaries when callers should not care about implementation details.

Good candidates:

- payment provider
- pricing strategy
- notification sender
- storage adapter
- clock/time provider
- external API client

### Polymorphism

Use polymorphism to replace repeated type checks or long conditional chains when behavior varies by type.

Prefer:

```text
paymentMethod.charge(amount)
```

Over:

```text
if paymentMethod.type == CARD ...
else if paymentMethod.type == PAYPAL ...
```

### Inheritance

Prefer composition over inheritance.

Use inheritance only when:

- the relationship is truly stable
- subclasses can fully honor the parent contract
- shared implementation is meaningful and unlikely to break

Do not use inheritance just to reuse a few methods.

## Practical Design Patterns

Use patterns only when they naturally simplify the design.

- **Factory**: callers should not care which concrete object is created.
- **Builder**: object construction has many optional fields or messy setup.
- **Singleton**: only when one global instance is truly required. Use rarely.
- **Decorator**: add optional behavior in layers without subclass explosion.
- **Facade**: hide complex subsystem steps behind a simple API.
- **Strategy**: swap algorithms/behaviors without if/else chains.
- **Observer**: multiple components need to react to one event.
- **State Machine**: behavior depends on current state and transitions are important.

Do not name-drop patterns. Explain why the structure fits the problem.

## Concurrency Checklist

Before writing concurrent code, classify the problem.

### A. Correctness Problem

Use this when multiple operations must preserve shared invariants.

Ask:

- What shared mutable state exists?
- What invariant must remain true?
- Which operations must be atomic together?
- Is this a check-then-act bug?
- Is this a read-modify-write bug?

Tools:

- coarse-grained lock for simple safety around related state
- fine-grained locks when independent resources can proceed concurrently
- atomic variables for single-variable counters/flags only
- thread confinement/message ownership to avoid sharing state entirely

Avoid using atomics for multi-field invariants unless the whole invariant is protected.

### B. Coordination Problem

Use this when work must move safely between producers and consumers.

Ask:

- Should producers wait, timeout, or drop work under load?
- Should consumers sleep when no work exists?
- Is backpressure required?
- Does ordering matter?
- How does shutdown happen?

Tools:

- bounded blocking queue for internal pipelines
- timeout/reject on request paths where waiting too long is bad
- drop/log for lossy analytics-style workloads
- message passing or actor-style ownership when shared state would get messy

Avoid unbounded queues unless memory growth is intentionally controlled elsewhere.

### C. Scarcity Problem

Use this when demand exceeds limited resources.

Ask:

- What is the limited resource?
- Is the limit count-based or unit-based?
- What happens when the limit is reached?
- Who releases the resource?
- Can a leak exhaust the system?

Tools:

- semaphore for limiting concurrent operations
- weighted semaphore for aggregate consumption like memory/bandwidth units
- resource pool with bounded queue for expensive reusable objects
- try/finally or equivalent cleanup to release resources reliably

Avoid creating resources lazily without enforcing a max count.

## Dependency and Testability Rules

Prefer dependency injection for external systems:

- database/repository
- HTTP clients
- Redis/cache clients
- queues
- clocks/timers
- random/id generators
- file systems
- loggers/metrics emitters when behavior depends on them

Do not directly instantiate hard dependencies inside business logic if it prevents testing or swapping implementations.

Business logic should be testable without real network calls, real databases, real queues, or real clocks.

## Error Handling Rules

Errors should match the layer.

- Domain/service layer: return domain errors or throw meaningful internal exceptions.
- API/controller layer: map errors to user-facing status codes and response bodies.
- Infrastructure layer: wrap low-level dependency failures with context.

Do not leak internal implementation details to external users.

## Logging and Observability Rules

When implementing production code, add logs around meaningful lifecycle events, not every line.

Good log points:

- request/session accepted
- validation rejected
- dependency call failed
- state transition happened
- retry/deadline/timeout occurred
- resource limit reached
- cleanup completed

Prefer structured fields over long unstructured messages.

## Testing Checklist

For every meaningful feature, consider tests for:

- happy path
- invalid input
- missing dependency/resource
- illegal state transition
- duplicate/idempotent request
- dependency failure
- timeout/retry behavior
- cleanup/release after failure
- concurrency race if shared state exists
- boundary values

Do not only test implementation details. Test the behavior and invariants.

## Final Review Checklist

Before returning code, verify:

- The code directly satisfies the requested requirement.
- The scope did not grow beyond what was asked.
- Responsibilities are placed in the right class/module.
- State ownership is clear.
- Public methods express meaningful behavior.
- Internal state is not exposed unnecessarily.
- Dependencies are injected or isolated where useful.
- The happy path is readable.
- Edge cases and invalid states are handled.
- There is no unnecessary inheritance or unnecessary pattern-driven design.
- There is no speculative feature building.
- Any concurrency/shared-resource risk is classified as correctness, coordination, or scarcity.
- Tests or test cases cover the important behavior.

## Response Format for Coding Agents

When the coding task is non-trivial, respond in this structure:

```text
Design Summary
- Requirement:
- Assumptions:
- Main entities/modules:
- State ownership:
- Key flows:
- Edge cases:
- Concurrency/resource risks:

Implementation
- Files changed:
- Key code changes:

Tests
- Added/updated tests:
- Manual verification:

Review Notes
- Why this design is simple enough:
- What future extension would look like, without building it now:
```

For small tasks, keep the response shorter, but still apply the same thinking.

## Strong Defaults

When unsure:

- choose composition over inheritance
- keep the first implementation boring and readable
- isolate external dependencies
- make state transitions explicit
- use bounded queues/pools
- release locks/resources in finally/defer patterns
- write tests around behavior and edge cases
- explain assumptions instead of silently guessing
