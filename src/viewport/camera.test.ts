import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Box3, PerspectiveCamera, Vector3 } from "three";
import { frameCamera } from "./camera.js";

describe("asset framing", () => {
  for (const aspect of [0.35, 1, 3])
    it(`keeps every corner inside a pane with aspect ${aspect}`, () => {
      const camera = new PerspectiveCamera(40, aspect);
      const bounds = new Box3(new Vector3(-2, 0, -1), new Vector3(2, 8, 1));
      frameCamera(camera, bounds);
      camera.updateMatrixWorld(true);
      for (const x of [-2, 2])
        for (const y of [0, 8])
          for (const z of [-1, 1]) {
            const p = new Vector3(x, y, z).project(camera);
            assert(Math.abs(p.x) < 1);
            assert(Math.abs(p.y) < 1);
            assert(Math.abs(p.z) < 1);
          }
    });
  it("rejects invalid bounds instead of corrupting camera matrices", () => {
    assert.throws(() => frameCamera(new PerspectiveCamera(), new Box3()));
  });
});
