---
name: omniverse-test-xcode
description: Test Apple platform projects with Xcode-oriented checks. Use when the user asks to build, test, or review iOS, macOS, watchOS, tvOS, Swift, SwiftUI, Xcode projects, schemes, simulators, or signing-related workflows.
---

# Omniverse Test Xcode

Use this skill for Apple-platform validation when an Xcode project is present.

## Workflow

1. Locate workspace, project, schemes, and package dependencies.
2. Identify the intended platform and simulator or device target.
3. Run build and tests through available Xcode tooling.
4. Capture compile errors, test failures, warnings, and signing blockers.
5. Fix narrow issues and rerun the smallest failing check.

## Rules

- Do not change signing, bundle IDs, or provisioning without explicit need.
- Prefer scheme-specific commands over broad guesses.
- Report unavailable simulators or missing Xcode tooling as environment blockers.
- Keep SwiftUI visual changes verified when possible.
