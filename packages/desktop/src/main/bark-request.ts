const endpoint = "https://api.day.app/push"
const icon = "https://opencode.ai/favicon-v3.ico"

export async function sendBarkSessionComplete(
  deviceKey: string,
  title: string,
  fetcher: (input: string, init: RequestInit) => Promise<Response> = fetch,
) {
  const response = await fetcher(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      device_key: deviceKey,
      title,
      body: "任务已完成",
      icon,
    }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error(`Bark push failed with HTTP ${response.status}`)
}
