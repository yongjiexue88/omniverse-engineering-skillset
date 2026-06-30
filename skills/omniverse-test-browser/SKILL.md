---
name: omniverse-test-browser
description: Test browser-based applications and UI workflows. Use when the user asks to run browser QA, inspect a page, verify a frontend change, check responsive behavior, smoke test a dev server, or validate user flows.
---

# Omniverse Test Browser

Use this skill for practical browser verification.

## Workflow

1. Start or identify the app URL.
2. Test the critical happy path first.
3. Check error, loading, empty, and permission states that are reachable.
4. Verify desktop and mobile layouts for overlap, clipped text, and broken controls.
5. Capture evidence: screenshots, console errors, network failures, and steps.
6. Report issues with reproduction steps and severity.

Use `scripts/create-browser-qa-report.js "<workflow>" --url <url>` when the QA findings should be saved under `docs/qa/`.

## Rules

- Do not rely only on static code review for UI behavior.
- If no browser automation tool is available, provide a manual checklist and note the gap.
- Prioritize broken workflows over visual nits.
