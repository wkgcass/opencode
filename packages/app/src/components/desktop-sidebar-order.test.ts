import { describe, expect, test } from "bun:test"
import { createRoot, createSignal } from "solid-js"
import { createStore } from "solid-js/store"
import {
  applySessionOrder,
  createDesktopSidebarOrder,
  rememberSessionOrder,
  reorderByInsertion,
  reorderSessionOrder,
  sortableDropIndex,
  sortableInsertionIndex,
} from "./desktop-sidebar-order"
import { ServerConnection } from "@/context/server"
import { ServerScope } from "@/utils/server-scope"

describe("desktop sidebar order", () => {
  test("keeps session order per server and normalized project path", () => {
    createRoot((dispose) => {
      const [scope, setScope] = createSignal(ServerScope.local)
      const [store, setStore] = createStore({ sessions: {} })
      const order = createDesktopSidebarOrder({ scope, store, setStore })

      order.setSession("/repo/", ["new", "old"])
      setScope(ServerScope.fromServerKey(ServerConnection.Key.make("https://debian.example")))
      order.setSession("/repo", ["remote"])

      expect(order.session("/repo/")).toEqual(["remote"])
      setScope(ServerScope.local)
      expect(order.session("/repo")).toEqual(["new", "old"])
      dispose()
    })
  })

  test("provides stable per-server order views", () => {
    createRoot((dispose) => {
      const [store, setStore] = createStore({ sessions: {} })
      const order = createDesktopSidebarOrder({ scope: () => ServerScope.local, store, setStore })
      const remoteScope = ServerScope.fromServerKey(ServerConnection.Key.make("wsl:Ubuntu"))
      const local = order.forScope(ServerScope.local)
      const remote = order.forScope(remoteScope)

      local.setSession("/repo", ["local-session"])
      remote.setSession("/repo", ["remote-session"])

      expect(local.session("/repo")).toEqual(["local-session"])
      expect(remote.session("/repo")).toEqual(["remote-session"])
      dispose()
    })
  })

  test("does not overwrite session order before persistence is ready", () => {
    createRoot((dispose) => {
      const [ready, setReady] = createSignal(false)
      const [store, setStore] = createStore({ sessions: {} })
      const order = createDesktopSidebarOrder({
        scope: () => ServerScope.local,
        store,
        setStore,
        ready,
      })

      order.setSession("/repo", ["new"])
      expect(store.sessions).toEqual({})
      setReady(true)
      order.setSession("/repo", ["new"])
      expect(order.session("/repo")).toEqual(["new"])
      dispose()
    })
  })

  test("moves a project into the first and final insertion zones", () => {
    expect(sortableDropIndex(3, 2, 0)).toBe(0)
    expect(sortableDropIndex(3, 0, 3)).toBe(2)
  })

  test("adjusts insertion zones after removing the dragged project", () => {
    expect(sortableDropIndex(4, 1, 3)).toBe(2)
    expect(sortableDropIndex(4, 2, 1)).toBe(1)
    expect(sortableDropIndex(4, 1, 2)).toBe(1)
  })

  test("reorders sessions into the first and final resolved positions", () => {
    expect(reorderByInsertion(["first", "middle", "last"], 2, 0)).toEqual(["last", "first", "middle"])
    expect(reorderByInsertion(["first", "middle", "last"], 0, 3)).toEqual(["middle", "last", "first"])
  })

  test("keeps the same session order when hovering an adjacent insertion zone", () => {
    const sessions = ["first", "middle", "last"]
    expect(reorderByInsertion(sessions, 1, 2)).toBe(sessions)
  })

  test("rejects invalid sortable insertion zones", () => {
    expect(sortableDropIndex(3, -1, 0)).toBeUndefined()
    expect(sortableDropIndex(3, 0, 4)).toBeUndefined()
    expect(sortableDropIndex(3, 0, 1.5)).toBeUndefined()
  })

  test("resolves stable insertion zones after the items move", () => {
    const prefix = "drop:"
    expect(sortableInsertionIndex(["a", "b", "c"], `${prefix}start`, prefix)).toBe(0)
    expect(sortableInsertionIndex(["b", "c", "a"], `${prefix}after:c`, prefix)).toBe(2)
    expect(sortableInsertionIndex(["b", "c", "a"], `${prefix}after:a`, prefix)).toBe(3)
    expect(sortableInsertionIndex(["b", "c", "a"], `${prefix}after:missing`, prefix)).toBeUndefined()
  })

  test("restores session order and puts unseen sessions first", () => {
    expect(applySessionOrder(["old", "new", "middle"], ["middle", "old", "deleted"])).toEqual(["new", "middle", "old"])
  })

  test("remembers unseen sessions first without dropping unloaded sessions", () => {
    expect(rememberSessionOrder(["old", "new"], ["old", "hidden", "old"])).toEqual(["new", "old", "hidden"])
  })

  test("persists a visible session reorder while retaining unloaded sessions", () => {
    expect(reorderSessionOrder(["middle", "old"], ["old", "hidden", "middle"])).toEqual(["middle", "old", "hidden"])
  })
})
