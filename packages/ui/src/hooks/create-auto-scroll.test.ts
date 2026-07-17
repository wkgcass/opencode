import { describe, expect, test } from "bun:test"
import { shouldKeepAutoScrollPaused } from "./create-auto-scroll-state"

describe("shouldKeepAutoScrollPaused", () => {
  test("keeps a user scroll paused inside the follow threshold", () => {
    expect(shouldKeepAutoScrollPaused(true, 5)).toBe(true)
  })

  test("resumes after the user returns to the bottom", () => {
    expect(shouldKeepAutoScrollPaused(true, 1)).toBe(false)
  })

  test("does not pause automatic scrolling without user interaction", () => {
    expect(shouldKeepAutoScrollPaused(false, 5)).toBe(false)
  })
})
