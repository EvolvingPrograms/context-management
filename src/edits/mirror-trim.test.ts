import { describe, expect, test } from "bun:test"

import type { ModelMessage } from "ai"

import { mirrorTrim } from "./mirror-trim"

const toolTurn = (id: string): ModelMessage[] => [
  {
    role: "assistant",
    content: [
      { type: "tool-call", toolCallId: id, toolName: "search", input: {} },
    ],
  },
  {
    role: "tool",
    content: [
      { type: "tool-result", toolCallId: id, toolName: "search", output: { type: "text", value: "r" } },
    ],
  },
]

const HISTORY: ModelMessage[] = [
  { role: "user", content: "q" },
  ...toolTurn("a"),
  ...toolTurn("b"),
  { role: "assistant", content: "done" },
]

const clearMeta = (n: number) => ({
  anthropic: {
    contextManagement: {
      appliedEdits: [
        { type: "clear_tool_uses_20250919", clearedToolUses: n, clearedInputTokens: 1 },
      ],
    },
  },
})

describe("mirrorTrim", () => {
  test("no edits → copy of the history", () => {
    const out = mirrorTrim(HISTORY, [undefined, {}])
    expect(out).toEqual(HISTORY)
    expect(out).not.toBe(HISTORY)
  })

  test("drops as many oldest tool pairs as the server cleared", () => {
    const out = mirrorTrim(HISTORY, [clearMeta(1)])
    expect(out).toEqual([
      { role: "user", content: "q" },
      ...toolTurn("b"),
      { role: "assistant", content: "done" },
    ])
  })

  test("sums clears across steps", () => {
    const out = mirrorTrim(HISTORY, [clearMeta(1), clearMeta(1)])
    expect(out).toEqual([
      { role: "user", content: "q" },
      { role: "assistant", content: "done" },
    ])
  })
})
