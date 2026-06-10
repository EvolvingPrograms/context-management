import { describe, expect, test } from "bun:test"

import { sdkUsage } from "./extract.test"
import { makeMessageMetadata } from "./metadata"

describe("makeMessageMetadata", () => {
  test("start → model id", () => {
    const cb = makeMessageMetadata({ model: "anthropic/claude-fable-5" })
    expect(cb({ part: { type: "start" } })).toEqual({
      model: "anthropic/claude-fable-5",
    })
  })

  test("finish-step → running cost + last-step context size", () => {
    const cb = makeMessageMetadata({ model: "m" })

    const step1 = cb({
      part: {
        type: "finish-step",
        usage: sdkUsage({ inputTokens: 1000, outputTokens: 200 }),
        providerMetadata: { gateway: { cost: "0.10" } },
      },
    })
    expect(step1).toEqual({ costUsd: 0.1, contextTokens: 1200 })

    // Cost accumulates; contextTokens reflects ONLY the latest step.
    const step2 = cb({
      part: {
        type: "finish-step",
        usage: sdkUsage({ inputTokens: 1500, outputTokens: 100 }),
        providerMetadata: { gateway: { cost: "0.05" } },
      },
    })
    expect(step2?.costUsd).toBeCloseTo(0.15)
    expect(step2?.contextTokens).toBe(1600)
  })

  test("finish-step with server clears records the turn's clearedToolUses", () => {
    const cb = makeMessageMetadata({ model: "m" })
    const meta = cb({
      part: {
        type: "finish-step",
        usage: sdkUsage(),
        providerMetadata: {
          gateway: { cost: "0.1" },
          anthropic: {
            contextManagement: {
              appliedEdits: [
                {
                  type: "clear_tool_uses_20250919",
                  clearedToolUses: 3,
                  clearedInputTokens: 4500,
                },
              ],
            },
          },
        },
      },
    })
    expect(meta?.clearedToolUses).toBe(3)
    // No clears → field omitted entirely (keeps persisted metadata lean).
    const quiet = makeMessageMetadata({ model: "m" })({
      part: { type: "finish-step", usage: sdkUsage() },
    })
    expect(quiet?.clearedToolUses).toBeUndefined()
  })

  test("finish → aggregate usage; other parts → undefined", () => {
    const cb = makeMessageMetadata({ model: "m" })
    const finish = cb({ part: { type: "finish", totalUsage: sdkUsage() } })
    expect(finish?.usage?.inputTokens).toBe(1000)
    expect(cb({ part: { type: "text-delta" } })).toBeUndefined()
  })

  test("each factory call is an independent cost accumulator", () => {
    const a = makeMessageMetadata({ model: "m" })
    const b = makeMessageMetadata({ model: "m" })
    a({
      part: {
        type: "finish-step",
        usage: sdkUsage(),
        providerMetadata: { gateway: { cost: "1" } },
      },
    })
    const fresh = b({
      part: {
        type: "finish-step",
        usage: sdkUsage(),
        providerMetadata: { gateway: { cost: "0.25" } },
      },
    })
    expect(fresh?.costUsd).toBe(0.25)
  })
})
