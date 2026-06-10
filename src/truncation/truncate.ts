/**
 * Client-side tool-result truncation: replace the BODIES of old, large
 * tool results in the outgoing prefix with short id-stamped stubs, so a
 * long conversation stops re-sending (and re-caching) bulky output the
 * model rarely needs again. The stub names the `toolCallId`, so the
 * model can recover the full body on demand via the `fetch_full_result`
 * tool (see `./fetch-tool.ts`).
 *
 * Deterministic and pure: the same history + options always produce the
 * same output, so the truncated prefix stays byte-stable across steps
 * and turns — a result crossing the keep-window boundary changes the
 * prefix exactly once (one cache invalidation, like a server-side edit).
 */

import type { ModelMessage } from "ai"

import { toolOutputText } from "./serialize"

/** Thresholds for `truncateToolResults`. */
export interface TruncateOptions {
  /** Newest tool results always kept verbatim. Default: 4. */
  keepLast?: number
  /** Older results with bodies LARGER than this many chars are truncated.
   * Default: 1000. */
  maxChars?: number
  /** Chars of head preview retained inside the stub. Default: 200. */
  preview?: number
}

/** The stub text a truncated tool-result body is replaced with. */
export function truncationStub(
  id: string,
  totalChars: number,
  preview: string,
): string {
  return (
    `${preview}\n` +
    `[…truncated ${totalChars} chars — call fetch_full_result with id "${id}" for the full output]`
  )
}

/** True when the part's body was produced by `truncationStub`. */
export function isTruncationStub(text: string): boolean {
  return /\[…truncated \d+ chars — call fetch_full_result with id "[^"]+" for the full output\]$/.test(
    text,
  )
}

/**
 * Return a new history with old, large tool-result bodies replaced by
 * stubs. Never mutates the input.
 */
export function truncateToolResults(
  history: readonly ModelMessage[],
  options: TruncateOptions = {},
): ModelMessage[] {
  const keepLast = options.keepLast ?? 4
  const maxChars = options.maxChars ?? 1000
  const preview = options.preview ?? 200

  // Count tool results so the newest `keepLast` stay verbatim.
  let totalResults = 0
  for (const message of history) {
    if (message.role === "tool") {
      totalResults += message.content.filter(
        (p) => p.type === "tool-result",
      ).length
    }
  }
  const cutoff = totalResults - keepLast

  let seen = 0
  return history.map((message) => {
    if (message.role !== "tool") {
      return message
    }
    let changed = false
    const content = message.content.map((part) => {
      if (part.type !== "tool-result") {
        return part
      }
      const index = seen++
      if (index >= cutoff) {
        return part
      }
      const text = toolOutputText(part.output)
      if (text.length <= maxChars || isTruncationStub(text)) {
        return part
      }
      changed = true
      return {
        ...part,
        output: {
          type: "text" as const,
          value: truncationStub(
            part.toolCallId,
            text.length,
            text.slice(0, preview),
          ),
        },
      }
    })
    return changed ? { ...message, content } : message
  })
}
