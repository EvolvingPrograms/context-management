/**
 * Drop the oldest `n` tool-use / tool-result pairs from a conversation
 * history. Used to mirror Anthropic's server-side
 * `clear_tool_uses_20250919` edit locally — so the outgoing prefix on
 * the NEXT turn matches what the server already cached, instead of
 * re-sending the verbose pre-edit history and forcing the cache to
 * write a new prefix.
 *
 * Implementation: walks the history left→right, identifies assistant
 * messages that contain a `tool-call` part, and pairs them with the
 * subsequent `tool` message holding the matching `tool-result`. Drops
 * the `n` oldest such pairs. Any plain-text content on those messages
 * is preserved by re-issuing a stripped assistant message with just
 * its text parts (so the model's narration around tool calls survives
 * the trim).
 */

import type { ModelMessage } from "ai"

/**
 * Returns a new history with the oldest `n` tool-use/result pairs
 * removed. If fewer than `n` pairs exist, removes as many as it can.
 */
export function dropOldestToolUses(
  history: readonly ModelMessage[],
  n: number,
): ModelMessage[] {
  if (n <= 0) {
    return [...history]
  }

  // Find indices of assistant messages containing tool-call parts.
  const toolCallIndices: number[] = []
  for (let i = 0; i < history.length; i++) {
    const m = history[i]!
    if (m.role !== "assistant") {
      continue
    }
    if (!Array.isArray(m.content)) {
      continue
    }
    if (m.content.some((p) => p.type === "tool-call")) {
      toolCallIndices.push(i)
    }
  }

  const toDrop = toolCallIndices.slice(0, n)
  if (toDrop.length === 0) {
    return [...history]
  }

  // For each assistant tool-call message, also drop the immediately
  // following `tool` message (the tool-result).
  const dropSet = new Set<number>(toDrop)
  for (const idx of toDrop) {
    const next = history[idx + 1]
    if (next && next.role === "tool") {
      dropSet.add(idx + 1)
    }
  }

  const out: ModelMessage[] = []
  for (let i = 0; i < history.length; i++) {
    if (dropSet.has(i)) {
      // If the assistant message also had a text part, preserve it
      // as a stripped assistant message (text only). Otherwise drop
      // the whole message.
      const m = history[i]!
      if (m.role === "assistant" && Array.isArray(m.content)) {
        const textOnly = m.content.filter((p) => p.type === "text")
        if (textOnly.length > 0) {
          out.push({ ...m, content: textOnly })
        }
      }
      continue
    }
    out.push(history[i]!)
  }
  return out
}
