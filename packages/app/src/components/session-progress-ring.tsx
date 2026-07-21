import type { ComponentProps } from "solid-js"
import "./session-progress-ring.css"

export function SessionProgressRing(props: ComponentProps<"span">) {
  return <span {...props} data-component="session-progress-ring" aria-hidden={props["aria-hidden"] ?? "true"} />
}
