import { beforeEach, describe, expect, test } from "bun:test"
import { activeSkinWindow, registerSkins } from "./skin"

const testSkin = {
  id: "test-skin",
  name: "Test Skin",
  window: {
    background: "#f1f2f3",
    titlebar: "#f1f2f3",
    symbols: "#313233",
  },
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute("data-opencode-desktop")
  registerSkins([testSkin], testSkin.id)
})

describe("desktop skin", () => {
  test("keeps the web presentation unskinned by default", () => {
    expect(activeSkinWindow()).toEqual({})
  })

  test("uses registered window colours when selected", () => {
    localStorage.setItem("opencode-skin-id", testSkin.id)

    expect(activeSkinWindow()).toEqual(testSkin.window)
  })

  test("uses the registered desktop default", () => {
    document.documentElement.dataset.opencodeDesktop = "true"

    expect(activeSkinWindow()).toEqual(testSkin.window)
  })

  test("ignores unregistered skin identifiers", () => {
    localStorage.setItem("opencode-skin-id", "unknown-skin")

    expect(activeSkinWindow()).toEqual({})
  })
})
