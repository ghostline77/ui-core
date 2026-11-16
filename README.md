# Ghostline UI core

Shared React 19 / TypeScript components, Tailwind 4 tokens and an interactive
browser 3D viewport. The palette, compact controls and editor layout follow
`character-builder`: charcoal backgrounds, green-grey surfaces and lime accents.
Builder, catalogue and workspot frontends consume this package. See
[consuming applications](docs/consuming-apps.md) for workspace builds, backend
ports, controller ownership and catalogue publication.

## Develop and build

```powershell
npm ci
npm run dev
npm run check
```

The standalone showcase runs at `http://127.0.0.1:8796`. It includes procedural
objects, a room, material controls, selection and transformation handles, and
loads self-contained local GLB files or glTF/GLB URLs. It requires no game data
or Rust service. `npm run build` creates the reusable library in `dist`;
`npm run build:demo` creates a separate static showcase in `demo-dist`.
The authored `/examples/triangle.gltf` is a small loader check, not a game asset.

## Consume from GitHub

Install the package from the `ghostline77` GitHub organization and React / React DOM 19:

```sh
npm install @ghostline/ui-core@github:ghostline77/ui-core react@19 react-dom@19
```

The Git dependency builds its library during installation. Commit your lockfile to pin the revision. Install Three.js when using the viewport.

```tsx
import "@ghostline/ui-core/styles.css";
import { AppShell, Button, Panel, Workspace } from "@ghostline/ui-core";
import { Viewport } from "@ghostline/ui-core/viewport";
import type { ViewportSource } from "@ghostline/ui-core/viewport";

// Keep source objects stable (useMemo for dynamic sources).
const source: ViewportSource = { kind: "gltf", url: "/assets/character.glb" };

export function Editor() {
  return (
    <AppShell
      product="Character builder"
      actions={<Button>Save project</Button>}
    >
      <Workspace
        library={<Panel title="Catalogue" />}
        inspector={<Panel title="Character" />}
      >
        <Viewport label="Character preview" source={source} />
      </Workspace>
    </AppShell>
  );
}
```

The default import contains no Three.js runtime. The viewport is a separate
entry point. Compiled `styles.css` includes the component utilities so a consumer
does not have to scan library source with Tailwind. For its own Tailwind classes,
the consumer can import `@ghostline/ui-core/theme.css` into its Tailwind stylesheet
to use `bg-panel`, `text-accent`, `border-line`, etc. Import the compiled styles
once, before consumer overrides. All editors should use these tokens rather than
copying colour literals. The `.gl-root` wrapper opts into page defaults; Tailwind
preflight is included in compiled styles and intended for new React applications.

Controller-based editors can use `mountViewport(element, options)` from the
viewport entry point. Its `load(url)` accepts self-contained GLBs, including blob
URLs, and its `fit`, `focus`, `lookAt`, `orbit` and `zoom` methods update only the
local camera. Call `dispose()` when removing the editor. The three native builders
use `renderer::Scene::browser_glb` to send evaluated geometry and embedded maps;
their normal image and mod export pipelines remain separate.

Components include `AppShell`, `Workspace`, `Panel`, `Toolbar`, `Button`, `Field`,
`Input`, `Select`, `Checkbox`, `Slider`, `SegmentedControl`, `AssetCard`, `Badge`,
`Status`, `Disclosure`, `EmptyState` and a native modal `Dialog` with focus trapping,
Escape handling and focus restoration. Inputs accept normal HTML/ARIA props;
associate additional hint/error descriptions with `aria-describedby` when needed.

## Browser 3D contract

The native builders prepare geometry in Rust and send it to the browser.
The viewport uses this contract:

1. The Rust backend decodes/resolves native meshes, rigs, materials and textures.
2. It supplies a browser-ready scene, preferably a self-contained GLB with embedded
   textures. Native paths/record IDs belong in glTF `extras` / `Object3D.userData`.
3. `Viewport` uploads it once. Camera movement, picking, materials, animation and
   object transforms are handled by the browser GPU without render requests.
4. `onTransformCommit` returns local position/quaternion/scale; the application
   updates its authored project and performs native validation/export in Rust.

This package does not implement native game decoding or new Rust export endpoints.
A consuming backend supplies its own scene adapter. The viewport also accepts
`Object3D` hierarchies.

Browser coordinates are right-handed, **Y up, metres**, matching glTF. Adapt RED
coordinates in the backend scene exporter exactly once, including transforms,
normals, winding, skinning and animation; do not rotate only vertices in the UI.
Preserve mesh/component names, rig hierarchy, draw visibility, submesh/material
bindings, UVs, alpha mode, double-sidedness, skin weights and morphs in that adapter.
Provide unique stable `userData.assetId` strings for picking/export identities;
names or generated UUIDs are only local fallbacks.

Orbit: left-drag. Pan: right-drag or modified left-drag; arrows when canvas focused.
Zoom: wheel or middle-drag. Touch uses one finger to orbit, two fingers to pan/zoom.
`F` frames the selection or scene; Escape clears selection. Camera presets and
fit-all controls are keyboard buttons. The pane resizes responsively and fits
portrait bounds as well as landscape. Rendering is on demand, with animation
frames only during camera damping, animation playback or explicit invalidation.
Pixel ratio is capped at two. Context loss and load failures are visible errors.

Use a `ViewportHandle` ref for `fit(view, selection)`, `invalidate()` after external
scene/material edits, and `playAnimation(name | null)`. `onLoad` supplies the
instantiated object and available clip names. `transformMode` enables move,
rotate or scale handles on the picked mesh. Commit callbacks use local-space
transforms; a consumer can select logical parent groups via its own source adapter.

GLB/glTF scene requests are cancelled/superseded on source change. External
glTF buffers/textures resolve relative to the scene URL and must be accessible
under the same origin or CORS policy. Compressed assets needing Draco/KTX2 or
Meshopt decoders are not enabled by this initial loader; send uncompressed GLB.
Each loaded asset owns its GPU buffers/materials/textures and is disposed on
replacement/unmount. Caller-supplied Object3D hierarchies are cloned for poses
and transforms; their geometry/material/texture resources remain caller-owned
and shared. Clone materials inside a material adapter before mutating them if
other views share the same objects. Return cleanup for adapter-owned resources.

## Materials and shader scope

The initial renderer is Three.js WebGL2 with glTF PBR materials, sRGB output,
ACES tone mapping and fixed studio lights. It is an interactive preview, not
pixel-identical to the Rust renderer. Hair, skin, multilayer surfaces, decals,
flow maps and other Cyberpunk-specific materials need explicit browser material
adapters; basic glTF PBR alone does not reproduce them.

`renderer/src/studio.wgsl` is WGSL bound to the native wgpu pipeline and its buffers,
bind groups and texture conventions. It cannot be pasted into this WebGL shader
pipeline. `materialAdapter(object, invalidate)` is the extension point for Three
materials/GLSL shaders; it returns optional cleanup. A later WebGPU renderer may
share shader algorithms, but still needs an explicit resource/material bridge.
Native high-quality renders and final exports remain in `renderer` and the
owning Rust tool. Keep preview shading changes here independent of native shaders.

References: [Tailwind Vite integration](https://tailwindcss.com/docs/installation/using-vite),
[Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html),
[OrbitControls](https://threejs.org/docs/pages/OrbitControls.html),
[TransformControls](https://threejs.org/docs/pages/TransformControls.html).
