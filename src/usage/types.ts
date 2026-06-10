/**
 * Token / cache / cost accounting types.
 *
 * Anthropic-style accounting, normalized by the AI SDK into
 * `LanguageModelUsage.inputTokenDetails`:
 *   - `noCacheTokens`    — input charged at the standard 1.0× rate
 *   - `cacheReadTokens`  — input served from prompt cache (0.1×)
 *   - `cacheWriteTokens` — input written to cache this call (1.25×)
 */

/** Flat usage for one generation, one turn, or a whole-conversation sum. */
export interface Usage {
  inputTokens: number
  noCacheTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  outputTokens: number
}

/**
 * The metadata `makeMessageMetadata` attaches to each assistant UIMessage.
 * Persist messages as-is (e.g. via `onFinish`) and this rides along — model,
 * usage, and cost survive reloads with no extra plumbing.
 */
export interface UsageMessageMetadata {
  /** Aggregate usage for the whole turn (all internal tool-loop steps). */
  usage?: Usage
  /** Prompt + completion size of the LAST step — the current context size. */
  contextTokens?: number
  /** Model id that produced the message. */
  model?: string
  /** Actual USD billed for the turn, summed from the AI Gateway's per-step
   * `providerMetadata.gateway.cost` (what was debited — not recomputed). */
  costUsd?: number
  /** Tool uses the server's context edits cleared during this turn. Apps
   * that persist FULL histories sum this (`totalClearedToolUses`) and
   * `dropOldestToolUses` on the rebuilt prefix so the next request matches
   * the server's rewritten cache. */
  clearedToolUses?: number
}

/** Conversation-level fold of per-message metadata. */
export interface SessionUsage {
  /** Sum across every assistant turn in the conversation. */
  total: Usage
  /** The most recent turn that reported usage, or null before the first. */
  lastTurn: Usage | null
  /** Current context size (latest turn's last-step prompt + completion). */
  contextTokens: number
  /** Total USD billed across the conversation (gateway-reported). */
  costUsd: number
}

export const EMPTY_USAGE: Usage = {
  inputTokens: 0,
  noCacheTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  outputTokens: 0,
}
