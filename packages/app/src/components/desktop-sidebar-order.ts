import { type Accessor } from "solid-js"
import { createStore, type SetStoreFunction, type Store } from "solid-js/store"
import { Persist, persisted } from "@/utils/persist"
import { pathKey } from "@/utils/path-key"
import { type ServerScope } from "@/utils/server-scope"

export type DesktopSidebarOrderState = {
  sessions: Record<string, Record<string, string[]>>
}

export type DesktopSidebarScopedOrder = {
  ready: Accessor<boolean>
  session: (directory: string) => string[]
  setSession: (directory: string, sessionIDs: string[]) => void
}

export function createDesktopSidebarOrder(input: {
  scope: Accessor<ServerScope>
  store: Store<DesktopSidebarOrderState>
  setStore: SetStoreFunction<DesktopSidebarOrderState>
  ready?: Accessor<boolean>
}) {
  const ready = input.ready ?? (() => true)
  const scoped = (scope: Accessor<ServerScope>): DesktopSidebarScopedOrder => {
    const session = (directory: string) => {
      if (!ready()) return []
      return input.store.sessions[scope()]?.[pathKey(directory)] ?? []
    }

    return {
      ready,
      session,
      setSession(directory: string, sessionIDs: string[]) {
        if (!ready()) return
        const currentScope = scope()
        const key = pathKey(directory)
        const current = session(directory)
        if (current.length === sessionIDs.length && current.every((id, index) => id === sessionIDs[index])) return
        input.setStore("sessions", currentScope, {
          ...input.store.sessions[currentScope],
          [key]: sessionIDs,
        })
      },
    }
  }
  return {
    ...scoped(input.scope),
    forScope(scope: ServerScope) {
      return scoped(() => scope)
    },
  }
}

export type DesktopSidebarOrder = ReturnType<typeof createDesktopSidebarOrder>

export function useDesktopSidebarOrder(scope: Accessor<ServerScope>) {
  const [store, setStore, _, ready] = persisted(
    Persist.global("desktop-sidebar-order.v1"),
    createStore<DesktopSidebarOrderState>({ sessions: {} }),
  )
  return createDesktopSidebarOrder({ scope, store, setStore, ready })
}

export function applySessionOrder(live: string[], stored: string[]) {
  const available = new Set(live)
  const seen = new Set<string>()
  const ordered = stored.filter((id) => {
    if (!available.has(id) || seen.has(id)) return false
    seen.add(id)
    return true
  })
  return [...live.filter((id) => !seen.has(id)), ...ordered]
}

export function rememberSessionOrder(live: string[], stored: string[]) {
  const seen = new Set<string>()
  // Child stores are paged, so keep IDs that are not currently loaded while prepending newly observed sessions.
  const ordered = stored.filter((id) => {
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
  return [...live.filter((id) => !seen.has(id)), ...ordered]
}

export function reorderSessionOrder(visible: string[], stored: string[]) {
  const seen = new Set(visible)
  return [...visible, ...stored.filter((id) => !seen.has(id))]
}

export function sortableDropIndex(length: number, source: number, insertion: number) {
  if (source < 0 || source >= length) return undefined
  if (!Number.isInteger(insertion) || insertion < 0 || insertion > length) return undefined
  return insertion > source ? insertion - 1 : insertion
}

export function sortableInsertionIndex(items: string[], target: string, prefix: string) {
  if (target === `${prefix}start`) return 0
  const after = `${prefix}after:`
  if (!target.startsWith(after)) return undefined
  const index = items.indexOf(target.slice(after.length))
  if (index < 0) return undefined
  return index + 1
}

export function reorderByInsertion<T>(items: T[], source: number, insertion: number) {
  const target = sortableDropIndex(items.length, source, insertion)
  if (target === undefined || source === target) return items
  return items.toSpliced(source, 1).toSpliced(target, 0, ...items.slice(source, source + 1))
}
