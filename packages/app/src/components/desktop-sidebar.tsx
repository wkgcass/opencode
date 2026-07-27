/* @refresh skip */
// Refresh through DesktopWorkspace so nested context consumers keep their provider owner.
import { createEffect, createMemo, createSignal, For, Show, type Accessor } from "solid-js"
import { createStore, produce } from "solid-js/store"
import { useNavigate } from "@solidjs/router"
import { type CollisionDetector, CollisionPriority, CollisionType } from "@dnd-kit/abstract"
import { DragDropProvider, PointerSensor, useDroppable } from "@dnd-kit/solid"
import { useSortable } from "@dnd-kit/solid/sortable"
import { PointerActivationConstraints } from "@dnd-kit/dom"
import { Icon } from "@opencode-ai/ui/icon"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { DialogFooter, DialogHeader, DialogTitleGroup, DialogV2 } from "@opencode-ai/ui/v2/dialog-v2"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { type Session } from "@opencode-ai/sdk/v2/client"
import { useLanguage } from "@/context/language"
import { useGlobal, type ServerCtx } from "@/context/global"
import { useLayout, type LocalProject } from "@/context/layout"
import { ServerConnection, useServer } from "@/context/server"
import { useTabs } from "@/context/tabs"
import { SessionProgressRing } from "@/components/session-progress-ring"
import { notifySessionTabsRemoved } from "@/components/titlebar-session-events"
import {
  applySessionOrder,
  rememberSessionOrder,
  reorderByInsertion,
  reorderSessionOrder,
  sortableDropIndex,
  sortableInsertionIndex,
  type DesktopSidebarScopedOrder,
  useDesktopSidebarOrder,
} from "@/components/desktop-sidebar-order"
import { displayName, errorMessage, sortedRootSessions } from "@/pages/layout/helpers"
import { useSessionTabAvatarState } from "@/pages/layout/project-avatar-state"
import { sessionTitle } from "@/utils/session-title"
import { showToast } from "@/utils/toast"

const PROJECT_DRAG_TYPE = "desktop-project"
const PROJECT_DROP_PREFIX = "desktop-project-drop:"
const SESSION_DRAG_TYPE = "desktop-session"
const SESSION_DROP_PREFIX = "desktop-session-drop:"

/** Fixed sidebar width in pixels. Mirrors `--desktop-sidebar-width` in codex-workspace.css. */
export const DESKTOP_SIDEBAR_WIDTH = 262
type DesktopSidebarProject = {
  server: ServerConnection.Key
  ctx: ServerCtx
  project: LocalProject
}
const pointerCollision: CollisionDetector = ({ dragOperation, droppable }) => {
  const disabled = droppable.data.disabled
  if (typeof disabled === "function" && disabled()) return null
  const point = dragOperation.position.current
  if (!droppable.shape?.containsPoint(point)) return null
  const distance = Math.hypot(droppable.shape.center.x - point.x, droppable.shape.center.y - point.y)
  return {
    id: droppable.id,
    value: 1 / Math.max(distance, 1),
    type: CollisionType.PointerIntersection,
    priority: CollisionPriority.Highest,
  }
}

const sessionCollision: CollisionDetector = ({ dragOperation, droppable }) => {
  const disabled = droppable.data.disabled
  if (typeof disabled === "function" && disabled()) return null
  const shape = droppable.shape
  if (!shape) return null
  const point = dragOperation.position.current
  const bounds = shape.boundingRectangle
  if (point.x < bounds.left || point.x > bounds.right) return null
  // Session rows are 30px tall, so the nearest boundary covers either half without adding visible spacing.
  const distance = Math.abs(shape.center.y - point.y)
  if (distance > 18) return null
  return {
    id: droppable.id,
    value: 1 / Math.max(distance, 1),
    type: CollisionType.Collision,
    priority: CollisionPriority.Highest,
  }
}

function SortableDropZone(props: {
  id: Accessor<string>
  accept: string
  disabled?: Accessor<boolean>
  collisionDetector?: CollisionDetector
  compact?: boolean
  projectGap?: boolean
}) {
  const droppable = useDroppable({
    get id() {
      return props.id()
    },
    type: "desktop-sortable-drop",
    accept: props.accept,
    data: { disabled: props.disabled },
    collisionPriority: CollisionPriority.Highest,
    collisionDetector: props.collisionDetector ?? pointerCollision,
  })

  return (
    <div
      ref={droppable.ref}
      data-sidebar-sortable-drop-zone
      class="pointer-events-none relative z-10 flex h-3 shrink-0 items-center px-2"
      classList={{ "-my-1.5": props.compact, "-my-0.5": props.projectGap }}
    >
      <div
        data-slot="sidebar-drop-indicator"
        data-active={droppable.isDropTarget() ? "true" : undefined}
        class="flex w-full items-center"
      >
        <div
          data-slot="sidebar-drop-indicator-dot"
          class="size-1.5 shrink-0 rounded-full border border-transparent"
          classList={{ "border-v2-text-text-accent": droppable.isDropTarget() }}
        />
        <div
          data-slot="sidebar-drop-indicator-line"
          class="-ml-px h-px flex-1 rounded-r-full"
          classList={{ "bg-v2-text-text-accent": droppable.isDropTarget() }}
        />
      </div>
    </div>
  )
}

function SortableSession(props: {
  server: ServerConnection.Key
  session: Session
  index: Accessor<number>
  active: Accessor<boolean>
  onOpen: () => void
  onDelete: (title: string) => void
}) {
  const language = useLanguage()
  const state = useSessionTabAvatarState(
    () => props.server,
    () => props.session.directory,
    () => props.session.id,
  )
  const sortable = useSortable({
    get id() {
      return props.session.id
    },
    get index() {
      return props.index()
    },
    type: SESSION_DRAG_TYPE,
    disabled: { draggable: false, droppable: true },
  })
  const title = () => sessionTitle(props.session.title) ?? language.t("command.session.new")

  return (
    <div
      ref={sortable.ref}
      data-sidebar-session-sortable
      data-working={state.loading() ? "true" : undefined}
      class="codex-app-sidebar-session-row"
      classList={{ "opacity-50": sortable.isDragSource() }}
    >
      <button
        type="button"
        class="codex-app-sidebar-session pr-10!"
        classList={{ "text-v2-text-text-base": props.active() }}
        aria-current={props.active() ? "page" : undefined}
        onClick={props.onOpen}
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
          onClick={() => props.onDelete(title())}
        >
          <Icon name="trash" size="small" />
        </button>
      </div>
      <Show when={state.loading()}>
        <div class="codex-app-sidebar-progress">
          <SessionProgressRing class="size-[14px]" />
        </div>
      </Show>
    </div>
  )
}

function SortableProject(props: {
  server: ServerConnection.Key
  local: boolean
  ctx: ServerCtx
  project: Accessor<LocalProject>
  index: Accessor<number>
  order: DesktopSidebarScopedOrder
  activeProject: Accessor<boolean>
  activeSession: (id: string) => boolean
  onSelect: () => void
  onNewTask: () => void
  onOpenSession: (id: string) => void
  onDeleteSession: (id: string, title: string) => void
}) {
  const language = useLanguage()
  const sortable = useSortable({
    get id() {
      return props.project().worktree
    },
    get index() {
      return props.index()
    },
    type: PROJECT_DRAG_TYPE,
    disabled: { draggable: false, droppable: true },
  })
  const [sync] = props.ctx.sync.child(props.project().worktree, { bootstrap: true })
  const rootSessions = createMemo(() => sortedRootSessions(sync, Date.now()))
  const liveSessionIDs = createMemo(() => rootSessions().map((session) => session.id))
  const storedSessionIDs = () => props.order.session(props.project().worktree)
  const orderedSessionIDs = createMemo(() => applySessionOrder(liveSessionIDs(), storedSessionIDs()))
  const sessions = createMemo(() => {
    const byID = new Map(rootSessions().map((session) => [session.id, session]))
    return orderedSessionIDs()
      .map((id) => byID.get(id))
      .filter((session): session is Session => !!session)
      .slice(0, 6)
  })
  const [sessionDrag, setSessionDrag] = createStore({ source: "" })
  const sessionDropDisabled = (insertion: number) => {
    const current = orderedSessionIDs()
    const source = current.indexOf(sessionDrag.source)
    return sortableDropIndex(current.length, source, insertion) === source
  }
  createEffect(() => {
    props.order.setSession(props.project().worktree, rememberSessionOrder(liveSessionIDs(), storedSessionIDs()))
  })

  return (
    <div ref={sortable.ref} data-sidebar-project-sortable classList={{ "opacity-50": sortable.isDragSource() }}>
      <div class="codex-app-sidebar-project">
        <button
          type="button"
          class="codex-app-sidebar-row pr-10!"
          classList={{
            "bg-v2-background-bg-layer-02 text-v2-text-text-base": props.activeProject(),
          }}
          aria-current={props.activeProject() ? "page" : undefined}
          onClick={props.onSelect}
        >
          <Icon name={props.local ? "folder" : "cloud"} />
          <span class="min-w-0 truncate">{displayName(props.project())}</span>
        </button>
        <div class="codex-app-sidebar-actions">
          <button
            type="button"
            class="codex-app-sidebar-action"
            title={language.t("command.session.new")}
            aria-label={`${language.t("command.session.new")}: ${displayName(props.project())}`}
            onClick={props.onNewTask}
          >
            <Icon name="edit" size="small" />
          </button>
        </div>
      </div>
      <DragDropProvider
        sensors={[
          PointerSensor.configure({
            activationConstraints: [new PointerActivationConstraints.Distance({ value: 4 })],
            preventActivation: (event) =>
              event.target instanceof Element && !!event.target.closest(".codex-app-sidebar-action"),
          }),
        ]}
        onDragStart={(event) => {
          setSessionDrag("source", event.operation.source?.id.toString() ?? "")
        }}
        onDragEnd={(event) => {
          const source = event.operation.source
          const target = event.operation.target
          setSessionDrag("source", "")
          if (event.canceled || !source || !target) return
          const targetID = target.id.toString()
          const current = orderedSessionIDs()
          const sourceID = source.id.toString()
          const sourceIndex = current.indexOf(sourceID)
          const insertion = sortableInsertionIndex(current, targetID, SESSION_DROP_PREFIX)
          if (insertion === undefined) return
          const next = reorderByInsertion(current, sourceIndex, insertion)
          if (next === current) return
          props.order.setSession(props.project().worktree, reorderSessionOrder(next, storedSessionIDs()))
        }}
      >
        <div class="flex flex-col">
          <SortableDropZone
            id={() => `${SESSION_DROP_PREFIX}start`}
            accept={SESSION_DRAG_TYPE}
            disabled={() => sessionDropDisabled(0)}
            collisionDetector={sessionCollision}
            compact
          />
          <For each={sessions()}>
            {(session, index) => (
              <>
                <SortableSession
                  server={props.server}
                  session={session}
                  index={index}
                  active={() => props.activeSession(session.id)}
                  onOpen={() => props.onOpenSession(session.id)}
                  onDelete={(title) => props.onDeleteSession(session.id, title)}
                />
                <SortableDropZone
                  id={() => `${SESSION_DROP_PREFIX}after:${session.id}`}
                  accept={SESSION_DRAG_TYPE}
                  disabled={() => sessionDropDisabled(index() + 1)}
                  collisionDetector={sessionCollision}
                  compact
                />
              </>
            )}
          </For>
        </div>
      </DragDropProvider>
    </div>
  )
}

export function DesktopSidebar() {
  const language = useLanguage()
  const global = useGlobal()
  const layout = useLayout()
  const navigate = useNavigate()
  const dialog = useDialog()
  const server = useServer()
  const sidebarOrder = useDesktopSidebarOrder(() => server.scope())
  const tabs = useTabs()
  const groups = createMemo(() =>
    global.servers.list().map((conn) => ({
      key: ServerConnection.key(conn),
      local: ServerConnection.local(conn),
      ctx: global.ensureServerCtx(conn),
    })),
  )
  const projects = () =>
    groups().flatMap((group) =>
      group.ctx.projects.list().map((project) => ({ server: group.key, ctx: group.ctx, project })),
    )
  const activeProject = (serverKey: ServerConnection.Key, directory: string) => {
    const route = layout.route()
    if (route.type === "session") return false
    if (route.type === "draft") {
      return tabs.store.some(
        (tab) =>
          tab.type === "draft" &&
          tab.draftID === route.draftID &&
          tab.server === serverKey &&
          tab.directory === directory,
      )
    }
    const selection = layout.home.selection()
    return selection.server === serverKey && selection.directory === directory
  }
  const activeSession = (serverKey: ServerConnection.Key, id: string) => {
    const route = layout.route()
    return route.type === "session" && (route.server ?? server.key) === serverKey && route.sessionId === id
  }

  const newTask = (target?: DesktopSidebarProject) => {
    const selection = layout.home.selection()
    const entry =
      target ??
      projects().find((item) => item.server === selection.server && item.project.worktree === selection.directory) ??
      projects()[0]
    if (!entry) {
      navigate("/")
      return
    }
    layout.home.setSelection({ server: entry.server, directory: entry.project.worktree })
    void tabs.newDraft({ server: entry.server, directory: entry.project.worktree }, "")
  }

  const selectProject = (serverKey: ServerConnection.Key, project: LocalProject) => {
    layout.home.setSelection({ server: serverKey, directory: project.worktree })
    navigate("/")
  }

  const deleteSession = async (target: DesktopSidebarProject, sessionID: string) => {
    const directory = target.project.worktree
    const [sync, setSync] = target.ctx.sync.child(directory, { bootstrap: true })
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

    const result = await target.ctx.sdk.client.session
      .delete({ directory: session.directory, sessionID })
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
    const order = sidebarOrder.forScope(target.ctx.sdk.scope)
    order.setSession(
      directory,
      order.session(directory).filter((id) => !removed.has(id)),
    )
    notifySessionTabsRemoved({
      server: target.server,
      directory: session.directory,
      sessionIDs: [...removed],
    })
    return true
  }

  function DialogDeleteSession(props: {
    target: DesktopSidebarProject
    sessionID: string
    title: string
  }) {
    const [deleting, setDeleting] = createSignal(false)
    const handleDelete = async () => {
      if (deleting()) return
      setDeleting(true)
      const deleted = await deleteSession(props.target, props.sessionID)
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
      class="hidden h-full w-[var(--desktop-sidebar-width)] shrink-0 flex-col overflow-hidden bg-v2-background-bg-deep lg:flex"
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
        <For each={groups()}>
          {(group) => {
            const projectIDs = () => group.ctx.projects.list().map((project) => project.worktree)
            const order = sidebarOrder.forScope(group.ctx.sdk.scope)
            const [projectDrag, setProjectDrag] = createStore({ source: "" })
            const projectDropDisabled = (insertion: number) => {
              const current = projectIDs()
              const source = current.indexOf(projectDrag.source)
              return sortableDropIndex(current.length, source, insertion) === source
            }
            return (
              <DragDropProvider
                sensors={[
                  PointerSensor.configure({
                    activationConstraints: [new PointerActivationConstraints.Distance({ value: 4 })],
                    preventActivation: (event) =>
                      event.target instanceof Element &&
                      !!event.target.closest("[data-sidebar-session-sortable], .codex-app-sidebar-action"),
                  }),
                ]}
                onDragStart={(event) => {
                  setProjectDrag("source", event.operation.source?.id.toString() ?? "")
                }}
                onDragEnd={(event) => {
                  const source = event.operation.source
                  const target = event.operation.target
                  setProjectDrag("source", "")
                  if (event.canceled || !source || !target) return
                  const targetID = target.id.toString()
                  const current = projectIDs()
                  const sourceID = source.id.toString()
                  const insertion = sortableInsertionIndex(current, targetID, PROJECT_DROP_PREFIX)
                  if (insertion === undefined) return
                  const index = sortableDropIndex(current.length, current.indexOf(sourceID), insertion)
                  if (index === undefined || index === current.indexOf(sourceID)) return
                  group.ctx.projects.move(sourceID, index)
                }}
              >
                <div data-sidebar-server={group.key}>
                  <SortableDropZone
                    id={() => `${PROJECT_DROP_PREFIX}start`}
                    accept={PROJECT_DRAG_TYPE}
                    disabled={() => projectDropDisabled(0)}
                    compact
                  />
                  <For each={projectIDs()}>
                    {(directory, index) => {
                      const project = () => group.ctx.projects.list().find((item) => item.worktree === directory)!
                      const target = () => ({
                        server: group.key,
                        ctx: group.ctx,
                        project: project(),
                      })
                      return (
                        <>
                          <SortableProject
                            server={group.key}
                            local={group.local}
                            ctx={group.ctx}
                            project={project}
                            index={index}
                            order={order}
                            activeProject={() => activeProject(group.key, directory)}
                            activeSession={(id) => activeSession(group.key, id)}
                            onSelect={() => selectProject(group.key, project())}
                            onNewTask={() => newTask(target())}
                            onOpenSession={(id) => {
                              const tab = tabs.addSessionTab({ server: group.key, sessionId: id })
                              tabs.select(tab)
                            }}
                            onDeleteSession={(id, title) =>
                              dialog.show(() => <DialogDeleteSession target={target()} sessionID={id} title={title} />)
                            }
                          />
                          <SortableDropZone
                            id={() => `${PROJECT_DROP_PREFIX}after:${directory}`}
                            accept={PROJECT_DRAG_TYPE}
                            disabled={() => projectDropDisabled(index() + 1)}
                            projectGap
                          />
                        </>
                      )
                    }}
                  </For>
                </div>
              </DragDropProvider>
            )
          }}
        </For>
      </div>
    </aside>
  )
}
