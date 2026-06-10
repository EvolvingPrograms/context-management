import { describe, expect, test } from "bun:test"

import type { UIMessage } from "ai"

import {
  addUsage,
  cachedShare,
  sessionUsage,
  totalClearedToolUses,
} from "./aggregate"
import { usageFromTotals } from "./extract"
import { sdkUsage } from "./extract.test"
import { EMPTY_USAGE, type UsageMessageMetadata } from "./types"

const msg = (
  metadata?: UsageMessageMetadata,
): UIMessage<UsageMessageMetadata> =>
  ({ id: "m", role: "assistant", parts: [], metadata }) as UIMessage<
    UsageMessageMetadata
  >

describe("addUsage", () => {
  test("sums fieldwise; EMPTY is identity", () => {
    const a = usageFromTotals(sdkUsage())
    expect(addUsage(a, a).inputTokens).toBe(2000)
    expect(addUsage(a, EMPTY_USAGE)).toEqual(a)
  })
})

describe("cachedShare", () => {
  test("(read + write) / input; 0 on empty", () => {
    expect(cachedShare(usageFromTotals(sdkUsage()))).toBeCloseTo(0.9)
    expect(cachedShare(EMPTY_USAGE)).toBe(0)
  })

  test("a first turn that writes its whole prompt is ~100% cached, not 0%", () => {
    const firstTurn = usageFromTotals(
      sdkUsage({
        inputTokens: 9800,
        inputTokenDetails: {
          noCacheTokens: 2,
          cacheReadTokens: 0,
          cacheWriteTokens: 9798,
        },
      }),
    )
    expect(cachedShare(firstTurn)).toBeCloseTo(1, 3)
  })
})

describe("sessionUsage", () => {
  test("folds usage + cost, keeps the LAST turn + contextTokens", () => {
    const last = usageFromTotals(sdkUsage({ inputTokens: 500 }))
    const s = sessionUsage([
      msg(), // user / pre-feature message: no metadata
      msg({ usage: usageFromTotals(sdkUsage()), contextTokens: 1200, costUsd: 0.5 }),
      msg({ usage: last, contextTokens: 2400, costUsd: 0.25 }),
    ])
    expect(s.total.inputTokens).toBe(1500)
    expect(s.lastTurn).toEqual(last)
    expect(s.contextTokens).toBe(2400)
    expect(s.costUsd).toBeCloseTo(0.75)
  })

  test("totalClearedToolUses sums per-turn clears", () => {
    expect(
      totalClearedToolUses([
        msg(),
        msg({ clearedToolUses: 2 }),
        msg({ clearedToolUses: 3 }),
      ]),
    ).toBe(5)
    expect(totalClearedToolUses([msg()])).toBe(0)
  })

  test("empty conversation → zeroes", () => {
    expect(sessionUsage([])).toEqual({
      total: EMPTY_USAGE,
      lastTurn: null,
      contextTokens: 0,
      costUsd: 0,
    })
  })
})
