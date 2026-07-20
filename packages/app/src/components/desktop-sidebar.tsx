import { createSignal, For } from "solid-js"
import { produce } from "solid-js/store"
import { useNavigate } from "@solidjs/router"
import { Icon } from "@opencode-ai/ui/icon"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { DialogFooter, DialogHeader, DialogTitleGroup, DialogV2 } from "@opencode-ai/ui/v2/dialog-v2"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { useLanguage } from "@/context/language"
import { useLayout, type LocalProject } from "@/context/layout"
import { useServer } from "@/context/server"
import { useServerSDK } from "@/context/server-sdk"
import { useServerSync } from "@/context/server-sync"
import { useTabs } from "@/context/tabs"
import { notifySessionTabsRemoved } from "@/components/titlebar-session-events"
import { displayName, errorMessage, sortedRootSessions } from "@/pages/layout/helpers"
import { sessionTitle } from "@/utils/session-title"
import { showToast } from "@/utils/toast"

export function DesktopSidebar() {
  const language = useLanguage()
  const layout = useLayout()
  const navigate = useNavigate()
  const dialog = useDialog()
  const server = useServer()
  const serverSDK = useServerSDK()
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

  const deleteSession = async (directory: string, sessionID: string) => {
    const [sync, setSync] = serverSync().child(directory, { bootstrap: true })
    const session = sync.session.find((item) => item.id === sessionID)
    if (!session) return false

    const removed = new Set([sessionID])
    const children = new Map<string, string[]>()
    sync.session.forEach((item) => {
      if (!item.parentID) return
      const ids = children.get(item.parentID)
      if (ids) {
        ids.push(item.id)
        return
      }
      children.set(item.parentID, [item.id])
    })
    const pending = [sessionID]
    while (pending.length) {
      const parentID = pending.pop()
      if (!parentID) continue
      children.get(parentID)?.forEach((id) => {
        if (removed.has(id)) return
        removed.add(id)
        pending.push(id)
      })
    }

    const result = await serverSDK()
      .client.session.delete({ directory: session.directory, sessionID })
      .then((response) => response.data)
      .catch((error) => {
        showToast({
          title: language.t("session.delete.failed.title"),
          description: errorMessage(error, language.t("common.requestFailed")),
        })
        return false
      })
    if (!result) return false

    setSync(
      produce((draft) => {
        draft.session = draft.session.filter((item) => !removed.has(item.id))
      }),
    )
    notifySessionTabsRemoved({
      server: server.key,
      directory: session.directory,
      sessionIDs: [...removed],
    })
    return true
  }

  function DialogDeleteSession(props: { directory: string; sessionID: string; title: string }) {
    const [deleting, setDeleting] = createSignal(false)
    const handleDelete = async () => {
      if (deleting()) return
      setDeleting(true)
      const deleted = await deleteSession(props.directory, props.sessionID)
      if (deleted) {
        dialog.close()
        return
      }
      setDeleting(false)
    }

    return (
      <DialogV2 fit>
        <DialogHeader hideClose>
          <DialogTitleGroup
            title={language.t("session.delete.title")}
            description={language.t("session.delete.confirm", { name: props.title })}
          />
        </DialogHeader>
        <DialogFooter>
          <ButtonV2 variant="ghost" disabled={deleting()} onClick={() => dialog.close()}>
            {language.t("common.cancel")}
          </ButtonV2>
          <ButtonV2
            variant={deleting() ? "loading" : "danger"}
            disabled={deleting()}
            onClick={() => void handleDelete()}
          >
            {language.t("session.delete.button")}
          </ButtonV2>
        </DialogFooter>
      </DialogV2>
    )
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
                    {(session) => {
                      const title = () => sessionTitle(session.title) ?? language.t("command.session.new")
                      return (
                        <div class="codex-app-sidebar-session-row">
                          <button
                            type="button"
                            class="codex-app-sidebar-session pr-10!"
                            classList={{ "text-v2-text-text-base": activeSession(session.id) }}
                            aria-current={activeSession(session.id) ? "page" : undefined}
                            onClick={() => {
                              const tab = tabs.addSessionTab({ server: server.key, sessionId: session.id })
                              tabs.select(tab)
                            }}
                          >
                            {title()}
                          </button>
                          <div class="codex-app-sidebar-actions">
                            <button
                              data-action="sidebar-delete-session"
                              type="button"
                              class="codex-app-sidebar-action"
                              title={language.t("session.delete.title")}
                              aria-label={`${language.t("session.delete.title")}: ${title()}`}
                              onClick={() =>
                                dialog.show(() => (
                                  <DialogDeleteSession
                                    directory={project.worktree}
                                    sessionID={session.id}
                                    title={title()}
                                  />
                                ))
                              }
                            >
                              <Icon name="trash" size="small" />
                            </button>
                          </div>
                        </div>
                      )
                    }}
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
