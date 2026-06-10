import { describe, expect, test } from "bun:test"

import type { ModelMessage } from "ai"

import {
  MemoryFullOutputStore,
  collectToolOutputs,
  historyOutputStore,
} from "./store"

const HISTORY: ModelMessage[] = [
  { role: "user", content: "q" },
  {
    role: "tool",
    content: [
      {
        type: "tool-result",
        toolCallId: "a",
        toolName: "search",
        output: { type: "text", value: "full text output" },
      },
      {
        type: "tool-result",
        toolCallId: "b",
        toolName: "lookup",
        output: { type: "json", value: { hits: 3 } },
      },
    ],
  },
]

describe("collectToolOutputs / historyOutputStore", () => {
  test("indexes every tool result by toolCallId, serialized to text", () => {
    const outputs = collectToolOutputs(HISTORY)
    expect(outputs.get("a")).toBe("full text output")
    expect(outputs.get("b")).toBe('{"hits":3}')
  })

  test("store returns null for unknown ids", () => {
    const store = historyOutputStore(HISTORY)
    expect(store.get("a")).toBe("full text output")
    expect(store.get("nope")).toBeNull()
  })
})

describe("MemoryFullOutputStore", () => {
  test("set/get round-trip; miss → null", () => {
    const store = new MemoryFullOutputStore()
    store.set("x", "body")
    expect(store.get("x")).toBe("body")
    expect(store.get("y")).toBeNull()
  })
})
