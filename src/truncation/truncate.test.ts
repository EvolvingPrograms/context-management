import { describe, expect, test } from "bun:test"

import type { ModelMessage } from "ai"

import { isTruncationStub, truncateToolResults, truncationStub } from "./truncate"
import { toolOutputText } from "./serialize"

const result = (id: string, value: string): ModelMessage => ({
  role: "tool",
  content: [
    { type: "tool-result", toolCallId: id, toolName: "search", output: { type: "text", value } },
  ],
})

const BIG = "x".repeat(5000)

const firstOutput = (m: ModelMessage): string => {
  if (m.role !== "tool") throw new Error("not a tool message")
  const part = m.content[0]
  if (part?.type !== "tool-result") throw new Error("not a tool result")
  return toolOutputText(part.output)
}

describe("truncateToolResults", () => {
  test("keeps the newest keepLast verbatim, stubs older large bodies", () => {
    const history = [
      result("a", BIG),
      result("b", BIG),
      result("c", BIG),
    ]
    const out = truncateToolResults(history, { keepLast: 2, maxChars: 1000, preview: 10 })

    expect(firstOutput(out[0]!)).toBe(
      truncationStub("a", 5000, BIG.slice(0, 10)),
    )
    expect(firstOutput(out[1]!)).toBe(BIG)
    expect(firstOutput(out[2]!)).toBe(BIG)
  })

  test("small old results stay verbatim", () => {
    const out = truncateToolResults([result("a", "tiny"), result("b", BIG)], {
      keepLast: 1,
      maxChars: 1000,
    })
    expect(firstOutput(out[0]!)).toBe("tiny")
  })

  test("idempotent — already-stubbed bodies are not re-stubbed", () => {
    const history = [result("a", BIG), result("b", BIG), result("c", BIG)]
    const once = truncateToolResults(history, { keepLast: 1, maxChars: 100, preview: 10 })
    const twice = truncateToolResults(once, { keepLast: 1, maxChars: 100, preview: 10 })
    expect(twice).toEqual(once)
  })

  test("never mutates the input; non-tool messages pass through", () => {
    const user: ModelMessage = { role: "user", content: "q" }
    const history = [user, result("a", BIG), result("b", BIG)]
    const out = truncateToolResults(history, { keepLast: 1, maxChars: 100 })
    expect(out[0]).toBe(user)
    expect(firstOutput(history[1]!)).toBe(BIG) // input untouched
  })
})

describe("isTruncationStub", () => {
  test("recognizes stubs, rejects ordinary text", () => {
    expect(isTruncationStub(truncationStub("id-1", 999, "head"))).toBe(true)
    expect(isTruncationStub("regular output")).toBe(false)
  })
})
