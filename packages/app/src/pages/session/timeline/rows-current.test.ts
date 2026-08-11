import { describe, expect, mock, test } from "bun:test"
import type { SessionMessageInfo } from "@opencode-ai/client/promise"
import type { Part } from "@opencode-ai/sdk/v2"
import { normalizeSessionMessages } from "@/utils/session-message"

mock.module("@opencode-ai/session-ui/message-part", () => ({
  renderable: () => true,
  groupParts: (refs: Array<{ messageID: string; part: { id: string } }>) =>
    refs.map((ref) => ({
      type: "part" as const,
      key: ref.part.id,
      ref: { messageID: ref.messageID, partID: ref.part.id },
    })),
}))

const { Timeline, TimelineRow } = await import("./rows")

describe("current session timeline rows", () => {
  test("derives turns and tagged rows from chronological current messages", () => {
    const source = [
      { id: "msg_1", type: "user", text: "first", time: { created: 1 } },
      {
        id: "msg_2",
        type: "assistant",
        agent: "build",
        model: { id: "model", providerID: "provider" },
        content: [{ type: "text", text: "answer" }],
        time: { created: 2, completed: 3 },
      },
      { id: "msg_3", type: "user", text: "second", time: { created: 4 } },
      {
        id: "msg_4",
        type: "assistant",
        agent: "build",
        model: { id: "model", providerID: "provider" },
        content: [{ type: "reasoning", text: "working" }],
        time: { created: 5 },
      },
    ] satisfies SessionMessageInfo[]
    const normalized = normalizeSessionMessages("ses_1", source)
    const messages = new Map(normalized.messages.map((message) => [message.id, message]))

    const result = Timeline.constructSessionMessageRows(
      source,
      (messageID) => messages.get(messageID),
      (messageID) => normalized.parts.get(messageID) ?? [],
      true,
      "busy",
      true,
      normalized.messages.filter((message) => message.role === "user"),
    )

    expect(result.activeMessageID).toBe("msg_3")
    expect(result.rows.map(TimelineRow.key)).toEqual([
      "user-message:msg_1",
      "assistant-part:msg_1:msg_2:text:0",
      "turn-gap:msg_3",
      "user-message:msg_3",
      "assistant-part:msg_3:msg_4:reasoning:0",
    ])
  })

  test("projects compaction progress into one stable row", () => {
    const running = [
      { id: "msg_user", type: "user", text: "question", time: { created: 1 } },
      {
        id: "msg_compaction",
        type: "compaction",
        status: "running",
        reason: "auto",
        summary: "partial",
        recent: "recent",
        time: { created: 2 },
      },
    ] satisfies SessionMessageInfo[]
    const runningNormalized = normalizeSessionMessages("ses_1", running)
    const runningMessages = new Map(runningNormalized.messages.map((message) => [message.id, message]))
    const runningResult = Timeline.constructSessionMessageRows(
      running,
      (messageID) => runningMessages.get(messageID),
      (messageID) => runningNormalized.parts.get(messageID) ?? [],
      true,
      "busy",
      true,
      runningNormalized.messages.filter((message) => message.role === "user"),
    )

    expect(runningResult.rows.map(TimelineRow.key)).toEqual(["user-message:msg_user", "compaction:msg_compaction"])
    expect(runningResult.rows[1]).toMatchObject({
      _tag: "Compaction",
      message: { status: "running", summary: "partial" },
    })

    const completed = [
      { id: "msg_user", type: "user", text: "question", time: { created: 1 } },
      {
        id: "msg_compaction",
        type: "compaction",
        status: "completed",
        reason: "auto",
        summary: "final summary",
        recent: "recent",
        time: { created: 2 },
      },
    ] satisfies SessionMessageInfo[]
    const completedNormalized = normalizeSessionMessages("ses_1", completed)
    const completedMessages = new Map(completedNormalized.messages.map((message) => [message.id, message]))
    const completedResult = Timeline.constructSessionMessageRows(
      completed,
      (messageID) => completedMessages.get(messageID),
      (messageID) => completedNormalized.parts.get(messageID) ?? [],
      true,
      "idle",
      true,
      completedNormalized.messages.filter((message) => message.role === "user"),
    )

    expect(completedResult.rows.map(TimelineRow.key)).toEqual(["user-message:msg_user", "compaction:msg_compaction"])
    expect(completedResult.rows[1]).toMatchObject({
      _tag: "Compaction",
      message: { status: "completed", summary: "final summary" },
    })
  })

  test("moves metadata-tagged compaction output into the compaction row", () => {
    const source = [
      { id: "msg_user", type: "user", text: "question", time: { created: 1 } },
      {
        id: "msg_compaction",
        type: "assistant",
        agent: "compaction",
        model: { id: "default", providerID: "pi" },
        content: [],
        time: { created: 2, completed: 2 },
      },
      {
        id: "msg_summary",
        type: "assistant",
        agent: "compaction",
        model: { id: "default", providerID: "pi" },
        content: [],
        time: { created: 3, completed: 3 },
      },
    ] satisfies SessionMessageInfo[]
    const normalized = normalizeSessionMessages("ses_1", source)
    const messages = new Map(normalized.messages.map((message) => [message.id, message]))
    const parts = new Map<string, Part[]>([
      [
        "msg_compaction",
        [
          {
            id: "prt_compaction",
            sessionID: "ses_1",
            messageID: "msg_compaction",
            type: "compaction",
            auto: true,
          },
        ],
      ],
      [
        "msg_summary",
        [
          {
            id: "prt_summary",
            sessionID: "ses_1",
            messageID: "msg_summary",
            type: "text",
            text: "## Summary\nPreserve the current task.",
            metadata: { compaction: { messageID: "msg_compaction" } },
          },
          {
            id: "prt_summary_more",
            sessionID: "ses_1",
            messageID: "msg_summary",
            type: "text",
            text: "Additional compacted context.",
          },
          {
            id: "prt_summary_reasoning",
            sessionID: "ses_1",
            messageID: "msg_summary",
            type: "reasoning",
            text: "Internal compaction reasoning",
            time: { start: 2, end: 3 },
          },
        ],
      ],
    ])

    const result = Timeline.constructSessionMessageRows(
      source,
      (messageID) => messages.get(messageID),
      (messageID) => parts.get(messageID) ?? normalized.parts.get(messageID) ?? [],
      true,
      "idle",
      true,
      normalized.messages.filter((message) => message.role === "user"),
    )

    expect(result.rows.map(TimelineRow.key)).toEqual(["user-message:msg_user", "compaction:msg_compaction"])
    expect(result.rows.find((row) => row._tag === "Compaction")).toMatchObject({
      _tag: "Compaction",
      message: {
        status: "completed",
        summary: "## Summary\nPreserve the current task.\nAdditional compacted context.",
      },
    })
  })

  test("treats the same-parent assistant as summary when a native compaction is also projected", () => {
    const source = [
      { id: "msg_compaction_user", type: "user", text: "Conversation compacted", time: { created: 1 } },
      {
        id: "msg_compaction_event",
        type: "compaction",
        status: "completed",
        reason: "manual",
        summary: "",
        recent: "",
        time: { created: 2 },
      },
      {
        id: "msg_summary",
        type: "assistant",
        agent: "pi",
        model: { id: "default", providerID: "pi" },
        content: [],
        time: { created: 3, completed: 4 },
      },
    ] satisfies SessionMessageInfo[]
    const normalized = normalizeSessionMessages("ses_1", source)
    const messages = new Map(normalized.messages.map((message) => [message.id, message]))
    const parts = new Map<string, Part[]>([
      [
        "msg_compaction_user",
        [
          {
            id: "msg_compaction_user:text:0",
            sessionID: "ses_1",
            messageID: "msg_compaction_user",
            type: "text",
            text: "Conversation compacted",
            synthetic: true,
          },
          {
            id: "msg_compaction:compaction",
            sessionID: "ses_1",
            messageID: "msg_compaction_user",
            type: "compaction",
            auto: false,
          },
        ],
      ],
      [
        "msg_summary",
        [
          {
            id: "prt_summary",
            sessionID: "ses_1",
            messageID: "msg_summary",
            type: "text",
            text: "## Summary\nContinue from the compacted context.",
          },
          {
            id: "prt_summary_reasoning",
            sessionID: "ses_1",
            messageID: "msg_summary",
            type: "reasoning",
            text: "Internal compaction reasoning",
            time: { start: 3, end: 4 },
          },
        ],
      ],
    ])

    const result = Timeline.constructSessionMessageRows(
      source,
      (messageID) => messages.get(messageID),
      (messageID) => parts.get(messageID) ?? normalized.parts.get(messageID) ?? [],
      true,
      "idle",
      true,
      normalized.messages.filter((message) => message.role === "user"),
    )

    expect(result.rows.map(TimelineRow.key)).toEqual([
      "user-message:msg_compaction_user",
      "compaction:msg_compaction_event",
    ])
    expect(result.rows.find((row) => row._tag === "Compaction")).toMatchObject({
      _tag: "Compaction",
      message: {
        status: "completed",
        summary: "## Summary\nContinue from the compacted context.",
      },
    })
  })

  test("renders a current shell message as a standalone turn", () => {
    const source = [
      {
        id: "msg_shell",
        type: "shell",
        shellID: "shell_1",
        command: "pwd",
        status: "exited",
        exit: 0,
        output: { output: "/repo", cursor: 5, size: 5, truncated: false },
        time: { created: 1, completed: 2 },
      },
    ] satisfies SessionMessageInfo[]
    const normalized = normalizeSessionMessages("ses_1", source)
    const messages = new Map(normalized.messages.map((message) => [message.id, message]))

    const result = Timeline.constructSessionMessageRows(
      source,
      (messageID) => messages.get(messageID),
      (messageID) => normalized.parts.get(messageID) ?? [],
      true,
      "idle",
      true,
      normalized.messages.filter((message) => message.role === "user"),
    )

    expect(result.activeMessageID).toBe("msg_shell")
    expect(result.rows.map(TimelineRow.key)).toEqual([
      "user-message:msg_shell",
      "assistant-part:msg_shell:msg_shell:tool",
    ])
  })

  test("keeps a projected parent missing from the source page before newer turns", () => {
    const source = [
      { id: "msg_user_1", type: "user", text: "first question", time: { created: 1 } },
      {
        id: "msg_assistant_1",
        type: "assistant",
        agent: "build",
        model: { id: "model", providerID: "provider" },
        content: [{ type: "text", text: "first answer" }],
        time: { created: 2, completed: 3 },
      },
      { id: "msg_user_2", type: "user", text: "second question", time: { created: 4 } },
      {
        id: "msg_assistant_2",
        type: "assistant",
        agent: "build",
        model: { id: "model", providerID: "provider" },
        content: [{ type: "text", text: "second answer" }],
        time: { created: 5, completed: 6 },
      },
    ] satisfies SessionMessageInfo[]
    const normalized = normalizeSessionMessages("ses_1", source)
    const messages = new Map(normalized.messages.map((message) => [message.id, message]))

    const result = Timeline.constructSessionMessageRows(
      source.slice(1),
      (messageID) => messages.get(messageID),
      (messageID) => normalized.parts.get(messageID) ?? [],
      true,
      "idle",
      true,
      normalized.messages.filter((message) => message.role === "user"),
    )

    expect(result.rows.map(TimelineRow.key)).toEqual([
      "user-message:msg_user_1",
      "assistant-part:msg_user_1:msg_assistant_1:text:0",
      "turn-gap:msg_user_2",
      "user-message:msg_user_2",
      "assistant-part:msg_user_2:msg_assistant_2:text:0",
    ])
  })

  test("renders an optimistic user turn and thinking before the protocol message arrives", () => {
    const source = [
      { id: "msg_1", type: "user", text: "existing", time: { created: 1 } },
    ] satisfies SessionMessageInfo[]
    const normalized = normalizeSessionMessages("ses_1", source)
    const optimistic = {
      id: "msg_2",
      sessionID: "ses_1",
      role: "user" as const,
      time: { created: 2 },
      agent: "build",
      model: { modelID: "model", providerID: "provider" },
    }
    const result = Timeline.constructSessionMessageRows(
      source,
      (messageID) =>
        messageID === optimistic.id ? optimistic : normalized.messages.find((message) => message.id === messageID),
      () => [],
      true,
      "busy",
      true,
      [...normalized.messages.filter((message) => message.role === "user"), optimistic],
    )

    expect(result.activeMessageID).toBe(optimistic.id)
    expect(result.rows.map(TimelineRow.key)).toEqual([
      "user-message:msg_1",
      "turn-gap:msg_2",
      "user-message:msg_2",
      "thinking:msg_2",
    ])
  })

  test("folds completed assistant messages before the final message into work history", () => {
    const source = [
      { id: "msg_user", type: "user", text: "question", time: { created: 1 } },
      {
        id: "msg_assistant",
        type: "assistant",
        agent: "build",
        model: { id: "model", providerID: "provider" },
        content: [
          { type: "reasoning", text: "working" },
          { type: "text", text: "answer" },
        ],
        time: { created: 2, completed: 3 },
      },
    ] satisfies SessionMessageInfo[]
    const normalized = normalizeSessionMessages("ses_1", source)
    const messages = new Map(normalized.messages.map((message) => [message.id, message]))

    const result = Timeline.constructSessionMessageRows(
      source,
      (messageID) => messages.get(messageID),
      (messageID) => normalized.parts.get(messageID) ?? [],
      true,
      "idle",
      true,
      normalized.messages.filter((message) => message.role === "user"),
    )

    expect(result.rows.map(TimelineRow.key)).toEqual([
      "user-message:msg_user",
      "work-history:msg_user",
      "assistant-part:msg_user:msg_assistant:text:0",
    ])
    const history = result.rows.find((row) => row._tag === "WorkHistory")
    expect(history?.rows.map(TimelineRow.key)).toEqual(["assistant-part:msg_user:msg_assistant:reasoning:0"])
  })

  test("keeps every assistant message visible while the output is active", () => {
    const source = [
      { id: "msg_user", type: "user", text: "question", time: { created: 1 } },
      {
        id: "msg_assistant",
        type: "assistant",
        agent: "build",
        model: { id: "model", providerID: "provider" },
        content: [
          { type: "reasoning", text: "working" },
          { type: "text", text: "partial answer" },
        ],
        time: { created: 2 },
      },
    ] satisfies SessionMessageInfo[]
    const normalized = normalizeSessionMessages("ses_1", source)
    const messages = new Map(normalized.messages.map((message) => [message.id, message]))

    const result = Timeline.constructSessionMessageRows(
      source,
      (messageID) => messages.get(messageID),
      (messageID) => normalized.parts.get(messageID) ?? [],
      true,
      "busy",
      true,
      normalized.messages.filter((message) => message.role === "user"),
    )

    expect(result.rows.map(TimelineRow.key)).toEqual([
      "user-message:msg_user",
      "assistant-part:msg_user:msg_assistant:reasoning:0",
      "assistant-part:msg_user:msg_assistant:text:0",
    ])
  })
})
