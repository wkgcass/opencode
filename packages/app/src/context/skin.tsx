import { makeEventListener } from "@solid-primitives/event-listener"
import { createSimpleContext } from "@opencode-ai/ui/context"
import { useTheme } from "@opencode-ai/ui/theme/context"
import { createEffect } from "solid-js"
import { createStore } from "solid-js/store"

export type SkinWindow = {
  background?: string
  titlebar?: string
  symbols?: string
}

export type SkinDefinition = {
  id: string
  name: string
  window: SkinWindow
}

export type SkinID = string

type SkinTitlebarTheme = {
  mode: "light" | "dark"
  scheme?: "system" | "light" | "dark"
  background?: string
  symbolColor?: string
}

const STORAGE_KEY = "opencode-skin-id"
const openCodeSkin: SkinDefinition = {
  id: "none",
  name: "OpenCode",
  window: {},
}
const registry = {
  skins: [] as readonly SkinDefinition[],
  defaultID: openCodeSkin.id,
}

export function registerSkins(skins: readonly SkinDefinition[], defaultID = openCodeSkin.id) {
  registry.skins = skins.filter((skin) => skin.id !== openCodeSkin.id)
  registry.defaultID = registry.skins.some((skin) => skin.id === defaultID) ? defaultID : openCodeSkin.id
}

function availableSkins() {
  return [openCodeSkin, ...registry.skins]
}

function normalizeSkinID(value: string | null | undefined, skins = availableSkins()) {
  return skins.find((skin) => skin.id === value)?.id
}

function desktop() {
  if (typeof document !== "object") return false
  return document.documentElement.dataset.opencodeDesktop === "true" || navigator.userAgent.includes("Electron")
}

function setBackgroundColor(color: string) {
  const api: unknown = window.api
  if (typeof api !== "object" || api === null) return
  if (!("setBackgroundColor" in api) || typeof api.setBackgroundColor !== "function") return
  void api.setBackgroundColor(color)
}

function setTitlebar(theme: SkinTitlebarTheme) {
  const api: unknown = window.api
  if (typeof api !== "object" || api === null) return
  if (!("setTitlebar" in api) || typeof api.setTitlebar !== "function") return
  void api.setTitlebar(theme)
}

function readSkinID(skins = availableSkins()) {
  if (typeof localStorage !== "object") return undefined
  try {
    return normalizeSkinID(localStorage.getItem(STORAGE_KEY), skins)
  } catch {
    return undefined
  }
}

function defaultSkinID() {
  return desktop() ? registry.defaultID : openCodeSkin.id
}

export function activeSkinWindow() {
  const skins = availableSkins()
  const id = readSkinID(skins) ?? defaultSkinID()
  return skins.find((skin) => skin.id === id)?.window
}

export const { use: useSkin, provider: SkinProvider } = createSimpleContext({
  name: "Skin",
  init: () => {
    const theme = useTheme()
    const skins = availableSkins()
    const [store, setStore] = createStore({
      id: readSkinID(skins) ?? defaultSkinID(),
    })

    makeEventListener(window, "storage", (event) => {
      if (event.key !== STORAGE_KEY) return
      const id = normalizeSkinID(event.newValue, skins)
      if (id) setStore("id", id)
    })

    createEffect(() => {
      const skin = skins.find((item) => item.id === store.id) ?? openCodeSkin
      if (skin.id !== openCodeSkin.id && theme.colorScheme() !== "light") {
        theme.setColorScheme("light")
        return
      }

      const mode = theme.mode()
      document.documentElement.dataset.skin = skin.id

      const fallback = getComputedStyle(document.documentElement).getPropertyValue("--background-base").trim()
      const background = skin.window.background ?? fallback
      if (background) {
        document.documentElement.style.backgroundColor = background
        document.querySelector('meta[name="theme-color"]')?.setAttribute("content", background)
        setBackgroundColor(background)
      }

      setTitlebar({
        mode,
        scheme: theme.colorScheme(),
        background: skin.window.titlebar,
        symbolColor: skin.window.symbols,
      })
    })

    return {
      id: () => store.id,
      skins: () => skins,
      set: (id: SkinID) => {
        const next = normalizeSkinID(id, skins) ?? openCodeSkin.id
        setStore("id", next)
        if (next !== openCodeSkin.id && theme.colorScheme() !== "light") theme.setColorScheme("light")
        try {
          localStorage.setItem(STORAGE_KEY, next)
        } catch {}
      },
    }
  },
})
