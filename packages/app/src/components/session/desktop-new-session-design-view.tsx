import { createMemo, Show, type JSX } from "solid-js"
import { useSearchParams } from "@solidjs/router"
import { useGlobal } from "@/context/global"
import { useLanguage } from "@/context/language"
import { useLayout } from "@/context/layout"
import { useSDK } from "@/context/sdk"
import { ServerConnection } from "@/context/server"
import { useSkin } from "@/context/skin"
import { useSync } from "@/context/sync"
import { useTabs, type DraftTab } from "@/context/tabs"
import { displayName } from "@/pages/layout/helpers"
import { NEW_SESSION_CONTENT_WIDTH } from "@/pages/session/new-session-layout"

export function DesktopNewSessionDesignView(props: { children: JSX.Element }) {
  const global = useGlobal()
  const language = useLanguage()
  const layout = useLayout()
  const sdk = useSDK()
  const skin = useSkin()
  const sync = useSync()
  const tabs = useTabs()
  const [searchParams] = useSearchParams<{ draftId?: string }>()
  const projectName = createMemo(() => {
    const draft = tabs.store.find(
      (item): item is DraftTab => item.type === "draft" && item.draftID === searchParams.draftId,
    )
    const directory = draft?.directory ?? sdk().directory ?? layout.home.selection().directory ?? ""
    const conn = draft ? global.servers.list().find((item) => ServerConnection.key(item) === draft.server) : undefined
    const project = conn
      ? global
          .ensureServerCtx(conn)
          .projects.list()
          .find((item) => item.worktree === directory || item.sandboxes?.includes(directory))
      : undefined
    if (project) return displayName(project)
    const synced = sync().project
    if (synced?.worktree === directory) return displayName(synced)
    const selected = layout.home.selection().directory
    const fallback = layout.projects.list().find((item) => item.worktree === selected)
    return displayName(fallback ?? { worktree: directory || selected || "opencode" })
  })
  const prompt = () => {
    if (skin.id() === "deepseek-harness") {
      if (language.locale() === "zh") return ["探索未至之境", ""]
      if (language.locale() === "zht") return ["探索未至之境", ""]
      return ["Explore beyond the horizon", ""]
    }
    if (skin.id() === "su7-ultra") {
      if (language.locale() === "zh") return ["让 ", " 的下一次提交，快过上一圈。"]
      if (language.locale() === "zht") return ["讓 ", " 的下一次提交，快過上一圈。"]
      return ["Make ", "'s next commit its fastest lap yet."]
    }
    if (skin.id() === "yu7-gt") {
      if (language.locale() === "zh") return ["让 ", " 的代码，突破圈速。"]
      if (language.locale() === "zht") return ["讓 ", " 的程式碼，突破圈速。"]
      return ["Push ", "'s code beyond the lap record."]
    }
    if (language.locale() === "zh") return ["我们应该在 ", " 中构建什么？"]
    if (language.locale() === "zht") return ["我們應該在 ", " 中建構什麼？"]
    return ["What should we build in ", "?"]
  }

  return (
    <div data-component="desktop-new-session-design" class="relative size-full overflow-hidden">
      <div
        data-component="desktop-new-session-hero"
        class="absolute inset-x-0 top-[31%] flex flex-col items-center gap-7 px-6 text-center"
      >
        <svg
          data-component="desktop-new-session-glyph"
          class="size-12 text-v2-icon-icon-muted"
          viewBox="0 0 48 48"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M24 4.5c4.1 0 7.5 2.4 9 5.8 3.7-.5 7.5 1.5 9.2 5 1.8 3.7.8 8-2 10.7 1.7 3.4 1 7.7-2.1 10.5-3 2.8-7.5 3.1-10.8 1.1-2.6 2.8-7 3.6-10.5 1.8-3.6-1.8-5.6-5.8-4.8-9.6-3.7-1.4-6.4-4.9-6.4-9 0-4.2 2.8-7.8 6.7-9.1C13.1 7.5 18.2 4.5 24 4.5Z"
            stroke="currentColor"
            stroke-width="3"
            stroke-linejoin="round"
          />
          <path
            d="m17.5 21 3 3-3 3M25 28h5.5"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <div
          data-slot="desktop-new-session-prompt"
          class="text-[28px] font-[400] leading-[1.35] tracking-[-0.6px] text-v2-text-text-base"
        >
          <Show when={skin.id() !== "deepseek-harness"} fallback={prompt()[0]}>
            {prompt()[0]}
            <span class="underline decoration-v2-text-text-muted decoration-1 underline-offset-4">
              {projectName()}
            </span>
            {prompt()[1]}
          </Show>
        </div>
      </div>
      <div data-slot="desktop-new-session-composer" class="absolute inset-x-0 bottom-4 flex justify-center px-6">
        <div class={NEW_SESSION_CONTENT_WIDTH}>{props.children}</div>
      </div>
    </div>
  )
}
