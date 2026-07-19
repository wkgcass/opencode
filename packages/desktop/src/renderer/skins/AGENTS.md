# Desktop skin customization

This directory contains the desktop-only skin registry, preload logic, and lazy-loaded skin styles. Keep skin policy here and keep shared-app edits as small integration hooks so future upstream merges stay mechanical.

## Fork invariants

Preserve these behaviours when merging or refactoring:

- The development debug bar is hidden by default in both layouts. Gate the `DebugBar` call sites in `packages/app/src/pages/layout-new.tsx` and `packages/app/src/pages/layout.tsx` with `import.meta.env.VITE_ENABLE_DEBUG_BAR === "1"` so the component is not mounted and reserves no height. Do not move this check into `DebugBar` and do not rely on CSS visibility.
- The desktop channel badge (`DEV`, `BETA`, and similar channel text) is not displayed. Keep the `desktop-channel-indicator` hook in `packages/app/src/components/titlebar.tsx` and its desktop-scoped rule in `packages/desktop/src/renderer/codex-workspace.css`.
- Skin behaviour must not change the web application unless the user explicitly requests it.
- A custom skin owns both colour scheme and theme. The `none` skin leaves both user-selectable. Missing custom-skin values resolve to the light colour scheme and the application-default `oc-2` theme.

## Change principles

- Prefer adding a new file in this directory over expanding or restructuring an upstream file.
- Treat edits outside this directory as integration hooks. Keep them to an import, provider/wrapper, registration call, or semantic `data-*` attribute whenever possible.
- Do not move, reformat, or rename unrelated upstream code. A small explicit hook is easier to replay than a clever structural rewrite.
- Prefer stable `data-component`, `data-slot`, and dedicated class hooks over selectors that depend on DOM depth, utility-class order, or translated text.
- Add a hook to shared application markup only when no existing semantic hook can express the target. Keep the original element structure and behaviour unchanged.
- Keep localized or dynamic user-facing copy in real application markup, not CSS generated content. If a skin needs different copy, branch only inside an already desktop-only component, preserve the default presentation, and provide the same locale coverage as the original copy.
- Scope every desktop workspace or skin override through `html[data-opencode-desktop="true"]`. Scope skin-specific rules further through `html[data-skin="<id>"]`. Never add an unscoped `body`, component, or utility-class override.
- Decorative pseudo-elements must use `pointer-events: none`. When decoration shares space with hover- or focus-revealed controls, hide the decoration on both `:hover` and `:focus-within` so it cannot obscure the controls.
- Keep skin CSS lazy-loaded. Do not statically import every skin stylesheet into the renderer entry point.
- Keep the shared app independent of the desktop package. `packages/app` may define the generic skin context and types; it must not import a desktop skin or desktop renderer module.
- Keep theme-lock integration in upstream files narrow:
  - In both settings implementations, import `skinSettingsLocked` and pass it only to the `disabled` prop of the colour-scheme and theme selects.
  - In `packages/app/src/pages/layout.tsx`, pass `skinSettingsLocked()` to the `disabled` field of theme and colour-scheme commands, and keep an early return in both cycle functions so direct invocation cannot bypass the lock. Do not spread skin checks into the theme context or unrelated command infrastructure.
- Do not call `useSkin()` from the top level of shared settings components. The web app does not mount `SkinProvider`; use the provider-independent reactive `skinSettingsLocked()` accessor for shared integration.
- Renderer code may call native functionality only through `window.api`, in accordance with `packages/desktop/AGENTS.md`.
- Do not edit generated sources or build output.

## Implementation flow

The skin system has a pre-render phase and a runtime phase so the correct appearance is visible before Solid renders while full skin CSS remains lazy-loaded.

1. `catalog.ts` is the desktop registry. `desktopSkins` contains the serializable definitions and `defaultDesktopSkinID` selects the desktop default.
2. `vite.ts` provides `desktopSkinPreloadPlugin`, registered by `packages/desktop/electron.vite.config.ts` before the shared app plugin.
   - The `head-prepend` script serializes the registry into `window.__OPENCODE__`, resolves `opencode-skin-id`, and sets `document.documentElement.dataset.skin` before the shared theme preload runs.
   - For a custom skin, it writes the resolved `opencode-color-scheme` and `opencode-theme-id`. When the theme changes, it removes both cached theme CSS variants so stale tokens are not prepainted.
   - For `none`, it must preserve the user's stored colour scheme and theme.
   - The later `head` script applies the skin window background and theme-color before the renderer bundle starts, avoiding an initial colour flash.
3. `initializeSkinStyles()` in `index.ts` runs near renderer startup.
   - It sets `data-opencode-desktop="true"`, which activates desktop-only workspace CSS.
   - It registers the catalog with the shared skin context.
   - It watches `data-skin` and imports the matching stylesheet from `styles.ts` once per renderer lifetime.
4. `SkinProvider` in `packages/app/src/context/skin.tsx` owns the runtime selection.
   - `none` is reserved for the unskinned OpenCode presentation and must not be used by a custom skin.
   - The selected ID is stored under `opencode-skin-id` and synchronized across windows through the `storage` event.
   - `skinSettingsLocked()` mirrors the active ID in a module-level reactive store so shared settings and command registrations can react without consuming `SkinProvider`.
   - For a custom skin, the provider enforces the resolved appearance even if another code path attempts a theme change. It waits for an asynchronously loaded theme before applying window colours so theme application cannot overwrite the skin background.
   - Selection updates `data-skin`, the document background, the HTML theme-color, and the native window background/titlebar through `window.api`.
5. Native titlebar colours use the optional `background` and `symbolColor` fields in `TitlebarTheme`. `packages/desktop/src/main/windows.ts` must merge partial titlebar updates because theme and skin changes arrive independently.
6. `SettingsSkinSelect` in `packages/app/src/components/settings-skin-select.tsx` exposes the same registry in both legacy and V2 desktop settings.

## Definition contract

`SkinDefinition` values are serialized into an inline preload script. Keep definitions JSON-safe: use plain strings and objects, with no functions, DOM objects, or runtime-only values.

- `id`: unique stable storage and `data-skin` identifier. Never use the reserved `none` ID.
- `name`: user-facing settings label.
- `appearance.colorScheme`: optional `light` or `dark`; defaults to `light`.
- `appearance.theme`: optional valid theme ID from `packages/ui/src/theme/themes`; defaults to `oc-2`.
- `window.background`: optional document and native-window background.
- `window.titlebar`: optional native titlebar background.
- `window.symbols`: optional native titlebar symbol colour.

Keep appearance defaults identical in `packages/app/src/context/skin.tsx` and the pre-render script in `vite.ts`. Existing skins should state their appearance explicitly even when it matches the defaults, so their intended pairing is reviewable from the skin file.

## Adding or changing a skin

For a skin with ID `<id>`:

1. Add `<id>/skin.ts` exporting a `SkinDefinition` that follows the definition contract. Prefer `satisfies SkinDefinition` so invalid appearance values fail type checking without widening the definition.
2. Add `<id>/index.css` and any colocated assets.
3. Register the definition in `catalog.ts`.
4. Add a dynamic stylesheet loader in `styles.ts` using the same ID.
5. Keep every CSS selector under both desktop and skin markers, for example:

   ```css
   html[data-opencode-desktop="true"][data-skin="<id>"] [data-component="example"] {
     /* skin-specific declaration */
   }
   ```

6. Update `defaultDesktopSkinID` only when intentionally changing the first-run desktop appearance.
7. Extend `packages/app/src/context/skin.test.ts` when registry, defaulting, appearance resolution, or settings-lock state changes.
8. Extend `vite.test.ts` when selection, persistence, theme cache invalidation, colour scheme, theme, or prepaint behaviour changes.

The catalog and lazy-style map are deliberately separate: the catalog must be serializable during HTML transformation, while `styles.ts` creates renderer chunks. Keep their IDs in sync.

## Assets and visual QA

- Keep skin assets colocated with the skin and reference them through the stylesheet so Vite fingerprints and packages them. Do not load runtime artwork from a remote URL.
- Prefer original or generated artwork over copied promotional or news images. Avoid watermarks and optimize raster assets before committing without making gradients or dark detail visibly banded.
- Inspect each source image before editing it, then render the finished skin in its actual desktop composition. Check at least a representative desktop viewport and any narrow layout affected by responsive rules.
- Verify asset cropping, text contrast, titlebar button clearance, sidebar selection, and hover/focus-revealed actions. A source image that looks correct by itself is not sufficient visual verification.
- Temporary HTML fixtures and local preview servers are for inspection only. Remove fixtures, close preview tabs, and stop servers before the final status check.

## Verification

Run tests and type checks from package directories, never from the repository root:

```sh
cd packages/app
bun test --preload ./happydom.ts ./src/context/skin.test.ts
bun typecheck

cd ../desktop
bun test ./src/renderer/skins/vite.test.ts
bun typecheck
```

For a distributable desktop change, also run from the repository root:

```sh
bun run --cwd packages/desktop build
bun run --cwd packages/desktop package
```

After verification, confirm that build output did not introduce tracked changes with `git status --short`, and review the existing-file conflict surface with `git diff --stat 17544802`.
