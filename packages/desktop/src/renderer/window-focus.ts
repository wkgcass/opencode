import { createSignal } from "solid-js"

const [windowFocused, setWindowFocused] = createSignal(false)

window.api.onWindowFocusedChanged(setWindowFocused)
void window.api.getWindowFocused().then(setWindowFocused)

export { windowFocused }
