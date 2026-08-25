import { describe, expect, test } from "bun:test"
import { sendBarkSessionComplete } from "./bark-request"
import { createCompletionReminderScheduler } from "./completion-reminder-scheduler"

const wait = (delay: number) => new Promise((resolve) => setTimeout(resolve, delay))

describe("Bark notification", () => {
  test("sends the configured device key and session title", async () => {
    const requests: Array<{ input: string | URL | Request; init?: RequestInit }> = []
    await sendBarkSessionComplete("device-123", "Fix desktop notifications", async (input, init) => {
      requests.push({ input, init })
      return new Response(null, { status: 200 })
    })

    expect(requests).toHaveLength(1)
    expect(requests[0]?.input).toBe("https://api.day.app/push")
    expect(requests[0]?.init?.method).toBe("POST")
    expect(requests[0]?.init?.headers).toEqual({ "Content-Type": "application/json" })
    const body = requests[0]?.init?.body
    expect(typeof body).toBe("string")
    if (typeof body !== "string") throw new Error("Expected a JSON request body")
    expect(JSON.parse(body)).toEqual({
      device_key: "device-123",
      title: "Fix desktop notifications",
      body: "任务已完成",
      icon: "https://opencode.ai/favicon-v3.ico",
    })
  })

  test("rejects non-success responses", async () => {
    expect(
      sendBarkSessionComplete("device-123", "Title", async () => new Response(null, { status: 500 })),
    ).rejects.toThrow("Bark push failed with HTTP 500")
  })

  test("waits before sending and cancels when the session is read", async () => {
    const sent: string[] = []
    const scheduler = createCompletionReminderScheduler({
      delay: 20,
      send: async (serverScope, directory, sessionID, count) =>
        void sent.push(`${serverScope}:${directory}:${sessionID}:${count}`),
    })

    scheduler.schedule("server", "project", "session-1", () => undefined)
    expect(sent).toEqual([])
    scheduler.cancelSession("server", "session-1")
    await wait(30)
    expect(sent).toEqual([])
  })

  test("sends after the delay when the session remains unread", async () => {
    const sent: string[] = []
    const scheduler = createCompletionReminderScheduler({
      delay: 20,
      send: async (serverScope, directory, sessionID, count) =>
        void sent.push(`${serverScope}:${directory}:${sessionID}:${count}`),
    })

    scheduler.schedule("server", "project", "session-1", () => undefined)
    expect(sent).toEqual([])
    await wait(30)
    expect(sent).toEqual(["server:project:session-1:1"])
    scheduler.cancelSession("server", "session-1")
  })

  test("cancels every pending session when a project is read", async () => {
    const sent: string[] = []
    const scheduler = createCompletionReminderScheduler({
      delay: 20,
      send: async (serverScope, directory, sessionID, count) =>
        void sent.push(`${serverScope}:${directory}:${sessionID}:${count}`),
    })

    scheduler.schedule("server", "project", "session-1", () => undefined)
    scheduler.schedule("server", "project", "session-2", () => undefined)
    scheduler.cancelDirectory("server", "project")
    await wait(30)
    expect(sent).toEqual([])
  })

  test("does not resurrect a read notification scheduled late by another window", async () => {
    const sent: string[] = []
    const scheduler = createCompletionReminderScheduler({
      delay: 10,
      readSuppression: 20,
      send: async (serverScope, directory, sessionID, count) =>
        void sent.push(`${serverScope}:${directory}:${sessionID}:${count}`),
    })

    scheduler.cancelSession("server", "session-1")
    scheduler.schedule("server", "project", "session-1", () => undefined)
    await wait(15)
    expect(sent).toEqual([])
  })

  test("repeats every interval until the session is read", async () => {
    const sent: number[] = []
    const scheduler = createCompletionReminderScheduler({
      delay: 10,
      send: async (_serverScope, _directory, _sessionID, count) => void sent.push(count),
    })

    scheduler.schedule("server", "project", "session-1", () => undefined)
    await wait(35)
    expect(sent.slice(0, 2)).toEqual([1, 2])
    scheduler.cancelSession("server", "session-1")
    const count = sent.length
    await wait(20)
    expect(sent).toHaveLength(count)
  })
})
