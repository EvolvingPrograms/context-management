Up: [../README.md](../README.md)

# `src` — library modules

Every module is exported standalone from the root barrel
([`index.ts`](./index.ts)); `createContextManagement` ([`manager.ts`](./manager.ts))
composes them into one per-request object, with the technique level picked
by a [`mode`](./modes.ts).

## Layout

```
src/
├── manager.ts     createContextManagement — the composed entry point
├── modes.ts       off | auto | pinned | managed preset ladder
├── breakpoints/   Anthropic cache_control placement
│   ├── ephemeral.ts   withEphemeralCacheControl (per-role tagging)
│   ├── pin-tail.ts    prepareStep hook tagging the last message per step
│   └── count.ts       countBreakpoints + makeCountingPrepareStep
├── edits/         Server-side context edits + local mirroring
│   ├── config.ts      contextEdits({ contextWindow }) provider option
│   ├── applied.ts     decode appliedEdits from providerMetadata
│   ├── trim.ts        dropOldestToolUses
│   └── mirror-trim.ts mirrorTrim — match local history to server clears
├── truncation/    Tool-result truncation + recovery
│   ├── truncate.ts    stub old/large tool-result bodies (id-stamped)
│   ├── store.ts       FullOutputStore + history-backed adapter
│   └── fetch-tool.ts  fetch_full_result recovery tool
└── usage/         Token / cache / cost accounting
    ├── extract.ts     usageFromTotals, gatewayCost (billed USD)
    ├── aggregate.ts   addUsage, cachedShare, sessionUsage
    └── metadata.ts    makeMessageMetadata — UIMessage metadata factory
```

## Conventions

- **Sibling tests.** Every `foo.ts` has `foo.test.ts` next to it
  (`bun test src/`). No network in unit tests.
- **Relative imports** within the library (it's consumed as a package).
- **No `!` non-null assertions, no ad-hoc `as` casts.** The trust
  boundary for untyped provider data is a small named helper
  (`readAnthropicMetadata` in `edits/applied.ts`, `gatewayCost` in
  `usage/extract.ts`).
- **Modular READMEs.** Every folder has its own README linking up.
