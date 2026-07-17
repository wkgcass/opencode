import { beforeEach, describe, expect, test } from "bun:test"
import { activeSkinWindow } from "./skin"

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute("data-opencode-desktop")
})

describe("desktop skin", () => {
  test("keeps the web presentation unskinned by default", () => {
    expect(activeSkinWindow()).toEqual({})
  })

  test("uses Miku window colours when selected", () => {
    localStorage.setItem("opencode-skin-id", "miku-future")

    expect(activeSkinWindow()).toEqual({
      background: "#eefcff",
      titlebar: "#eefcff",
      symbols: "#245b65",
    })
  })

  test("defaults the desktop renderer to Miku Future", () => {
    document.documentElement.dataset.opencodeDesktop = "true"

    expect(activeSkinWindow()).toEqual({
      background: "#eefcff",
      titlebar: "#eefcff",
      symbols: "#245b65",
    })
  })
})
