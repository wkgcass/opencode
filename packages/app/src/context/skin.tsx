import { makeEventListener } from "@solid-primitives/event-listener"
import { createSimpleContext } from "@opencode-ai/ui/context"
import { useTheme } from "@opencode-ai/ui/theme/context"
import { createEffect } from "solid-js"
import { createStore } from "solid-js/store"

export const SKINS = [
  {
    id: "none",
    name: "OpenCode",
    window: {},
  },
  {
    id: "miku-future",
    name: "Miku Future",
    window: {
      background: "#eefcff",
      titlebar: "#eefcff",
      symbols: "#245b65",
    },
  },
] as const

export type SkinID = (typeof SKINS)[number]["id"]

const STORAGE_KEY = "opencode-skin-id"

function normalizeSkinID(value: string | null | undefined): SkinID | undefined {
  return SKINS.find((skin) => skin.id === value)?.id
}

function desktop() {
  if (typeof document !== "object") return false
  return document.documentElement.dataset.opencodeDesktop === "true" || navigator.userAgent.includes("Electron")
}

function readSkinID() {
  if (typeof localStorage !== "object") return
  try {
    return normalizeSkinID(localStorage.getItem(STORAGE_KEY))
  } catch {
    return undefined
  }
}

export function activeSkinWindow() {
  const id = readSkinID() ?? (desktop() ? "miku-future" : "none")
  return SKINS.find((skin) => skin.id === id)?.window
}

export const { use: useSkin, provider: SkinProvider } = createSimpleContext({
  name: "Skin",
  init: () => {
    const theme = useTheme()
    const [store, setStore] = createStore({
      id: readSkinID() ?? (desktop() ? "miku-future" : "none"),
    })

    makeEventListener(window, "storage", (event) => {
      if (event.key !== STORAGE_KEY) return
      const id = normalizeSkinID(event.newValue)
      if (id) setStore("id", id)
    })

    createEffect(() => {
      const skin = SKINS.find((item) => item.id === store.id) ?? SKINS[0]
      if (skin.id !== "none" && theme.colorScheme() !== "light") {
        theme.setColorScheme("light")
        return
      }

      const mode = theme.mode()
      const windowTheme = skin.window
      document.documentElement.dataset.skin = skin.id

      const fallback = getComputedStyle(document.documentElement).getPropertyValue("--background-base").trim()
      const background = "background" in windowTheme ? windowTheme.background : fallback
      if (background) {
        document.documentElement.style.backgroundColor = background
        document.querySelector('meta[name="theme-color"]')?.setAttribute("content", background)
        void window.api?.setBackgroundColor?.(background)
      }

      void window.api?.setTitlebar?.({
        mode,
        scheme: theme.colorScheme(),
        background: "titlebar" in windowTheme ? windowTheme.titlebar : undefined,
        symbolColor: "symbols" in windowTheme ? windowTheme.symbols : undefined,
      })
    })

    return {
      id: () => store.id,
      skins: () => SKINS,
      set: (id: SkinID) => {
        setStore("id", id)
        if (id !== "none" && theme.colorScheme() !== "light") theme.setColorScheme("light")
        try {
          localStorage.setItem(STORAGE_KEY, id)
        } catch {}
      },
    }
  },
})
