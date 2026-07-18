import { beforeEach, describe, expect, test } from "bun:test"
import { defaultDesktopSkinID, desktopSkins } from "./catalog"
import { desktopSkinPreloadPlugin } from "./vite"

const tags = desktopSkinPreloadPlugin.transformIndexHtml.handler()
const beforeTheme = tags.find((tag) => tag.injectTo === "head-prepend")
const afterTheme = tags.find((tag) => tag.injectTo === "head")

function environment() {
  const values = new Map<string, string>()
  const meta = { content: "#fafafa" }
  const document = {
    documentElement: {
      dataset: {} as Record<string, string>,
      style: { backgroundColor: "" },
    },
    querySelector: (selector: string) => {
      if (selector !== "meta[name='theme-color']") return null
      return {
        getAttribute: (name: string) => (name === "content" ? meta.content : null),
        setAttribute: (name: string, value: string) => {
          if (name === "content") meta.content = value
        },
      }
    },
  }
  return {
    document,
    localStorage: {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
    meta,
    window: {} as { __OPENCODE__?: unknown },
  }
}

let env = environment()

function run(source: string | undefined) {
  if (!source) throw new Error("Missing desktop skin preload script")
  Function("window", "localStorage", "document", source)(env.window, env.localStorage, env.document)
}

beforeEach(() => {
  env = environment()
})

describe("desktop skin preload", () => {
  test("selects the desktop default before the shared theme preload", () => {
    env.localStorage.setItem("opencode-color-scheme", "dark")

    run(beforeTheme?.children)

    expect(env.document.documentElement.dataset.skin).toBe(defaultDesktopSkinID)
    expect(env.localStorage.getItem("opencode-color-scheme")).toBe("light")
  })

  test("applies the selected background after the shared theme preload", () => {
    run(beforeTheme?.children)
    env.document.documentElement.style.backgroundColor = "#fafafa"
    run(afterTheme?.children)

    const skin = desktopSkins.find((item) => item.id === defaultDesktopSkinID)
    expect(env.document.documentElement.style.backgroundColor).toBe(skin?.window.background)
    expect(env.meta.content).toBe(skin?.window.background)
  })

  test("preserves the colour scheme when the OpenCode skin is selected", () => {
    env.localStorage.setItem("opencode-skin-id", "none")
    env.localStorage.setItem("opencode-color-scheme", "dark")

    run(beforeTheme?.children)
    run(afterTheme?.children)

    expect(env.document.documentElement.dataset.skin).toBe("none")
    expect(env.localStorage.getItem("opencode-color-scheme")).toBe("dark")
    expect(env.document.documentElement.style.backgroundColor).toBe("")
  })
})
