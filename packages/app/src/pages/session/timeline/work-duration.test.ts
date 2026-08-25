import { describe, expect, test } from "bun:test"
import { formatWorkDuration } from "./work-duration"

describe("formatWorkDuration", () => {
  test.each([
    [0, "0s"],
    [59_999, "59s"],
    [60_000, "1m 0s"],
    [61_000, "1m 1s"],
    [3_661_000, "1h 1m 1s"],
    [90_061_000, "25h 1m 1s"],
  ])("formats %d milliseconds as %s", (ms, expected) => {
    expect(formatWorkDuration(ms)).toBe(expected)
  })
})
