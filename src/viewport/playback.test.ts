import assert from "node:assert/strict";
import test from "node:test";
import { AnimationClip, AnimationMixer, Object3D, VectorKeyframeTrack } from "three";
import { ViewportEngine } from "./engine.js";

test("frame inspection evaluates a pose without continuing playback", () => {
  const object = new Object3D();
  const clip = new AnimationClip("motion", 2, [new VectorKeyframeTrack(".position", [0, 2], [0, 0, 0, 4, 0, 0])]);
  const mixer = new AnimationMixer(object);
  const stub = { clips:[clip], mixer, playing:true, lastTime:123, invalidate() {} };
  ViewportEngine.prototype.seekAnimation.call(stub as unknown as ViewportEngine,"motion",1.4);
  assert.ok(Math.abs(object.position.x-2.8)<1e-6);
  mixer.update(1);
  assert.ok(Math.abs(object.position.x-2.8)<1e-6, "Inspecting must freeze the selected pose");
  assert.equal(stub.playing,false);
  ViewportEngine.prototype.seekAnimation.call(stub as unknown as ViewportEngine,"motion",2);
  assert.ok(Math.abs(object.position.x-4)<1e-6,"Last frame must not wrap to the start");
  ViewportEngine.prototype.playAnimation.call(stub as unknown as ViewportEngine,"motion");
  mixer.update(.5);
  assert.ok(Math.abs(object.position.x-1)<1e-6, "Play must resume a running action");
});
