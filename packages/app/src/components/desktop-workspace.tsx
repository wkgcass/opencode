import type { ParentProps } from "solid-js"
import { usePlatform } from "@/context/platform"
import { DesktopSidebar } from "./desktop-sidebar"

const mainClass = "flex-1 min-h-0 min-w-0 overflow-x-hidden flex flex-col items-start contain-strict"

export function DesktopWorkspace(props: ParentProps) {
  const platform = usePlatform()
  if (platform.platform !== "desktop") return <main class={mainClass}>{props.children}</main>

  return (
    <div class="flex min-h-0 min-w-0 flex-1">
      <DesktopSidebar />
      <main data-component="codex-main-workspace" class={mainClass}>
        {props.children}
      </main>
    </div>
  )
}
