import { describe, expect, test } from "bun:test"
import type { ModelMessage } from "ai"

import { pinTailBreakpoint } from "./pin-tail"

describe("pinTailBreakpoint", () => {
  test("returns undefined for empty messages (passes through to outer settings)", () => {
    expect(pinTailBreakpoint({ messages: [] })).toBeUndefined()
  })

  test("tags only the last message — earlier messages untouched", () => {
    const msgs: ModelMessage[] = [
      { role: "user", content: "first" },
      { role: "assistant", content: [{ type: "text", text: "ack" }] },
      { role: "user", content: "second" },
    ]

    const out = pinTailBreakpoint({ messages: msgs })
    if (!out) {
      throw new Error("expected messages back")
    }

    expect(out.messages).toHaveLength(3)

    // First two messages identical to inputs (no breakpoint).
    expect(out.messages[0]).toEqual(msgs[0]!)
    expect(out.messages[1]).toEqual(msgs[1]!)

    // Last message has cache_control: ephemeral on its tail part.
    const last = out.messages[2]!
    if (last.role !== "user") {
      throw new Error("role drift")
    }

    const parts = last.content as Array<{
      providerOptions?: { anthropic?: { cacheControl?: unknown } }
    }>

    expect(parts[0]?.providerOptions?.anthropic?.cacheControl).toEqual({
      type: "ephemeral",
    })
  })

  test("does not mutate the input messages array", () => {
    const msgs: ModelMessage[] = [
      { role: "user", content: [{ type: "text", text: "hi" }] },
    ]

    const snapshot = JSON.parse(JSON.stringify(msgs))
    pinTailBreakpoint({ messages: msgs })
    expect(msgs).toEqual(snapshot)
  })
})
