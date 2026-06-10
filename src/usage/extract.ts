/**
 * Extraction from AI SDK / AI Gateway responses. The trust boundary for
 * untyped provider data lives here — small named helpers, no scattered casts.
 */

import type { LanguageModelUsage } from "ai"

import { EMPTY_USAGE, type Usage } from "./types"

/** Flatten an AI SDK usage object (fields are `number | undefined`). */
export function usageFromTotals(usage: LanguageModelUsage | undefined): Usage {
  if (!usage) {
    return EMPTY_USAGE
  }
  return {
    inputTokens: usage.inputTokens ?? 0,
    noCacheTokens: usage.inputTokenDetails?.noCacheTokens ?? 0,
    cacheReadTokens: usage.inputTokenDetails?.cacheReadTokens ?? 0,
    cacheWriteTokens: usage.inputTokenDetails?.cacheWriteTokens ?? 0,
    outputTokens: usage.outputTokens ?? 0,
  }
}

/**
 * The actual billed USD for one generation, read from the AI Gateway's
 * response metadata (`providerMetadata.gateway.cost`, a decimal string).
 * Returns 0 when absent (non-gateway providers, older responses).
 */
export function gatewayCost(providerMetadata: unknown): number {
  const gateway = (providerMetadata as { gateway?: { cost?: unknown } } | null)
    ?.gateway
  const cost = Number(gateway?.cost ?? 0)
  return Number.isFinite(cost) ? cost : 0
}
