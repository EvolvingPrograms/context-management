# context-management

Prompt-cache + context-window management for [AI SDK](https://ai-sdk.dev)
apps. Extracted from the
[gateway-caching](../gateway-caching) experiments, where the combined
techniques cut a 20-turn Opus conversation's cost by **82%** vs. gateway
`caching: "auto"` alone.

What it does:

- **Breakpoint placement** — `pinTailBreakpoint` (a `prepareStep` hook)
  caches each tool-loop step's tail so multi-step turns don't re-pay for
  the same tool output every step (-15% alone), plus trailing-history
  chains and breakpoint budgeting under Anthropic's 4-marker cap.
- **Server-side context edits** — `contextEdits({ contextWindow })`
  configures Anthropic's `clear_tool_uses` / `clear_thinking` with
  cache-friendly sizing, and `mirrorTrim` keeps the local history matched
  to what the server cleared so the cached prefix stays aligned.
- **Usage / cost accounting** — `makeMessageMetadata` attaches model id,
  per-turn token breakdown (cache read/write/uncached), context size, and
  the AI Gateway's **actual billed USD** to every assistant message;
  `sessionUsage` folds a conversation into totals. Metadata rides the
  `UIMessage`, so existing persistence stores it for free.
- **Truncation + recovery** — replace old, large tool-result bodies with
  id-stamped stubs (deterministic, cache-stable) and expose a
  `fetch_full_result` tool so the model can recover any full output on
  demand — backed by existing chat persistence (`historyOutputStore`),
  no extra storage.

## Install

Local, from disk (publishing comes later):

```jsonc
// package.json
"dependencies": {
  "context-management": "file:../context-management"
}
```

## Use

Building blocks are standalone:

```ts
import {
  pinTailBreakpoint,
  contextEdits,
  mirrorTrim,
  makeMessageMetadata,
  sessionUsage,
} from "context-management"

const result = streamText({
  model,
  prepareStep: pinTailBreakpoint,
  providerOptions: {
    gateway: { caching: "auto" },
    anthropic: { contextManagement: contextEdits({ contextWindow: 200_000 }) },
  },
  ...
})

return result.toUIMessageStreamResponse({
  messageMetadata: makeMessageMetadata({ model: modelId }),
  onFinish: ({ messages }) => save(messages), // usage/cost/model persist free
})
```

Or compose everything with one call — modes `off | auto | pinned |
managed` mirror the gateway-caching strategy ladder:

```ts
import { createContextManagement, historyOutputStore } from "context-management"

const cm = createContextManagement({
  mode: "managed",
  model: modelId,
  contextWindow: 200_000,
  store: historyOutputStore(modelMessages),
})

const result = streamText({
  model,
  system: SYSTEM + cm.systemSuffix,
  messages: modelMessages,
  tools: { ...appTools, ...cm.tools },
  prepareStep: cm.prepareStep,
  providerOptions: cm.providerOptions(base),
})
return result.toUIMessageStreamResponse({
  messageMetadata: cm.messageMetadata,
  onFinish: ({ messages }) => save(messages),
})
```

## Layout

```
src/            modules (each with its own README + sibling tests)
├── breakpoints/   cache_control placement
├── edits/         Anthropic context edits + local mirror-trim
├── truncation/    tool-result truncation + recovery
└── usage/         token / cache / cost accounting
```

## Develop

```sh
bun install
bun test          # unit tests, no network
bun run typecheck
```
