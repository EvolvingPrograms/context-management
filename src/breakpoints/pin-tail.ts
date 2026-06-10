/**
 * `prepareStep` callback for the AI SDK that pins an ephemeral
 * `cache_control` breakpoint on the LAST message before every
 * internal tool-loop generation. This caches the within-turn tool
 * tail step-by-step: each step's new asst/tool-result pair gets a
 * cache write at the end of step N, then step N+1's request reads
 * it before generating the next.
 *
 * Without this, the gateway's auto-breakpoint only places one
 * marker at the end of static content per request, so each
 * subsequent step's freshly-added tool tail stays uncached and is
 * charged at the full 1.0× rate.
 */

import type { ModelMessage } from "ai"

import { withEphemeralCacheControl } from "./ephemeral"

/**
 * Pass directly to a `ToolLoopAgent` constructor:
 *
 *     new ToolLoopAgent({
 *       model: ...,
 *       prepareStep: pinTailBreakpoint,
 *       ...
 *     })
 */
export function pinTailBreakpoint(args: {
  messages: ModelMessage[]
}): { messages: ModelMessage[] } | undefined {
  const { messages } = args
  if (messages.length === 0) {
    return undefined
  }
  const lastIdx = messages.length - 1
  const tagged = messages.slice()
  tagged[lastIdx] = withEphemeralCacheControl(tagged[lastIdx]!)
  return { messages: tagged }
}
