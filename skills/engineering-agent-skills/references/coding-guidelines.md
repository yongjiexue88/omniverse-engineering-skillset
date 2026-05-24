# Coding Guidelines

Use these guidelines when writing, reviewing, or refactoring code to reduce common LLM coding mistakes. They bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

Do not assume, hide confusion, or skip tradeoff analysis.

Before implementing:

- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them instead of picking silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop, name what is confusing, and ask.

## 2. Simplicity First

Write the minimum code that solves the problem. Do not add speculative behavior.

- Do not build features beyond what was asked.
- Do not add abstractions for single-use code.
- Do not add flexibility or configurability that was not requested.
- Do not add error handling for impossible scenarios.
- If 200 lines could be 50, rewrite it.

Ask: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

Touch only what is required. Clean up only the mess created by the current change.

When editing existing code:

- Do not improve adjacent code, comments, or formatting.
- Do not refactor things that are not broken.
- Match existing style, even if another style would be preferable.
- If unrelated dead code is visible, mention it instead of deleting it.

When changes create orphans:

- Remove imports, variables, functions, and files that the current change made unused.
- Do not remove pre-existing dead code unless asked.

Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

Define success criteria and loop until verified.

Transform tasks into verifiable goals:

- "Add validation" -> "Write tests for invalid inputs, then make them pass."
- "Fix the bug" -> "Write a test that reproduces it, then make it pass."
- "Refactor X" -> "Ensure tests pass before and after."

For multi-step tasks, state a brief plan:

```text
1. [Step] -> verify: [check]
2. [Step] -> verify: [check]
3. [Step] -> verify: [check]
```

Strong success criteria let the agent loop independently. Weak criteria such as "make it work" require clarification.
