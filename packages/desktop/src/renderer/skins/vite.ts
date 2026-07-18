import { defaultDesktopSkinID, desktopSkins } from "./catalog"

export const desktopSkinPreloadPlugin = {
  name: "opencode:desktop-skin-preload",
  transformIndexHtml: {
    order: "pre" as const,
    handler() {
      return [
        {
          tag: "script",
          children: `;(function () {
  var skins = ${JSON.stringify(desktopSkins)}
  var defaultID = ${JSON.stringify(defaultDesktopSkinID)}
  window.__OPENCODE__ ??= {}
  window.__OPENCODE__.skins = skins
  window.__OPENCODE__.skinDefaultID = defaultID

  var storedID = localStorage.getItem("opencode-skin-id")
  var stored = skins.find(function (skin) { return skin.id === storedID })
  var fallback = skins.find(function (skin) { return skin.id === defaultID })
  var skin = storedID === "none" ? undefined : (stored || fallback)
  document.documentElement.dataset.skin = skin ? skin.id : "none"
  if (!skin) return
  localStorage.setItem("opencode-color-scheme", "light")
})()`,
          injectTo: "head-prepend" as const,
        },
        {
          tag: "script",
          children: `;(function () {
  var registry = window.__OPENCODE__
  var skins = registry && Array.isArray(registry.skins) ? registry.skins : []
  var id = document.documentElement.dataset.skin
  var skin = skins.find(function (item) { return item.id === id })
  var background = skin && skin.window && skin.window.background
  if (!background) return
  document.documentElement.style.backgroundColor = background
  var meta = document.querySelector("meta[name='theme-color']")
  if (meta) meta.setAttribute("content", background)
})()`,
          injectTo: "head" as const,
        },
      ]
    },
  },
}
