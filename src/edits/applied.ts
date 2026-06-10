/**
 * Decode the context-editing operations Anthropic applied to a request,
 * from a step's `providerMetadata`. The Anthropic provider publishes the
 * strongly-typed shape under `AnthropicMessageMetadata`; the single cast
 * lives in `readAnthropicMetadata` so call sites stay clean.
 */

import type { AnthropicMessageMetadata } from "@ai-sdk/anthropic"

/** One context-editing operation Anthropic applied to a request (the
 * provider's strongly-typed `appliedEdits` record). */
export type AppliedEdit = NonNullable<
  AnthropicMessageMetadata["contextManagement"]
>["appliedEdits"][number]

/** The applied-edit records on one step's providerMetadata (often empty). */
export function extractAppliedEdits(providerMetadata: unknown): AppliedEdit[] {
  const meta = readAnthropicMetadata(providerMetadata)
  return meta?.contextManagement?.appliedEdits ?? []
}

/** Total tool uses the server cleared across a set of edits. */
export function clearedToolUses(edits: readonly AppliedEdit[]): number {
  let total = 0
  for (const edit of edits) {
    if (edit.type === "clear_tool_uses_20250919") {
      total += edit.clearedToolUses
    }
  }
  return total
}

/** One-line human description of an edit (for logs / UI). */
export function describeEdit(edit: AppliedEdit): string {
  switch (edit.type) {
    case "clear_tool_uses_20250919":
      return `cleared ${edit.clearedToolUses} tool use(s); freed ${edit.clearedInputTokens} tokens`
    case "clear_thinking_20251015":
      return `cleared ${edit.clearedThinkingTurns} thinking turn(s); freed ${edit.clearedInputTokens} tokens`
    case "compact_20260112":
      return "compaction applied"
    default: {
      // Future edit types in @ai-sdk/anthropic surface here at compile time.
      const unknown: { type: string } = edit
      return `edit applied: ${unknown.type}`
    }
  }
}

/**
 * Read the `anthropic` block of a step's `providerMetadata`, typed as
 * `AnthropicMessageMetadata`. The SDK stores `providerMetadata` as
 * `Record<string, Record<string, JSONValue>>`, so the trust boundary is
 * here — one well-named cast where untyped provider data becomes typed.
 */
function readAnthropicMetadata(
  providerMetadata: unknown,
): AnthropicMessageMetadata | undefined {
  if (providerMetadata === null || typeof providerMetadata !== "object") {
    return undefined
  }
  if (!("anthropic" in providerMetadata)) {
    return undefined
  }
  const { anthropic } = providerMetadata
  if (anthropic === null || typeof anthropic !== "object") {
    return undefined
  }
  return anthropic as AnthropicMessageMetadata
}
