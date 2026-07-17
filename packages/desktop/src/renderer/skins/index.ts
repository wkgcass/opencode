const loaded = new Set<string>()
const styles: Record<string, () => Promise<unknown>> = {
  "miku-future": () => import("./miku/index.css"),
}

export function initializeSkinStyles() {
  const root = document.documentElement
  const load = () => {
    const id = root.dataset.skin
    if (!id || loaded.has(id)) return
    const style = styles[id]
    if (!style) return
    loaded.add(id)
    void style()
  }

  load()
  const observer = new MutationObserver(load)
  observer.observe(root, { attributes: true, attributeFilter: ["data-skin"] })
}
