import { describe, expect, test } from "bun:test"
import type { ModelMessage } from "ai"

import { withEphemeralCacheControl } from "./ephemeral"
import { pinTailBreakpoint } from "./pin-tail"
import { countBreakpoints, makeCountingPrepareStep } from "./count"

describe("countBreakpoints", () => {
  test("returns 0 for an empty messages array", () => {
    expect(countBreakpoints([])).toBe(0)
  })

  test("counts a marker placed on a message itself (system style)", () => {
    const msgs: ModelMessage[] = [
      withEphemeralCacheControl({ role: "system", content: "..." }),
    ]

    expect(countBreakpoints(msgs)).toBe(1)
  })

  test("counts a marker placed on a content part", () => {
    const msgs: ModelMessage[] = [
      withEphemeralCacheControl({ role: "user", content: "hi" }),
    ]

    expect(countBreakpoints(msgs)).toBe(1)
  })

  test("counts one marker per tagged part, not per message", () => {
    const msgs: ModelMessage[] = [
      withEphemeralCacheControl({
        role: "user",
        content: [
          { type: "text", text: "a" },
          { type: "text", text: "b" },
        ],
      }),
      withEphemeralCacheControl({
        role: "assistant",
        content: [{ type: "text", text: "c" }],
      }),
    ]

    // Each message has cache_control on its LAST part only → 2 markers.
    expect(countBreakpoints(msgs)).toBe(2)
  })

  test("systemHasEphemeral=true adds 1 even when messages have none", () => {
    expect(countBreakpoints([], true)).toBe(1)
  })

  test("ignores messages with no cache_control anywhere", () => {
    const msgs: ModelMessage[] = [
      { role: "user", content: "untagged" },
      { role: "assistant", content: [{ type: "text", text: "also untagged" }] },
    ]

    expect(countBreakpoints(msgs)).toBe(0)
  })
})

describe("makeCountingPrepareStep", () => {
  test("with no inner: counts only markers in the incoming messages", () => {
    const { prepareStep, lastCount } = makeCountingPrepareStep({
      systemHasEphemeral: true,
    })

    const messages: ModelMessage[] = [
      withEphemeralCacheControl({ role: "user", content: "hi" }),
    ]

    const result = prepareStep({ messages })

    // No inner hook → returns undefined; messages pass through.
    expect(result).toBeUndefined()
    // system (1) + tagged user (1) = 2
    expect(lastCount()).toBe(2)
  })

  test("with inner=pinTailBreakpoint: counts the marker the inner placed", () => {
    const { prepareStep, lastCount } = makeCountingPrepareStep({
      inner: pinTailBreakpoint,
      systemHasEphemeral: false,
    })

    const messages: ModelMessage[] = [
      { role: "user", content: "hi" },
    ]

    const result = prepareStep({ messages })

    // Inner returns transformed messages with the tail tagged.
    expect(result).toBeDefined()
    expect(lastCount()).toBe(1)
  })

  test("lastCount reflects the MOST RECENT call (not accumulated)", () => {
    const { prepareStep, lastCount } = makeCountingPrepareStep({
      inner: pinTailBreakpoint,
      systemHasEphemeral: false,
    })

    prepareStep({ messages: [{ role: "user", content: "a" }] })
    expect(lastCount()).toBe(1)

    prepareStep({ messages: [] })
    // Empty messages → inner returns undefined → no markers anywhere.
    expect(lastCount()).toBe(0)
  })
})
