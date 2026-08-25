export function formatWorkDuration(ms: number) {
  const total = Math.floor(ms / 1000)
  const seconds = total % 60
  if (total < 60) return `${total}s`

  const minutes = Math.floor(total / 60)
  if (minutes < 60) return `${minutes}m ${seconds}s`

  return `${Math.floor(minutes / 60)}h ${minutes % 60}m ${seconds}s`
}
