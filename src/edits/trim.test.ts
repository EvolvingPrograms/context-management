import { describe, expect, test } from "bun:test"
import type { ModelMessage } from "ai"
import { dropOldestToolUses } from "./trim"

function userMsg(text: string): ModelMessage {
  return { role: "user", content: text }
}

function assistantText(text: string): ModelMessage {
  return { role: "assistant", content: [{ type: "text", text }] }
}

function assistantToolCall(callId: string, name: string): ModelMessage {
  return {
    role: "assistant",
    content: [
      {
        type: "tool-call",
        toolCallId: callId,
        toolName: name,
        input: {},
      },
    ],
  }
}

function assistantTextAndToolCall(
  text: string,
  callId: string,
  name: string,
): ModelMessage {
  return {
    role: "assistant",
    content: [
      { type: "text", text },
      {
        type: "tool-call",
        toolCallId: callId,
        toolName: name,
        input: {},
      },
    ],
  }
}

function toolResult(callId: string, name: string): ModelMessage {
  return {
    role: "tool",
    content: [
      {
        type: "tool-result",
        toolCallId: callId,
        toolName: name,
        output: { type: "json", value: { ok: true } },
      },
    ],
  }
}

describe("dropOldestToolUses", () => {
  test("n=0 returns a copy unchanged", () => {
    const h: ModelMessage[] = [userMsg("hi"), assistantText("hello")]
    const out = dropOldestToolUses(h, 0)
    expect(out).toEqual(h)
    expect(out).not.toBe(h)
  })

  test("drops the oldest tool-call assistant message + its tool-result", () => {
    const h: ModelMessage[] = [
      userMsg("research X"),
      assistantToolCall("c1", "search"),
      toolResult("c1", "search"),
      assistantText("found it"),
    ]
    const out = dropOldestToolUses(h, 1)
    expect(out).toHaveLength(2)
    expect(out[0]).toEqual(userMsg("research X"))
    expect(out[1]).toEqual(assistantText("found it"))
  })

  test("drops multiple oldest pairs but keeps newer ones intact", () => {
    const h: ModelMessage[] = [
      userMsg("u1"),
      assistantToolCall("c1", "search"),
      toolResult("c1", "search"),
      assistantToolCall("c2", "fetch"),
      toolResult("c2", "fetch"),
      assistantToolCall("c3", "fetch"),
      toolResult("c3", "fetch"),
      assistantText("done"),
    ]
    const out = dropOldestToolUses(h, 2)
    expect(out).toEqual([
      userMsg("u1"),
      assistantToolCall("c3", "fetch"),
      toolResult("c3", "fetch"),
      assistantText("done"),
    ])
  })

  test("preserves text narration when an assistant message had text + tool-call", () => {
    const h: ModelMessage[] = [
      userMsg("research"),
      assistantTextAndToolCall("Let me search.", "c1", "search"),
      toolResult("c1", "search"),
      assistantText("found it"),
    ]
    const out = dropOldestToolUses(h, 1)
    // The tool-call is dropped along with its tool result, but the
    // surrounding text part survives as a stripped assistant message.
    expect(out).toEqual([
      userMsg("research"),
      { role: "assistant", content: [{ type: "text", text: "Let me search." }] },
      assistantText("found it"),
    ])
  })

  test("n larger than available tool-uses drops what's there", () => {
    const h: ModelMessage[] = [
      userMsg("u"),
      assistantToolCall("c1", "search"),
      toolResult("c1", "search"),
      assistantText("done"),
    ]
    const out = dropOldestToolUses(h, 5)
    expect(out).toEqual([userMsg("u"), assistantText("done")])
  })

  test("history with no tool calls is returned unchanged", () => {
    const h: ModelMessage[] = [userMsg("hi"), assistantText("hello")]
    const out = dropOldestToolUses(h, 3)
    expect(out).toEqual(h)
  })

  test("does not drop more than n even if more pairs exist", () => {
    const h: ModelMessage[] = [
      assistantToolCall("c1", "x"),
      toolResult("c1", "x"),
      assistantToolCall("c2", "x"),
      toolResult("c2", "x"),
      assistantToolCall("c3", "x"),
      toolResult("c3", "x"),
    ]
    const out = dropOldestToolUses(h, 1)
    expect(out).toHaveLength(4)
    // c2 and c3 should remain.
    const callIds = out
      .filter((m) => m.role === "assistant")
      .flatMap((m) =>
        Array.isArray(m.content)
          ? m.content.flatMap((p) =>
              p.type === "tool-call" ? [p.toolCallId] : [],
            )
          : [],
      )
    expect(callIds).toEqual(["c2", "c3"])
  })
})
