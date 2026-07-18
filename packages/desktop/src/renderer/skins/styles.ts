import { EmilySkin } from "./emily/skin"
import { MikuSkin } from "./miku/skin"

export const desktopSkinStyles: Record<string, () => Promise<unknown>> = {
  [MikuSkin.id]: () => import("./miku/index.css"),
  [EmilySkin.id]: () => import("./emily/index.css"),
}
