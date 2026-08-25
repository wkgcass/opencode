import { parseCommentNote, readCommentMetadata } from "@/utils/comment-note"
import type { SessionMessageInfo } from "@opencode-ai/client/promise"
import { AssistantMessage, Part, SessionStatus, UserMessage } from "@opencode-ai/sdk/v2"
import { groupParts, renderable, type PartGroup } from "@opencode-ai/session-ui/message-part"
import { TimelineRow, type CompactionMessage, type SummaryDiff } from "./timeline-row"
import { uniqueSummaryDiffs } from "./summary-diffs"
import { compareMessages } from "@/utils/session-message"

export { TimelineRow, type SummaryDiff } from "./timeline-row"

type SessionCompactionMessage = Extract<SessionMessageInfo, { type: "compaction" }>
type AssistantPartRef = { messageID: string; messageIndex: number; completed: boolean; part: Part }

export type TimelineRowMap = {
  TurnGap: { userMessageID: string }
  CommentStrip: {
    userMessageID: string
  }
  UserMessage: {
    userMessageID: string
    anchor: boolean
  }
  TurnDivider: {
    userMessageID: string
    label: "interrupted"
  }
  Compaction: {
    userMessageID: string
    message: CompactionMessage
  }
  AssistantPart: {
    userMessageID: string
    group: PartGroup
    previousAssistantPart: boolean
  }
  WorkHistory: {
    userMessageID: string
    rows: (TimelineRow.AssistantPart | TimelineRow.TurnDivider)[]
  }
  Thinking: { userMessageID: string; reasoningHeading?: string }
  Retry: { userMessageID: string }
  DiffSummary: { userMessageID: string; diffs: SummaryDiff[] }
  Error: { userMessageID: string; text: string }
}

export namespace Timeline {
  export function constructSessionMessageRows(
    messages: SessionMessageInfo[],
    getMessage: (messageID: string) => UserMessage | AssistantMessage | undefined,
    getMessageParts: (messageID: string) => Part[],
    showReasoning: boolean,
    status: SessionStatus["type"],
    inlineComments: boolean,
    projectedUserMessages: UserMessage[],
  ) {
    const turns: { user: UserMessage; assistants: AssistantMessage[]; compactions: SessionCompactionMessage[] }[] = []
    const turnByUserID = new Map<string, (typeof turns)[number]>()
    let currentTurn: (typeof turns)[number] | undefined
    messages.forEach((message) => {
      if (message.type === "compaction") {
        currentTurn?.compactions.push(message)
        return
      }
      const projected = getMessage(message.id)
      if (message.type === "shell" && projected?.role === "user") {
        const assistant = getMessage(`${message.id}:assistant`)
        const turn = {
          user: projected,
          assistants: assistant?.role === "assistant" ? [assistant] : [],
          compactions: [],
        }
        turns.push(turn)
        turnByUserID.set(projected.id, turn)
        currentTurn = turn
        return
      }
      if (projected?.role === "user") {
        const existing = turnByUserID.get(projected.id)
        if (existing) {
          currentTurn = existing
          return
        }
        const turn = { user: projected, assistants: [], compactions: [] }
        turns.push(turn)
        turnByUserID.set(projected.id, turn)
        currentTurn = turn
        return
      }
      if (projected?.role !== "assistant") return
      const existing = turnByUserID.get(projected.parentID)
      if (existing) {
        existing.assistants.push(projected)
        currentTurn = existing
        return
      }
      const user = getMessage(projected.parentID)
      if (user?.role !== "user") return
      const turn = { user, assistants: [projected], compactions: [] }
      turns.push(turn)
      turnByUserID.set(user.id, turn)
      currentTurn = turn
    })
    projectedUserMessages.forEach((user) => {
      if (turnByUserID.has(user.id)) return
      const turn = { user, assistants: [], compactions: [] }
      const index = turns.findIndex((item) => compareMessages(user, item.user) < 0)
      if (index < 0) turns.push(turn)
      if (index >= 0) turns.splice(index, 0, turn)
      turnByUserID.set(user.id, turn)
    })
    const activeMessageID = turns.at(-1)?.user.id
    return {
      activeMessageID,
      rows: turns.flatMap((turn, index) =>
        constructMessageRows(
          turn.user,
          getMessageParts,
          turn.assistants,
          turn.compactions,
          index,
          showReasoning,
          status,
          turn.user.id === activeMessageID,
          inlineComments,
        ),
      ),
    }
  }

  export function constructMessageRows(
    userMessage: UserMessage,
    getMessageParts: (messageID: string) => Part[],
    assistantMessages: AssistantMessage[],
    compactions: SessionCompactionMessage[],
    index: number,
    showReasoning: boolean,
    status: SessionStatus["type"],
    isActive: boolean,
    // v2 renders comments inside the user message attachments row instead of a strip row
    inlineComments: boolean,
  ) {
    const rows: TimelineRow.TimelineRow[] = []

    const previousUserMessage = index > 0
    const userParts = getMessageParts(userMessage.id)
    const comments = userParts.flatMap((p) => MessageComment.fromPart(p) ?? [])
    const userCompaction = userParts.some((part) => part.type === "compaction")
    const interruptedMessageIndex = assistantMessages.findIndex((m) => m.error?.name === "MessageAbortedError")
    const interrupted = interruptedMessageIndex !== -1
    const latestError = assistantMessages.at(-1)?.error
    const error = latestError?.name === "MessageAbortedError" ? undefined : latestError

    const assistantPartRefs = assistantMessages.flatMap((message, messageIndex) =>
      getMessageParts(message.id).map((part) => ({
        messageID: message.id,
        messageIndex,
        completed: typeof message.time.completed === "number",
        part,
      })),
    )
    const projectedCompactions = projectCompactions({
      userMessageID: userMessage.id,
      userParts,
      assistantPartRefs,
      compactions,
      userCompaction,
      status,
      isActive,
    })
    const visibleAssistantPartRefs = assistantPartRefs.filter(
      (ref) =>
        ref.part.type !== "compaction" &&
        !projectedCompactions.summaryMessageIDs.has(ref.messageID) &&
        renderable(ref.part, showReasoning),
    )
    const compacting = projectedCompactions.messages.some((message) => message.status === "running")
    const assistantItems =
      interrupted && !userCompaction
        ? [
            ...groupParts(visibleAssistantPartRefs.filter((ref) => ref.messageIndex <= interruptedMessageIndex)).map(
              (group) => ({
                type: "part" as const,
                group,
              }),
            ),
            { type: "interrupted" as const },
            ...groupParts(visibleAssistantPartRefs.filter((ref) => ref.messageIndex > interruptedMessageIndex)).map(
              (group) => ({
                type: "part" as const,
                group,
              }),
            ),
          ]
        : groupParts(visibleAssistantPartRefs).map((group) => ({ type: "part" as const, group }))
    if (previousUserMessage) rows.push(new TimelineRow.TurnGap({ userMessageID: userMessage.id }))

    if (comments.length > 0 && !inlineComments)
      rows.push(
        new TimelineRow.CommentStrip({
          userMessageID: userMessage.id,
        }),
      )

    rows.push(
      new TimelineRow.UserMessage({
        userMessageID: userMessage.id,
        anchor: inlineComments || comments.length === 0,
      }),
    )

    rows.push(
      ...projectedCompactions.messages.map(
        (message) =>
          new TimelineRow.Compaction({
            userMessageID: userMessage.id,
            message,
          }),
      ),
    )

    let assistantGroupIndex = 0
    const assistantRows = assistantItems.map((item) => {
      if (item.type === "interrupted") {
        return new TimelineRow.TurnDivider({
          userMessageID: userMessage.id,
          label: "interrupted",
        })
      }

      const row = new TimelineRow.AssistantPart({
        userMessageID: userMessage.id,
        group: item.group,
        previousAssistantPart: assistantGroupIndex > 0,
      })
      assistantGroupIndex += 1
      return row
    })
    const lastAssistantRowIndex = assistantRows.findLastIndex((row) => row._tag === "AssistantPart")
    const historyRows = !isActive || status === "idle" ? assistantRows.slice(0, lastAssistantRowIndex) : []
    const projectedAssistantRows = historyRows.some((row) => row._tag === "AssistantPart")
      ? [
          new TimelineRow.WorkHistory({
            userMessageID: userMessage.id,
            rows: historyRows,
          }),
          ...assistantRows.slice(lastAssistantRowIndex),
        ]
      : assistantRows

    rows.push(...projectedAssistantRows)

    if (
      isActive &&
      status === "busy" &&
      !error &&
      !compacting &&
      (showReasoning ? visibleAssistantPartRefs.length === 0 : true)
    ) {
      const heading = assistantMessages
        .flatMap((message) => getMessageParts(message.id))
        .map((part) => (part.type === "reasoning" && part.text ? reasoningHeading(part.text) : undefined))
        .find((value): value is string => !!value)

      rows.push(
        new TimelineRow.Thinking({
          userMessageID: userMessage.id,
          reasoningHeading: heading,
        }),
      )
    }

    if (isActive && status === "retry") rows.push(new TimelineRow.Retry({ userMessageID: userMessage.id }))

    const diffs = uniqueSummaryDiffs(userMessage.summary?.diffs)
    if (diffs.length > 0 && (status === "idle" || !isActive)) {
      rows.push(
        new TimelineRow.DiffSummary({
          userMessageID: userMessage.id,
          diffs,
        }),
      )
    }

    if (error) {
      const data = error.data?.message
      rows.push(
        new TimelineRow.Error({
          userMessageID: userMessage.id,
          text: unwrapErrorMessage(
            typeof data === "string" ? data : data === undefined || data === null ? "" : String(data),
          ),
        }),
      )
    }

    return rows
  }

  function reasoningHeading(text: string) {
    const markdown = text.replace(/\r\n?/g, "\n")
    const html = markdown.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i)
    if (html?.[1]) {
      const value = cleanHeading(html[1].replace(/<[^>]+>/g, " "))
      if (value) return value
    }

    const atx = markdown.match(/^\s{0,3}#{1,6}[ \t]+(.+?)(?:[ \t]+#+[ \t]*)?$/m)
    if (atx?.[1]) {
      const value = cleanHeading(atx[1])
      if (value) return value
    }

    const setext = markdown.match(/^([^\n]+)\n(?:=+|-+)\s*$/m)
    if (setext?.[1]) {
      const value = cleanHeading(setext[1])
      if (value) return value
    }

    const strong = markdown.match(/^\s*(?:\*\*|__)(.+?)(?:\*\*|__)\s*$/m)
    if (strong?.[1]) {
      const value = cleanHeading(strong[1])
      if (value) return value
    }
  }

  function cleanHeading(value: string) {
    return value
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[*_~]+/g, "")
      .trim()
  }

  function unwrapErrorMessage(message: string) {
    const text = message.replace(/^Error:\s*/, "").trim()

    const parse = (value: string) => {
      try {
        return JSON.parse(value) as unknown
      } catch {
        return undefined
      }
    }

    const read = (value: string) => {
      const first = parse(value)
      if (typeof first !== "string") return first
      return parse(first.trim())
    }

    let json = read(text)

    if (json === undefined) {
      const start = text.indexOf("{")
      const end = text.lastIndexOf("}")
      if (start !== -1 && end > start) json = read(text.slice(start, end + 1))
    }

    if (!record(json)) return message

    const err = record(json.error) ? json.error : undefined
    if (err) {
      const type = typeof err.type === "string" ? err.type : undefined
      const msg = typeof err.message === "string" ? err.message : undefined
      if (type && msg) return `${type}: ${msg}`
      if (msg) return msg
      if (type) return type
      const code = typeof err.code === "string" ? err.code : undefined
      if (code) return code
    }

    const msg = typeof json.message === "string" ? json.message : undefined
    if (msg) return msg

    const reason = typeof json.error === "string" ? json.error : undefined
    if (reason) return reason

    return message
  }

  function record(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value)
  }

  function projectCompactions(input: {
    userMessageID: string
    userParts: Part[]
    assistantPartRefs: AssistantPartRef[]
    compactions: SessionCompactionMessage[]
    userCompaction: boolean
    status: SessionStatus["type"]
    isActive: boolean
  }) {
    const summaryTargets = new Map(
      input.assistantPartRefs.flatMap((ref) => {
        const id = compactionMessageID(ref.part)
        return id ? [[ref.messageID, id] as const] : []
      }),
    )
    const adjacentSummaryMessageID = input.userCompaction
      ? input.assistantPartRefs.find((ref) => ref.part.type === "text")?.messageID
      : undefined
    const summaryMessageIDs = new Set([
      ...summaryTargets.keys(),
      ...(adjacentSummaryMessageID ? [adjacentSummaryMessageID] : []),
    ])
    const summaries = [
      ...input.assistantPartRefs.reduce((result, ref) => {
        if (!summaryMessageIDs.has(ref.messageID) || ref.part.type !== "text") return result
        const id = summaryTargets.get(ref.messageID) ?? input.userMessageID
        const current = result.get(id)
        result.set(id, {
          summary: current ? `${current.summary}\n${ref.part.text}` : ref.part.text,
          completed: (current?.completed ?? true) && ref.completed,
        })
        return result
      }, new Map<string, { summary: string; completed: boolean }>()),
    ].map(([id, summary]) => ({ id, ...summary }))
    const availableSummaries = new Map(summaries.map((summary) => [summary.id, summary]))
    const onlySummary = summaries.length === 1 ? summaries[0] : undefined
    const matchedSummaries = new Set<string>()
    const source = input.compactions.map((message): CompactionMessage => {
      const exact = availableSummaries.get(message.id)
      const summary = exact ?? (input.compactions.length === 1 ? onlySummary : undefined)
      if (summary) matchedSummaries.add(summary.id)
      return {
        id: message.id,
        status: summary?.completed ? "completed" : message.status,
        summary: summary?.summary ?? ("summary" in message ? message.summary : ""),
      }
    })
    const markerIDs = input.compactions.length
      ? []
      : [
          ...new Set([
            ...input.userParts.filter((part) => part.type === "compaction").map((part) => part.messageID),
            ...input.assistantPartRefs.filter((ref) => ref.part.type === "compaction").map((ref) => ref.messageID),
          ]),
        ]
    const markers = markerIDs.map((id): CompactionMessage => {
      const exact = availableSummaries.get(id)
      const summary = exact ?? (markerIDs.length === 1 ? onlySummary : undefined)
      if (summary) matchedSummaries.add(summary.id)
      return {
        id,
        status: summary?.completed || input.status === "idle" || !input.isActive ? "completed" : "running",
        summary: summary?.summary ?? "",
      }
    })
    return {
      summaryMessageIDs,
      messages: [
        ...source,
        ...markers,
        ...summaries
          .filter((summary) => !matchedSummaries.has(summary.id))
          .map(
            (summary): CompactionMessage => ({
              id: summary.id,
              status: summary.completed ? "completed" : "running",
              summary: summary.summary,
            }),
          ),
      ],
    }
  }

  function compactionMessageID(part: Part) {
    if (part.type !== "text") return undefined
    const metadata = record(part.metadata) ? part.metadata : undefined
    const compaction = record(metadata?.compaction) ? metadata.compaction : undefined
    return typeof compaction?.messageID === "string" ? compaction.messageID : undefined
  }
}

export namespace MessageComment {
  export type MessageComment = {
    path: string
    comment: string
    selection?: {
      startLine: number
      endLine: number
    }
  }

  export const fromPart = (part: Part): MessageComment | undefined => {
    if (part.type !== "text" || !part.synthetic) return
    const next = readCommentMetadata(part.metadata) ?? parseCommentNote(part.text)
    if (!next) return
    return {
      path: next.path,
      comment: next.comment,
      selection: next.selection
        ? {
            startLine: next.selection.startLine,
            endLine: next.selection.endLine,
          }
        : undefined,
    }
  }
}
