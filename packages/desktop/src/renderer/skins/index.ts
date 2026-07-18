import { registerSkins } from "@opencode-ai/app"
import { defaultDesktopSkinID, desktopSkins } from "./catalog"
import { desktopSkinStyles } from "./styles"
import "../codex-workspace.css"

const loaded = new Set<string>()

export function initializeSkinStyles() {
  // Scope the shared application's workspace treatment to the desktop renderer.
  document.documentElement.dataset.opencodeDesktop = "true"
  registerSkins(desktopSkins, defaultDesktopSkinID)

  const root = document.documentElement
  const load = () => {
    const id = root.dataset.skin
    if (!id || loaded.has(id)) return
    const style = desktopSkinStyles[id]
    if (!style) return
    loaded.add(id)
    void style()
  }

  load()
  const observer = new MutationObserver(load)
  observer.observe(root, { attributes: true, attributeFilter: ["data-skin"] })
}
