/**
 * Pure aggregation over `Usage` values and message metadata. No I/O.
 */

import type { UIMessage } from "ai"

import {
  EMPTY_USAGE,
  type SessionUsage,
  type Usage,
  type UsageMessageMetadata,
} from "./types"

export function addUsage(a: Usage, b: Usage): Usage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    noCacheTokens: a.noCacheTokens + b.noCacheTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
    outputTokens: a.outputTokens + b.outputTokens,
  }
}

/**
 * Share of input that went through the prompt cache, in [0, 1]:
 * `(cacheRead + cacheWrite) / input`. Writes count as cached — they're cache
 * traffic this call and become reads on the next step — so a first turn that
 * writes its whole prompt shows ~100%, not 0%. Only `noCacheTokens`
 * (full-rate input) counts against it.
 */
export function cachedShare(u: Usage): number {
  if (u.inputTokens === 0) {
    return 0
  }
  return (u.cacheReadTokens + u.cacheWriteTokens) / u.inputTokens
}

/**
 * Fold a conversation's message metadata into session totals. Messages
 * without metadata (user messages, pre-feature history) contribute nothing.
 * Works on any `UIMessage` whose metadata extends `UsageMessageMetadata`.
 */
export function sessionUsage(
  messages: readonly UIMessage<UsageMessageMetadata>[],
): SessionUsage {
  const acc: SessionUsage = {
    total: EMPTY_USAGE,
    lastTurn: null,
    contextTokens: 0,
    costUsd: 0,
  }

  for (const { metadata } of messages) {
    if (!metadata) {
      continue
    }
    const { usage, contextTokens, costUsd } = metadata
    if (usage) {
      acc.total = addUsage(acc.total, usage)
      acc.lastTurn = usage
    }
    if (contextTokens) {
      acc.contextTokens = contextTokens
    }
    if (costUsd) {
      acc.costUsd += costUsd
    }
  }

  return acc
}

/**
 * Total tool uses Anthropic's server-side edits cleared across the
 * conversation. Apps that persist FULL histories and rebuild the model
 * prefix per request pass this to `dropOldestToolUses` so the outgoing
 * prefix matches the server's rewritten cache:
 *
 *     const cleared = totalClearedToolUses(uiMessages)
 *     const prefix = dropOldestToolUses(modelMessages, cleared)
 */
export function totalClearedToolUses(
  messages: readonly UIMessage<UsageMessageMetadata>[],
): number {
  let total = 0
  for (const { metadata } of messages) {
    total += metadata?.clearedToolUses ?? 0
  }
  return total
}
