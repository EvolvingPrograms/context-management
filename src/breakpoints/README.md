Up: [../README.md](../README.md)

# `src/breakpoints` — Anthropic `cache_control` placement

Helpers for placing Anthropic `cache_control: { type: 'ephemeral' }`
markers in a `ModelMessage` history so the prompt cache anchors at the
right positions. Anthropic caps each request at 4 explicit
breakpoints; this folder gives you the primitives to spend that budget
deliberately.


## Files

- [`ephemeral.ts`](./ephemeral.ts) — `withEphemeralCacheControl(msg)`
  tags a single message; per-role handling for system / user /
  assistant / tool.
- [`pin-tail.ts`](./pin-tail.ts) — `pinTailBreakpoint`, a
  `prepareStep` hook that tags the LAST message of every internal
  tool-loop step so each step's new tail is written to cache before
  the next step reads it.
- [`count.ts`](./count.ts) — `countBreakpoints` and
  `makeCountingPrepareStep` to observe how many markers a strategy
  actually emits, step-by-step.
- [`index.ts`](./index.ts) — public barrel.


## Key facts

- **Hard cap of 4** `cache_control` markers per request. Exceeding
  it returns a 400 from Anthropic, so the SDK / gateway silently
  strip extras — usually in ways that hurt cache-write anchoring.
- **Gateway `caching: 'auto'` adds a 5th server-side marker** this
  module can't see. If you're using gateway auto, budget your manual
  placements at 3 (system + 2 trailing history) to leave room.
- **Cache invalidates downstream** when content before a breakpoint
  changes — placement matters as much as count.


## Tests

Sibling `.test.ts` files cover each module:

- [`ephemeral.test.ts`](./ephemeral.test.ts) — per-role tagging,
  no-mutation, preserves pre-existing `providerOptions`.
- [`pin-tail.test.ts`](./pin-tail.test.ts) — empty-input
  fallthrough, tail-only tagging.
- [`count.test.ts`](./count.test.ts) — message-level + per-part
  marker counting, `systemHasEphemeral` flag,
  `makeCountingPrepareStep` wrapper semantics.

Real-API integration coverage for `pinTailBreakpoint` lives in the
gateway-caching repo's `tests/step.test.ts` (this library's unit tests
stay offline).
