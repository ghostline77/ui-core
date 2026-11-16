import { createRef } from "react";
import { createRoot } from "react-dom/client";
import { nativeMaterials } from "./nativeMaterials.js";
import type { Object3D } from "three";
import { Viewport } from "./Viewport.js";
import type { ViewportHandle, ViewportSource } from "./Viewport.js";
import type { CameraView } from "./camera.js";

/** Mounts the shared React viewport inside a controller-owned editor leaf. */
export function mountViewport(
  container: HTMLElement,
  options: {
    label: string;
    character?: boolean;
    onError?: (error: Error) => void;
    onLoad?: () => void;
  },
) {
  const host = document.createElement("div");
  host.className = "gl-embedded-viewport";
  host.hidden = true;
  container.append(host);
  const root = createRoot(host),
    ref = createRef<ViewportHandle>();
  let source: ViewportSource | undefined;
  let loading = false;
  let pendingCamera: (() => void) | undefined;
  const cameraAction = (action: () => void) => {
    if (loading) pendingCamera = action;
    else action();
  };
  const adapter = (object: Object3D) => {
    if (options.character) object.rotation.y = Math.PI;
    nativeMaterials(object);
  };
  const render = () =>
    root.render(
      <Viewport
        ref={ref}
        label={options.label}
        {...(source ? { source } : {})}
        grid={false}
        toolbar={false}
        preserveCamera
        materialAdapter={adapter}
        onError={(error) => {
          loading = false;
          pendingCamera = undefined;
          options.onError?.(error);
        }}
        onLoad={() => {
          loading = false;
          pendingCamera?.();
          pendingCamera = undefined;
          options.onLoad?.();
        }}
      />,
    );
  render();
  return {
    load(url: string) {
      loading = true;
      host.hidden = false;
      source = { kind: "gltf", url };
      render();
    },
    clear() {
      loading = false;
      pendingCamera = undefined;
      host.hidden = true;
      source = undefined;
      render();
    },
    fit(view: CameraView = "perspective") {
      cameraAction(() => ref.current?.fit(view));
    },
    zoom(factor: number) {
      ref.current?.zoom(factor);
    },
    orbit(yaw: number, pitch = 0) {
      ref.current?.orbit(yaw, pitch);
    },
    lookAt(eye: [number, number, number], target: [number, number, number]) {
      cameraAction(() => ref.current?.lookAt(eye, target));
    },
    focus(center: [number, number, number], radius: number) {
      cameraAction(() =>
        ref.current?.focus(
          options.character ? [-center[0], center[1], -center[2]] : center,
          radius,
        ),
      );
    },
    dispose() {
      root.unmount();
      host.remove();
    },
  };
}
