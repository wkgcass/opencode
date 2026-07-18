import { beforeEach, describe, expect, test } from "bun:test"

const src = await Bun.file(new URL("../public/oc-theme-preload.js", import.meta.url)).text()

const run = () => Function(src)()

beforeEach(() => {
  document.head.innerHTML = ""
  document.documentElement.removeAttribute("data-theme")
  document.documentElement.removeAttribute("data-color-scheme")
  document.documentElement.removeAttribute("data-skin")
  document.documentElement.removeAttribute("style")
  localStorage.clear()
  const target = window as Window & {
    __OPENCODE__?: {
      skins?: Array<{ id: string; window: { background: string } }>
      skinDefaultID?: string
    }
  }
  target.__OPENCODE__ = {
    skins: [{ id: "test-skin", window: { background: "#f1f2f3" } }],
    skinDefaultID: "test-skin",
  }
  Object.defineProperty(window, "matchMedia", {
    value: () =>
      ({
        matches: false,
      }) as MediaQueryList,
    configurable: true,
  })
})

describe("theme preload", () => {
  test("migrates legacy oc-1 to oc-2 before mount", () => {
    localStorage.setItem("opencode-theme-id", "oc-1")
    localStorage.setItem("opencode-theme-css-light", "--background-base:#fff;")
    localStorage.setItem("opencode-theme-css-dark", "--background-base:#000;")

    run()

    expect(document.documentElement.dataset.theme).toBe("oc-2")
    expect(document.documentElement.dataset.colorScheme).toBe("light")
    expect(localStorage.getItem("opencode-theme-id")).toBe("oc-2")
    expect(localStorage.getItem("opencode-theme-css-light")).toBeNull()
    expect(localStorage.getItem("opencode-theme-css-dark")).toBeNull()
    expect(document.getElementById("oc-theme-preload")).toBeNull()
  })

  test("keeps cached css for non-default themes", () => {
    localStorage.setItem("opencode-theme-id", "nightowl")
    localStorage.setItem("opencode-theme-css-light", "--background-base:#fff;")

    run()

    expect(document.documentElement.dataset.theme).toBe("nightowl")
    expect(document.getElementById("oc-theme-preload")?.textContent).toContain("--background-base:#fff;")
  })

  test("restores the selected skin before mount", () => {
    const meta = document.createElement("meta")
    meta.name = "theme-color"
    document.head.appendChild(meta)
    localStorage.setItem("opencode-skin-id", "test-skin")
    localStorage.setItem("opencode-color-scheme", "dark")

    run()

    expect(document.documentElement.dataset.skin).toBe("test-skin")
    expect(document.documentElement.dataset.colorScheme).toBe("light")
    expect(localStorage.getItem("opencode-color-scheme")).toBe("light")
    expect(document.documentElement.style.backgroundColor).toBe("#f1f2f3")
    expect(meta.content).toBe("#f1f2f3")
  })

  test("keeps the selected colour scheme for the OpenCode skin", () => {
    localStorage.setItem("opencode-skin-id", "none")
    localStorage.setItem("opencode-color-scheme", "dark")

    run()

    expect(document.documentElement.dataset.skin).toBe("none")
    expect(document.documentElement.dataset.colorScheme).toBe("dark")
    expect(localStorage.getItem("opencode-color-scheme")).toBe("dark")
  })

  test("ignores unknown skin identifiers", () => {
    localStorage.setItem("opencode-skin-id", "untrusted-skin")

    run()

    expect(document.documentElement.dataset.skin).toBe("none")
  })
})
