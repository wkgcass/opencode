import { Show, type JSX } from "solid-js"
import { WordmarkV2 } from "@opencode-ai/ui/v2/wordmark-v2"
import { useLanguage } from "@/context/language"
import { usePlatform } from "@/context/platform"
import { NEW_SESSION_CONTENT_WIDTH } from "@/pages/session/new-session-layout"

export function NewSessionDesignView(props: { children: JSX.Element; projectName?: string }) {
  const language = useLanguage()
  const platform = usePlatform()
  const prompt = () => {
    if (language.locale() === "zh") return ["我们应该在 ", " 中构建什么？"]
    if (language.locale() === "zht") return ["我們應該在 ", " 中建構什麼？"]
    return ["What should we build in ", "?"]
  }

  return (
    <Show
      when={platform.platform === "desktop"}
      fallback={
        <div data-component="session-new-design" class="relative size-full overflow-hidden bg-v2-background-bg-deep">
          <div class="absolute inset-x-0 top-[25.375%] flex justify-center px-6">
            <div class={NEW_SESSION_CONTENT_WIDTH}>
              <WordmarkV2 class="h-auto w-full text-v2-background-bg-inverse" />
              <div class="mt-8">{props.children}</div>
            </div>
          </div>
        </div>
      }
    >
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
            <path d="m17.5 21 3 3-3 3M25 28h5.5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <div class="text-[28px] font-[400] leading-[1.35] tracking-[-0.6px] text-v2-text-text-base">
            {prompt()[0]}
            <span class="underline decoration-v2-text-text-muted decoration-1 underline-offset-4">
              {props.projectName ?? "opencode"}
            </span>
            {prompt()[1]}
          </div>
        </div>
        <div class="absolute inset-x-0 bottom-4 flex justify-center px-6">
          <div class={NEW_SESSION_CONTENT_WIDTH}>{props.children}</div>
        </div>
      </div>
    </Show>
  )
}
