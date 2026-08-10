import { describe, expect, test } from "bun:test"
import { isSessionCompletionViewed, isSessionViewed } from "./notification-viewed"

const current = {
  active: true,
  windowFocused: true,
  directory: "/project",
  currentDirectory: "/project",
  sessionID: "session-1",
  currentSession: "session-1",
}

describe("notification viewed state", () => {
  test("views the current tab only while its desktop window is focused", () => {
    expect(isSessionViewed(current)).toBe(true)
    expect(isSessionViewed({ ...current, windowFocused: false })).toBe(false)
  })

  test("does not view sessions in another tab, project, or server", () => {
    expect(isSessionViewed({ ...current, sessionID: "session-2" })).toBe(false)
    expect(isSessionViewed({ ...current, directory: "/other" })).toBe(false)
    expect(isSessionViewed({ ...current, active: false })).toBe(false)
  })

  test("preserves the web behavior when window focus is unavailable", () => {
    expect(isSessionViewed({ ...current, windowFocused: undefined })).toBe(true)
  })

  test("requires a new interaction after desktop session completion", () => {
    expect(
      isSessionCompletionViewed({
        interactionRequired: true,
        completionInteraction: 3,
        currentInteraction: 3,
        otherwiseViewed: true,
      }),
    ).toBe(false)
    expect(
      isSessionCompletionViewed({
        interactionRequired: true,
        completionInteraction: 3,
        currentInteraction: 4,
        otherwiseViewed: false,
      }),
    ).toBe(true)
    expect(
      isSessionCompletionViewed({
        interactionRequired: false,
        completionInteraction: 3,
        currentInteraction: 3,
        otherwiseViewed: true,
      }),
    ).toBe(true)
  })
})
