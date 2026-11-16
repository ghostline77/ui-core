import { useEffect, useImperativeHandle, useRef, useState } from "react";
import type { ReactNode, Ref } from "react";
import type { AnimationClip, Object3D } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { Button, Status, Toolbar } from "../components.js";
import { cn } from "../utils.js";
import { disposeAsset, ViewportEngine } from "./engine.js";
import type {
  ObjectTransform,
  TransformMode,
  ViewportSelection,
  ViewportLighting,
} from "./engine.js";
import type { CameraView } from "./camera.js";

export type ViewportSource =
  | { kind: "gltf"; url: string }
  | { kind: "object"; object: Object3D; animations?: AnimationClip[] };
export interface ViewportHandle {
  fit: (view?: CameraView, selection?: boolean) => void;
  invalidate: () => void;
  playAnimation: (name: string | null) => void;
  seekAnimation: (name: string, seconds: number) => void;
  zoom: (factor: number) => void;
  orbit: (yaw: number, pitch?: number) => void;
  lookAt: (
    eye: [number, number, number],
    target: [number, number, number],
  ) => void;
  focus: (center: [number, number, number], radius: number) => void;
}
export interface ViewportProps {
  source?: ViewportSource;
  label: string;
  className?: string;
  grid?: boolean;
  toolbar?: boolean;
  preserveCamera?: boolean;
  /** Material inspection uses neutral lights and stronger environment reflections. */
  lighting?: ViewportLighting;
  transformMode?: TransformMode | null;
  ref?: Ref<ViewportHandle>;
  onSelect?: (selection: ViewportSelection | null) => void;
  onTransformCommit?: (transform: ObjectTransform) => void;
  onLoad?: (object: Object3D, animationNames: string[]) => void;
  onError?: (error: Error) => void;
  /** Material customisation runs once per asset load, not on camera movement. Return cleanup for adapter-owned resources. */
  materialAdapter?: (
    object: Object3D,
    invalidate: () => void,
  ) => void | (() => void);
  overlay?: ReactNode;
}

export function Viewport({
  source,
  label,
  className,
  grid = true,
  toolbar = true,
  preserveCamera = false,
  lighting = "default",
  transformMode = null,
  ref,
  overlay,
  ...callbacks
}: ViewportProps) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(callbacks);
  latest.current = callbacks;
  const [engine, setEngine] = useState<ViewportEngine | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!host.current) return;
    let instance: ViewportEngine;
    try {
      instance = new ViewportEngine(host.current);
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error(String(cause));
      setError("3D preview unavailable: " + error.message);
      latest.current.onError?.(error);
      return;
    }
    instance.onSelect = (selection) => latest.current.onSelect?.(selection);
    instance.onTransformCommit = (transform) =>
      latest.current.onTransformCommit?.(transform);
    instance.onContextLost = () =>
      setError(
        "The graphics context was lost. Reload this viewport to restore it.",
      );
    setEngine(instance);
    return () => instance.dispose();
  }, []);
  useEffect(() => {
    engine?.setGrid(grid);
  }, [engine, grid]);
  useEffect(() => {
    engine?.setLighting(lighting);
  }, [engine, lighting]);
  useEffect(() => {
    engine?.setTransformMode(transformMode);
  }, [engine, transformMode]);
  useImperativeHandle(
    ref,
    () => ({
      fit: (view, selection) => engine?.fit(view, selection),
      invalidate: () => engine?.invalidate(),
      playAnimation: (name) => engine?.playAnimation(name),
      seekAnimation: (name, seconds) => engine?.seekAnimation(name, seconds),
      zoom: (factor) => engine?.zoom(factor),
      orbit: (yaw, pitch) => engine?.orbit(yaw, pitch),
      lookAt: (eye, target) => engine?.lookAt(eye, target),
      focus: (center, radius) => engine?.focus(center, radius),
    }),
    [engine],
  );
  useEffect(() => {
    if (!engine) return;
    const abort = new AbortController();
    let owned: Object3D | null = null;
    let adapterCleanup: void | (() => void);
    setError("");
    setStatus(source ? "Loading scene…" : "");
    engine.setModel(null);
    async function load() {
      if (!source) return;
      let object: Object3D;
      let clips: AnimationClip[];
      if (source.kind === "object") {
        object = clone(source.object);
        clips = source.animations || [];
      } else {
        const url = new URL(source.url, window.location.href);
        const response = await fetch(url, { signal: abort.signal });
        if (!response.ok)
          throw new Error(`Scene request failed (${response.status})`);
        if (response.headers.get("content-type")?.includes("text/html"))
          throw new Error("No 3D asset was found at this URL.");
        const gltf = await new GLTFLoader().parseAsync(
          await response.arrayBuffer(),
          url.protocol === "blob:" ? "" : new URL(".", url).href,
        );
        object = gltf.scene;
        clips = gltf.animations;
        if (abort.signal.aborted) {
          disposeAsset(object);
          return;
        }
        owned = object;
      }
      if (abort.signal.aborted) return;
      adapterCleanup = latest.current.materialAdapter?.(
        object,
        engine!.invalidate,
      );
      engine!.setModel(object, clips, preserveCamera);
      setStatus("");
      latest.current.onLoad?.(
        object,
        clips.map((clip) => clip.name),
      );
    }
    void load().catch((cause) => {
      if (abort.signal.aborted) return;
      const error = cause instanceof Error ? cause : new Error(String(cause));
      setStatus("");
      setError(error.message);
      latest.current.onError?.(error);
    });
    return () => {
      abort.abort();
      engine.setModel(null);
      adapterCleanup?.();
      if (owned) disposeAsset(owned);
    };
  }, [engine, source, callbacks.materialAdapter, preserveCamera]);
  return (
    <section
      aria-label={label}
      className={cn("relative flex min-h-[360px] flex-1 flex-col", className)}
    >
      {toolbar && (
        <Toolbar className="justify-between">
          <div className="flex flex-wrap gap-1">
            {(["perspective", "front", "right", "top"] as const).map((view) => (
              <Button
                key={view}
                size="sm"
                onClick={() => engine?.fit(view)}
                disabled={!source || !engine}
              >
                {view === "perspective"
                  ? "¾ view"
                  : view.charAt(0).toUpperCase() + view.slice(1)}
              </Button>
            ))}
            <Button
              size="sm"
              onClick={() => engine?.fit()}
              disabled={!source || !engine}
            >
              Fit all
            </Button>
          </div>
          <span className="text-xs text-muted">
            Drag to orbit · right-drag to pan · scroll to zoom
          </span>
        </Toolbar>
      )}
      <div
        ref={host}
        className="gl-viewport-canvas relative min-h-[300px] flex-1 overflow-hidden"
      />
      {(status || error || !source) && (
        <div className="pointer-events-none absolute inset-x-4 top-20 rounded-control bg-panel/90 p-3">
          <Status tone={error ? "danger" : "neutral"}>
            {error || status || "Choose an asset to preview"}
          </Status>
        </div>
      )}
      {overlay}
    </section>
  );
}
