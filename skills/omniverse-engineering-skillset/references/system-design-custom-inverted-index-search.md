# System Design Custom Inverted Index Search

## Purpose

Use this reference when a system needs large-scale keyword search over massive
user-generated content but cannot use a managed search engine such as
Elasticsearch/OpenSearch or a built-in full-text index. The goal is to reason
about data layout, indexing, write amplification, hot/cold tiers, and
approximate retrieval/reranking fundamentals.

This is a specialized case under Scaling Reads, Scaling Writes, Custom Search
Indexing, Hot/Cold Data Tiering, and Approximate Retrieval/Reranking. Use it
with `system-design-pattern-recognition-playbook.md` and
`system-design-architecture-decision-playbook.md` when a design involves custom
post search, keyword-to-document indexes, posting lists, mutable ranking
signals, cacheable non-personalized search, or search without Elasticsearch.

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

The system must search a massive corpus where raw scanning is impossible. It
needs keyword lookup, multiple sort orders, fresh-enough new documents,
discoverable old documents, and bounded cost despite write amplification.

The generic problem:

> How do we build read-optimized inverted index views, accept controlled
> staleness, and use two-stage retrieval when exact ranking maintenance is too
> expensive?

Key pressures:

- Raw scans and wildcard queries cannot work.
- New documents must become searchable within a freshness SLA.
- Old/cold documents must remain discoverable with slower latency.
- Each document expands into many index writes.
- Ranking signals such as likes can change more often than documents are
  created.
- Hot terms receive disproportionate traffic.
- Results can usually tolerate bounded staleness.

## When To Use

Use this pattern when:

- You need keyword search over a huge corpus.
- Managed search/indexing engines are not allowed.
- Full table scans or wildcard queries are impossible.
- Query patterns are mostly non-personalized.
- Staleness of seconds or minutes is acceptable.
- Multiple sort orders are required, such as recency and popularity.
- Both hot terms and long-tail cold terms matter.
- Index write amplification is a central challenge.
- The goal is to demonstrate indexing fundamentals.
- Search relevance can be simple, approximate, or two-stage.

## When Not To Use

Avoid this pattern when:

- Elasticsearch/OpenSearch/Lucene/Solr are allowed and fit the requirements.
- The corpus is small enough for database-native full-text search.
- Privacy/personalization dominates query behavior.
- Fuzzy matching, stemming, synonyms, complex ranking, and language analysis are
  required.
- Results must reflect every write immediately.
- Ranking signals change too frequently for index maintenance.
- The team cannot operate custom durability, rebuild, compaction, and cold
  storage.
- Exact global ranking is mandatory for every query.

## Default Architecture

Use source-of-truth documents plus derived index views:

```text
Post write
  -> Source DB/object store
  -> Durable document-created event
  -> Tokenization/normalization workers
  -> Index update events partitioned by keyword/hash
  -> Hot posting lists in Redis/KV/SSD store
  -> Cold immutable index segments in object storage

Ranking signal update, such as like
  -> Source-of-truth counter/event
  -> Optional approximate rank bucket update
  -> Query-time fresh score fetch for reranking

Search query
  -> Normalize query
  -> Check CDN/Redis cache if non-personalized
  -> Fetch posting list candidates from hot tier
  -> Optional cold fallback
  -> Intersect/filter for multi-term queries
  -> Hydrate top candidates and rerank precisely
  -> Return cursor-paginated results
```

## Core Design Rules

### 1. Estimate before choosing architecture

Scale estimation should reveal the real bottleneck:

- Documents created per second.
- Ranking-signal updates per second.
- Searches per second.
- Average tokens per document.
- Index entries per document.
- Total corpus size.
- Hot-term versus long-tail distribution.

Search systems can be write-heavy once each document expands into many token
updates and each like/share can affect ranking.

### 2. Do not scale an unindexed scan

Sharding and replication do not fix a fundamentally wrong access pattern.
`LIKE '%keyword%'` over a massive corpus remains too slow even if each shard
scans a fraction.

For "find documents containing term X," organize data by term.

### 3. Use an inverted index

Index by query shape:

```text
keyword -> ordered list of document IDs and lightweight metadata
```

At ingestion:

1. Tokenize document.
2. Normalize tokens.
3. Deduplicate tokens within the document when appropriate.
4. Write document ID into each token's posting list.
5. Store enough metadata for sorting/ranking.

Reads become keyword lookups, but writes fan out.

### 4. Precompute separate views for common sort orders

Do not sort millions of candidate IDs at request time. Maintain physical views
for frequent sort modes:

- Recency: append-only/time-ordered segments.
- Popularity: sorted score/bucket index.
- Relevance: precomputed score or two-stage reranking.

Ask for each sort order:

- Is it common enough to materialize?
- Is the sort key immutable or mutable?
- How expensive is maintenance?
- Can the view be approximate?

### 5. Treat mutable ranking signals as write-amplification hazards

Likes may be far more frequent than document creation. If every like updates the
score for that document in every keyword posting list, the system can collapse
under fan-out writes.

For mutable signals:

- Quantify update frequency.
- Estimate affected posting-list entries per update.
- Avoid updating all lists on every event.
- Use batching, thresholds, approximate buckets, or reranking.

### 6. Use two-stage retrieval when exact maintenance is too expensive

Use approximate indexes for candidate retrieval and precise reranking over a
small candidate set.

Example:

- Update popularity index only when like counts cross milestones or log buckets.
- Query retrieves `N * K` candidates by approximate popularity.
- Fetch fresh like counts from source-of-truth counters.
- Rerank precisely and return top `N`.

Name approximate fields clearly, such as `approx_likes`, `rank_bucket`, or
`log_likes`.

### 7. Cache aggressively when search is not personalized

Non-personalized search results are cacheable. If new posts only need to appear
within one minute, use TTL below that SLA.

Cache keys must include:

- Normalized query.
- Sort mode.
- Cursor/page.
- Filters.
- Locale/language/region.
- Index version.

Use Redis/distributed cache and CDN edge caching only when responses are safe to
share.

### 8. Use edge caching only for public reusable results

CDN caching is powerful for public non-personalized search but dangerous for
identity-dependent, permissioned, or private results.

Use CDN only when:

- Response is public or safely shared.
- Query does not depend on identity.
- Privacy filters are not required.
- Cache key includes all relevant parameters.
- TTL respects freshness SLA.

### 9. Handle phrase search selectively

Phrase search can be done by intersecting posting lists and filtering, but that
can be expensive for common terms.

Options:

- Intersection/filter fallback.
- Selectively index common bigrams/trigrams.
- Track phrase frequency with analytics/probabilistic counters.
- Cap rare shingle indexes.

Do not blindly index every possible phrase.

### 10. Use streams to absorb ingestion fan-out

Indexing is a fan-out write pipeline. Use a durable log to buffer bursts and
partition work:

- Source document events.
- Tokenization workers.
- Index update events partitioned by keyword or keyword hash.
- Idempotent posting-list writes.
- DLQ for malformed/unindexable documents.
- Replay/backfill from source events.

Monitor ingestion lag against the search freshness SLA.

### 11. Cap hot posting lists and preserve cold recall

Common terms may have enormous posting lists. Hot memory should serve likely
visible results, not entire history.

Use:

- Recent/top candidates in hot storage.
- Older/long-tail segments in cold storage.
- Query hot first.
- Fall back to cold with latency penalty.
- Make older/unpopular results discoverable, not necessarily fast.

### 12. Tier indexes by access frequency

Not all keywords deserve memory-resident indexes.

Typical tiers:

- Hot memory/KV.
- Warm SSD/KV.
- Cold object storage with immutable segments.

Add promotion/demotion jobs, metadata manifests, compaction, and clear latency
expectations.

## Architecture Decision Rules

- If keyword search must scan huge text, avoid unindexed database search.
- If search is keyword-based, use an inverted index.
- If a sort order is frequently requested, materialize an index view.
- If sort key is immutable, use append-only/time-segmented indexes.
- If sort key is mutable and high-volume, avoid updating every posting list on
  every event.
- If exact ranking maintenance is too expensive, use approximate candidates plus
  precise reranking.
- If results are not personalized, use Redis/CDN caching when safe.
- If results depend on identity/privacy, avoid shared CDN caching.
- If freshness SLA is bounded, set cache TTL below that SLA.
- If phrase queries are common and expensive, selectively index shingles.
- If phrase queries are rare, avoid indexing all shingles.
- If one document fans out to many index writes, use a durable stream and
  partitioned consumers.
- If posting lists exceed memory limits, cap hot lists and move cold segments.
- If old/unpopular results must remain discoverable, maintain cold fallback.
- If ranking metadata is approximate, name it explicitly.

## Production Guardrails

Tokenization and normalization:

- Lowercase/case-fold tokens.
- Normalize punctuation.
- Define stopword behavior.
- Handle language/locale when required.
- Version tokenization rules.
- Reindex when tokenization changes.

Index write pipeline:

- Durable event log for document and ranking-signal events.
- Idempotent index updates.
- Partition by keyword or keyword hash.
- Backpressure on ingestion workers.
- DLQ for malformed/unindexable documents.
- Replay from source events.
- Lag monitoring against freshness SLA.

Posting list storage:

- Cap hot posting lists.
- Segment long lists by time/rank range.
- Compress document IDs with delta encoding or compact binary format.
- Avoid unbounded Redis lists/sorted sets.
- Track per-key size and hot-key pressure.
- Store metadata catalog for hot/warm/cold locations.

Multiple indexes:

- Separate physical views per sort mode.
- Store index schema/version metadata.
- Support rebuild/backfill.
- Detect and repair divergence between views.

Mutable ranking signals:

- Batch viral updates.
- Use milestone/log-bucket updates.
- Fetch fresh ranking values during reranking.
- Bound candidate multiplier such as `top N * K`.
- Monitor reranking miss rate.

Caching:

- Canonicalize query parameters.
- Include sort, cursor, filters, locale, and version in keys.
- Use TTL less than freshness SLA.
- Add cache stampede protection.
- Disable shared caching for personalized/private queries.
- Use `Cache-Control` safely.

Cold storage:

- Store cold index segments in immutable chunks.
- Avoid random in-place object-storage updates.
- Use compaction/rewrite jobs.
- Maintain manifest/catalog.
- Promote hot cold terms back to memory.
- Track cold fallback latency and success rate.

Query path:

- Enforce max result and page size.
- Use cursor pagination, not deep offset.
- Avoid returning huge posting lists across the network.
- Run intersections near data when possible.
- Timeout long cold queries.
- Return degraded/partial results only when acceptable.

Observability:

- Index freshness lag.
- Ingestion lag by partition.
- Per-key posting list size.
- Hot-key frequency.
- Cache/CDN hit rate.
- Query latency by hot/warm/cold path.
- Reranking latency.
- Approximate ranking error/miss rate.
- Cold retrieval latency.
- DLQ size and replay rate.

## Common Failure Modes

| Failure Mode | Cause | Mitigation |
|---|---|---|
| Full scans destroy latency | Query searches raw documents | Inverted index |
| Sharding does not help enough | Still scanning many rows | Reorganize by keyword |
| Redis memory explosion | Common terms have huge posting lists | Cap hot lists, segment, compress, cold tier |
| Hot keyword overload | Many reads/writes hit one term | Cache, replicate hot keys, shard where safe |
| Write amplification overload | One document creates many token writes | Stream ingestion, batching, partitioned workers |
| Like-update storm | Each like updates many sorted sets | Milestones, batching, two-stage reranking |
| Stale popularity ranking | Approximate likes lag | Fetch fresh counts for reranking |
| Phrase query timeout | Intersecting huge posting lists | Selective shingles and fallback |
| Index inconsistency | Failed/duplicated events | Idempotent updates, replay, reconciliation |
| New posts miss SLA | Ingestion lag | Lag alerts, autoscaling, backpressure |
| CDN serves wrong result | Query personalized/private | Disable shared cache or vary safely |
| Cold index update pain | Object storage immutable | Immutable segments, compaction, manifests |
| Deep pagination overload | Far pages over huge sets | Cursor pagination and capped windows |
| Analyzer mismatch | Query and index tokenization differ | Version analyzers and reindex |

## Clarifying Questions

Ask:

1. Are Elasticsearch/OpenSearch/Lucene allowed?
2. What is document creation rate?
3. What is ranking-signal update rate?
4. How many tokens per average document?
5. How quickly must new documents become searchable?
6. Are results personalized or public?
7. Are privacy/visibility filters required?
8. What sort modes are required?
9. Which sort keys are immutable versus mutable?
10. Are phrase queries common?
11. Do we need fuzzy matching, stemming, synonyms, or language-specific
    analysis?
12. What staleness is acceptable for ranking signals?
13. Can popularity ranking be approximate?
14. What candidate multiplier is acceptable for reranking?
15. How large can hot posting lists grow?
16. What recall is needed for old/unpopular documents?
17. How often are cold keywords queried?
18. How are cold segments updated or compacted?
19. What happens if the index lags source data?
20. How do we rebuild the whole index from source events?

## Reusable Agent Instructions

When designing custom keyword search:

1. Start with scale estimates for documents, ranking updates, searches, tokens,
   and index size.
2. Do not propose sharded scans as the main search solution.
3. Use an inverted index for keyword search.
4. Materialize separate views for common sort orders.
5. Treat mutable ranking indexes as write-amplification risks.
6. Prefer approximate ranking plus precise reranking when exact updates are too
   expensive.
7. State bounded staleness and freshness SLA.
8. Cache non-personalized search results with Redis/CDN when safe.
9. Never use shared edge cache for personalized or permission-sensitive results.
10. Use Kafka or another durable log to buffer and partition indexing work.
11. Partition index writes by keyword or keyword hash.
12. Cap hot posting lists and store cold segments separately.
13. Design manifests, compaction, promotion, and fallback for cold storage.
14. Add replay, rebuild, reconciliation, DLQ, and index versioning early.
15. Monitor hot keys, index lag, cache hit rate, reranking accuracy, and
    cold-path latency.

## Condensed Memory

For massive keyword search without managed search engines, organize data as
inverted indexes: token to document IDs. Do not scale unindexed scans; sharding
only divides the scan and remains too slow. Estimate first, because search
systems can be write-heavy once document tokenization and ranking-signal updates
are included. Materialize different index views for common sort orders: recency
can be append/time ordered, while popularity needs sorted scores. Mutable
signals like likes create severe write amplification, so use batching,
milestone/log-bucket updates, or a two-stage architecture: retrieve approximate
top candidates, fetch fresh source-of-truth scores, then rerank precisely. Cache
non-personalized search results with TTL below the freshness SLA, and use CDN
only when results are safe to share. For phrase search, use intersection/filter
as fallback and selectively index bigrams/shingles. Scale ingestion with
durable streams, partitioned workers, and keyword-sharded indexes. Cap hot
posting lists, compress/segment them, and move cold/rare keyword indexes to
blob storage with manifests and compaction. Guardrails: idempotent indexing,
replay/rebuild, DLQ, backpressure, cache-key canonicalization, index versioning,
hot-key monitoring, cold fallback, reranking metrics, and freshness lag alerts.
