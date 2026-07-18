import { registerSkins } from "@opencode-ai/app"
import { defaultDesktopSkinID, desktopSkins } from "./catalog"
import { desktopSkinStyles } from "./styles"

const loaded = new Set<string>()

export function initializeSkinStyles() {
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
