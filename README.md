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

## Reference Catalog

The full routing source of truth is `skills/engineering-agent-skills/SKILL.md`. Detailed guidance lives one level down in `skills/engineering-agent-skills/references/`.

Current reference groups:

- Review and implementation: coding guidelines, low-level design, API docs, architecture decisions, and commit messages.
- Core system design: general checklist, architecture decision playbook, and pattern recognition playbook.
- Large files and media: blob/file sync, media streaming, media-heavy feeds, and CDN processing patterns.
- Feeds and search: feed aggregation, hybrid timeline fan-out, recommendation feeds, local search, custom inverted indexes, and immutable mapping.
- Real-time systems: durable messaging, live comments, collaborative editing, market-data proxying, dispatch/provider matching, and LLM token streaming.
- Workflows and contention: job scheduling, sandboxed task execution, financial workflows, auctions/bidding, offline-first sync, local availability, and scarce inventory reservations.
- Analytics and infrastructure: clickstream aggregation, metrics monitoring, streaming Top-K, web crawling, external monitoring, distributed cache, and distributed rate limiting.

List references locally with `find skills/engineering-agent-skills/references -maxdepth 1 -type f | sort`.

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
