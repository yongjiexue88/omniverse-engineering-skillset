# System Design Media-Heavy Social Feed

## Purpose

Use this reference for Instagram/TikTok-style systems where users upload
photos/videos, follow producers, and consume chronological or ranked feeds.

This is a composition pattern. Load it with:

- `system-design-large-blob-file-sync.md` for upload, signed URL, object
  storage, CDN, and blob lifecycle details.
- `system-design-hybrid-feed-fanout-timeline.md` for follower timeline,
  cursor pagination, and celebrity fan-out details.
- `system-design-pattern-recognition-playbook.md` for broader pattern fit.

## Core Problem Pattern

Ingest large user-generated media, process it asynchronously, store it outside
the primary database, and expose it through low-latency feeds at read-heavy
scale.

The key split:

- Hot metadata path: post, media asset, visibility, and processing state.
- Blob path: original uploads, processed variants, thumbnails, and video
  segments in object storage/CDN.
- Async path: media processing, moderation, fan-out, repair, and cleanup.
- Feed path: precomputed timelines for normal producers plus read-time merge
  for high-follower producers.

## When To Use

Use this when:

- Users upload images, video, carousels, stories, files, or marketplace media.
- Media requires resizing, transcoding, thumbnails, metadata extraction,
  moderation, or CDN-ready variants.
- Feed reads greatly outnumber post writes.
- Users follow creators, topics, sellers, or other entities.
- Some producers have huge follower counts.
- The product can tolerate eventual consistency from upload to feed visibility.

Avoid the full pattern when media is small, low-volume, unprocessed, feeds are
low-QPS, or every post must be immediately and synchronously visible.

## Default Architecture

```text
Client
  -> API: create upload session
  <- API: media_asset_id + presigned upload URL
Client
  -> Object storage: upload original media
Storage event / completion API
  -> Media queue
  -> Media workers: validate, scan, transcode, thumbnail, variants
  -> MediaAsset status update
  -> Post becomes PREVIEW_READY or READY
  -> PostReady event
  -> Feed fan-out workers
  -> Home timelines / celebrity read-time merge
Feed read
  -> timeline IDs + recent celebrity posts
  -> merge/dedupe
  -> hydrate post and media metadata
  -> return cursor page with CDN URLs
```

Core models:

- `Post`: `post_id`, `author_id`, `caption`, `media_asset_ids`,
  `created_at`, `visibility`, `post_status`.
- `MediaAsset`: `media_asset_id`, `owner_id`, `original_object_key`,
  `status`, `variants`, `duration`, `dimensions`, `checksum`,
  `created_at`, `updated_at`.
- `FeedEntry`: `viewer_id`, `post_id`, `sort_key`, `fanout_version`.

Do not store raw image or video bytes in primary database rows.

## Design Rules

### Split Metadata From Blobs

Store queryable metadata in a database and bytes in object storage. Use explicit
states so metadata/blob divergence is recoverable: `UPLOADING`, `PROCESSING`,
`PREVIEW_READY`, `READY`, `FAILED`, and `DELETED`.

### Use Direct Uploads

Application servers should issue scoped presigned upload URLs and upload
sessions, not proxy large media bytes. Clean up abandoned sessions and orphaned
objects with TTL jobs.

### Process Media Asynchronously

Post creation should not synchronously resize or transcode media. Workers should
consume upload-complete events, generate variants, store processed metadata, and
publish readiness events. Every worker step must be idempotent.

### Fan Out Only When Media Is Ready Enough

Do not push a media post into millions of feeds before a renderable preview
exists. Fan out at `PREVIEW_READY` when the feed can show a thumbnail or low-res
asset; update media metadata later as higher-quality variants become ready.

### Use Hybrid Feed Fan-Out

Use fan-out-on-write for normal producers and read-time merge for celebrity or
high-follower producers. The threshold should depend on follower count, post
frequency, queue lag, and read-time merge cost.

### Serve Through CDN With Versioned URLs

Generate device/network variants and serve them through CDN. Prefer immutable,
versioned object keys over purge-based invalidation.

## Architecture Decision Rules

- If media is large, use presigned direct upload because app servers should not
  carry upload bytes.
- If media needs resizing/transcoding/moderation, use async workers because
  request latency and failure isolation matter.
- If feed cards need media, wait until preview readiness before feed fan-out.
- If media is global or hot, use CDN because origin reads add latency and cost.
- If clients vary by device/network, generate bounded variants instead of
  serving one original to everyone.
- If feed reads are low-scale, fan-out-on-read may be enough.
- If feed reads are high-scale, use precomputed timelines for normal producers.
- If producers have extreme follower counts, exclude them from full fan-out and
  merge their recent posts at read time.
- If ranking is chronological, cursor by `(created_at, post_id)`; if ranked,
  cursor by `(rank_score, post_id)` or a stable feed-rank key.

## Production Guardrails

Media upload:

- Presigned upload URLs with size, type, and key scope restrictions.
- Upload session IDs, expiry, checksum/hash validation, and object ownership.
- Content-type and extension validation; malware/safety scanning when needed.
- Cleanup for unused sessions, incomplete multipart uploads, and orphaned blobs.

Media processing:

- Durable queues, idempotent steps, retries with backoff, DLQ, and timeouts.
- Status per media asset, partial readiness, repair jobs for stuck assets.
- Variant matrix limits to avoid uncontrolled storage and processing cost.

Feed fan-out:

- Post/media-ready events through outbox or durable event publishing.
- Batched idempotent timeline writes keyed by `(viewer_id, post_id)`.
- Per-post fan-out status, lag monitoring, DLQ, and replay/reconciliation.
- Read-time fallback or stale feed behavior when fan-out is delayed.

Feed reads:

- Stable cursor pagination, bounded page size, and dedupe after hybrid merge.
- Hydrate post/media metadata separately from timeline IDs when useful.
- Visibility checks or tombstones for deleted, private, or failed posts.

CDN/media delivery:

- Cache-control by privacy/access pattern.
- Signed CDN URLs when media is private or follower-only.
- Versioned URLs for replacements; monitor hit ratio and origin egress.

## Common Failure Modes

| Failure Mode | Cause | Mitigation |
|---|---|---|
| App servers overloaded by uploads | Clients upload bytes through API servers | Presigned direct-to-object uploads |
| Metadata exists but upload failed | Blob and metadata lifecycle not coordinated | Upload sessions and explicit media status |
| Orphaned blobs accumulate | Upload started but post never finalized | TTL lifecycle and orphan cleanup |
| Processing gets stuck | Worker crash, bad file, unsupported codec | Timeouts, retry, DLQ, status tracking, repair jobs |
| Broken feed cards | Fan-out before preview assets exist | Fan out at `PREVIEW_READY` or show placeholders |
| Feed reads too slow | Querying all followees on every read | Precomputed timelines and hybrid fan-out |
| Celebrity post overload | Fan-out-on-write to millions of followers | Celebrity read-time merge |
| Duplicate feed entries | Retried fan-out or merge overlap | Unique `(viewer_id, post_id)` and dedupe |
| Deleted/private post remains | Stale materialized timeline | Tombstones, hydration-time visibility checks, cleanup |
| CDN serves stale media | Mutable URL behind cached asset | Immutable versioned object keys |

## Clarifying Questions

- Which media types are supported: image, video, carousel, stories?
- What are max upload sizes, video durations, and variant requirements?
- What processing is required before a post can appear in feed?
- What post-created-to-feed-visible latency is acceptable?
- What are feed read/write rates, average followees, and p99 followers?
- Are there celebrity/high-follower producers?
- Is media public, private, follower-only, or mixed?
- Should feed freshness beat media quality, or should visibility wait?
- How are deletes, privacy changes, and failed processing handled?

## Reusable Agent Instructions

- Separate post/media metadata from blob storage.
- Use presigned direct uploads and explicit upload sessions.
- Treat media processing as async, idempotent, and repairable.
- Track media readiness levels and fan out only when preview media can render.
- Serve processed variants through CDN with versioned URLs.
- Use fan-out-on-write for normal producers and read-time merge for celebrities.
- Use cursor pagination and dedupe merged feeds.
- Design stale-feed, processing-placeholder, and delayed-visibility degradation.
- Monitor upload, processing, fan-out lag, feed p99, CDN hit rate, broken media,
  and orphaned storage.
