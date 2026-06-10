import { describe, expect, test } from "bun:test"

import { MemoryFullOutputStore } from "./store"
import { createFetchFullResultTool } from "./fetch-tool"

describe("createFetchFullResultTool", () => {
  test("returns the stored body; descriptive miss message", async () => {
    const store = new MemoryFullOutputStore()
    store.set("call-1", "the full output")
    const t = createFetchFullResultTool({ store })

    const execute = t.execute
    if (!execute) throw new Error("tool has no execute")
    const opts = { toolCallId: "tc", messages: [] }
    expect(await execute({ id: "call-1" }, opts)).toBe("the full output")
    expect(await execute({ id: "missing" }, opts)).toBe(
      'No stored output found for id "missing".',
    )
  })
})
