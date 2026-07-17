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
  var storedSkinId = localStorage.getItem("opencode-skin-id")
  var skinId =
    storedSkinId === "none" || storedSkinId === "miku-future" ? storedSkinId : desktop ? "miku-future" : "none"
  var scheme = localStorage.getItem("opencode-color-scheme") || "system"
  if (skinId !== "none") {
    scheme = "light"
    localStorage.setItem("opencode-color-scheme", scheme)
  }
  var isDark = scheme === "dark" || (scheme === "system" && matchMedia("(prefers-color-scheme: dark)").matches)
  var mode = isDark ? "dark" : "light"
  var background = skinId === "miku-future" ? "#eefcff" : isDark ? "#080808" : "#fafafa"

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
