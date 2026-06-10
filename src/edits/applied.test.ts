import { describe, expect, test } from "bun:test"

import {
  clearedToolUses,
  describeEdit,
  extractAppliedEdits,
  type AppliedEdit,
} from "./applied"

const CLEAR_TOOLS: AppliedEdit = {
  type: "clear_tool_uses_20250919",
  clearedToolUses: 3,
  clearedInputTokens: 4500,
}

const CLEAR_THINKING: AppliedEdit = {
  type: "clear_thinking_20251015",
  clearedThinkingTurns: 2,
  clearedInputTokens: 800,
}

describe("extractAppliedEdits", () => {
  test("reads the anthropic contextManagement block", () => {
    const meta = {
      anthropic: { contextManagement: { appliedEdits: [CLEAR_TOOLS] } },
    }
    expect(extractAppliedEdits(meta)).toEqual([CLEAR_TOOLS])
  })

  test("absent / malformed → []", () => {
    expect(extractAppliedEdits(undefined)).toEqual([])
    expect(extractAppliedEdits(null)).toEqual([])
    expect(extractAppliedEdits({})).toEqual([])
    expect(extractAppliedEdits({ anthropic: {} })).toEqual([])
    expect(extractAppliedEdits({ anthropic: null })).toEqual([])
  })
})

describe("clearedToolUses", () => {
  test("sums only clear_tool_uses edits", () => {
    expect(clearedToolUses([CLEAR_TOOLS, CLEAR_THINKING, CLEAR_TOOLS])).toBe(6)
    expect(clearedToolUses([CLEAR_THINKING])).toBe(0)
    expect(clearedToolUses([])).toBe(0)
  })
})

describe("describeEdit", () => {
  test("one-liners per edit type", () => {
    expect(describeEdit(CLEAR_TOOLS)).toBe(
      "cleared 3 tool use(s); freed 4500 tokens",
    )
    expect(describeEdit(CLEAR_THINKING)).toBe(
      "cleared 2 thinking turn(s); freed 800 tokens",
    )
  })
})
