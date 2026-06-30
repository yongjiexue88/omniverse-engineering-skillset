# System Design Fault-Tolerant Polite Web Crawling Pipeline

## Purpose

Use this reference for systems that crawl or fetch large numbers of external
web resources, extract useful content, store output, follow links, and remain
fault-tolerant and polite to external sites.

This is a specialized case under Large-Scale Data Ingestion, Distributed
Crawling, Queue-Based Pipelines, External Fetching, Politeness and Rate
Limiting, and Deduplication. Use it when a design involves seed URLs, web
crawling, URL frontiers, robots.txt, crawl-delay, domain rate limits, DNS
bottlenecks, parser pipelines, content deduplication, or crawler traps.

## Core Problem Pattern

The system processes a huge graph of external resources where each fetched page
can produce more URLs to fetch. Fetching is unreliable, work can run for days,
payloads can be large, duplicate URLs/content are common, and the crawler must
avoid overloading any external domain.

A crawler is not just workers plus a queue. It is a distributed scheduler,
fetch pipeline, deduplication system, politeness controller, and fault-recovery
system.

## When To Use

Use this pattern when:

- The system must crawl or fetch many external resources.
- Fetching is I/O-bound, slow, rate-limited, or failure-prone.
- Each work unit can be retried independently.
- Large HTML/text payloads should live in blob/object storage.
- External domains require robots-style rules, crawl delay, or rate limits.
- Processing can be split into fetch, parse, extract, store, and enqueue stages.
- The crawl must resume after worker, queue, or network failures.
- Duplicate work is expensive.
- Throughput depends on crawling many domains in parallel.

Avoid the full pattern when there are only a few known URLs, a reliable bulk API
exists, the crawl is tiny and one-time, link following is out of scope, sources
are internal and unconstrained, or legal/compliance boundaries are unclear.

## Default Architecture

```text
Seed URLs
  -> URL canonicalizer / URL metadata table
  -> crawl frontier / scheduler
  -> per-domain politeness gate
  -> DNS cache / resolver
  -> fetch workers
  -> raw payload blob storage
  -> parse/extract queue
  -> parser workers
  -> extracted output storage
  -> link extractor
  -> URL canonicalizer / dedupe
  -> frontier
```

Store state in durable metadata:

- `url_id`, canonical URL, domain, depth, priority.
- Stage status: `discovered`, `scheduled`, `fetched`, `parsed`, `failed`,
  `skipped`.
- Raw blob URI, extracted output URI, content hash.
- Fetch timestamp, HTTP status, parser version.
- Retry count, last error, next eligible fetch time.

Queue messages should carry IDs and blob references, not full HTML/text payloads.

## Core Design Rules

### Define Boundary And Data Flow First

Start with:

```text
input -> fetch/load -> raw storage -> transform/extract -> output storage
      -> next work generation
```

Then decide which stages need queues, retries, metadata state, and independent
scaling.

### Split Fetch And Parse

Avoid one monolithic worker that resolves DNS, fetches, extracts text, extracts
links, and enqueues more work. Split stages so failed fetches do not lose parse
progress, parser upgrades can replay from raw HTML, and each stage can scale
independently.

### Store Payloads In Blob Storage

Do not put multi-MB HTML/text payloads inside SQS/Kafka messages. Store raw
payloads and extracted outputs in blob/object storage, then pass `url_id` and
blob URIs through queues.

### Preserve Raw Input For Replay

Keep raw fetched data separate from extracted output. Store parser version,
content hash, response metadata, and fetch timestamp so parser logic can be
rerun without refetching external sites.

### Ack Only After Durable Stage Output Exists

For each stage:

1. Read work item.
2. Check whether stage output already exists.
3. Perform work.
4. Write output durably.
5. Update metadata state.
6. Ack/delete the queue message.

Assume at-least-once delivery and make every stage idempotent.

### Enforce Politeness Globally

Maintain per-domain metadata:

- Robots rules and fetch timestamp.
- Crawl-delay or rate-limit policy.
- Last crawl timestamp and next allowed fetch time.
- Domain status and failure count.

Distributed fetchers need shared per-domain locks, token buckets, or a central
frontier scheduler. Local worker state is not enough.

### Add Jitter Everywhere

Add jitter to retry backoff, deferred crawl visibility timeout, rate-limit
waiting, robots refresh, and scheduled recrawls to avoid synchronized retry
storms.

### Treat DNS As A Real Bottleneck

High-throughput crawlers can overload DNS. Add TTL-respecting DNS caches,
multiple resolver providers where useful, resolver latency/error metrics, and
fallback handling for NXDOMAIN/timeouts.

### Deduplicate URL And Content

Use canonical URL normalization and a unique URL table before enqueue. After
fetch, compute a content hash and skip parse/output work for content already
seen.

Use Bloom filters only if false positives, and therefore skipped legitimate
pages, are acceptable.

### Protect Against Crawler Traps

Use max depth, per-domain/page caps, query-parameter normalization, repeated URL
pattern detection, calendar/session/search trap detection, and frontier growth
alerts.

## Architecture Decision Rules

- If a worker performs fetch, parse, extract, and enqueue together, split it
  into stages because a subtask failure should not lose all progress.
- If queue messages would contain large HTML/text payloads, store payloads in
  blob storage and pass references.
- If external fetch can fail, use persistent retry state instead of in-memory
  timers.
- If using SQS, prefer visibility timeout plus `ChangeMessageVisibility` for
  retry/defer, with redrive policy and DLQ.
- If a URL is disallowed by robots rules, mark it skipped and do not retry it.
- If crawl-delay has not elapsed, defer the message rather than busy-wait.
- If many workers crawl one domain, use per-domain locks/rate limiting.
- If throughput is high across many domains, cache DNS and monitor resolver
  health.
- If ML/search/training downstreams use the data, preserve raw HTML for replay.
- If exact crawl completeness matters, prefer indexed metadata lookups over
  Bloom filters.
- If continual recrawling is required, use a scheduler/frontier rather than
  parser workers directly enqueueing everything.

## Production Guardrails

Pipeline state:

- URL metadata table with canonical URL, domain, depth, priority, and status.
- Raw blob URI, extracted blob URI, parser version, content hash, timestamps.
- Retry count, last error, final failure reason.
- Idempotent state transitions and repair jobs for stuck stages.

Queue handling:

- Small messages with IDs/URIs only.
- Visibility timeout sized to stage duration.
- Backoff with jitter, retry count, redrive policy, DLQ.
- Oldest-message-age alerts and poison-message handling.

Fetch safety:

- Request timeout, redirect limit, max content length.
- Content-type filtering and optional HEAD before large downloads.
- TLS/network error handling and status-code-aware retry policy.
- User-agent identification and compliance review.

Politeness:

- Robots fetch/cache, disallow path checks, crawl-delay support.
- Per-domain last crawl time and shared lock/token bucket.
- Domain-level backoff on blocks/errors.
- Jittered deferrals and per-domain rate-limit metrics.

Deduplication:

- URL canonicalization and unique URL metadata record.
- Content hash after fetch and indexed hash lookup.
- Optional Bloom filter with measured false-positive rate.
- Duplicate-content skip path.

Scaling:

- Fetcher autoscaling by queue depth, bandwidth, external constraints, and DNS
  latency.
- Parser autoscaling by queue depth, age of oldest message, CPU, blob I/O, and
  metadata DB write capacity.
- Backpressure when blob storage, metadata DB, or external domains slow down.

Observability:

- Pages/bytes fetched per second.
- Fetch success/failure by domain.
- Retry and DLQ rates.
- Robots skip count and rate-limit deferrals.
- DNS latency/error rate.
- Queue depth and age by stage.
- Parser throughput and failure rate.
- URL/content dedup hit rate.
- Crawl depth distribution and frontier growth rate.

## Common Failure Modes

| Failure Mode | Cause | Mitigation |
|---|---|---|
| Lost crawl progress | Worker crashes after dequeue | Ack only after durable output; visibility timeout retry |
| Queue bloat/cost | Large HTML stored in messages | Store payloads in blob storage; pass references |
| Infinite retries | Permanently dead URL | Max retry count, DLQ, final failure state |
| Duplicate fetches | Same URL discovered repeatedly | Canonicalization and unique URL table |
| Duplicate parsing/storage | Different URLs return same content | Content hash dedup |
| Overloading a domain | No shared politeness state | Per-domain lock/rate limiter |
| Thundering herd | Workers retry at rate-window boundary | Jittered backoff/defer |
| Robots violation | Rules missing, stale, or unchecked | Robots cache and skip logic |
| DNS bottleneck | Millions of domains repeatedly resolved | DNS cache and resolver metrics |
| Parser backlog | Fetchers outpace extractors | Autoscale parser workers by queue depth |
| Crawler trap | Infinite/deep link structures | Max depth, per-domain caps, pattern detection |
| Missed pages | Bloom filter false positive | Tune false positives or use exact DB index |

## Clarifying Questions

- What is the crawl output used for: search, ML training, monitoring,
  archiving, or analytics?
- Is this one-time crawl, recurring crawl, or continuous recrawl?
- How many pages are expected, and what completion window is required?
- What average and max page size should be expected?
- Is dynamic JavaScript rendering or authenticated content in scope?
- What robots/compliance/politeness rules apply?
- What request rate is allowed per domain?
- Is probabilistic skipping acceptable?
- How long should raw HTML and extracted output be retained?
- How many retries before DLQ?
- Should the frontier support priority and URL quality scoring?
- How should crawler traps and DNS failures be handled?

## Reusable Agent Instructions

- Model a crawler as a distributed data pipeline, not a single service.
- Define input, output, and stage-by-stage flow before choosing technology.
- Split fetch and parse/extract into separate stages.
- Store raw payloads and extracted output in blob storage.
- Pass only metadata IDs or blob references through queues.
- Make every stage idempotent and retryable.
- Ack only after durable output and metadata state update.
- Use queue visibility timeout/backoff/DLQ for durable retry behavior.
- Respect robots rules and crawl-delay before fetching.
- Coordinate distributed fetchers with per-domain locks or centralized rate
  limiting.
- Add jitter to retries and deferred scheduling.
- Treat DNS as a scalable dependency.
- Deduplicate by canonical URL before enqueue and content hash after fetch.
- Add max depth and frontier controls to avoid crawler traps.
- Scale fetchers by bandwidth/external constraints and parsers by backlog.
- Add observability for progress, queue age, retries, DLQ, robots skips, DNS
  latency, dedup rate, and domain throttling.

## Condensed Memory

For large-scale web crawling, use a fault-tolerant, polite, staged ingestion
pipeline. Start from seed URLs, schedule work in a frontier, fetch raw HTML,
store raw payloads in blob storage, parse/extract text and links, store output,
and enqueue newly discovered URLs. Do not put large payloads in queues; pass
metadata IDs/blob URIs. Split fetch and parse so failures are isolated and
parser logic can replay from raw HTML. Use durable queues with visibility
timeout/backoff/DLQ, ack only after durable output, enforce robots/crawl-delay
and per-domain rate limits, cache DNS, dedupe by canonical URL and content hash,
and protect against crawler traps with depth, caps, normalization, and frontier
controls.
