import { expect, test } from "@playwright/test"
import {
  assistantMessage,
  partDelta,
  partUpdated,
  reasoningPart,
  setupTimeline,
  status,
  textPart,
  toolPart,
  userMessage,
} from "../performance/timeline-stability/fixture"

const profiles = [
  { name: "summaries off no reasoning", summaries: false, reasoning: "", other: false, thinking: true, body: false },
  {
    name: "summaries off reasoning heading",
    summaries: false,
    reasoning: "## Inspecting stability",
    other: false,
    thinking: true,
    body: false,
  },
  {
    name: "summaries off with visible tool",
    summaries: false,
    reasoning: "## Inspecting stability",
    other: true,
    thinking: true,
    body: false,
  },
  { name: "summaries on no content", summaries: true, reasoning: "", other: false, thinking: true, body: false },
  {
    name: "summaries on blank reasoning",
    summaries: true,
    reasoning: "   ",
    other: false,
    thinking: true,
    body: false,
  },
  {
    name: "summaries on visible reasoning",
    summaries: true,
    reasoning: "## Inspecting stability",
    other: false,
    thinking: false,
    body: true,
  },
  {
    name: "summaries on visible tool no reasoning",
    summaries: true,
    reasoning: "",
    other: true,
    thinking: false,
    body: false,
  },
] as const

function reasoningTimelineMessages(reasoningID: string, reasoningCompleted: boolean) {
  return [
    userMessage(undefined, { id: "msg_reasoning_previous_user", created: 1699999990000 }),
    assistantMessage(
      [
        textPart(
          "prt_reasoning_previous_text",
          Array.from({ length: 8 }, (_, index) => `Previous response ${index}`).join("\n\n"),
        ),
      ],
      {
        id: "msg_reasoning_previous_assistant",
        parentID: "msg_reasoning_previous_user",
        created: 1699999991000,
      },
    ),
    userMessage(),
    assistantMessage(
      [
        {
          ...reasoningPart(
            reasoningID,
            Array.from({ length: 100 }, (_, index) => `Reasoning line ${index}`).join("\n\n"),
          ),
          time: { start: 1700000001000, ...(reasoningCompleted ? { end: 1700000002000 } : {}) },
        },
      ],
      { completed: false },
    ),
  ]
}

for (const profile of profiles) {
  test(`projects busy reasoning profile ${profile.name}`, async ({ page }) => {
    const reasoningID = `prt_reasoning_matrix_${profiles.indexOf(profile)}`
    const parts = [
      ...(profile.reasoning ? [reasoningPart(reasoningID, profile.reasoning)] : []),
      ...(profile.other
        ? [toolPart(`prt_reasoning_tool_${profiles.indexOf(profile)}`, "skill", "running", { name: "inspect" })]
        : []),
    ]
    const timeline = await setupTimeline(page, {
      messages: [userMessage(), assistantMessage(parts, { completed: false })],
      settings: { showReasoningSummaries: profile.summaries },
    })
    await timeline.send(status("busy"), 150)

    await expect(page.locator('[data-timeline-row="Thinking"]')).toHaveCount(profile.thinking ? 1 : 0)
    await expect(page.locator(`[data-timeline-part-id="${reasoningID}"]`)).toHaveCount(profile.body ? 1 : 0)
    if (!profile.summaries && profile.reasoning.trim()) {
      await expect(page.getByText("Inspecting stability", { exact: true })).toBeVisible()
    }
  })
}

test("does not infer reasoning visibility from provider identity", async ({ page }) => {
  const timeline = await setupTimeline(page, {
    messages: [
      userMessage(),
      assistantMessage([textPart("prt_provider_text", "No reasoning payload")], { completed: false }),
    ],
    settings: { showReasoningSummaries: true },
  })
  await timeline.send(status("busy"), 150)

  await expect(page.locator('[data-timeline-row="Thinking"]')).toHaveCount(0)
  await expect(page.locator('[data-timeline-part-id*="reasoning"]')).toHaveCount(0)
  await expect(page.locator('[data-timeline-part-id="prt_provider_text"]')).toBeVisible()
})

test("reasoning is collapsed into a bounded scrollable panel", async ({ page }) => {
  const reasoningID = "prt_reasoning_collapsible"
  const timeline = await setupTimeline(page, {
    messages: reasoningTimelineMessages(reasoningID, true),
    settings: { showReasoningSummaries: true },
    locale: "zh",
  })
  await timeline.send(status("busy"), 150)

  const reasoning = page.locator(`[data-timeline-part-id="${reasoningID}"]`)
  const trigger = reasoning.locator('[data-slot="collapsible-trigger"]')
  const content = reasoning.locator('[data-slot="reasoning-part-content"]')
  const viewport = page.locator(".scroll-view__viewport").filter({ has: reasoning })

  await viewport.evaluate((element) => element.parentElement?.style.setProperty("height", "500px"))
  await expect(trigger).toHaveAttribute("aria-expanded", "false")
  await expect(trigger).toContainText("已思考")
  await expect(content).toBeHidden()

  await trigger.click()

  await expect(trigger).toHaveAttribute("aria-expanded", "true")
  await expect(content).toBeVisible()
  await expect(content).toHaveCSS("max-height", "350px")
  await expect(content).toHaveCSS("overflow-y", "auto")
  expect(await content.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true)
  await expect
    .poll(async () => {
      const [reasoningBox, viewportBox] = await Promise.all([reasoning.boundingBox(), viewport.boundingBox()])
      if (!reasoningBox || !viewportBox) return Number.POSITIVE_INFINITY
      return Math.abs(reasoningBox.y + reasoningBox.height - (viewportBox.y + viewportBox.height - 10))
    })
    .toBeLessThan(2)

  await trigger.click()

  await expect(trigger).toHaveAttribute("aria-expanded", "false")
  await expect(content).toBeHidden()

  await viewport.evaluate((element) => element.parentElement?.style.setProperty("height", "260px"))
  await trigger.scrollIntoViewIfNeeded()
  await trigger.click()

  await expect(trigger).toHaveAttribute("aria-expanded", "true")
  await expect
    .poll(async () => {
      return viewport.evaluate((element) => {
        const trigger = element.querySelector<HTMLElement>('[data-slot="collapsible-trigger"][aria-expanded="true"]')
        const header = element.querySelector<HTMLElement>("[data-session-title]")
        if (!trigger) return Number.POSITIVE_INFINITY
        const viewportRect = element.getBoundingClientRect()
        const top = header ? Math.max(viewportRect.top, header.getBoundingClientRect().bottom) : viewportRect.top
        return Math.abs(trigger.getBoundingClientRect().top - top)
      })
    })
    .toBeLessThan(2)
})

test("streaming reasoning stays collapsed with a live current-line summary", async ({ page }) => {
  const reasoningID = "prt_reasoning_streaming"
  const timeline = await setupTimeline(page, {
    messages: reasoningTimelineMessages(reasoningID, false),
    settings: { showReasoningSummaries: true },
  })
  await timeline.send(status("busy"), 150)

  const reasoning = page.locator(`[data-timeline-part-id="${reasoningID}"]`)
  const trigger = reasoning.locator('[data-slot="collapsible-trigger"]')
  const title = reasoning.locator('[data-slot="reasoning-part-title"]')
  const arrow = reasoning.locator('[data-slot="collapsible-arrow"]')
  const summary = reasoning.locator('[data-slot="reasoning-part-summary"]')
  const summaryShimmer = summary.locator('[data-component="text-shimmer"]')
  const content = reasoning.locator('[data-slot="reasoning-part-content"]')
  const viewport = page.locator(".scroll-view__viewport").filter({ has: reasoning })

  await viewport.evaluate((element) => element.parentElement?.style.setProperty("height", "500px"))
  await viewport.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })

  await expect(trigger).toHaveAttribute("aria-expanded", "false")
  await expect(trigger).toContainText("Thinking")
  await expect(summaryShimmer).toHaveAttribute("aria-label", "Reasoning line 99")
  await expect(content).toBeHidden()
  await expect(trigger).toHaveCSS("justify-content", "flex-start")
  await expect(summary).toHaveCSS("text-align", "left")
  await expect(title.locator('[data-component="text-shimmer"]')).toHaveAttribute("data-active", "true")
  await expect(summaryShimmer).toHaveAttribute("data-active", "true")
  const fonts = await Promise.all(
    [title, summary].map((element) =>
      element.evaluate((node) => {
        const style = getComputedStyle(node)
        return [style.fontFamily, style.fontSize, style.fontWeight, style.lineHeight]
      }),
    ),
  )
  expect(fonts[1]).toEqual(fonts[0])

  const positions = await Promise.all(
    [title, arrow, summary].map((element) => element.boundingBox().then((box) => box?.x ?? Number.POSITIVE_INFINITY)),
  )
  expect(positions[0]).toBeLessThan(positions[1])
  expect(positions[1]).toBeLessThan(positions[2])
  const [triggerBox, titleBox] = await Promise.all([trigger.boundingBox(), title.boundingBox()])
  expect(Math.abs((triggerBox?.x ?? 0) - (titleBox?.x ?? Number.POSITIVE_INFINITY))).toBeLessThan(1)

  await timeline.send(partDelta(reasoningID, "\n   Fresh streaming line"))

  await expect(summaryShimmer).toHaveAttribute("aria-label", "Fresh streaming line")
  await expect.poll(() => summary.evaluate((element) => element.scrollLeft)).toBe(0)

  await timeline.send(partDelta(reasoningID, " " + "long ".repeat(200) + "visible tail"))

  await expect(summaryShimmer).toHaveAttribute("aria-label", /visible tail$/)
  await expect
    .poll(() => summary.evaluate((element) => element.scrollWidth - element.clientWidth - element.scrollLeft))
    .toBeLessThan(2)

  await timeline.send(partDelta(reasoningID, "\nNext line"))

  await expect(summaryShimmer).toHaveAttribute("aria-label", "Next line")
  await expect.poll(() => summary.evaluate((element) => element.scrollLeft)).toBe(0)

  await timeline.send(partDelta(reasoningID, " updated"))

  await expect(summaryShimmer).toHaveAttribute("aria-label", "Next line updated")

  await trigger.click()

  await expect(trigger).toHaveAttribute("aria-expanded", "true")
  await expect(summary).toBeHidden()
  await expect(content).toBeVisible()
  await expect
    .poll(() => viewport.evaluate((element) => element.scrollHeight - element.clientHeight - element.scrollTop))
    .toBeLessThan(2)
  await expect
    .poll(() => content.evaluate((element) => element.scrollHeight - element.clientHeight - element.scrollTop))
    .toBeLessThan(2)

  const previousHeight = await content.evaluate((element) => element.scrollHeight)
  await timeline.send(
    partDelta(
      reasoningID,
      "\n\n" + Array.from({ length: 20 }, (_, index) => `New streaming reasoning line ${index}`).join("\n\n"),
    ),
  )

  await expect(content).toContainText("New streaming reasoning line 19")
  await expect.poll(() => content.evaluate((element) => element.scrollHeight)).toBeGreaterThan(previousHeight)
  await expect
    .poll(() => content.evaluate((element) => element.scrollHeight - element.clientHeight - element.scrollTop))
    .toBeLessThan(2)
  await expect
    .poll(() => viewport.evaluate((element) => element.scrollHeight - element.clientHeight - element.scrollTop))
    .toBeLessThan(2)

  await content.evaluate((element) => {
    element.dispatchEvent(new WheelEvent("wheel", { deltaY: -100, bubbles: true }))
    element.scrollTop = 0
    element.dispatchEvent(new Event("scroll"))
  })
  await timeline.send(
    partDelta(
      reasoningID,
      "\n\n" + Array.from({ length: 20 }, (_, index) => `Paused reasoning line ${index}`).join("\n\n"),
    ),
  )

  await expect(content).toContainText("Paused reasoning line 19")
  await expect.poll(() => content.evaluate((element) => element.scrollTop)).toBeLessThan(2)

  await content.evaluate((element) => {
    element.scrollTop = element.scrollHeight
    element.dispatchEvent(new Event("scroll"))
  })
  await timeline.send(partDelta(reasoningID, "\n\nFollowing resumed"))

  await expect(content).toContainText("Following resumed")
  await expect
    .poll(() => content.evaluate((element) => element.scrollHeight - element.clientHeight - element.scrollTop))
    .toBeLessThan(2)

  await timeline.send(
    partUpdated({
      ...reasoningPart(reasoningID, "Completed reasoning"),
      time: { start: 1700000001000, end: 1700000002000 },
    }),
  )

  await expect(trigger).toContainText("Thought")
  await expect(trigger).toHaveAttribute("aria-expanded", "false")
  await expect(content).toBeHidden()
})
