const delay = 60_000
const readSuppression = 1_000

export function createCompletionReminderScheduler(input: {
  send: (serverScope: string, directory: string, sessionID: string, count: number) => Promise<void>
  delay?: number
  readSuppression?: number
}) {
  const pending = new Map<
    string,
    { directory: string; timer?: ReturnType<typeof setTimeout>; count: number; onError: (error: unknown) => void }
  >()
  const readSessions = new Map<string, ReturnType<typeof setTimeout>>()
  const readDirectories = new Map<string, ReturnType<typeof setTimeout>>()

  const suppress = (entries: Map<string, ReturnType<typeof setTimeout>>, key: string) => {
    clearTimeout(entries.get(key))
    const timer = setTimeout(() => entries.delete(key), input.readSuppression ?? readSuppression)
    timer.unref()
    entries.set(key, timer)
  }

  const cancelSession = (serverScope: string, sessionID: string) => {
    const key = `${serverScope}\0${sessionID}`
    clearTimeout(pending.get(key)?.timer)
    pending.delete(key)
    // Renderer windows can process the same idle event in either order. Remember the read briefly so a late schedule
    // from another window cannot resurrect a reminder that the focused window already cancelled.
    suppress(readSessions, key)
  }

  const cancelDirectory = (serverScope: string, directory: string) => {
    pending.forEach((entry, key) => {
      if (!key.startsWith(`${serverScope}\0`) || entry.directory !== directory) return
      clearTimeout(entry.timer)
      pending.delete(key)
    })
    suppress(readDirectories, `${serverScope}\0${directory}`)
  }

  return {
    schedule(serverScope: string, directory: string, sessionID: string, onError: (error: unknown) => void) {
      const key = `${serverScope}\0${sessionID}`
      if (readSessions.has(key) || readDirectories.has(`${serverScope}\0${directory}`)) return
      clearTimeout(pending.get(key)?.timer)
      const entry: {
        directory: string
        timer?: ReturnType<typeof setTimeout>
        count: number
        onError: (error: unknown) => void
      } = { directory, count: 0, onError }
      const tick = () => {
        if (pending.get(key) !== entry) return
        entry.count += 1
        void input.send(serverScope, directory, sessionID, entry.count).catch(entry.onError)
        entry.timer = setTimeout(tick, input.delay ?? delay)
        entry.timer.unref()
      }
      entry.timer = setTimeout(tick, input.delay ?? delay)
      entry.timer.unref()
      pending.set(key, entry)
    },
    cancelSession,
    cancelDirectory,
  }
}
