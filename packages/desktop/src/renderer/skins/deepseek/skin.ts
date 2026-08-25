import type { SkinDefinition } from "@opencode-ai/app"

export const DeepSeekHarnessSkin = {
  id: "deepseek-harness",
  name: "DeepSeek Harness",
  appearance: {
    colorScheme: "light",
    colorSchemes: ["light", "dark"],
    theme: "oc-2",
  },
  window: {
    background: "#f7f8fa",
    titlebar: "#f7f8fa",
    symbols: "#1f2329",
    dark: {
      background: "#19191a",
      titlebar: "#19191a",
      symbols: "#d8dadd",
    },
  },
} satisfies SkinDefinition
