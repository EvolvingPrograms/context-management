import { describe, expect, test } from "bun:test"

import type { LanguageModelUsage } from "ai"

import { gatewayCost, usageFromTotals } from "./extract"
import { EMPTY_USAGE } from "./types"

export const sdkUsage = (
  over: Partial<LanguageModelUsage> = {},
): LanguageModelUsage =>
  ({
    inputTokens: 1000,
    inputTokenDetails: {
      noCacheTokens: 100,
      cacheReadTokens: 850,
      cacheWriteTokens: 50,
    },
    outputTokens: 200,
    outputTokenDetails: { textTokens: 150, reasoningTokens: 50 },
    totalTokens: 1200,
    ...over,
  }) as LanguageModelUsage

describe("usageFromTotals", () => {
  test("flattens the SDK shape", () => {
    expect(usageFromTotals(sdkUsage())).toEqual({
      inputTokens: 1000,
      noCacheTokens: 100,
      cacheReadTokens: 850,
      cacheWriteTokens: 50,
      outputTokens: 200,
    })
  })

  test("undefined usage / fields coerce to 0", () => {
    expect(usageFromTotals(undefined)).toEqual(EMPTY_USAGE)
    const u = usageFromTotals(
      sdkUsage({
        inputTokens: undefined,
        outputTokens: undefined,
        inputTokenDetails: {
          noCacheTokens: undefined,
          cacheReadTokens: undefined,
          cacheWriteTokens: undefined,
        },
      }),
    )
    expect(u).toEqual(EMPTY_USAGE)
  })
})

describe("gatewayCost", () => {
  test("reads the decimal-string cost from gateway metadata", () => {
    expect(gatewayCost({ gateway: { cost: "0.0123" } })).toBeCloseTo(0.0123)
    expect(gatewayCost({ gateway: { cost: 0.5 } })).toBe(0.5)
  })

  test("absent / malformed → 0", () => {
    expect(gatewayCost(undefined)).toBe(0)
    expect(gatewayCost(null)).toBe(0)
    expect(gatewayCost({})).toBe(0)
    expect(gatewayCost({ gateway: {} })).toBe(0)
    expect(gatewayCost({ gateway: { cost: "not-a-number" } })).toBe(0)
  })
})
