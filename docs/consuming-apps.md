# Consuming applications

The JavaScript workspace at `ghostline77` contains `ui-core` and its application frontends:

| Application | Source | Development UI | Default backend |
|---|---|---|---|
| Character builder | `character-builder/ui/src` | 8887 | 8787 |
| Building builder | `building-builder/ui/src` | 8892 | 8792 |
| Item builder | `item-builder/ui/src` | 8893 | 8793 |
| Quest builder | `quest-builder/ui/src` | 8890 | 8790 |
| Race builder | `race-builder/ui/src` | 8895 | 8795 |
| Items catalogue | `items/web/src` | 8901 | Published files |
| Vehicles catalogue | `vehicles/web/src` | 8902 | Published files |
| Workspots | `workspots/ui/src` | Embedded UI | 8820 |

Run from the `ghostline77` workspace root:

```powershell
npm ci
npm run build:uis
npm run check:uis
npm run dev -w @ghostline/character-builder-ui
```

All app shells use React/TypeScript and shared `AppShell`, `Button`, `Input` and
`Select` components. Theme tokens, control styling, focus rings and dialog styling
come from ui-core. Tool-local styles retain their layouts, domain visualisations
and specialised editors. Import ordering puts local styles in the `app-layout`
cascade layer, then the shared component styles and domain-control styles.

`mountApp` renders the shell synchronously before importing the existing domain
controller. Character and item controllers expose `startController` so their
asynchronous bootstrap runs after the bundle has initialised. Controllers retain
their backend calls and project/data rules, and
own only their designated list/editor leaves. Do not add React-rendered descendants
inside a controller-owned leaf, or rerender its ancestor with new children.
Development hot reload is disabled for these one-shot controller roots; reload
explicitly after source edits. This avoids replacing an active editor DOM while
retaining stale controller references. The standalone ui-core showcase remains
a normal React development application.

Character, building and item builders mount the shared interactive `Viewport`.
Rust prepares a self-contained GLB from the native assembly when its appearance,
shape, placement or visibility changes. Orbit, pan, zoom and view buttons update
the browser camera without calling a preview/render endpoint. `mountViewport`
provides a controller-facing bridge while React owns the canvas lifecycle.
Native image APIs remain available for export thumbnails and layer-mask references.
Other frontends retain their existing preview paths.

The shared Cargo build hook builds missing/stale frontend bundles before Rust
embeds them. Install workspace npm dependencies before invoking Cargo on a fresh
checkout. Generated frontend output is in each app's `ui/dist` or `web/dist`.
Release executables embed built JavaScript/CSS and do not require Node or Vite
at runtime. Development servers proxy API requests to the existing backend;
override `GHOSTLINE_UI_BACKEND` or `GHOSTLINE_UI_PORT` for other local ports.
The development proxy checks the incoming origin before forwarding authorised
same-origin requests to the backend's origin. Backend session tokens remain intact.

Items and vehicles build a single classic-script bundle with relative URLs.
Their generated data scripts load first, preserving offline `file://` browsing
and deployment under a hosted subpath. Development reads data/media from the
existing sibling `dist/catalogue` without copying or regenerating it.

To update only the UI in an existing published catalogue:

```powershell
items/target/release/ghostline-items.exe refresh-ui --catalogue items/dist/catalogue
vehicles/target/release/ghostline-vehicles.exe refresh-ui --catalogue vehicles/dist/catalogue
```

These commands replace the three browser assets and update their manifest
metadata. They do not discover resources, regenerate catalogue shards or touch
rendered media. Normal catalogue generation also publishes the new bundles.

## Responsive layout and visual ownership

`gl-app-shell`, `gl-app-header`, `gl-project-context` and `gl-project-actions`
isolate shared shell geometry from tool-local `header` and `nav` selectors.
Palette aliases and control states belong in `controller.css`; specialised editor
layouts belong in each app's `src/style.css`. Preserve visible keyboard focus,
selected states, wrapped action rows and access to every inspector panel.

Editors use their full desktop columns when there is room. At intermediate widths,
inspectors move below the working area. At narrow widths, panels stack and retain
normal page scrolling; do not hide a library or inspector to make the canvas fit.
Map and preview canvases retain explicit usable heights. Tables may scroll inside
their own container, but should not widen the page. Popup menus must remain inside
the viewport, including when their trigger wraps onto another row.

The frontends bundle the same local Inter variable font and its license from
`src/assets/fonts`. The app build inlines it into CSS so embedded executables and
offline catalogues need no additional font route or external font service.

For visual checks, review every app at 320, 390, 768 and 1280 pixels wide, including
the panels below the initial viewport, open menus and keyboard focus. Check layout
and media loading after embedding the production bundles as well as in Vite.
