import { describe, expect, test } from "bun:test"

import type { ModelMessage } from "ai"

import { countBreakpoints } from "./count"
import { tagTrailing } from "./trailing"

const HISTORY: ModelMessage[] = [
  { role: "user", content: "one" },
  { role: "assistant", content: "two" },
  { role: "user", content: "three" },
]

describe("tagTrailing", () => {
  test("tags exactly the last n messages", () => {
    const out = tagTrailing(HISTORY, 2)
    expect(countBreakpoints(out)).toBe(2)
    expect(out[0]).toBe(HISTORY[0]) // untouched head shares identity
  })

  test("n ≥ length tags everything; n ≤ 0 tags nothing", () => {
    expect(countBreakpoints(tagTrailing(HISTORY, 99))).toBe(3)
    expect(countBreakpoints(tagTrailing(HISTORY, 0))).toBe(0)
  })

  test("never mutates the input", () => {
    tagTrailing(HISTORY, 3)
    expect(countBreakpoints(HISTORY)).toBe(0)
  })
})
