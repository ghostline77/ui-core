import { Box3, PerspectiveCamera, Vector3 } from "three";

export type CameraView =
  "front" | "back" | "left" | "right" | "top" | "perspective";
const directions: Record<CameraView, [number, number, number]> = {
  front: [0, 0, 1],
  back: [0, 0, -1],
  left: [-1, 0, 0],
  right: [1, 0, 0],
  top: [0, 1, 0.0001],
  perspective: [1, 0.65, 1],
};

/** Frames a bounding sphere using the narrower field of view, including portrait panes. */
export function frameCamera(
  camera: PerspectiveCamera,
  bounds: Box3,
  view: CameraView = "perspective",
): Vector3 {
  if (
    bounds.isEmpty() ||
    ![...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite)
  )
    throw new Error("Cannot frame empty or non-finite bounds");
  const center = bounds.getCenter(new Vector3());
  const radius = Math.max(bounds.getSize(new Vector3()).length() * 0.5, 0.01);
  const vertical = (camera.fov * Math.PI) / 360;
  const horizontal = Math.atan(Math.tan(vertical) * camera.aspect);
  const distance = (radius / Math.sin(Math.min(vertical, horizontal))) * 1.12;
  camera.position
    .copy(center)
    .add(new Vector3(...directions[view]).normalize().multiplyScalar(distance));
  camera.near = Math.max(0.0001, (distance - radius * 2) / 10);
  camera.far = Math.max(100, distance + radius * 10);
  camera.updateProjectionMatrix();
  camera.lookAt(center);
  return center;
}
