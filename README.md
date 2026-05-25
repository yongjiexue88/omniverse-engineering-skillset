# Engineering Agent Skills

Reusable AI agent skills for software engineering workflows.

This repository stores a portable skill folder that can be copied into projects and used by AI agents during engineering review, writing, and implementation guidance.

## Repository Layout

The skill lives under:

```txt
skills/<skill-name>/SKILL.md
```

Bundled skill:

- `engineering-agent-skills`: reviews software engineering work before shipping, including system design, backend architecture technology choices, system design pattern recognition, low-level design/coding guidance, coding guidelines, commit messages, architecture decisions, and API documentation.

Low-level design guidance is bundled inside the skill at:

```txt
skills/engineering-agent-skills/references/low-level-design-coding-principles.md
```

Coding guidelines are bundled inside the skill at:

```txt
skills/engineering-agent-skills/references/coding-guidelines.md
```

Commit message guidance is bundled inside the skill at:

```txt
skills/engineering-agent-skills/references/commit-message-guidelines.md
```

System design architecture decision guidance is bundled inside the skill at:

```txt
skills/engineering-agent-skills/references/system-design-architecture-decision-playbook.md
```

System design pattern recognition guidance is bundled inside the skill at:

```txt
skills/engineering-agent-skills/references/system-design-pattern-recognition-playbook.md
```

Large blob storage and multi-device file sync guidance is bundled inside the skill at:

```txt
skills/engineering-agent-skills/references/system-design-large-blob-file-sync.md
```

Large blob media upload and adaptive streaming guidance is bundled inside the skill at:

```txt
skills/engineering-agent-skills/references/system-design-large-blob-media-streaming.md
```

Distributed job scheduler guidance is bundled inside the skill at:

```txt
skills/engineering-agent-skills/references/system-design-distributed-job-scheduler.md
```

Read-heavy local search and review aggregate guidance is bundled inside the skill at:

```txt
skills/engineering-agent-skills/references/system-design-local-search-review-aggregates.md
```

Durable real-time messaging guidance is bundled inside the skill at:

```txt
skills/engineering-agent-skills/references/system-design-durable-real-time-messaging.md
```

Sandboxed long-running task execution guidance is bundled inside the skill at:

```txt
skills/engineering-agent-skills/references/system-design-sandboxed-long-running-task-execution.md
```

Recommendation feed and reciprocal action guidance is bundled inside the skill at:

```txt
skills/engineering-agent-skills/references/system-design-recommendation-feed-reciprocal-actions.md
```

Hybrid follower timeline fan-out guidance is bundled inside the skill at:

```txt
skills/engineering-agent-skills/references/system-design-hybrid-feed-fanout-timeline.md
```

Media-heavy social feed guidance is bundled inside the skill at:

```txt
skills/engineering-agent-skills/references/system-design-media-heavy-social-feed.md
```

Fault-tolerant polite web crawling guidance is bundled inside the skill at:

```txt
skills/engineering-agent-skills/references/system-design-web-crawler-pipeline.md
```

External data monitoring and alerting guidance is bundled inside the skill at:

```txt
skills/engineering-agent-skills/references/system-design-external-data-monitoring-alerts.md
```

Real-time clickstream aggregation guidance is bundled inside the skill at:

```txt
skills/engineering-agent-skills/references/system-design-realtime-clickstream-aggregation.md
```

Metrics monitoring platform guidance is bundled inside the skill at:

```txt
skills/engineering-agent-skills/references/system-design-metrics-monitoring-platform.md
```

Streaming Top-K windowed aggregation guidance is bundled inside the skill at:

```txt
skills/engineering-agent-skills/references/system-design-streaming-top-k-windowed-aggregation.md
```

Real-time dispatch and provider matching guidance is bundled inside the skill at:

```txt
skills/engineering-agent-skills/references/system-design-realtime-dispatch-provider-matching.md
```

Market-data proxy and high-consistency order state guidance is bundled inside the skill at:

```txt
skills/engineering-agent-skills/references/system-design-market-data-proxy-order-state.md
```

Financial workflow state machine guidance is bundled inside the skill at:

```txt
skills/engineering-agent-skills/references/system-design-financial-workflow-state-machines.md
```

LLM serving, streaming, and GPU scheduling guidance is bundled inside the skill at:

```txt
skills/engineering-agent-skills/references/system-design-llm-serving-streaming-gpu-scheduling.md
```

High-contention bidding and real-time auction update guidance is bundled inside the skill at:

```txt
skills/engineering-agent-skills/references/system-design-high-contention-bidding-realtime.md
```

Offline-first activity tracking guidance is bundled inside the skill at:

```txt
skills/engineering-agent-skills/references/system-design-offline-first-activity-tracking.md
```

High-scale live comment streaming guidance is bundled inside the skill at:

```txt
skills/engineering-agent-skills/references/system-design-live-comment-streaming.md
```

Collaborative editing convergence guidance is bundled inside the skill at:

```txt
skills/engineering-agent-skills/references/system-design-collaborative-editing-convergence.md
```

Distributed cache guidance is bundled inside the skill at:

```txt
skills/engineering-agent-skills/references/system-design-distributed-cache.md
```

Distributed rate limiter guidance is bundled inside the skill at:

```txt
skills/engineering-agent-skills/references/system-design-distributed-rate-limiter.md
```

Custom inverted index search guidance is bundled inside the skill at:

```txt
skills/engineering-agent-skills/references/system-design-custom-inverted-index-search.md
```

Local availability and strong inventory/reservation consistency guidance is bundled inside the skill at:

```txt
skills/engineering-agent-skills/references/system-design-local-availability-inventory-consistency.md
```

Scarce inventory reservation guidance is bundled inside the skill at:

```txt
skills/engineering-agent-skills/references/system-design-scarce-inventory-reservation-playbook.md
```

High-scale feed aggregation guidance is bundled inside the skill at:

```txt
skills/engineering-agent-skills/references/system-design-feed-aggregation-playbook.md
```

Read-heavy immutable mapping guidance is bundled inside the skill at:

```txt
skills/engineering-agent-skills/references/system-design-read-heavy-immutable-mapping-playbook.md
```

## Install All Skills

From this repository, copy the bundled skill into another project's `.agents/skills` folder:

```bash
./install.sh
```

By default, this installs into:

```txt
.agents/skills
```

To install into a custom target:

```bash
./install.sh /path/to/project/.agents/skills
```

## Install With Skills CLI

This repo also works with the Skills CLI used by `npx skills add`.

List available skills:

```bash
npx skills add yongjiexue88/engineering-agent-skills --list
```

Install the skill for Codex without prompts:

```bash
npx skills add yongjiexue88/engineering-agent-skills \
  --skill engineering-agent-skills \
  --agent codex \
  --yes
```

Codex uses the universal `.agents/skills` location. If the CLI shows `Universal (.agents/skills) — always included`, Codex is already covered there; it may not appear again under “Additional agents.”

Install the skill for the detected agent in the current project:

```bash
npx skills add yongjiexue88/engineering-agent-skills \
  --skill engineering-agent-skills
```

Install the skill for all supported agents without prompts:

```bash
npx skills add yongjiexue88/engineering-agent-skills \
  --skill engineering-agent-skills \
  --agent '*' \
  --yes
```

Install by copying instead of symlinking:

```bash
npx skills add yongjiexue88/engineering-agent-skills \
  --skill engineering-agent-skills \
  --agent '*' \
  --copy \
  --yes
```

Install globally:

```bash
npx skills add yongjiexue88/engineering-agent-skills \
  --skill engineering-agent-skills \
  --global
```

Install all skills for all supported agents without prompts:

```bash
npx skills add yongjiexue88/engineering-agent-skills --all
```

Use `--agent codex`, `--agent claude-code`, `--agent cursor`, or another explicit agent only when you want to target one agent. No npm package is required for this repository. The Skills CLI reads the public GitHub repo, finds `skills/engineering-agent-skills/SKILL.md`, and installs it into the target agent skill folder.

## Install With This npm Package

Install the bundled skill from npm with:

```bash
npx engineering-agent-skills install
```

Install the skill explicitly:

```bash
npx engineering-agent-skills install --skill engineering-agent-skills
```

Install for Codex or another agent target:

```bash
npx engineering-agent-skills install --agent codex
npx engineering-agent-skills install --agent claude-code
```

Install into a custom target:

```bash
npx engineering-agent-skills install --target .agents/skills
```

List bundled skills:

```bash
npx engineering-agent-skills list
```

Publish the npm package:

```bash
npm login
npm publish --access public
```

## Install One Skill Manually

Copy the skill folder:

```bash
mkdir -p /path/to/project/.agents/skills
cp -R skills/engineering-agent-skills /path/to/project/.agents/skills/
```

The installed skill should look like:

```txt
/path/to/project/.agents/skills/engineering-agent-skills/SKILL.md
```

## Invoke From an AI Agent

Ask the agent to use the skill by name:

```txt
Use the engineering-agent-skills skill to review this architecture proposal.
```

Examples:

```txt
Use engineering-agent-skills to review this architecture proposal.
Use engineering-agent-skills to decide between REST, GraphQL, gRPC, WebSocket, SQL, NoSQL, Redis, queues, or sharding.
Use engineering-agent-skills to recognize system design patterns like long-running tasks, large blobs, scaling reads/writes, contention, workflows, or real-time updates.
Use engineering-agent-skills to design large file upload, signed URL transfer, and multi-device file sync.
Use engineering-agent-skills to design large video upload with async processing and adaptive streaming.
Use engineering-agent-skills to design a distributed job scheduler with at-least-once execution.
Use engineering-agent-skills to design read-heavy local business search with review aggregates.
Use engineering-agent-skills to design durable real-time messaging with offline delivery.
Use engineering-agent-skills to design sandboxed long-running task execution for online code judging.
Use engineering-agent-skills to design a recommendation feed with reciprocal matching.
Use engineering-agent-skills to design a hybrid follower timeline with celebrity fan-out handling.
Use engineering-agent-skills to design a media-heavy social feed with async video processing and feed fan-out.
Use engineering-agent-skills to design a fault-tolerant polite web crawler with URL frontier dedupe and robots.txt handling.
Use engineering-agent-skills to design an external price/data monitoring service with priority crawling and alerts.
Use engineering-agent-skills to design real-time clickstream aggregation with dedupe, event-time windows, and OLAP dashboards.
Use engineering-agent-skills to design a metrics monitoring platform with cardinality control, rollups, and alerting.
Use engineering-agent-skills to design streaming Top-K rankings with precomputed time windows.
Use engineering-agent-skills to design real-time dispatch with geospatial provider matching and reservations.
Use engineering-agent-skills to design a market-data proxy with SSE fan-out and high-consistency order state.
Use engineering-agent-skills to design a financial payment workflow with idempotency, auditability, webhooks, and reconciliation.
Use engineering-agent-skills to design LLM serving with SSE token streaming, GPU scheduling, and context-cost control.
Use engineering-agent-skills to design an auction bidding system with ordered processing and live highest-bid updates.
Use engineering-agent-skills to design offline-first GPS activity tracking with chunked sync.
Use engineering-agent-skills to design high-scale live comments with SSE fan-out and reconnect replay.
Use engineering-agent-skills to design collaborative editing with OT/CRDT convergence.
Use engineering-agent-skills to design a distributed cache with consistent hashing and hot-key protection.
Use engineering-agent-skills to design a distributed rate limiter for API gateway traffic protection.
Use engineering-agent-skills to design custom inverted-index search with hot/cold tiers.
Use engineering-agent-skills to design local inventory availability with strong reservation consistency.
Use engineering-agent-skills to design scarce inventory reservation with TTL holds, payment finalization, and waiting-room admission control.
Use engineering-agent-skills to design a high-scale read-optimized feed with cursor pagination and feed projections.
Use engineering-agent-skills to design a URL shortener or read-heavy immutable public-key lookup service.
Use engineering-agent-skills to review these API docs before release.
Use engineering-agent-skills to write a commit message for this diff.
Use engineering-agent-skills before implementing this feature.
Use engineering-agent-skills to review state ownership and concurrency risks.
Use engineering-agent-skills to apply coding guidelines while implementing this change.
```
