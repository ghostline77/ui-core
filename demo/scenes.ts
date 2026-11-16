import {
  BoxGeometry,
  CapsuleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
} from "three";

export type DemoAsset = "case" | "room" | "bust";
export function createScene(kind: DemoAsset): Group {
  const root = new Group();
  root.name = kind;
  const dark = new MeshStandardMaterial({
    color: "#29322e",
    roughness: 0.45,
    metalness: 0.65,
  });
  const accent = new MeshStandardMaterial({ color: "#c6ee83", roughness: 0.5 });
  const light = new MeshStandardMaterial({ color: "#b8b8aa", roughness: 0.85 });
  function part(
    name: string,
    geometry: Mesh["geometry"],
    material: MeshStandardMaterial,
    position: [number, number, number],
  ) {
    const mesh = new Mesh(geometry, material);
    mesh.name = name;
    mesh.userData["assetId"] = `${kind}/${name}`;
    mesh.position.set(...position);
    root.add(mesh);
    return mesh;
  }
  if (kind === "case") {
    part("Case shell", new BoxGeometry(1.6, 0.65, 0.9), dark, [0, 0.4, 0]);
    part("Lid", new BoxGeometry(1.65, 0.12, 0.95), light, [0, 0.78, 0]);
    for (const x of [-0.64, 0.64]) {
      part(`Latch ${x}`, new BoxGeometry(0.12, 0.24, 0.07), accent, [
        x,
        0.65,
        0.49,
      ]);
      part(`Rail ${x}`, new BoxGeometry(0.09, 0.05, 0.96), dark, [x, 0.865, 0]);
    }
    part("Handle", new BoxGeometry(0.55, 0.08, 0.12), dark, [0, 0.54, 0.55]);
    for (const x of [-0.72, 0.72])
      for (const z of [-0.36, 0.36])
        part(`Foot ${x} ${z}`, new BoxGeometry(0.14, 0.1, 0.14), dark, [
          x,
          0.05,
          z,
        ]);
  } else if (kind === "room") {
    part("Floor", new BoxGeometry(6, 0.15, 5), dark, [0, -0.075, 0]);
    part("Back wall", new BoxGeometry(6, 2.8, 0.15), light, [0, 1.4, -2.5]);
    part("Side wall", new BoxGeometry(0.15, 2.8, 5), light, [-3, 1.4, 0]);
    part(
      "Light strip",
      new BoxGeometry(5.4, 0.04, 0.05),
      accent,
      [0, 2.45, -2.4],
    );
    part("Table top", new BoxGeometry(2.1, 0.1, 1.1), dark, [-0.8, 0.85, -0.8]);
    for (const x of [-1.65, 0.05])
      for (const z of [-1.2, -0.4])
        part(`Table leg ${x} ${z}`, new BoxGeometry(0.06, 0.8, 0.06), dark, [
          x,
          0.4,
          z,
        ]);
    part("Cabinet", new BoxGeometry(1.2, 1.7, 0.65), dark, [1.9, 0.85, -2.05]);
    for (const y of [0.5, 1, 1.5])
      part(`Cabinet trim ${y}`, new BoxGeometry(1.05, 0.025, 0.025), accent, [
        1.9,
        y,
        -1.71,
      ]);
    part(
      "Seat",
      new CylinderGeometry(0.38, 0.38, 0.12, 32),
      accent,
      [-0.8, 0.5, 0.55],
    );
    part(
      "Seat base",
      new CylinderGeometry(0.08, 0.3, 0.44, 24),
      dark,
      [-0.8, 0.22, 0.55],
    );
  } else {
    part(
      "Plinth",
      new CylinderGeometry(0.55, 0.6, 0.12, 48),
      dark,
      [0, 0.06, 0],
    );
    const torso = part(
      "Shoulders",
      new SphereGeometry(0.48, 48, 32),
      light,
      [0, 0.55, 0],
    );
    torso.scale.set(1.2, 0.8, 0.65);
    part(
      "Neck",
      new CylinderGeometry(0.13, 0.18, 0.3, 32),
      light,
      [0, 0.95, 0],
    );
    const head = part(
      "Head",
      new CapsuleGeometry(0.24, 0.18, 12, 48),
      light,
      [0, 1.36, 0],
    );
    head.scale.z = 0.85;
    part("Visor", new BoxGeometry(0.43, 0.09, 0.09), dark, [0, 1.4, 0.2]);
    for (const x of [-0.275, 0.275])
      part(`Earpiece ${x}`, new SphereGeometry(0.075, 24, 16), accent, [
        x,
        1.33,
        0,
      ]);
  }
  return root;
}
