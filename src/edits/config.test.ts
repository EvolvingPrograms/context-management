import { describe, expect, test } from "bun:test"

import { contextEdits } from "./config"

describe("contextEdits", () => {
  test("defaults scale from the context window (1M → 180k trigger, 60k clear)", () => {
    const cfg = contextEdits({ contextWindow: 1_000_000 })
    expect(cfg.edits).toEqual([
      {
        type: "clear_thinking_20251015",
        keep: { type: "thinking_turns", value: 20 },
      },
      {
        type: "clear_tool_uses_20250919",
        trigger: { type: "input_tokens", value: 180_000 },
        keep: { type: "tool_uses", value: 20 },
        clearAtLeast: { type: "input_tokens", value: 60_000 },
        clearToolInputs: false,
      },
    ])
  })

  test("200k window → 36k trigger, 12k clear", () => {
    const cfg = contextEdits({ contextWindow: 200_000 })
    const clearToolUses = cfg.edits?.[1]
    expect(clearToolUses).toMatchObject({
      trigger: { type: "input_tokens", value: 36_000 },
      clearAtLeast: { type: "input_tokens", value: 12_000 },
    })
  })

  test("explicit overrides win", () => {
    const cfg = contextEdits({
      contextWindow: 200_000,
      trigger: 50_000,
      clearAtLeast: 25_000,
      keepToolUses: 10,
      keepThinkingTurns: 5,
    })
    expect(cfg.edits).toMatchObject([
      { keep: { type: "thinking_turns", value: 5 } },
      {
        trigger: { type: "input_tokens", value: 50_000 },
        keep: { type: "tool_uses", value: 10 },
        clearAtLeast: { type: "input_tokens", value: 25_000 },
      },
    ])
  })
})
