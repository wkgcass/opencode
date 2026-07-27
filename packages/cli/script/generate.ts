import path from "path"
import os from "os"
import { mkdir } from "node:fs/promises"

const modelsUrl = process.env.OPENCODE_MODELS_URL || "https://models.dev"
const cacheFile = path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache"), "opencode", "models.json")

export const modelsData = process.env.MODELS_DEV_API_JSON
  ? await Bun.file(process.env.MODELS_DEV_API_JSON).text()
  : await (async () => {
      if (!process.env.OPENCODE_MODELS_REFRESH) {
        const cached = await Bun.file(cacheFile).text().catch(() => undefined)
        if (cached) return cached
      }
      const text = await fetch(`${modelsUrl}/api.json`).then((response) => response.text())
      await mkdir(path.dirname(cacheFile), { recursive: true }).catch(() => {})
      await Bun.write(cacheFile, text).catch(() => {})
      return text
    })()

console.log("Loaded models.dev snapshot")
