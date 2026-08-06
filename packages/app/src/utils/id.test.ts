import { describe, expect, test } from "bun:test"
import { Identifier } from "./id"

describe("Identifier", () => {
  test("generates and parses legacy and extended timestamp IDs", () => {
    const timestamp = 2 ** 36 + 123_456_789
    const legacy = Identifier.ascendingAt("message", timestamp)
    const extended = Identifier.ascendingAt("message", timestamp, true)

    expect(legacy).toMatch(/^msg_[0-9a-f]{12}[0-9A-Za-z]{14}$/)
    expect(extended).toMatch(/^msg_-[0-9a-f]{14}[0-9A-Za-z]{14}$/)
    expect(Identifier.timestamp(legacy)).toBe(timestamp % 2 ** 36)
    expect(Identifier.timestamp(extended)).toBe(timestamp)
  })

  test("rejects timestamp segments with the wrong width", () => {
    expect(Identifier.timestamp("msg_bad")).toBeUndefined()
    expect(Identifier.timestamp("msg_-bad")).toBeUndefined()
  })
})
