const modelsUrl = process.env.OPENCODE_MODELS_URL || "https://models.opencode.ai"

export const modelsData = process.env.MODELS_DEV_API_JSON
  ? await Bun.file(process.env.MODELS_DEV_API_JSON).text()
  : await loadCachedModelsSnapshot(modelsUrl)

console.log("Loaded models.dev snapshot")

async function loadCachedModelsSnapshot(url: string) {
  const { loadModelsSnapshot } = await import("@opencode-ai/script/models-snapshot")
  return loadModelsSnapshot(url)
}
