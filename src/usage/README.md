Up: [../README.md](../README.md)

# `src/usage` — token / cache / cost accounting

Per-message usage metadata for AI SDK chat apps: what each turn cost
(tokens by cache class + actual billed USD), which model produced it,
and how full the context currently is.

## Data flow

```
streamText(...)
  └─ toUIMessageStreamResponse({
       messageMetadata: makeMessageMetadata({ model }),   ← attaches per message
       onFinish: ({ messages }) => save(messages),        ← metadata rides along
     })

client / anywhere later:
  sessionUsage(messages)   ← folds metadata → totals + last turn + context + cost
```

- `makeMessageMetadata({ model })` builds the `messageMetadata` callback
  (one per request — it accumulates the turn's billed cost in a closure):
  model id on `start`, running `costUsd` + `contextTokens` on each
  `finish-step`, aggregate `usage` on `finish`.
- Cost is the AI Gateway's **actual debited USD**
  (`providerMetadata.gateway.cost`) — never recomputed from token rates.
- Persistence is free: metadata is part of the `UIMessage`, so whatever
  already saves messages saves the accounting.

## Files

- [`types.ts`](./types.ts) — `Usage`, `UsageMessageMetadata`,
  `SessionUsage`, `EMPTY_USAGE`.
- [`extract.ts`](./extract.ts) — `usageFromTotals` (AI SDK usage →
  flat `Usage`), `gatewayCost` (billed USD from gateway metadata).
- [`aggregate.ts`](./aggregate.ts) — `addUsage`, `cachedShare`
  (cache writes count as cached), `sessionUsage` (conversation fold).
- [`metadata.ts`](./metadata.ts) — `makeMessageMetadata`.

Formatting (compact token counts, currency) is deliberately NOT here —
apps own presentation.

## Tests

Sibling `*.test.ts` files; `bun test src/usage/`.
