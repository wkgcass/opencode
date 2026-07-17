import { createEffect, For, Show, Suspense, type ParentProps } from "solid-js"
import { useNavigate } from "@solidjs/router"
import { DebugBar } from "@/components/debug-bar"
import { TabsInfoPopup } from "@/components/help-button"
import { Titlebar, type TitlebarUpdate } from "@/components/titlebar"
import { Icon } from "@opencode-ai/ui/v2/icon"
import { useLanguage } from "@/context/language"
import { useLayout, type LocalProject } from "@/context/layout"
import { usePlatform } from "@/context/platform"
import { useServer } from "@/context/server"
import { useServerSync } from "@/context/server-sync"
import { useTabs } from "@/context/tabs"
import { displayName, sortedRootSessions } from "@/pages/layout/helpers"
import { setNavigate } from "@/utils/notification-click"
import { setV2Toast, ToastRegion } from "@/utils/toast"

export default function NewLayout(props: ParentProps) {
  const platform = usePlatform()
  const navigate = useNavigate()
  setNavigate(navigate)

  createEffect(() => setV2Toast(true))

  const update: TitlebarUpdate = {
    version: () => {
      const state = platform.updater?.state()
      if (state?.status !== "ready") return
      return state.version
    },
    installing: () => platform.updater?.state().status === "installing",
    install: () => void platform.updater?.install(),
  }

  return (
    <div
      data-component="codex-app-shell"
      class="relative bg-v2-background-bg-deep flex-1 min-h-0 min-w-0 flex flex-col select-none [&_input]:select-text [&_textarea]:select-text [&_[contenteditable]]:select-text"
      style={{
        "padding-top": "env(safe-area-inset-top, 0px)",
        "padding-bottom": "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <Titlebar update={update} />
      <div class="flex min-h-0 min-w-0 flex-1">
        <Show when={platform.platform === "desktop"}>
          <CodexSidebar />
        </Show>
        <main
          data-component="codex-main-workspace"
          class="flex min-h-0 min-w-0 flex-1 flex-col items-start contain-strict overflow-x-hidden bg-v2-background-bg-deep"
        >
          <Suspense>{props.children}</Suspense>
        </main>
      </div>
      {import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEBUG_BAR === "1" && <DebugBar inline />}
      <TabsInfoPopup />
      <ToastRegion v2 />
    </div>
  )
}

function CodexSidebar() {
  const language = useLanguage()
  const layout = useLayout()
  const navigate = useNavigate()
  const server = useServer()
  const serverSync = useServerSync()
  const tabs = useTabs()
  const projects = layout.projects.list
  const selected = () => layout.home.selection().directory
  const activeProject = (directory: string) => {
    const route = layout.route()
    if (route.type === "session") return false
    if (route.type === "draft") {
      return tabs.store.some(
        (tab) => tab.type === "draft" && tab.draftID === route.draftID && tab.directory === directory,
      )
    }
    return selected() === directory
  }
  const activeSession = (id: string) => {
    const route = layout.route()
    return route.type === "session" && route.sessionId === id
  }

  const newTask = (target?: LocalProject) => {
    const project = target ?? projects().find((item) => item.worktree === selected()) ?? projects()[0]
    if (!project) {
      navigate("/")
      return
    }
    layout.home.setSelection({ server: server.key, directory: project.worktree })
    void tabs.newDraft({ server: server.key, directory: project.worktree }, "")
  }

  const selectProject = (project: LocalProject) => {
    layout.home.setSelection({ server: server.key, directory: project.worktree })
    navigate("/")
  }

  return (
    <aside
      data-component="codex-app-sidebar"
      class="hidden h-full w-[262px] shrink-0 flex-col overflow-hidden bg-v2-background-bg-deep lg:flex"
      aria-label="opencode"
    >
      <div class="flex shrink-0 flex-col gap-1 px-1 pb-3 pt-2">
        <div class="mb-2 flex h-8 items-center px-2">
          <div class="flex min-w-0 flex-col leading-none">
            <span
              data-slot="codex-sidebar-brand"
              class="text-[17px] font-[600] tracking-[-0.2px] text-v2-text-text-base"
            >
              opencode
            </span>
          </div>
        </div>
        <button data-action="sidebar-new-session" type="button" class="codex-app-sidebar-row" onClick={() => newTask()}>
          <Icon name="edit" />
          <span>{language.t("command.session.new")}</span>
        </button>
      </div>

      <div class="px-3 pb-2 text-[12px] text-v2-text-text-faint">Projects</div>
      <div class="min-h-0 flex-1 overflow-y-auto px-1 pb-4 no-scrollbar">
        <For each={projects()}>
          {(project) => {
            const [sync] = serverSync().child(project.worktree, { bootstrap: true })
            const sessions = () => sortedRootSessions(sync, Date.now()).slice(0, 6)
            return (
              <div class="mb-2">
                <div class="codex-app-sidebar-project">
                  <button
                    type="button"
                    class="codex-app-sidebar-row pr-10!"
                    classList={{
                      "bg-v2-background-bg-layer-02 text-v2-text-text-base": activeProject(project.worktree),
                    }}
                    aria-current={activeProject(project.worktree) ? "page" : undefined}
                    onClick={() => selectProject(project)}
                  >
                    <Icon name="folder" />
                    <span class="min-w-0 truncate">{displayName(project)}</span>
                  </button>
                  <div class="codex-app-sidebar-actions">
                    <button
                      type="button"
                      class="codex-app-sidebar-action"
                      title={language.t("command.session.new")}
                      aria-label={`${language.t("command.session.new")}: ${displayName(project)}`}
                      onClick={() => newTask(project)}
                    >
                      <Icon name="edit" size="small" />
                    </button>
                  </div>
                </div>
                <div class="flex flex-col">
                  <For each={sessions()}>
                    {(session) => (
                      <button
                        type="button"
                        class="codex-app-sidebar-session"
                        classList={{ "text-v2-text-text-base": activeSession(session.id) }}
                        aria-current={activeSession(session.id) ? "page" : undefined}
                        onClick={() => {
                          const tab = tabs.addSessionTab({ server: server.key, sessionId: session.id })
                          tabs.select(tab)
                        }}
                      >
                        {session.title}
                      </button>
                    )}
                  </For>
                </div>
              </div>
            )
          }}
        </For>
      </div>
    </aside>
  )
}
