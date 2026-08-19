import { makeEventListener } from "@solid-primitives/event-listener"
import { createSimpleContext } from "@opencode-ai/ui/context"
import { useTheme } from "@opencode-ai/ui/theme/context"
import { createEffect } from "solid-js"
import { createStore } from "solid-js/store"

type SkinWindowColors = {
  background?: string
  titlebar?: string
  symbols?: string
}

export type SkinWindow = SkinWindowColors & {
  dark?: SkinWindowColors
}

export type SkinAppearance = {
  colorScheme?: "light" | "dark"
  colorSchemes?: readonly ("light" | "dark")[]
  theme?: string
}

export type SkinDefinition = {
  id: string
  name: string
  appearance?: SkinAppearance
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
const COLOR_SCHEME_STORAGE_KEY = "opencode-color-scheme"
const DEFAULT_COLOR_SCHEME = "light"
const DEFAULT_THEME = "oc-2"
const OPEN_CODE_COLOR_SCHEMES = ["system", "light", "dark"] as const
const openCodeSkin: SkinDefinition = {
  id: "none",
  name: "OpenCode",
  window: {},
}
const registry = {
  skins: [] as readonly SkinDefinition[],
  defaultID: openCodeSkin.id,
}
const [active, setActive] = createStore({ id: openCodeSkin.id })

export function registerSkins(skins: readonly SkinDefinition[], defaultID = openCodeSkin.id) {
  registry.skins = skins.filter((skin) => skin.id !== openCodeSkin.id)
  registry.defaultID = registry.skins.some((skin) => skin.id === defaultID) ? defaultID : openCodeSkin.id
  setActive("id", readSkinID() ?? defaultSkinID())
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

function activeSkin(skins = availableSkins()) {
  const id = readSkinID(skins) ?? defaultSkinID()
  return skins.find((skin) => skin.id === id) ?? openCodeSkin
}

function skinAppearance(skin: SkinDefinition) {
  if (skin.id === openCodeSkin.id) return
  return {
    colorScheme: skin.appearance?.colorScheme ?? DEFAULT_COLOR_SCHEME,
    theme: skin.appearance?.theme ?? DEFAULT_THEME,
  }
}

function skinColorSchemes(skin: SkinDefinition) {
  if (skin.id === openCodeSkin.id) return OPEN_CODE_COLOR_SCHEMES
  return skin.appearance?.colorSchemes ?? [skin.appearance?.colorScheme ?? DEFAULT_COLOR_SCHEME]
}

function resolveSkinWindow(skin: SkinDefinition, mode?: "light" | "dark") {
  const { dark, ...window } = skin.window
  if (mode !== "dark" || !dark) return window
  return { ...window, ...dark }
}

function readColorScheme() {
  if (typeof localStorage !== "object") return undefined
  try {
    return localStorage.getItem(COLOR_SCHEME_STORAGE_KEY)
  } catch {
    return undefined
  }
}

export function activeSkinWindow() {
  const skin = activeSkin()
  const stored = readColorScheme()
  const scheme = skinColorSchemes(skin).some((option) => option === stored)
    ? stored
    : (skin.appearance?.colorScheme ?? DEFAULT_COLOR_SCHEME)
  const mode = scheme === "dark" ? "dark" : "light"
  return resolveSkinWindow(skin, mode)
}

export function activeSkinAppearance() {
  return skinAppearance(activeSkin())
}

export function skinSettingsLocked() {
  return active.id !== openCodeSkin.id
}

export function skinColorSchemeOptions() {
  const skin = availableSkins().find((item) => item.id === active.id) ?? openCodeSkin
  return skinColorSchemes(skin)
}

export function skinColorSchemeSettingsLocked() {
  return skinColorSchemeOptions().length < 2
}

export const { use: useSkin, provider: SkinProvider } = createSimpleContext({
  name: "Skin",
  init: () => {
    const theme = useTheme()
    const skins = availableSkins()
    const [store, setStore] = createStore({
      id: readSkinID(skins) ?? defaultSkinID(),
    })
    setActive("id", store.id)

    const select = (id: SkinID) => {
      setStore("id", id)
      setActive("id", id)
    }

    makeEventListener(window, "storage", (event) => {
      if (event.key !== STORAGE_KEY) return
      const id = normalizeSkinID(event.newValue, skins)
      if (id) select(id)
    })

    createEffect(() => {
      const skin = skins.find((item) => item.id === store.id) ?? openCodeSkin
      const appearance = skinAppearance(skin)
      document.documentElement.dataset.skin = skin.id

      const colorSchemes = skinColorSchemes(skin)
      const colorScheme = colorSchemes.some((scheme) => scheme === theme.colorScheme())
        ? theme.colorScheme()
        : (appearance?.colorScheme ?? DEFAULT_COLOR_SCHEME)

      if (
        appearance &&
        (theme.colorScheme() !== colorScheme || theme.themeId() !== appearance.theme)
      ) {
        if (theme.colorScheme() !== colorScheme) theme.setColorScheme(colorScheme)
        if (theme.themeId() !== appearance.theme) theme.setTheme(appearance.theme)
        return
      }
      if (appearance && !theme.themes()[appearance.theme]) return

      const mode = theme.mode()

      const fallback = getComputedStyle(document.documentElement).getPropertyValue("--background-base").trim()
      const window = resolveSkinWindow(skin, mode)
      const background = window.background ?? fallback
      if (background) {
        document.documentElement.style.backgroundColor = background
        document.querySelector('meta[name="theme-color"]')?.setAttribute("content", background)
        setBackgroundColor(background)
      }

      const chromeBackground =
        getComputedStyle(document.documentElement).getPropertyValue("--desktop-chrome").trim() || undefined
      setTitlebar({
        mode,
        scheme: theme.colorScheme(),
        background: window.titlebar ?? chromeBackground,
        symbolColor: window.symbols,
      })
    })

    return {
      id: () => store.id,
      skins: () => skins,
      set: (id: SkinID) => {
        const next = normalizeSkinID(id, skins) ?? openCodeSkin.id
        select(next)
        try {
          localStorage.setItem(STORAGE_KEY, next)
        } catch {}
      },
    }
  },
})
