import { EmilySkin } from "./emily/skin"
import { MikuSkin } from "./miku/skin"
import { Su7UltraSkin } from "./su7ultra/skin"
import { Yu7GtSkin } from "./yu7gt/skin"

export const desktopSkinStyles: Record<string, () => Promise<unknown>> = {
  [MikuSkin.id]: () => import("./miku/index.css"),
  [EmilySkin.id]: () => import("./emily/index.css"),
  [Yu7GtSkin.id]: () => import("./yu7gt/index.css"),
  [Su7UltraSkin.id]: () => import("./su7ultra/index.css"),
}
