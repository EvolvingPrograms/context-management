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

import type { ModelMessage } from "ai"

import { clearedToolUses, extractAppliedEdits } from "./applied"
import { dropOldestToolUses } from "./trim"

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
