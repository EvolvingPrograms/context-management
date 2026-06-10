/**
 * Mirror Anthropic's server-side `clear_tool_uses` edits on the LOCAL
 * outgoing history.
 *
 * When the server clears N tool uses, the prompt cache is rewritten to a
 * SHORTER prefix. If the un-trimmed prefix is re-sent on the next turn,
 * the outgoing request no longer matches what the server cached and the
 * conversation eats an extra full cache write. This reads the applied-edit
 * records from each step's `providerMetadata`, counts the cleared tool
 * uses, and drops the same count from the oldest end of the history so the
 * next outgoing prefix lines up.
 *
 * Call after a turn finishes, BEFORE persisting / re-sending the history:
 *
 *     const trimmed = mirrorTrim(history, steps.map((s) => s.providerMetadata))
 */

import type { ModelMessage, UIMessage } from "ai"

import { totalClearedToolUses } from "../usage/aggregate"
import type { UsageMessageMetadata } from "../usage/types"
import { clearedToolUses, extractAppliedEdits } from "./applied"
import { dropOldestToolUses } from "./trim"

/** Mirror a turn's server-side `clear_tool_uses` edits onto an in-memory
 * history: count the clears in each step's `providerMetadata` and drop the
 * same number of oldest tool pairs, so the next outgoing prefix matches
 * the server's rewritten cache. */
export function mirrorTrim(
  history: readonly ModelMessage[],
  stepProviderMetadata: readonly unknown[],
): ModelMessage[] {
  let cleared = 0
  for (const meta of stepProviderMetadata) {
    cleared += clearedToolUses(extractAppliedEdits(meta))
  }
  if (cleared === 0) {
    return [...history]
  }
  return dropOldestToolUses(history, cleared)
}

/**
 * The persisted-history variant: apps that save FULL UIMessages and
 * rebuild the model prefix per request mirror the server's PAST clears at
 * load time instead. `makeMessageMetadata` records each turn's cleared
 * count on the message; this folds those counts and drops the same number
 * of oldest tool uses from the rebuilt prefix, so the outgoing request
 * matches the server's rewritten cache.
 *
 *     const modelMessages = mirrorPersistedClears(
 *       uiMessages,
 *       await convertToModelMessages(uiMessages),
 *     )
 */
export function mirrorPersistedClears(
  uiMessages: readonly UIMessage<UsageMessageMetadata>[],
  modelMessages: ModelMessage[],
): ModelMessage[] {
  const cleared = totalClearedToolUses(uiMessages)
  if (cleared === 0) {
    return modelMessages
  }
  return dropOldestToolUses(modelMessages, cleared)
}
