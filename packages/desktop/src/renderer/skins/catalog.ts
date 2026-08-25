import { DeepSeekHarnessSkin } from "./deepseek/skin"
import { EmilySkin } from "./emily/skin"
import { MikuSkin } from "./miku/skin"
import { Su7UltraSkin } from "./su7ultra/skin"
import { Yu7GtSkin } from "./yu7gt/skin"

export const desktopSkins = [MikuSkin, EmilySkin, DeepSeekHarnessSkin, Yu7GtSkin, Su7UltraSkin]
export const defaultDesktopSkinID = MikuSkin.id
