# System Design Large Blob Storage And File Sync Playbook

## Category

Handling large blobs, file storage, file sharing, and multi-device file sync
architecture.

Use this reference for systems that need to upload, download, share, and
synchronize large binary objects across users, devices, regions, or clients.
Dropbox-style storage and sync systems are the canonical example.

This reference is a specialized case under the Handling Large Blobs pattern. Use
it with `system-design-pattern-recognition-playbook.md` and
`system-design-architecture-decision-playbook.md` when the design involves large
files, object storage, signed URLs, resumable uploads, CDN delivery, or
multi-device sync.

## Table Of Contents

- [Core Problem Pattern](#core-problem-pattern)
- [When To Use](#when-to-use)
- [When Not To Use](#when-not-to-use)
- [Core Design Ideas](#core-design-ideas)
- [Architecture Decision Rules](#architecture-decision-rules)
- [Production Guardrails](#production-guardrails)
- [Common Failure Modes](#common-failure-modes)
- [Deep-Dive Questions](#deep-dive-questions)
- [Reusable Agent Instructions](#reusable-agent-instructions)
- [Condensed Memory](#condensed-memory)

## Core Problem Pattern

Build a system where application servers coordinate ownership, permissions,
metadata, upload state, and sync state, while large file bytes move through
specialized blob/object storage and edge delivery infrastructure.

The central design separation is:

- Control plane: metadata service, auth, ACLs, signed URL generation, upload
  sessions, and sync events.
- Data plane: object storage, multipart upload, CDN, byte-range download, and
  chunk transfer.

The staff-level mistake to avoid is putting application servers directly in the
large-file data path. Uploading to the backend and then to blob storage
duplicates transfer work. The stronger default is direct client-to-blob upload
using signed URLs, with the backend acting as coordinator.

## When To Use

Use this pattern when:

- Users upload or download large files, especially hundreds of MBs to tens of
  GBs.
- Uploads need to survive flaky networks, browser restarts, app restarts, or
  mobile connectivity changes.
- Downloads need low latency across regions.
- Clients need progress bars, resumable upload, retry, and partial failure
  recovery.
- Multiple devices must stay synchronized.
- File bytes are much larger than metadata.
- Authorization and sharing rules matter.
- The system can tolerate eventual consistency for file visibility or sync
  propagation.
- Large binary objects should not overload app servers, API gateways, or
  databases.

## When Not To Use

Avoid or simplify this pattern when:

- Files are small and infrequent enough that direct backend upload is
  operationally acceptable.
- The system is internal, low-scale, or prototype-only.
- Strong consistency is required for every read-after-write across regions.
- CDN cost is not justified because files are rarely downloaded more than once
  or mostly accessed from the same region.
- Clients are too constrained to perform chunking, compression, hashing, or
  upload orchestration.
- The storage provider already gives you a managed SDK that solves
  multipart/resumable upload and custom sync semantics are not needed.
- Security requirements forbid bearer-style signed URLs unless combined with
  stronger restrictions.

## Core Design Ideas

### 1. Separate Metadata From File Bytes

Store file metadata in a database and raw bytes in object/blob storage.

Metadata has query, permission, ownership, sharing, sync, and lifecycle
concerns. File bytes have throughput, durability, and storage-scale concerns.
Mixing them creates scalability and operational pain.

Tradeoff: metadata and object storage can diverge. Metadata may say a file
exists while bytes are missing, or bytes may exist while metadata was never
finalized.

Apply it by modeling explicit lifecycle states such as `uploading`, `uploaded`,
`failed`, and `deleted`. Expose files only after blob storage confirms
finalization.

### 2. Keep Application Servers Out Of The File Data Path

Use signed URLs so clients upload and download directly to and from object
storage or CDN.

Routing huge files through app servers doubles bandwidth, increases latency,
raises infrastructure cost, and creates bottlenecks.

Tradeoff: the backend loses direct control over byte transfer. It must
coordinate using upload sessions, signed URL expiration, object keys, callbacks,
ETags, and verification APIs.

Apply it by making the backend a coordinator, not a byte proxy. It should
authenticate users, authorize access, create upload sessions, generate signed
URLs, verify completion, and update metadata.

### 3. Treat Signed URLs As Bearer Tokens

A signed URL grants access to whoever holds it until it expires.

Signed URLs reduce backend load, but they can be leaked or forwarded. Short
expiration limits exposure but does not fully prevent sharing.

Tradeoff: short TTLs improve security but may break slow uploads/downloads.
Long TTLs improve usability but increase leak impact.

Apply it with short-lived signed URLs, ACL checks before issuance, scoped object
keys, and stronger controls such as IP binding, auth cookies, one-time URLs, or
scoped tokens for high-security files.

### 4. Use Multipart Or Chunked Uploads For Large Files

Break large files into chunks on the client and upload parts independently.

Chunking enables progress tracking, retrying only failed parts, resumable
upload, and parallel transfer. Chunking on the server defeats the purpose
because the whole file still reaches the server first.

Tradeoff: chunking adds upload session state, chunk metadata, part ordering,
ETag tracking, cleanup of abandoned uploads, and final assembly.

Apply it by creating an upload session with `upload_id`, part numbers, chunk
fingerprints, presigned part URLs, and chunk status. Finalize only after every
part is verified and object storage confirms assembly.

### 5. Trust Client Progress, But Verify Server-Side

Let the client report chunk progress for UI responsiveness, but verify uploaded
chunks with the storage provider before marking the file complete.

A malicious or buggy client can claim chunks were uploaded when they were not.
Use storage-side ETag or `ListParts` verification.

Tradeoff: verification adds storage API calls and state transitions, but
prevents corrupt metadata and hard-to-debug incomplete files.

Apply it by treating client-reported ETags as hints, not proof. Before
finalization, call storage-provider APIs such as `ListParts`, validate part
numbers and ETags, then call `CompleteMultipartUpload`.

### 6. Use Fingerprints For Deduplication And Resumability

Identify content by hashes/fingerprints, not filenames.

Filenames are not unique. A fingerprint tells whether the same content or chunk
has appeared before, which helps resume interrupted uploads and avoid duplicate
transfer.

Tradeoff: hashing large files costs client CPU and battery. Fingerprints can
also reveal that two users uploaded identical content if not designed carefully.

Apply it by using a unique metadata ID for the file record and separate content
fingerprints for dedup/resume checks. For resumable upload, fingerprint both the
full file and individual chunks.

### 7. Use CDN For Download Acceleration Selectively

Serve downloads through a CDN when files are repeatedly accessed, globally
shared, or cross-region latency matters.

Tradeoff: CDNs cost money and are most useful when cache hit rate or latency
savings justify them. Private one-off downloads may not benefit much.

Apply it by asking about access patterns before adding CDN. Use cache-control,
signed CDN URLs, and metrics for hit rate, egress cost, latency, and regional
distribution.

### 8. Use Hybrid Push And Poll For Reliable Sync

Use WebSocket/SSE for fast notifications, plus periodic polling as a safety net.

Push gives near-real-time sync, but connections drop and messages can be missed.
Use one connection per device/session and periodic `changes?since=...` polling
to guarantee eventual catch-up.

Tradeoff: hybrid sync is more complex than pure polling but more reliable than
pure push.

Apply it by designing sync around a durable change feed and client
cursor/watermark. Push should wake the client up; polling should repair missed
notifications.

### 9. Prefer Durable Change Feeds Over Timestamp-Only Sync

Use monotonically ordered change events or version cursors instead of relying
only on timestamps.

Timestamp-based sync can miss events due to clock skew, equal timestamps, race
conditions, or pagination boundaries.

Tradeoff: a durable change log requires storage, retention, compaction, and
replay semantics.

Apply it with ordered events containing `event_id`, `user_id`, `file_id`,
`version`, `operation`, `metadata_snapshot`, and `created_at`. Clients sync
using `since_event_id` or an opaque cursor.

### 10. Use Content-Defined Chunking For Efficient Delta Sync

For file updates, chunk boundaries should be based on content, not fixed
offsets, when delta sync matters.

Inserting one byte near the beginning of a file shifts fixed-size chunk
boundaries, causing many chunks to appear changed. Content-defined chunking uses
rolling hashes so small edits affect only nearby chunks.

Tradeoff: content-defined chunking is more CPU-intensive and more complex than
fixed-size chunking.

Apply it by using fixed-size chunks for simple multipart upload. Use
content-defined chunking only when efficient sync of modified files is a key
requirement.

### 11. Compress Selectively And Before Encryption

Compress only when compression saves more transfer time than it costs in CPU,
and compress before encryption.

Compression helps text-like data but often wastes time on already-compressed
media. When the backend is not in the data path, useful compression usually
happens client-side. Encrypted data is effectively random and does not compress
well.

Tradeoff: compression increases client CPU, memory, battery, and implementation
complexity.

Apply it adaptively based on file type, size, device capability, and network
conditions. Avoid compressing images/videos unless measurement proves benefit.

## Architecture Decision Rules

- If files are large or frequent, prefer direct-to-object-storage upload because
  app servers should not carry large byte streams.
- If uploads must be resumable, prefer multipart upload with persisted upload
  state because retries should resume from missing chunks only.
- If clients need progress bars, prefer client-side chunk orchestration because
  the client sees per-part progress directly.
- If metadata and blob state can diverge, use explicit file lifecycle states
  because incomplete uploads must not appear as available files.
- If the client reports upload completion, require server-side ETag/ListParts
  verification because client state is not authoritative.
- If the file may be uploaded multiple times, use content fingerprints because
  filenames are not stable identifiers.
- If users download files globally or repeatedly, prefer CDN signed URLs because
  edge caching reduces latency and origin egress.
- If files are private and downloaded once, avoid default CDN caching because
  cache hit rate may not justify cost.
- If sync must feel real-time, use WebSocket/SSE notifications because polling
  alone is slow and wasteful.
- If sync must be reliable, pair push with polling/replay because push messages
  can be missed.
- If conflict resolution matters, avoid silent last-write-wins unless product
  explicitly accepts data loss risk.
- If small edits to large files are common, prefer delta sync with
  content-defined chunking because fixed-size chunks create false changes after
  insertions.
- If uploads happen on weak networks, use adaptive chunk size and bounded
  parallelism because too much concurrency can worsen reliability.
- If signed URLs are used for sensitive data, keep TTL short and add extra
  restrictions because signed URLs are bearer credentials.
- If encryption is required and compression is useful, compress before
  encrypting because encrypted bytes do not compress well.
- If immediate cross-region visibility is not business-critical, prefer
  availability and eventual consistency because file sync systems can tolerate
  short propagation delays.

## Production Guardrails

### Idempotency

- Idempotent upload session creation by file fingerprint/user.
- Idempotent chunk status updates by `upload_id + part_number + ETag`.
- Idempotent finalize operation.

### Retries

- Retry failed chunk uploads with exponential backoff and jitter.
- Retry signed URL generation safely.
- Retry metadata updates without duplicating file records.

### Backpressure

- Limit concurrent chunk uploads per client.
- Throttle upload session creation per user/IP.
- Protect metadata DB from excessive chunk status updates.

### Timeouts

- Signed URL TTLs.
- Upload session expiration.
- Abandoned multipart upload cleanup.
- WebSocket heartbeat and reconnect handling.

### Verification

- Validate part numbers, chunk sizes, file size, MIME type, hash/fingerprint,
  and ETags.
- Verify all parts before final assembly.
- Do not mark file `uploaded` until object storage confirms completion.

### Observability

- Track upload lifecycle events.
- Track upload success rate, failed chunks, resume rate, finalization failures,
  orphaned objects, CDN hit ratio, and sync lag.
- Include `user_id`, `file_id`, `upload_id`, `chunk_id`, `object_key`, and
  request correlation ID in logs.

### Data Repair

- Background job to find metadata records stuck in `uploading`.
- Background job to delete orphaned chunks and uncommitted multipart uploads.
- Background job to detect metadata pointing to missing objects.

### Security

- ACL check before signed URL generation.
- Short-lived signed URLs.
- Encryption in transit and at rest.
- Avoid passing user identity in request body; derive identity from auth
  context.
- Audit file sharing changes.

### Cache Invalidation

- Version object keys or include file version in CDN cache key.
- Avoid overwriting objects behind cached URLs without versioned paths.
- Set cache-control based on file access pattern and privacy.

### Sync Correctness

- Durable change log.
- Cursor-based incremental sync.
- Push notification plus polling fallback.
- Replay missed events.
- Deduplicate events client-side.
- Handle out-of-order notifications.

### Graceful Degradation

- If WebSocket fails, fall back to polling.
- If CDN fails, optionally fall back to object storage signed URL.
- If compression is too expensive, upload raw file.
- If chunk verification is delayed, keep file in pending state.

## Common Failure Modes

| Failure Mode | Why It Happens | Mitigation |
|---|---|---|
| Metadata says uploaded but object is missing | Metadata updated before blob finalization | Only mark uploaded after storage confirms completion |
| Object exists but metadata insert failed | Blob upload succeeded, DB write failed | Use upload lifecycle states and orphan cleanup |
| Client falsely marks chunks uploaded | Buggy or malicious client status update | Verify ETags/ListParts server-side |
| Upload cannot resume | No persisted upload session or chunk state | Store upload state keyed by user/file fingerprint |
| Duplicate uploads waste storage | No content fingerprinting | Use file/chunk fingerprints for dedup/resume |
| CDN serves stale file | Object overwritten behind same cache key | Use versioned object keys or cache-busting |
| Signed URL leak | URL forwarded or logged | Short TTL, scoped URL, IP binding/auth cookies when needed |
| Sync misses changes | WebSocket dropped or message lost | Durable change feed plus polling fallback |
| Timestamp sync skips events | Clock skew or equal timestamps | Use monotonic event IDs/cursors |
| Last-write-wins loses user edits | Concurrent edits overwrite each other | Versioning, conflict files, merge strategy, user-visible conflict resolution |
| Upload overloads client/network | Too many parallel chunks | Adaptive concurrency and backpressure |
| Abandoned multipart uploads accumulate cost | Client disconnects mid-upload | Upload session TTL and cleanup jobs |
| Compression hurts performance | Already-compressed media or weak device | Compress selectively based on file type and measurement |
| Delta sync ineffective | Fixed-size chunks shift after insertion | Use content-defined chunking for delta sync |

## Deep-Dive Questions

- What is the maximum file size?
- What is the typical file size distribution?
- How often are files updated after upload?
- Are updates append-only, random edits, or full replacements?
- Do users need true real-time sync or eventual sync?
- What is the acceptable sync delay?
- What consistency guarantee is required after upload?
- Are files private, shared with small groups, or publicly shared?
- What percentage of downloads are repeated enough to justify CDN?
- Are users global or mostly in one region?
- Should uploads resume after browser/app restart?
- Should downloads resume after interruption?
- Is deduplication required across one user, one tenant, or globally?
- What is the security level of the files?
- Are signed URLs acceptable as bearer tokens?
- Do clients support hashing, compression, and chunk orchestration?
- What are the mobile battery/CPU constraints?
- How should concurrent edits be resolved?
- Is version history required?
- What is the retention policy for deleted files and old versions?
- What observability is required to debug corrupted or stuck uploads?
- What storage lifecycle policy should clean abandoned chunks?

## Reusable Agent Instructions

- Start by separating metadata/control plane from blob/data plane.
- Do not route large file bytes through application servers unless scale is tiny
  or explicitly required.
- Use object storage for raw bytes and a database for metadata, ACLs, ownership,
  upload state, and sync state.
- Generate signed URLs only after authenticating and authorizing the user.
- Treat signed URLs as bearer credentials; keep them scoped and short-lived.
- Use multipart upload for large files.
- Perform chunking on the client, not the server.
- Persist upload session state and chunk status.
- Use file and chunk fingerprints for resumability and deduplication.
- Never trust client-reported upload completion without storage-side
  verification.
- Finalize object storage assembly before marking metadata as uploaded.
- Add cleanup jobs for orphaned objects, abandoned multipart uploads, and stuck
  metadata records.
- Use CDN only when download latency or repeated access justifies cost.
- Use versioned object keys to avoid stale CDN content.
- Use WebSocket/SSE for fast sync notifications, but always include
  polling/replay fallback.
- Design sync around a durable change feed and cursor, not timestamp-only
  polling.
- Use content-defined chunking or delta sync only when file modifications are
  frequent and transfer savings justify complexity.
- Make conflict resolution explicit; do not hide last-write-wins data loss
  risk.
- Add metrics and logs for every upload, chunk, finalization, download, and sync
  stage.
- Ask scale, file size, access pattern, consistency, security, and client
  capability questions before recommending this pattern.

## Condensed Memory

Use the Large Blob Storage and File Sync pattern when systems handle large
uploads/downloads, file sharing, or multi-device sync. Separate metadata/control
plane from blob/data plane. Store metadata, ACLs, upload sessions, and sync
events in a database; store raw bytes in object storage. Keep app servers out of
the byte path by using short-lived signed URLs. For large files, use client-side
multipart/chunked uploads, persisted upload state, file/chunk fingerprints,
ETag/ListParts verification, and only mark files uploaded after storage
finalization. Use CDN signed URLs for downloads only when repeated/global access
justifies cost. For sync, use WebSocket/SSE push for low latency plus
polling/replay from a durable change feed for reliability. Prefer event cursors
over timestamp-only sync. Use content-defined chunking for efficient delta sync
when small edits to large files are common. Guardrails include idempotency,
retries, adaptive chunk concurrency, backpressure, upload TTLs, orphan cleanup,
signed URL scope/TTL, encryption, ACL checks, versioned object keys,
observability, conflict strategy, and data repair jobs.
