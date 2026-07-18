;(function () {
  var key = "opencode-theme-id"
  var themeId = localStorage.getItem(key) || "oc-2"

  if (themeId === "oc-1") {
    themeId = "oc-2"
    localStorage.setItem(key, themeId)
    localStorage.removeItem("opencode-theme-css-light")
    localStorage.removeItem("opencode-theme-css-dark")
  }

  var desktop = location.protocol === "oc:" || navigator.userAgent.indexOf("Electron") !== -1
  var skinRegistry = window.__OPENCODE__
  var skins = skinRegistry && Array.isArray(skinRegistry.skins) ? skinRegistry.skins : []
  var skinDefaultID = skinRegistry && skinRegistry.skinDefaultID
  var storedSkinId = localStorage.getItem("opencode-skin-id")
  var storedSkin = skins.find(function (skin) {
    return skin.id === storedSkinId
  })
  var defaultSkin = desktop
    ? skins.find(function (skin) {
        return skin.id === skinDefaultID
      })
    : undefined
  var skin = storedSkinId === "none" ? undefined : (storedSkin ?? defaultSkin)
  var skinId = skin ? skin.id : "none"
  var scheme = localStorage.getItem("opencode-color-scheme") || "system"
  if (skinId !== "none") {
    scheme = "light"
    localStorage.setItem("opencode-color-scheme", scheme)
  }
  var isDark = scheme === "dark" || (scheme === "system" && matchMedia("(prefers-color-scheme: dark)").matches)
  var mode = isDark ? "dark" : "light"
  var background = skin?.window?.background || (isDark ? "#080808" : "#fafafa")

  document.documentElement.dataset.theme = themeId
  document.documentElement.dataset.colorScheme = mode
  document.documentElement.dataset.skin = skinId
  document.documentElement.style.backgroundColor = background

  // Update theme-color meta tag to match app color scheme
  var metas = document.querySelectorAll("meta[name='theme-color']")
  if (metas.length > 0) metas[0].setAttribute("content", background)

  if (themeId === "oc-2") return

  var css = localStorage.getItem("opencode-theme-css-" + mode)
  if (css) {
    var style = document.createElement("style")
    style.id = "oc-theme-preload"
    style.textContent =
      ":root{color-scheme:" +
      mode +
      ";--text-mix-blend-mode:" +
      (isDark ? "plus-lighter" : "multiply") +
      ";" +
      css +
      "}"
    document.head.appendChild(style)
  }
})()
