# Desktop skin customization

This directory contains the desktop-only skin registry, preload logic, and lazy-loaded skin styles. Keep the customization isolated here so future merges from upstream remain small and mechanical.

## Fork invariants

Preserve these behaviours when merging or refactoring:

- The development debug bar is hidden by default in both layouts. Gate the `DebugBar` call sites in `packages/app/src/pages/layout-new.tsx` and `packages/app/src/pages/layout.tsx` with `import.meta.env.VITE_ENABLE_DEBUG_BAR === "1"` so the component is not mounted and reserves no height. Do not move this check into `DebugBar` and do not rely on CSS visibility.
- The desktop channel badge (`DEV`, `BETA`, and similar channel text) is not displayed. Keep the `desktop-channel-indicator` hook in `packages/app/src/components/titlebar.tsx` and its desktop-scoped rule in `packages/desktop/src/renderer/codex-workspace.css`.
- Skin behaviour must not change the web application unless the user explicitly requests it.

## Change principles

- Prefer adding a new file in this directory over expanding or restructuring an upstream file.
- Treat edits outside this directory as integration hooks. Keep them to an import, provider/wrapper, registration call, or semantic `data-*` attribute whenever possible.
- Do not move, reformat, or rename unrelated upstream code. A small explicit hook is easier to replay than a clever structural rewrite.
- Prefer stable `data-component`, `data-slot`, and dedicated class hooks over selectors that depend on DOM depth, utility-class order, or translated text.
- Add a hook to shared application markup only when no existing semantic hook can express the target. Keep the original element structure and behaviour unchanged.
- Scope every desktop workspace or skin override through `html[data-opencode-desktop="true"]`. Scope skin-specific rules further through `html[data-skin="<id>"]`. Never add an unscoped `body`, component, or utility-class override.
- Keep skin CSS lazy-loaded. Do not statically import every skin stylesheet into the renderer entry point.
- Keep the shared app independent of the desktop package. `packages/app` may define the generic skin context and types; it must not import a desktop skin or desktop renderer module.
- Renderer code may call native functionality only through `window.api`, in accordance with `packages/desktop/AGENTS.md`.
- Do not edit generated sources or build output.

## Implementation flow

The skin system has two phases so the correct background is visible before Solid renders and the full stylesheet is still loaded on demand.

1. `catalog.ts` is the desktop registry. `desktopSkins` contains the serializable definitions and `defaultDesktopSkinID` selects the desktop default.
2. `vite.ts` provides `desktopSkinPreloadPlugin`, registered by `packages/desktop/electron.vite.config.ts` before the shared app plugin.
   - The `head-prepend` script serializes the registry into `window.__OPENCODE__`, resolves `opencode-skin-id`, sets `document.documentElement.dataset.skin`, and selects the light colour scheme for a custom skin before the shared theme preload runs.
   - The later `head` script applies the skin window background and theme-color before the renderer bundle starts, avoiding an initial colour flash.
3. `initializeSkinStyles()` in `index.ts` runs near renderer startup.
   - It sets `data-opencode-desktop="true"`, which activates desktop-only workspace CSS.
   - It registers the catalog with the shared skin context.
   - It watches `data-skin` and imports the matching stylesheet from `styles.ts` once per renderer lifetime.
4. `SkinProvider` in `packages/app/src/context/skin.tsx` owns the runtime selection.
   - `none` is reserved for the unskinned OpenCode presentation and must not be used by a custom skin.
   - The selected ID is stored under `opencode-skin-id` and synchronized across windows through the `storage` event.
   - Selection updates `data-skin`, the document background, the HTML theme-color, and the native window background/titlebar through `window.api`.
   - Custom skins currently require the light colour scheme. The `none` skin preserves the normal theme selection.
5. Native titlebar colours use the optional `background` and `symbolColor` fields in `TitlebarTheme`. `packages/desktop/src/main/windows.ts` must merge partial titlebar updates because theme and skin changes arrive independently.
6. `SettingsSkinSelect` in `packages/app/src/components/settings-skin-select.tsx` exposes the same registry in both legacy and V2 desktop settings.

`SkinDefinition` values are serialized into an inline preload script. Keep definitions JSON-safe: use plain strings and objects, with no functions, DOM objects, or runtime-only values.

## Adding or changing a skin

For a skin with ID `<id>`:

1. Add `<id>/skin.ts` exporting a `SkinDefinition` with a unique, stable ID, display name, and native window colours.
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
7. Extend preload tests when selection, persistence, defaulting, colour-scheme, or prepaint behaviour changes.

The catalog and lazy-style map are deliberately separate: the catalog must be serializable during HTML transformation, while `styles.ts` creates renderer chunks. Keep their IDs in sync.

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
