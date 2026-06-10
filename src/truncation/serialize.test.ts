import { describe, expect, test } from "bun:test"

import { toolOutputText } from "./serialize"

describe("toolOutputText", () => {
  test("text + error-text pass through", () => {
    expect(toolOutputText({ type: "text", value: "plain" })).toBe("plain")
    expect(toolOutputText({ type: "error-text", value: "boom" })).toBe("boom")
  })

  test("json + error-json stringify", () => {
    expect(toolOutputText({ type: "json", value: { a: 1 } })).toBe('{"a":1}')
    expect(toolOutputText({ type: "error-json", value: { err: true } })).toBe(
      '{"err":true}',
    )
  })

  test("execution-denied uses the reason, with a fallback", () => {
    expect(toolOutputText({ type: "execution-denied", reason: "nope" })).toBe("nope")
    expect(toolOutputText({ type: "execution-denied" })).toBe("(execution denied)")
  })

  test("content arrays join text items and label non-text ones", () => {
    expect(
      toolOutputText({
        type: "content",
        value: [
          { type: "text", text: "first" },
          { type: "media", data: "AAAA", mediaType: "image/png" },
          { type: "text", text: "last" },
        ],
      }),
    ).toBe("first\n[media]\nlast")
  })
})
