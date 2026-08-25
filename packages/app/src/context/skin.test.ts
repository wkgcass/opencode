import { beforeEach, describe, expect, test } from "bun:test"
import {
  activeSkinAppearance,
  activeSkinWindow,
  registerSkins,
  skinColorSchemeOptions,
  skinColorSchemeSettingsLocked,
  skinSettingsLocked,
  type SkinDefinition,
} from "./skin"

const testSkin = {
  id: "test-skin",
  name: "Test Skin",
  window: {
    background: "#f1f2f3",
    titlebar: "#f1f2f3",
    symbols: "#313233",
  },
}
const darkSkin = {
  id: "dark-skin",
  name: "Dark Skin",
  appearance: {
    colorScheme: "dark",
    theme: "nightowl",
  },
  window: {},
} satisfies SkinDefinition
const flexibleSkin = {
  id: "flexible-skin",
  name: "Flexible Skin",
  appearance: {
    colorScheme: "light",
    colorSchemes: ["light", "dark"],
    theme: "oc-2",
  },
  window: {
    background: "#f7f8fa",
    dark: { background: "#19191a" },
  },
} satisfies SkinDefinition

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute("data-opencode-desktop")
  registerSkins([testSkin, darkSkin, flexibleSkin], testSkin.id)
})

describe("desktop skin", () => {
  test("keeps the web presentation unskinned by default", () => {
    expect(activeSkinWindow()).toEqual({})
    expect(activeSkinAppearance()).toBeUndefined()
  })

  test("uses registered window colours when selected", () => {
    localStorage.setItem("opencode-skin-id", testSkin.id)
    registerSkins([testSkin, darkSkin], testSkin.id)

    expect(activeSkinWindow()).toEqual(testSkin.window)
    expect(activeSkinAppearance()).toEqual({ colorScheme: "light", theme: "oc-2" })
    expect(skinSettingsLocked()).toBeTrue()
  })

  test("uses the appearance configured by the selected skin", () => {
    localStorage.setItem("opencode-skin-id", darkSkin.id)

    expect(activeSkinAppearance()).toEqual(darkSkin.appearance)
  })

  test("allows a skin to expose light and dark modes without unlocking its theme", () => {
    localStorage.setItem("opencode-skin-id", flexibleSkin.id)
    localStorage.setItem("opencode-color-scheme", "dark")
    registerSkins([testSkin, darkSkin, flexibleSkin], testSkin.id)

    expect(skinColorSchemeOptions()).toEqual(["light", "dark"])
    expect(skinColorSchemeSettingsLocked()).toBeFalse()
    expect(skinSettingsLocked()).toBeTrue()
    expect(activeSkinWindow()).toEqual({ background: "#19191a" })
  })

  test("uses the registered desktop default", () => {
    document.documentElement.dataset.opencodeDesktop = "true"
    registerSkins([testSkin, darkSkin], testSkin.id)

    expect(activeSkinWindow()).toEqual(testSkin.window)
    expect(skinSettingsLocked()).toBeTrue()
  })

  test("ignores unregistered skin identifiers", () => {
    localStorage.setItem("opencode-skin-id", "unknown-skin")
    registerSkins([testSkin, darkSkin], testSkin.id)

    expect(activeSkinWindow()).toEqual({})
    expect(activeSkinAppearance()).toBeUndefined()
    expect(skinSettingsLocked()).toBeFalse()
  })
})
