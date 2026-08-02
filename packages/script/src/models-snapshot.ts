import os from "os"
import path from "path"
import { mkdir } from "node:fs/promises"

const cacheFile = path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache"), "opencode", "models.json")

export async function loadModelsSnapshot(modelsUrl: string) {
  if (!process.env.OPENCODE_MODELS_REFRESH) {
    const cached = await Bun.file(cacheFile).text().catch(() => undefined)
    if (cached) return cached
  }

  const data = await fetch(`${modelsUrl}/api.json`).then((response) => response.text())
  await mkdir(path.dirname(cacheFile), { recursive: true }).catch(() => {})
  await Bun.write(cacheFile, data).catch(() => {})
  return data
}
