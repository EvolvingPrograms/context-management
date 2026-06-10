Up: [../README.md](../README.md)

# `src/truncation` — tool-result truncation + recovery

Replace the bodies of OLD, LARGE tool results in the outgoing prefix
with short id-stamped stubs, and give the model a `fetch_full_result`
tool to recover any full body on demand. The gateway-caching experiments
showed concise tool results are the dominant cost lever once the cache
is anchored (2× on a long conversation); this applies the same idea
retroactively to results that have aged out of relevance.

## Design

- **Deterministic + pure** — same history + options → byte-identical
  output, so the truncated prefix stays cache-stable across steps and
  turns. A result crossing the keep-window changes the prefix exactly
  once.
- **Stub keeps a head preview** and names the `toolCallId`:
  `…preview…\n[…truncated 5000 chars — call fetch_full_result with id "x"]`.
- **Recovery needs no extra storage** when chat history is persisted —
  `historyOutputStore(history)` indexes the un-truncated messages; apps
  with their own storage implement the one-method `FullOutputStore`.
- **Idempotent** — already-stubbed bodies are never re-stubbed.

## Files

- [`truncate.ts`](./truncate.ts) — `truncateToolResults(history,
  { keepLast, maxChars, preview })`, `truncationStub`, `isTruncationStub`.
- [`store.ts`](./store.ts) — `FullOutputStore`, `MemoryFullOutputStore`,
  `collectToolOutputs`, `historyOutputStore`.
- [`fetch-tool.ts`](./fetch-tool.ts) — `createFetchFullResultTool({ store })`.
- [`serialize.ts`](./serialize.ts) — `toolOutputText` over every
  `ToolResultOutput` variant.
- [`system.ts`](./system.ts) — `TRUNCATION_SYSTEM_PROMPT` (static, append
  once; keeps the cached system prefix stable).

## Tests

Sibling `*.test.ts` files; `bun test src/truncation/`.
