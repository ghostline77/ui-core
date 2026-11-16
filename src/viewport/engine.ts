import {
  ACESFilmicToneMapping,
  AnimationMixer,
  Box3,
  BoxHelper,
  Color,
  DirectionalLight,
  GridHelper,
  Group,
  HemisphereLight,
  Material,
  Mesh,
  PerspectiveCamera,
  PMREMGenerator,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Spherical,
  SkinnedMesh,
  Texture,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import type { AnimationClip, Object3D, WebGLRenderTarget } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { frameCamera } from "./camera.js";
import type { CameraView } from "./camera.js";

export type TransformMode = "translate" | "rotate" | "scale";
export type ViewportLighting = "default" | "material";
export interface ObjectTransform {
  id: string;
  position: [number, number, number];
  quaternion: [number, number, number, number];
  scale: [number, number, number];
}
export interface ViewportSelection {
  id: string;
  name: string;
  object: Object3D;
}

/** Release resources owned by a loaded asset, never caller-owned Object3D resources. */
export function disposeAsset(root: Object3D): void {
  const geometries = new Set<Mesh["geometry"]>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  const skeletons = new Set<SkinnedMesh["skeleton"]>();
  root.traverse((object) => {
    if (object instanceof SkinnedMesh) skeletons.add(object.skeleton);
    if (object instanceof Mesh) {
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material)
        ? object.material
        : [object.material])
        materials.add(material);
    }
  });
  for (const material of materials) {
    for (const value of Object.values(material))
      if (value instanceof Texture) textures.add(value);
    material.dispose();
  }
  for (const geometry of geometries) geometry.dispose();
  for (const skeleton of skeletons) skeleton.dispose();
  for (const texture of textures) {
    texture.dispose();
    const image: unknown = texture.source.data;
    if (typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap)
      image.close();
  }
}

export class ViewportEngine {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(40, 1, 0.001, 1000);
  readonly controls: OrbitControls;
  private readonly root = new Group();
  private readonly grid = new GridHelper(10, 20, "#60714e", "#343e33");
  private readonly gizmo: TransformControls;
  private readonly observer: ResizeObserver;
  private model: Object3D | null = null;
  private selection: Object3D | null = null;
  private outline: BoxHelper | null = null;
  private mixer: AnimationMixer | null = null;
  private clips: AnimationClip[] = [];
  private playing = false;
  private frame = 0;
  private lastTime = 0;
  private disposed = false;
  private pointer = new Vector2();
  private dragged = false;
  private view: CameraView = "perspective";
  private framed = false;
  private readonly environment: WebGLRenderTarget;
  private readonly hemisphere = new HemisphereLight("#e6eddb", "#424b43", 2);
  private readonly keyLight = new DirectionalLight("#fff4e5", 3);
  private readonly fillLight = new DirectionalLight("#c9dcf1", 1);
  onSelect: (selection: ViewportSelection | null) => void = () => {};
  onTransformCommit: (transform: ObjectTransform) => void = () => {};
  onContextLost: () => void = () => {};

  constructor(private readonly host: HTMLElement) {
    this.renderer = new WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const environment = new RoomEnvironment();
    const pmrem = new PMREMGenerator(this.renderer);
    this.environment = pmrem.fromScene(environment, 0.04);
    this.scene.environment = this.environment.texture;
    this.scene.environmentIntensity = 0.25;
    environment.dispose();
    pmrem.dispose();
    this.camera.position.set(4, 3, 4);
    this.camera.lookAt(0, 0, 0);
    const canvas = this.renderer.domElement;
    canvas.style.cssText =
      "display:block;width:100%;height:100%;touch-action:none";
    canvas.tabIndex = 0;
    canvas.setAttribute("aria-label", "Interactive 3D scene");
    this.host.append(canvas);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.addEventListener("change", this.invalidate);
    this.controls.addEventListener("start", () =>
      canvas.focus({ preventScroll: true }),
    );
    this.controls.listenToKeyEvents(canvas);
    this.gizmo = new TransformControls(this.camera, canvas);
    this.gizmo.enabled = false;
    this.gizmo.addEventListener("dragging-changed", (event) => {
      this.controls.enabled = !event.value;
      if (event.value) this.dragged = true;
    });
    this.gizmo.addEventListener("change", this.invalidate);
    this.gizmo.addEventListener("mouseUp", () => {
      if (this.selection)
        this.onTransformCommit({
          id: this.identity(this.selection),
          position: this.selection.position.toArray(),
          quaternion: this.selection.quaternion.toArray(),
          scale: this.selection.scale.toArray(),
        });
    });
    this.scene.add(this.root, this.grid, this.gizmo.getHelper());
    const key = this.keyLight;
    key.position.set(3, 5, 4);
    const fill = this.fillLight;
    fill.position.set(-4, 2, -2);
    this.scene.add(this.hemisphere, key, fill);
    canvas.addEventListener("pointerdown", this.pointerDown);
    canvas.addEventListener("pointerup", this.pointerUp);
    canvas.addEventListener("keydown", this.keyDown);
    canvas.addEventListener("webglcontextlost", this.contextLost);
    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(host);
    this.resize();
  }
  /** Neutral, broad illumination for evaluating metallic and painted surfaces. */
  setLighting(lighting: ViewportLighting): void {
    const material = lighting === "material";
    this.scene.environmentIntensity = material ? 1.5 : 0.25;
    this.renderer.toneMappingExposure = material ? 1.15 : 1;
    this.hemisphere.color.set(material ? "#ffffff" : "#e6eddb");
    this.hemisphere.groundColor.set(material ? "#b8b8b8" : "#424b43");
    this.keyLight.color.set(material ? "#ffffff" : "#fff4e5");
    this.fillLight.color.set(material ? "#ffffff" : "#c9dcf1");
    this.fillLight.intensity = material ? 2.5 : 1;
    this.invalidate();
  }
  invalidate = (): void => {
    if (!this.disposed && !this.frame)
      this.frame = requestAnimationFrame(this.render);
  };
  private render = (time: number): void => {
    this.frame = 0;
    if (this.disposed) return;
    this.controls.update();
    if (this.playing && this.mixer) {
      this.mixer.update(Math.min((time - (this.lastTime || time)) / 1000, 0.1));
      this.invalidate();
    }
    this.lastTime = time;
    this.outline?.update();
    this.renderer.render(this.scene, this.camera);
  };
  private resize = (): void => {
    const { width, height } = this.host.getBoundingClientRect();
    if (width < 1 || height < 1) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    if (this.model) this.fit(this.view);
    this.invalidate();
  };
  private identity(object: Object3D): string {
    return typeof object.userData["assetId"] === "string"
      ? object.userData["assetId"]
      : object.name || object.uuid;
  }
  private pointerDown = (event: PointerEvent): void => {
    this.pointer.set(event.clientX, event.clientY);
    this.dragged = false;
  };
  private pointerUp = (event: PointerEvent): void => {
    if (
      event.button !== 0 ||
      this.dragged ||
      this.pointer.distanceTo(new Vector2(event.clientX, event.clientY)) > 4 ||
      !this.model
    )
      return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ray = new Raycaster();
    ray.setFromCamera(
      new Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        (-(event.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      this.camera,
    );
    const hit = ray.intersectObject(this.model, true).find((hit) => {
      let object: Object3D | null = hit.object;
      while (object) {
        if (!object.visible) return false;
        object = object.parent;
      }
      return true;
    });
    this.select(hit?.object || null);
  };
  private keyDown = (event: KeyboardEvent): void => {
    if (event.key.toLowerCase() === "f") {
      event.preventDefault();
      this.fit(this.view, true);
    } else if (event.key === "Escape") this.select(null);
  };
  private contextLost = (event: Event): void => {
    event.preventDefault();
    this.onContextLost();
  };
  setModel(
    object: Object3D | null,
    clips: AnimationClip[] = [],
    preserveCamera = false,
  ): void {
    this.select(null);
    if (this.model && this.mixer) {
      this.mixer.stopAllAction();
      this.mixer.uncacheRoot(this.model);
    }
    this.root.clear();
    this.model = object;
    this.clips = clips;
    this.mixer = object ? new AnimationMixer(object) : null;
    this.playing = false;
    if (object) {
      this.root.add(object);
      object.updateMatrixWorld(true);
      const bounds = new Box3().setFromObject(object);
      if (!bounds.isEmpty()) {
        this.grid.position.y = bounds.min.y;
        const scale = Math.max(bounds.getSize(new Vector3()).length(), 0.1) / 5;
        this.grid.scale.setScalar(scale);
        if (!preserveCamera || !this.framed) this.fit();
        this.framed = true;
      }
    }
    this.invalidate();
  }
  zoom(factor: number): void {
    if (!Number.isFinite(factor) || factor <= 0) return;
    const offset = this.camera.position.clone().sub(this.controls.target);
    offset.setLength(
      Math.max(
        this.controls.minDistance,
        Math.min(this.controls.maxDistance, offset.length() * factor),
      ),
    );
    this.camera.position.copy(this.controls.target).add(offset);
    this.controls.update();
    this.invalidate();
  }
  orbit(yaw: number, pitch = 0): void {
    const spherical = new Spherical().setFromVector3(
      this.camera.position.clone().sub(this.controls.target),
    );
    spherical.theta += yaw;
    spherical.phi = Math.max(
      0.01,
      Math.min(Math.PI - 0.01, spherical.phi + pitch),
    );
    this.camera.position
      .copy(this.controls.target)
      .add(new Vector3().setFromSpherical(spherical));
    this.controls.update();
    this.invalidate();
  }
  lookAt(
    eye: [number, number, number],
    target: [number, number, number],
  ): void {
    this.camera.position.fromArray(eye);
    this.controls.target.fromArray(target);
    this.camera.near = 0.001;
    this.camera.far = Math.max(
      1000,
      this.camera.position.distanceTo(this.controls.target) * 100,
    );
    this.camera.updateProjectionMatrix();
    this.controls.update();
    this.invalidate();
  }
  focus(center: [number, number, number], radius: number): void {
    const point = new Vector3(...center),
      size = new Vector3().setScalar(radius / Math.sqrt(3));
    this.controls.target.copy(
      frameCamera(
        this.camera,
        new Box3(point.clone().sub(size), point.clone().add(size)),
        this.view,
      ),
    );
    this.controls.update();
    this.invalidate();
  }
  select(object: Object3D | null): void {
    this.gizmo.detach();
    if (this.outline) {
      this.scene.remove(this.outline);
      this.outline.dispose();
      this.outline = null;
    }
    this.selection = object;
    if (object) {
      this.outline = new BoxHelper(object, new Color("#c6ee83"));
      this.scene.add(this.outline);
      if (this.gizmo.enabled) this.gizmo.attach(object);
    }
    this.onSelect(
      object
        ? {
            id: this.identity(object),
            name: object.name || "Unnamed object",
            object,
          }
        : null,
    );
    this.invalidate();
  }
  fit(view: CameraView = "perspective", selected = false): void {
    const object = selected && this.selection ? this.selection : this.model;
    if (!object) return;
    object.updateWorldMatrix(true, true);
    object.traverse((node) => {
      if (node instanceof SkinnedMesh) node.computeBoundingBox();
    });
    const bounds = new Box3().setFromObject(object);
    if (bounds.isEmpty()) return;
    this.view = view;
    this.controls.target.copy(frameCamera(this.camera, bounds, view));
    const size = Math.max(bounds.getSize(new Vector3()).length(), 0.01);
    this.controls.minDistance = size * 0.01;
    this.controls.maxDistance = size * 50;
    this.controls.update();
    this.invalidate();
  }
  setGrid(visible: boolean): void {
    this.grid.visible = visible;
    this.invalidate();
  }
  setTransformMode(mode: TransformMode | null): void {
    this.gizmo.enabled = mode !== null;
    if (mode) {
      this.gizmo.setMode(mode);
      if (this.selection) this.gizmo.attach(this.selection);
    } else this.gizmo.detach();
    this.invalidate();
  }
  playAnimation(name: string | null): void {
    this.mixer?.stopAllAction();
    const clip = this.clips.find((clip) => clip.name === name);
    this.playing = Boolean(clip && this.mixer);
    if (clip && this.mixer) this.mixer.clipAction(clip).play();
    this.lastTime = 0;
    this.invalidate();
  }
  seekAnimation(name: string, seconds: number): void {
    const clip = this.clips.find((clip) => clip.name === name);
    if (!clip || !this.mixer || !Number.isFinite(seconds)) return;
    this.mixer.stopAllAction();
    const action = this.mixer.clipAction(clip).reset().play();
    action.time = Math.max(0, Math.min(clip.duration, seconds));
    action.paused = true;
    this.mixer.update(0);
    this.playing = false;
    this.lastTime = 0;
    this.invalidate();
  }
  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.setModel(null);
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("pointerdown", this.pointerDown);
    canvas.removeEventListener("pointerup", this.pointerUp);
    canvas.removeEventListener("keydown", this.keyDown);
    canvas.removeEventListener("webglcontextlost", this.contextLost);
    this.controls.dispose();
    this.gizmo.dispose();
    this.grid.geometry.dispose();
    for (const material of Array.isArray(this.grid.material)
      ? this.grid.material
      : [this.grid.material])
      material.dispose();
    this.renderer.dispose();
    this.environment.dispose();
    this.renderer.forceContextLoss();
    canvas.remove();
  }
}
