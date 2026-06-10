import { describe, expect, test } from "bun:test"

import type { ModelMessage } from "ai"

import { countBreakpoints } from "./breakpoints/count"
import { createContextManagement } from "./manager"
import { MemoryFullOutputStore } from "./truncation/store"
import { FETCH_FULL_RESULT_TOOL_NAME } from "./truncation/fetch-tool"

const HISTORY: ModelMessage[] = [
  { role: "user", content: "one" },
  { role: "assistant", content: "two" },
  { role: "user", content: "three" },
]

describe("createContextManagement — modes", () => {
  test("off: no-op prepareStep, untouched provider options, no tools", () => {
    const cm = createContextManagement({ mode: "off", model: "m" })
    expect(cm.prepareStep({ messages: HISTORY })).toBeUndefined()
    expect(cm.providerOptions({ anthropic: { effort: "medium" } })).toEqual({
      anthropic: { effort: "medium" },
    })
    expect(cm.tools).toEqual({})
    expect(cm.systemSuffix).toBe("")
  })

  test("auto: gateway caching only, no breakpoints", () => {
    const cm = createContextManagement({ mode: "auto", model: "m" })
    expect(cm.prepareStep({ messages: HISTORY })).toBeUndefined()
    expect(cm.providerOptions().gateway).toEqual({ caching: "auto" })
  })

  test("pinned (default): tags exactly the tail message", () => {
    const cm = createContextManagement({ model: "m" })
    expect(cm.mode).toBe("pinned")
    const out = cm.prepareStep({ messages: HISTORY })
    expect(out).toBeDefined()
    expect(countBreakpoints(out!.messages)).toBe(1)
    expect(cm.providerOptions().gateway).toEqual({ caching: "auto" })
    expect(cm.providerOptions().anthropic).toBeUndefined()
  })

  test("managed: trailing chain + edits + truncation tool + system suffix", () => {
    const store = new MemoryFullOutputStore()
    const cm = createContextManagement({
      mode: "managed",
      model: "m",
      contextWindow: 1_000_000,
      store,
    })

    const out = cm.prepareStep({ messages: HISTORY })
    expect(countBreakpoints(out!.messages)).toBe(2) // trailing depth

    const po = cm.providerOptions({ anthropic: { effort: "medium" } })
    expect(po.gateway).toEqual({ caching: "auto" })
    expect(po.anthropic?.effort).toBe("medium")
    expect(po.anthropic?.contextManagement).toMatchObject({
      edits: [
        { type: "clear_thinking_20251015" },
        {
          type: "clear_tool_uses_20250919",
          trigger: { type: "input_tokens", value: 180_000 },
        },
      ],
    })

    expect(Object.keys(cm.tools)).toEqual([FETCH_FULL_RESULT_TOOL_NAME])
    expect(cm.systemSuffix).toContain("fetch_full_result")
  })

  test("managed without a store skips truncation (no tool, no suffix)", () => {
    const cm = createContextManagement({ mode: "managed", model: "m" })
    expect(cm.tools).toEqual({})
    expect(cm.systemSuffix).toBe("")
  })

  test("caller's explicit gateway options win over the preset", () => {
    const cm = createContextManagement({ mode: "pinned", model: "m" })
    const po = cm.providerOptions({ gateway: { caching: "manual" } })
    expect(po.gateway).toEqual({ caching: "manual" })
  })
})

describe("trimHistory", () => {
  const clearMeta = {
    anthropic: {
      contextManagement: {
        appliedEdits: [
          { type: "clear_tool_uses_20250919", clearedToolUses: 1, clearedInputTokens: 1 },
        ],
      },
    },
  }

  const toolHistory: ModelMessage[] = [
    {
      role: "assistant",
      content: [{ type: "tool-call", toolCallId: "a", toolName: "t", input: {} }],
    },
    {
      role: "tool",
      content: [
        { type: "tool-result", toolCallId: "a", toolName: "t", output: { type: "text", value: "r" } },
      ],
    },
    { role: "assistant", content: "done" },
  ]

  test("managed mirrors server clears; other modes copy through", () => {
    const managed = createContextManagement({ mode: "managed", model: "m" })
    expect(managed.trimHistory(toolHistory, [clearMeta])).toEqual([
      { role: "assistant", content: "done" },
    ])

    const pinned = createContextManagement({ mode: "pinned", model: "m" })
    expect(pinned.trimHistory(toolHistory, [clearMeta])).toEqual(toolHistory)
  })
})

describe("messageMetadata passthrough", () => {
  test("attaches the model id on start", () => {
    const cm = createContextManagement({ model: "anthropic/claude-fable-5" })
    expect(cm.messageMetadata({ part: { type: "start" } })).toEqual({
      model: "anthropic/claude-fable-5",
    })
  })
})
