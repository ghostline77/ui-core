# Consuming applications

The `ghostline77` GitHub organization contains `ui-core` and its application frontends:

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

Install and run each frontend from its own UI directory. Cargo builds install the locked dependencies when the frontend is required.

```sh
npm ci --workspaces=false
npm run build
```

The shared build tooling identifies applications by package name. Applications import the shared styles and TypeScript configuration through package exports.

Character and building builders render the shared interactive `Viewport` directly.
Rust prepares a self-contained GLB from the native assembly when its appearance,
shape, placement or visibility changes. Orbit, pan, zoom and view buttons update
the browser camera without calling a preview/render endpoint. Item builder uses
the `mountViewport` bridge while React owns the canvas lifecycle.
Native image APIs remain available for export thumbnails and layer-mask references.
Other frontends retain their existing preview paths.

Quest Builder's Cargo build hook installs its locked npm dependencies and builds
missing/stale frontend bundles before Rust embeds them. Node.js is required to
build the CLI. Library consumers can disable the default `build-ui` feature. Generated frontend output is in each app's `ui/dist` or `web/dist`.
Release executables embed built JavaScript/CSS and do not require Node or Vite
at runtime. Development servers proxy API requests to the existing backend;
override `GHOSTLINE_UI_BACKEND` or `GHOSTLINE_UI_PORT` for other local ports.
The development proxy checks the incoming origin before forwarding authorised
same-origin requests to the backend's origin. Backend session tokens remain intact.

Items and vehicles build a single classic-script bundle with relative URLs.
Their generated data scripts load first, preserving offline `file://` browsing
and deployment under a hosted subpath. Development reads data/media from the
catalogue repository’s own `dist/catalogue` without copying or regenerating it.

To update only the UI in an existing published catalogue:

```powershell
ghostline-items refresh-ui --catalogue PATH_TO_ITEMS_CATALOGUE
ghostline-vehicles refresh-ui --catalogue PATH_TO_VEHICLES_CATALOGUE
```

These commands replace the three browser assets and update their manifest
metadata. They do not discover resources, regenerate catalogue shards or touch
rendered media. Normal catalogue generation also publishes the new bundles.

## Responsive layout and visual ownership

`gl-app-shell`, `gl-app-header`, `gl-project-context` and `gl-project-actions`
isolate shared shell geometry from tool-local `header` and `nav` selectors.
The migrated apps use shared theme tokens and Tailwind utilities; `controller.css`
supports the remaining controller apps. Preserve visible keyboard focus,
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

From UI Core, run `npx playwright install chromium` and `npm run test:apps`. The test fetches and builds each required application in a temporary directory. To reuse built bundles, set `GHOSTLINE_TEST_ITEMS_DIST`, `GHOSTLINE_TEST_VEHICLES_DIST`, `GHOSTLINE_TEST_CHARACTER_BUILDER_DIST` or `GHOSTLINE_TEST_BUILDING_BUILDER_DIST` to the appropriate output directory.
It checks Items and Vehicles from hosted subpaths and `file://`, plus character
selection/save/jobs and building draft recovery, validation, history, placement
and export against isolated API fixtures. Quest builder has its own unit and
browser checks: `npm test` and
`npm run test:browser` from Quest Builder’s `ui/` directory. These browser fixtures do
not certify native material fidelity or in-game behaviour.

Set `GHOSTLINE_TEST_CHARACTER_GLB` and `GHOSTLINE_TEST_BUILDING_GLB` to existing
native preview files to exercise their geometry and materials in these browser
checks. Without them, the checks use a small GLB loader fixture.
