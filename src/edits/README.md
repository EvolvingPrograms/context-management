Up: [../README.md](../README.md)

# `src/edits` — Anthropic server-side context edits

Configuration + bookkeeping for Anthropic's context-management edits
(`clear_tool_uses`, `clear_thinking`), tuned so the edits and the prompt
cache cooperate instead of fighting.

## Why the tuning matters

Every context edit invalidates the cache from the edit point onward. So:

- **Triggers sit high** (default: 18% of the context window) to delay
  invalidation as long as possible.
- **Clears are big** (default: ≥ trigger/3) so the post-edit cache write
  amortizes over many later reads.
- **Compaction is omitted** — it rewrites the whole history, the
  maximum-blast-radius invalidation.

And when the server DOES clear N tool uses, the local history must drop
the same N (`mirrorTrim`) — otherwise the next request re-sends the
pre-edit prefix, mismatches the rewritten cache, and pays a full write.

## Files

- [`config.ts`](./config.ts) — `contextEdits({ contextWindow, ... })` →
  the `anthropic.contextManagement` provider option.
- [`applied.ts`](./applied.ts) — decode `appliedEdits` from a step's
  `providerMetadata`: `extractAppliedEdits`, `clearedToolUses`,
  `describeEdit`.
- [`trim.ts`](./trim.ts) — `dropOldestToolUses(history, n)`: remove the
  oldest n tool-call/result pairs, preserving assistant narration.
- [`mirror-trim.ts`](./mirror-trim.ts) — `mirrorTrim(history,
  stepProviderMetadata)`: count server clears, drop the same count locally.
  `mirrorPersistedClears(uiMessages, modelMessages)`: the persisted-history
  variant — fold the per-turn clear counts `makeMessageMetadata` recorded
  and trim the rebuilt prefix at load time.

## Tests

Sibling `*.test.ts` files; `bun test src/edits/`.
