/**
 * `messageMetadata` factory for `result.toUIMessageStreamResponse(...)`.
 *
 * Attaches a `UsageMessageMetadata` to the assistant message as it streams:
 *
 *   - `start`       → the model id
 *   - `finish-step` → running billed cost (gateway-reported) + the step's
 *                     prompt+completion size. Each step OVERWRITES
 *                     `contextTokens` — the last step's footprint IS the
 *                     conversation's current context size.
 *   - `finish`      → the turn's aggregate usage
 *
 * Returned objects merge into `message.metadata`, which the SDK hands to
 * `onFinish` with the message — persist messages as-is and the accounting
 * flows to your database for free.
 *
 * Structurally typed against the SDK's stream parts so it plugs into
 * `toUIMessageStreamResponse({ messageMetadata })` without importing the
 * SDK's internal part union.
 */

import type { LanguageModelUsage } from "ai"

import { clearedToolUses, extractAppliedEdits } from "../edits/applied"
import { gatewayCost, usageFromTotals } from "./extract"
import type { UsageMessageMetadata } from "./types"

/** Structural supertype of the stream parts the callback inspects. */
export interface UsageMetadataPart {
  type: string
  usage?: LanguageModelUsage
  totalUsage?: LanguageModelUsage
  providerMetadata?: unknown
}

/**
 * Build a per-request `messageMetadata` callback. Create ONE per request —
 * it accumulates the turn's billed cost across steps in a closure.
 *
 *     return result.toUIMessageStreamResponse({
 *       messageMetadata: makeMessageMetadata({ model: modelId }),
 *       ...
 *     })
 */
export function makeMessageMetadata(args: { model: string }) {
  let turnCostUsd = 0
  let turnClearedToolUses = 0

  return ({ part }: { part: UsageMetadataPart }): UsageMessageMetadata | undefined => {
    switch (part.type) {
      case "start":
        return { model: args.model }
      case "finish-step": {
        turnCostUsd += gatewayCost(part.providerMetadata)
        turnClearedToolUses += clearedToolUses(
          extractAppliedEdits(part.providerMetadata),
        )
        const meta: UsageMessageMetadata = {
          costUsd: turnCostUsd,
          contextTokens:
            (part.usage?.inputTokens ?? 0) + (part.usage?.outputTokens ?? 0),
        }
        if (turnClearedToolUses > 0) {
          meta.clearedToolUses = turnClearedToolUses
        }
        return meta
      }
      case "finish":
        return { usage: usageFromTotals(part.totalUsage) }
      default:
        return undefined
    }
  }
}
