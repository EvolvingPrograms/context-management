import { afterEach, describe, expect, test } from "bun:test"

import {
  MODE_ENV_VAR,
  isContextManagementMode,
  modeFlags,
  resolveMode,
} from "./modes"

const ORIGINAL = process.env[MODE_ENV_VAR]
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env[MODE_ENV_VAR]
  else process.env[MODE_ENV_VAR] = ORIGINAL
})

describe("resolveMode", () => {
  test("no env → configured default (pinned when unset)", () => {
    delete process.env[MODE_ENV_VAR]
    expect(resolveMode("managed")).toBe("managed")
    expect(resolveMode()).toBe("pinned")
  })

  test("valid env overrides the configured mode", () => {
    process.env[MODE_ENV_VAR] = "auto"
    expect(resolveMode("managed")).toBe("auto")
  })

  test("invalid env is ignored", () => {
    process.env[MODE_ENV_VAR] = "turbo"
    expect(resolveMode("managed")).toBe("managed")
  })
})

describe("isContextManagementMode", () => {
  test("accepts the four modes, rejects everything else", () => {
    expect(isContextManagementMode("managed")).toBe(true)
    expect(isContextManagementMode("off")).toBe(true)
    expect(isContextManagementMode("turbo")).toBe(false)
    expect(isContextManagementMode(undefined)).toBe(false)
  })
})

describe("modeFlags", () => {
  test("the ladder is strictly increasing", () => {
    expect(modeFlags("off").gatewayAuto).toBe(false)
    expect(modeFlags("auto")).toMatchObject({ gatewayAuto: true, pinTail: false })
    expect(modeFlags("pinned")).toMatchObject({ pinTail: true, trailing: 0 })
    expect(modeFlags("managed")).toMatchObject({
      pinTail: true,
      trailing: 2,
      edits: true,
      truncation: true,
    })
  })
})
