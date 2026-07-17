import type { LocalProject } from "@/context/layout"
import { getProjectAvatarVariant } from "@/context/layout"
import type { ServerConnection } from "@/context/server"
import { SessionProgressRing } from "@/components/session-progress-ring"
import { displayName, getProjectAvatarSource } from "@/pages/layout/helpers"
import { useSessionTabAvatarState } from "@/pages/layout/project-avatar-state"
import { ProjectAvatar } from "@opencode-ai/ui/v2/project-avatar-v2"
import { SessionProgressIndicatorV2 } from "@opencode-ai/session-ui/v2/session-progress-indicator-v2"
import { Show } from "solid-js"

export function SessionTabAvatar(props: {
  project?: LocalProject
  directory: string
  sessionId: string
  server: ServerConnection.Key
  revealProjectOnHover?: boolean
  progressIndicator?: "dots" | "ring"
}) {
  const state = useSessionTabAvatarState(
    () => props.server,
    () => props.directory,
    () => props.sessionId,
  )
  return (
    <SessionTabAvatarView
      project={props.project}
      directory={props.directory}
      revealProjectOnHover={props.revealProjectOnHover}
      progressIndicator={props.progressIndicator}
      unread={state.unread()}
      loading={state.loading()}
    />
  )
}

export function SessionTabAvatarView(props: {
  project?: LocalProject
  directory: string
  revealProjectOnHover?: boolean
  progressIndicator?: "dots" | "ring"
  unread: boolean
  loading: boolean
}) {
  const projectAvatar = () => (
    <ProjectAvatar
      fallback={displayName(props.project ?? { worktree: props.directory })}
      src={getProjectAvatarSource(props.project?.id, props.project?.icon)}
      variant={getProjectAvatarVariant(props.project?.icon?.color)}
      unread={props.unread}
    />
  )
  return (
    <Show when={props.loading} fallback={projectAvatar()}>
      <span class="relative block size-4 shrink-0">
        <Show
          when={props.progressIndicator === "ring"}
          fallback={
            <SessionProgressIndicatorV2
              class={`absolute inset-0 ${props.revealProjectOnHover === false ? "" : "group-hover:invisible"}`}
            />
          }
        >
          <SessionProgressRing
            class={`absolute inset-px ${props.revealProjectOnHover === false ? "" : "group-hover:invisible"}`}
          />
        </Show>
        <Show when={props.revealProjectOnHover !== false}>
          <span class="invisible absolute inset-0 group-hover:visible">{projectAvatar()}</span>
        </Show>
      </span>
    </Show>
  )
}
