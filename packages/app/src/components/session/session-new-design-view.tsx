import type { JSX } from "solid-js"
import { WordmarkV2 } from "@opencode-ai/ui/v2/wordmark-v2"
import { usePlatform } from "@/context/platform"
import { NEW_SESSION_CONTENT_WIDTH } from "@/pages/session/new-session-layout"
import { DesktopNewSessionDesignView } from "./desktop-new-session-design-view"

export function NewSessionDesignView(props: { children: JSX.Element }) {
  const platform = usePlatform()
  if (platform.platform === "desktop")
    return <DesktopNewSessionDesignView>{props.children}</DesktopNewSessionDesignView>

  return (
    <div data-component="session-new-design" class="relative size-full overflow-hidden bg-v2-background-bg-deep ">
      <div class="absolute inset-x-0 top-[25.375%] flex justify-center px-6">
        <div class={NEW_SESSION_CONTENT_WIDTH}>
          <WordmarkV2 class="h-auto w-full text-v2-background-bg-inverse" />
          <div class="mt-8">{props.children}</div>
        </div>
      </div>
    </div>
  )
}
