/**
 * Tag the last `n` messages of a history with ephemeral `cache_control` —
 * the rolling "breakpoint chain". Combined with one marker on the system
 * prompt and the per-step tail pin, this spends Anthropic's 4-breakpoint
 * budget deliberately:
 *
 *     system (1) + trailing history (n) ≤ 4    (tail pin tags the last
 *     message, which trailing already covers — they compose idempotently)
 *
 * Keeping a marker on the last FEW messages (not just the tail) means the
 * previous turn's breakpoint is still in place when the next request
 * arrives, so the new request's prefix ends at a marker the server
 * already cached.
 */

import type { ModelMessage } from "ai"

import { withEphemeralCacheControl } from "./ephemeral"

/** Tag the last `n` messages with ephemeral `cache_control` — the rolling
 * breakpoint chain (see module doc for the 4-marker budget math). */
export function tagTrailing(
  messages: readonly ModelMessage[],
  n: number,
): ModelMessage[] {
  if (n <= 0) {
    return [...messages]
  }
  const start = Math.max(0, messages.length - n)
  return messages.map((m, i) => (i >= start ? withEphemeralCacheControl(m) : m))
}
