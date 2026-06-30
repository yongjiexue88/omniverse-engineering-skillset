# System Design Large Blob Media Upload And Adaptive Streaming

## Purpose

Use this reference for systems that accept very large immutable user uploads,
process them asynchronously into derived media assets, and serve them to many
users with low latency through CDN and adaptive streaming. The canonical example
is YouTube-style video upload, transcoding, segmentation, and playback.

This is a specialized case under Large Blob/File Handling, Scaling Reads, Async
Processing, and CDN Delivery. Use it with
`system-design-large-blob-file-sync.md`,
`system-design-pattern-recognition-playbook.md`, and
`system-design-architecture-decision-playbook.md` when a design involves video
or audio upload, multipart/resumable media upload, transcoding, manifests,
segments, adaptive bitrate streaming, thumbnails, CDN playback, or partial media
readiness.

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

Users upload very large immutable blobs. The system must store them reliably,
process them asynchronously into usable derived assets, and serve them at
massive read scale with low latency and graceful adaptation to client/network
conditions.

The tension:

- Uploads are large and unreliable.
- Application servers should not move large bytes.
- Raw files are rarely final serving artifacts.
- Playback/read traffic can be much larger than upload traffic.
- Users expect low buffering.
- Playback must adapt to bandwidth, device, codec, and geography.
- Consistency is usually eventual through lifecycle states.

## When To Use

Use this pattern when:

- Files are large enough that app-server upload proxying is risky.
- Uploads may fail or need resume support.
- Blob data is mostly immutable after upload.
- Metadata and blob bytes have different storage/query requirements.
- Files require processing before serving.
- Read traffic greatly exceeds upload traffic.
- CDN caching can reduce latency and origin load.
- Multiple output variants are needed for device/quality/bandwidth.
- The system can expose states such as `PROCESSING` before availability.

Examples:

- Video platforms.
- Audio/podcast platforms.
- Media asset management.
- Large file-sharing systems with previews/transcodes.
- Photo backup with thumbnails/derivatives.
- Training-data upload pipelines.
- Large export/download systems.

## When Not To Use

Avoid this pattern when:

- Files are small and rarely uploaded.
- Files do not need processing.
- Content is private/internal with low read volume.
- CDN caching is not allowed.
- Strong immediate consistency is required before user-visible state.
- Large files are frequently mutated in place.
- Direct object-store upload is impossible due to client/network constraints.

## Default Architecture

Keep large bytes off application servers:

```text
Client
  -> API: create upload session
  -> API: return scoped presigned multipart upload credentials
  -> Object storage: direct multipart upload
  -> API/Object event: complete upload
  -> Metadata DB: UPLOAD_COMPLETE
  -> Processing queue
  -> Media workers:
       validate original
       extract metadata
       transcode variants
       split into segments
       generate thumbnails/captions/manifests
       validate outputs
  -> Metadata DB: PARTIALLY_READY / READY
  -> CDN serves manifests and segments from object store origin
```

## Core Design Rules

### 1. Keep large bytes off application servers

Application servers should authorize and coordinate uploads, not proxy multi-GB
payloads.

Preferred flow:

```text
Client -> API: create upload session / request upload URL
API -> Client: short-lived presigned URL or credentials
Client -> Object Store: upload bytes directly
Object Store -> Event/Callback: upload completed
Processing Pipeline -> derived assets
API/DB -> mark asset ready
```

This decouples app compute from blob transfer bandwidth.

### 2. Separate metadata from blob storage

Store metadata in a queryable database and bytes in object storage.

Example metadata:

```text
VideoMetadata:
  video_id
  owner_id
  title
  description
  upload_status
  processing_status
  original_object_key
  manifest_url
  variants[]
  created_at
  updated_at
```

Partition metadata by access pattern: `video_id` for playback point lookup,
`owner_id`/channel indexes for listing, search index for title/discovery.

### 3. Use resumable multipart upload

Large uploads should be independently retryable by part.

Track upload session:

- Upload session ID.
- Blob key.
- Expected size.
- Uploaded parts.
- Part checksums.
- Expiration time.
- Completion status.

Lifecycle:

```text
CREATE_UPLOAD_SESSION
UPLOAD_PART_N
VERIFY_PART_N
COMPLETE_UPLOAD
ABORT_UPLOAD
```

Expire abandoned sessions and clean incomplete multipart uploads.

### 4. Treat raw upload as pipeline input

Raw uploaded media is usually not final playback content. Trigger async
processing:

```text
original upload
  -> validate file
  -> extract metadata
  -> split into segments
  -> transcode variants
  -> generate thumbnails/transcripts
  -> generate manifests
  -> update metadata readiness
```

### 5. Use adaptive bitrate streaming

Generate multiple quality/bitrate variants and let clients switch during
playback.

Typical outputs:

- 240p, 360p, 480p, 720p, 1080p, 4K where needed.
- Multiple codecs/containers if required.
- Segment files for each variant.
- Manifest files referencing variants and segments.

This avoids forcing slow networks to download high-bitrate files and lets fast
clients get higher quality.

### 6. Serve segments through manifests

Do not serve one giant video file for streaming. Serve a manifest pointing to
small segments.

Client flow:

```text
fetch primary manifest
  -> choose variant/media playlist
  -> download segment 1
  -> download segment 2
  -> switch variant as bandwidth changes
```

Segments support fast startup, seeking, partial retry, and quality switching.

### 7. Use CDN for playback assets

Serve static manifests, segments, thumbnails, captions, and other playback
assets through CDN/edge caches.

CDN reduces:

- Origin load.
- Geographic latency.
- Buffering risk.
- Bandwidth cost pressure at application servers.

Use signed CDN URLs/cookies for private content.

### 8. Model media lifecycle explicitly

Use states such as:

- `INITIATED`
- `UPLOADING`
- `UPLOAD_COMPLETE`
- `PROCESSING`
- `PARTIALLY_READY`
- `READY`
- `FAILED`
- `BLOCKED`
- `DELETED`

Expose useful user-facing states and errors. Do not let clients try to play
media that is uploaded but not processed.

### 9. Allow partial readiness when useful

Large media can be progressively available:

```json
[
  { "quality": "360p", "status": "READY" },
  { "quality": "720p", "status": "PROCESSING" },
  { "quality": "1080p", "status": "PROCESSING" }
]
```

Advertise only ready variants in manifests.

### 10. Partition metadata by access pattern

Blob storage handles bytes. Metadata storage must support:

- Playback lookup by asset ID.
- Listing by owner/channel.
- Search by title/description.
- Moderation/status filtering.
- Lifecycle updates.

Add separate indexes/tables for non-asset-ID access patterns.

## Architecture Decision Rules

- If files are large, use direct object-store upload.
- If uploads can fail mid-transfer, use multipart resumable upload.
- If raw files need transformation, use async processing.
- If playback supports many devices, generate codec/container variants.
- If playback adapts to bandwidth, use adaptive bitrate streaming.
- If playback needs fast startup/seeking, split into segments.
- If content is watched many times, serve through CDN.
- If metadata reads are point lookups, partition by asset ID.
- If clients need channel/user listing, add access-pattern-specific indexes.
- If a video is not fully processed, do not expose unavailable variants.
- If consistency is not critical for playback metadata, prefer availability and
  eventual consistency.
- If processing fails, retain original for retry/reprocessing.
- If CDN can serve stale manifests, version manifest URLs or control TTLs.

## Production Guardrails

Upload:

- Create upload sessions.
- Use short-lived presigned URLs.
- Scope upload URL to one object key/user.
- Enforce max file size and allowed MIME/container types.
- Use multipart upload.
- Track parts and verify checksums.
- Support pause/resume.
- Expire abandoned sessions.
- Clean incomplete multipart uploads.
- Make completion idempotent.
- Scan uploads when required.
- Store original for reprocessing/recovery.

Metadata:

- Store metadata separately from bytes.
- Track upload and processing status.
- Use server-generated asset IDs.
- Store object keys, not raw public URLs as sole truth.
- Store manifest version and variant readiness.
- Store duration, resolution, codec, bitrate, size.
- Maintain ownership/auth metadata.
- Keep audit history for status transitions.

Processing pipeline:

- Trigger from object-store event or completion event.
- Use durable queue.
- Make processing idempotent.
- Retry with exponential backoff.
- Use DLQ for failed assets.
- Split video into segments.
- Transcode target variants.
- Generate manifests only after segments are ready.
- Generate thumbnails/previews/captions as needed.
- Validate output files before marking ready.
- Store processing logs and error reasons.
- Support reprocessing with pipeline version.

Streaming/CDN:

- Serve manifests and segments through CDN.
- Use cache-control headers by asset type.
- Version manifests and segment paths.
- Use signed CDN URLs/cookies for private content.
- Support range requests or segmented fetch.
- Use origin fallback.
- Pre-warm CDN for popular/new content when needed.
- Avoid frequent mutation of cached objects.
- Invalidate or version on changes.
- Monitor cache hit ratio.

Availability and degradation:

- Show processing state if media is not ready.
- Serve lower-quality variants while higher quality processes.
- Continue serving ready variants if some variants fail.
- Keep previous manifest version during rollout.
- Retry failed jobs without blocking unrelated assets.

Observability:

- Upload success/failure rate.
- Multipart completion rate.
- Upload duration.
- Abandoned sessions.
- Processing queue depth.
- Processing latency by length/resolution.
- Transcode failure rate.
- Time to first playable variant.
- Time to all variants ready.
- CDN hit ratio.
- Playback startup time.
- Rebuffering ratio.
- Segment/manifest error rate.
- Origin bandwidth cost.

## Common Failure Modes

| Failure Mode | Cause | Mitigation |
|---|---|---|
| App server upload bottleneck | Large files proxied through app server | Presigned direct upload |
| Upload restarts from zero | Single-shot upload | Multipart resumable sessions |
| Video fails on devices | Only raw format stored | Transcode supported variants |
| Heavy buffering | Single bitrate or giant file | Adaptive bitrate segments/manifests |
| Manifest references missing segments | Ready before outputs complete | Validate segments before manifest publish |
| Processing job lost | Event dropped or processor crash | Durable queue, retry, DLQ, reconciliation |
| CDN serves stale manifest | Overwrite without versioning | Versioned keys or invalidation/TTL |
| Hot video overloads origin | CDN miss/misconfig | Cache/pre-warm segments and manifests |
| Metadata ready but playback fails | DB and object state diverge | Readiness checks and repair jobs |
| Storage cost explodes | Too many variants/no lifecycle | Variant policy, lifecycle tiers, cleanup |
| Long videos block capacity | Giant files monopolize workers | Segment parallelism, queues, quotas, autoscaling |
| Private content leaks | Public URLs/broad CDN cache | Signed URLs/cookies and access controls |

## Clarifying Questions

Ask:

1. Max and average upload size?
2. Uploads per day and watches per day?
3. Expected read/write ratio?
4. Public or private uploads?
5. Moderation before playback?
6. Devices/browsers supported?
7. Codecs/containers required?
8. Resolutions/bitrates generated?
9. Time to first playable version?
10. Is partial readiness acceptable?
11. Retain originals? For how long?
12. Intermediate file retention?
13. Resumable upload protocol?
14. Checksum/integrity requirements?
15. What if upload never completes?
16. Processing retry behavior?
17. How are failures shown to users?
18. Can users replace or edit media?
19. Manifest versioning strategy?
20. CDN invalidation strategy?
21. Signed URL required?
22. Can CDN cache private content?
23. Playback staleness tolerance?
24. Startup latency and rebuffering targets?
25. Low-bandwidth behavior?
26. Metadata partitioning?
27. Repair jobs for metadata/blob divergence?

## Reusable Agent Instructions

When designing large-blob media systems:

1. Keep large bytes out of application servers.
2. Use direct object-store upload with short-lived scoped permissions.
3. Use multipart resumable uploads.
4. Store metadata and blob bytes separately.
5. Track upload/processing lifecycle states.
6. Treat raw uploads as source artifacts, not final serving artifacts.
7. Trigger async processing after upload completion.
8. Generate playback variants for device/bandwidth compatibility.
9. Split media into segments.
10. Generate manifests referencing ready segments.
11. Publish manifests only after validating referenced objects.
12. Serve playback assets through CDN/edge.
13. Version manifests and segments.
14. Use retries, DLQ, reconciliation, and reprocessing.
15. Monitor upload, processing, CDN, and playback QoE separately.

## Condensed Memory

Use this pattern for large immutable media files. Do not proxy multi-GB uploads
through app servers; use direct object-store uploads with presigned URLs and
multipart resumable sessions. Store metadata separately from blob bytes. Treat
raw uploads as input to async processing, not final serving content. For video,
split files into segments, transcode into multiple codec/container/resolution/
bitrate variants, generate manifests, and mark variants ready only after
validating output objects. Serve manifests and segments through CDN/edge caches
for low-latency playback and origin protection. Guardrails: upload session
tracking, checksums, idempotent completion, abandoned-upload cleanup, durable
processing queue, retries, DLQ, manifest versioning, CDN TTL/invalidation,
signed URLs for private content, lifecycle cleanup, repair jobs, and
observability for upload success, processing latency, CDN hit rate, startup
time, and rebuffering.
