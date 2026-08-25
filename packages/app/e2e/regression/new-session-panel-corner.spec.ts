import { expect, test } from "@playwright/test"
import { readFile } from "node:fs/promises"
import { mockOpenCodeServer } from "../utils/mock-server"
import { expectAppVisible } from "../utils/waits"

const draftID = "draft_new_session_panel_corner"
const directory = "C:/OpenCode/NewSessionPanelCorner"
const server = `http://${process.env.PLAYWRIGHT_SERVER_HOST ?? "127.0.0.1"}:${process.env.PLAYWRIGHT_SERVER_PORT ?? "4096"}`

test.use({
  viewport: { width: 935, height: 522 },
  deviceScaleFactor: 1,
})

test("fits the desktop bounds with only a rounded top-left corner", async ({ page }) => {
  await mockOpenCodeServer(page, {
    directory,
    project: {
      id: "proj_new_session_panel_corner",
      worktree: directory,
      vcs: "git",
      name: "new-session-panel-corner",
      time: { created: 1700000000000, updated: 1700000000000 },
      sandboxes: [],
    },
    provider: { all: [], connected: [], default: {} },
    sessions: [],
    pageMessages: () => ({ items: [] }),
  })
  await page.addInitScript(
    ({ directory, draftID, server }) => {
      localStorage.setItem("settings.v3", JSON.stringify({ general: { newLayoutDesigns: true } }))
      localStorage.setItem("opencode-theme-id", "oc-2")
      localStorage.setItem("opencode-color-scheme", "dark")
      localStorage.setItem(
        "opencode.global.dat:server",
        JSON.stringify({
          projects: { local: [{ worktree: directory, expanded: true }] },
          lastProject: { local: directory },
        }),
      )
      localStorage.setItem(
        "opencode.window.browser.dat:tabs",
        JSON.stringify([{ type: "draft", draftID, server, directory }]),
      )
    },
    { directory, draftID, server },
  )

  await page.goto(`/new-session?draftId=${draftID}`)
  await page.locator("html").evaluate((element) => {
    element.dataset.opencodeDesktop = "true"
  })
  await page.addStyleTag({ content: await readFile("../desktop/src/renderer/codex-workspace.css", "utf8") })
  await expectAppVisible(page.locator('[data-component="prompt-input"]'))
  await expect(page.locator("html")).toHaveAttribute("data-color-scheme", "dark")
  const shell = page.locator('[data-slot="new-session-panel-shell"]')
  const panel = page.locator('[data-component="session-new-design"]')
  await expect(shell).toHaveCSS("padding", "0px")
  await expect(panel).toHaveCount(1)
  await expect(panel).toHaveCSS("border-top-left-radius", "24px")
  await expect(panel).toHaveCSS("border-top-right-radius", "0px")
  await expect(panel).toHaveCSS("border-bottom-right-radius", "0px")
  await expect(panel).toHaveCSS("border-bottom-left-radius", "0px")
  const shellBox = await shell.boundingBox()
  const box = await panel.boundingBox()
  if (!shellBox) throw new Error("New-session shell bounds are unavailable")
  if (!box) throw new Error("New-session panel bounds are unavailable")
  expect(box).toEqual(shellBox)
})
