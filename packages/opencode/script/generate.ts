import path from "path"
import { fileURLToPath } from "url"
import { loadModelsSnapshot } from "@opencode-ai/script/models-snapshot"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dir = path.resolve(__dirname, "..")

process.chdir(dir)

const modelsUrl = process.env.OPENCODE_MODELS_URL || "https://models.dev"

export const modelsData = process.env.MODELS_DEV_API_JSON
  ? await Bun.file(process.env.MODELS_DEV_API_JSON).text()
  : await loadModelsSnapshot(modelsUrl)
console.log("Loaded models.dev snapshot")
