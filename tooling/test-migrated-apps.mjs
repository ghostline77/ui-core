import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  mkdtemp,
  mkdir,
  copyFile,
  readFile,
  writeFile,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, extname, resolve, sep } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";
const workspace = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const temporary = await mkdtemp(resolve(tmpdir(), "ghostline-react-"));
const browser = await chromium.launch({
  headless: true,
  args: [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const checks = [];
const characterScene = process.env.GHOSTLINE_TEST_CHARACTER_GLB
  ? await readFile(process.env.GHOSTLINE_TEST_CHARACTER_GLB)
  : null;
const buildingScene = process.env.GHOSTLINE_TEST_BUILDING_GLB
  ? await readFile(process.env.GHOSTLINE_TEST_BUILDING_GLB)
  : null;
const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" fill="#202620"/><circle cx="64" cy="64" r="32" fill="#c6ee83"/></svg>';
async function put(root, path, value) {
  const target = resolve(root, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, value);
}
async function packageApp(app) {
  const root = resolve(temporary, app.replaceAll("/", "-"));
  await mkdir(root, { recursive: true });
  const dist = resolve(workspace, app, "dist");
  for (const name of app.endsWith("/web")
    ? ["index.html", "assets/app.js", "assets/style.css"]
    : ["index.html", "app.js", "style.css"]) {
    await mkdir(dirname(resolve(root, name)), { recursive: true });
    await copyFile(resolve(dist, name), resolve(root, name));
  }
  return root;
}
async function withPage(root, mode, fn) {
  let server;
  let url;
  if (mode === "offline") url = pathToFileURL(resolve(root, "index.html")).href;
  else {
    server = createServer(async (req, res) => {
      try {
        const prefix = "/hosted/catalogue/";
        let path = decodeURIComponent((req.url || "/").split("?")[0]);
        if (mode === "subpath") {
          if (!path.startsWith(prefix)) {
            res.writeHead(404);
            res.end();
            return;
          }
          path = path.slice(prefix.length);
        }
        const target = resolve(root, "." + sep + path.replace(/^\//, ""));
        if (target !== root && !target.startsWith(root + sep))
          throw Error("path");
        const value = await readFile(
          target.endsWith(sep)
            ? target + "index.html"
            : target === root
              ? resolve(root, "index.html")
              : target,
        );
        res.setHeader(
          "content-type",
          {
            ".js": "text/javascript",
            ".css": "text/css",
            ".svg": "image/svg+xml",
            ".html": "text/html",
          }[target === root ? ".html" : extname(target)] ||
            "application/octet-stream",
        );
        res.end(value);
      } catch {
        res.writeHead(404);
        res.end();
      }
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    url =
      "http://127.0.0.1:" +
      server.address().port +
      (mode === "subpath" ? "/hosted/catalogue/" : "/");
  }
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await fn(page, url);
    assert.deepEqual(errors, []);
    checks.push(root.split(sep).at(-1) + " " + mode);
    console.log("PASS " + checks.at(-1));
  } catch (error) {
    console.error(await page.locator("body").innerText());
    await page.screenshot({
      path: resolve(temporary, "failure.png"),
      fullPage: true,
    });
    throw error;
  } finally {
    await context.close();
    if (server) await new Promise((r) => server.close(r));
  }
}
function glb() {
  let json = Buffer.from(
    JSON.stringify({
      asset: { version: "2.0" },
      scene: 0,
      scenes: [{ nodes: [] }],
      nodes: [],
    }),
  );
  json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 32)]);
  const data = Buffer.alloc(20 + json.length);
  data.writeUInt32LE(0x46546c67, 0);
  data.writeUInt32LE(2, 4);
  data.writeUInt32LE(data.length, 8);
  data.writeUInt32LE(json.length, 12);
  data.writeUInt32LE(0x4e4f534a, 16);
  json.copy(data, 20);
  return data;
}
try {
  const vehicles = await packageApp("vehicles/web"),
    vehicleData = {
      records: [
        {
          id: "Vehicle.demo",
          label: "Demo car",
          manufacturer: "Makigai",
          vehicle_type: "Car",
          native_name: "Vehicle.demo",
          selections: ["red", "blue"],
          diagnostics: [],
          detail: "data/car.js",
          performance: {
            specifications: { horsepower: 200, physics_mass_kg: 900 },
            calculated: { top_gear: { hud_mph: 120 } },
          },
        },
        {
          id: "Vehicle.other",
          label: "Other car",
          manufacturer: "Other",
          vehicle_type: "Car",
          selections: [],
          diagnostics: ["Metadata only"],
          detail: "data/other.js",
        },
      ],
      selections: ["red", "blue"].map((id) => ({
        id,
        appearance: id,
        media: [
          { path: "media/car.svg", view: "hero" },
          { path: "media/side.svg", view: "side" },
        ],
        preview_state: "ready",
        resolution: "resolved",
        resource: { Path: "mod/car.ent" },
        records: ["Vehicle.demo"],
        detail: "data/" + id + ".js",
      })),
      sources: { game_version: "fixture" },
      coverage: { records: 2, selections: 2, ready: 2, blocked: 0 },
    };
  await put(
    vehicles,
    "data/browser/catalogue.js",
    "globalThis.GHOSTLINE_VEHICLES=" + JSON.stringify(vehicleData),
  );
  for (const name of ["car", "other", "red", "blue"])
    await put(
      vehicles,
      "data/" + name + ".js",
      "globalThis.GHOSTLINE_VEHICLE_DETAIL=" +
        JSON.stringify({ id: name, provenance: "exact source " + name }),
    );
  await put(vehicles, "media/car.svg", svg);
  await put(vehicles, "media/side.svg", svg);
  for (const mode of ["subpath", "offline"])
    await withPage(vehicles, mode, async (page, url) => {
      await page.goto(url);
      await expect(
        page.getByRole("heading", { name: "Vehicles catalogue" }),
      ).toBeVisible();
      await page.getByRole("searchbox").fill("Demo");
      await expect(page.getByRole("status")).toContainText("1 vehicle records");
      await page.getByLabel("Appearance for Demo car").selectOption("blue");
      await page.getByRole("button", { name: "Compare", exact: true }).click();
      await expect(
        page.getByRole("region", { name: "Compare vehicles" }),
      ).toContainText("blue");
      await page
        .getByRole("button", { name: "side", exact: true })
        .first()
        .click();
      await page
        .getByRole("link", { name: "Appearance details", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "blue", exact: true }),
      ).toBeVisible();
      await page
        .getByText(
          "Native components, transforms, materials and render provenance",
          { exact: true },
        )
        .click();
      await expect(page.getByText(/exact source blue/)).toBeVisible();
      await page.setViewportSize({ width: 390, height: 844 });
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
    });
  const items = await packageApp("items/web"),
    itemData = {
      items: [
        {
          id: "Items.demo",
          label: "Demo jacket",
          native_name: "Items.demo",
          category: "Jacket",
          selections: ["look"],
          detail_script: "data/item.js",
        },
        {
          id: "Items.other",
          label: "Other item",
          native_name: "Items.other",
          category: "Other",
          detail_script: "data/item.js",
        },
      ],
      props: [
        {
          id: "prop",
          label: "Demo desk",
          kind: "assembly",
          selections: ["look"],
          parts: ["part"],
        },
      ],
      assets: {
        part: {
          id: "part",
          label: "Desk mesh",
          roles: ["clothing"],
          resource: { Path: "mod/desk.mesh" },
          assemblies: ["prop"],
        },
      },
      controls: [],
      choices: [],
      selections: {
        look: {
          id: "look",
          appearance: "default",
          resource: { Path: "mod/desk.ent" },
          preview_state: "ready",
          media: [{ path: "media/item.svg", view: "hero", size: 128 }],
          context: {
            prop_components: [
              {
                component: "desk",
                part: "part",
                native_world_transform: [
                  1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 2, 3, 4, 1,
                ],
              },
            ],
          },
        },
      },
      game_version: "fixture",
    };
  await put(
    items,
    "data/browser/catalogue.js",
    "globalThis.GHOSTLINE_CATALOGUE=" + JSON.stringify(itemData),
  );
  await put(items, "assets/config.js", 'globalThis.GHOSTLINE_MEDIA_BASE=""');
  await put(
    items,
    "data/item.js",
    'globalThis.GHOSTLINE_DETAILS={"Items.demo":' +
      JSON.stringify({
        ...itemData.items[0],
        diagnostics: ["Exact native fixture"],
      }) +
      ',"Items.other":' +
      JSON.stringify(itemData.items[1]) +
      "}",
  );
  await put(items, "media/item.svg", svg);
  for (const mode of ["subpath", "offline"])
    await withPage(items, mode, async (page, url) => {
      await page.goto(url);
      await expect(
        page.getByRole("heading", { name: "Items catalogue" }),
      ).toBeVisible();
      await page.getByRole("searchbox").fill("Demo jacket");
      await page.getByRole("button", { name: "Search", exact: true }).click();
      await expect(page.getByRole("status")).toHaveText("1 entries");
      await page.getByRole("link", { name: /Demo jacket/ }).click();
      await expect(
        page.getByRole("heading", { name: "Demo jacket", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("Exact native fixture", { exact: true }),
      ).toBeVisible();
      await page.evaluate(() => {
        location.hash = "#entry/Items.other";
      });
      await expect(
        page.getByRole("heading", { name: "Other item", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("link", { name: "← Catalogue", exact: true })
        .click();
      await expect(page.getByRole("searchbox")).toHaveValue("Demo jacket");
      await page
        .getByLabel("Collection", { exact: true })
        .selectOption("props");
      await page.getByRole("searchbox").fill("");
      await page.getByRole("button", { name: "Search", exact: true }).click();
      await page.getByRole("link", { name: /Demo desk/ }).click();
      await expect(
        page.getByRole("heading", { name: "Placed components / default" }),
      ).toBeVisible();
      await expect(
        page.getByRole("cell", { name: "2.0000 / 3.0000 / 4.0000" }),
      ).toBeVisible();
      await page.setViewportSize({ width: 390, height: 844 });
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
    });
  const character = await packageApp("character-builder/ui");
  await withPage(character, "hosted", async (page, url) => {
    let project = {
        format: "ghostline-character",
        version: 1,
        id: "demo",
        name: "Demo character",
        revision: 0,
        template: "female",
        namespace: "mod/demo",
        identity: {
          record: "Character.Demo",
          voice_tag: "Iris",
          affiliation: "Ghostline",
        },
        appearances: [
          {
            id: "default",
            name: "Default",
            choices: {},
            equipment: {},
            shapes: {},
          },
        ],
        active_appearance: "default",
        loadout: [],
        ai: { profile: "quest" },
        refit_clothing: false,
      },
      saved = [];
    const jobs = new Map();
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname,
        body = route.request().postDataJSON(),
        json = (value) =>
          route.fulfill({
            contentType: "application/json",
            body: JSON.stringify(value),
          });
      if (path === "/api/bootstrap")
        return json({
          templates: [
            { id: "female", label: "Female", frame: "female", shape_max: 21 },
          ],
          categories: ["hair_color", "Clo_OuterChest", "Wea_Handgun"],
          settings: { game: null, schema: null },
          behaviour: { presets: [], options: {} },
          catalogue: { sources: { game_version: "fixture" } },
        });
      if (path === "/api/catalogue")
        return json({
          entries: [
            {
              id: "jacket",
              label: "Demo jacket",
              category: "Clo_OuterChest",
              kind: "equipment",
              resolution: "resolved",
              media: [],
            },
            {
              id: "weapon",
              label: "Demo pistol",
              category: "Wea_Handgun",
              kind: "loadout",
              resolution: "resolved",
              role: "pistol",
              media: [],
            },
          ],
          total: 2,
        });
      if (path === "/api/projects/new") return json(project);
      if (path === "/api/project-selections")
        return json({
          choice_entries: {
            jacket: {
              id: "jacket",
              label: "Demo jacket",
              category: "Clo_OuterChest",
              kind: "equipment",
              resolution: "resolved",
            },
            weapon: {
              id: "weapon",
              label: "Demo pistol",
              category: "Wea_Handgun",
              kind: "loadout",
              role: "pistol",
              resolution: "resolved",
            },
          },
          choice_selections: {},
        });
      if (path === "/api/projects" && route.request().method() === "POST") {
        saved.push(body);
        return json({ revision: saved.length });
      }
      if (path === "/api/jobs" && route.request().method() === "POST") {
        const id = String(jobs.size + 1);
        jobs.set(id, {
          id,
          state: "complete",
          kind: body.export ? "export" : "preview",
          project: "demo",
          result: {
            scene: "scene.glb",
            warnings: [],
            head_bounds: { center: [0, 1, 0], radius: 1 },
          },
        });
        return json({ id });
      }
      if (path.startsWith("/api/jobs/"))
        return json(jobs.get(path.split("/").at(-1)));
      if (path === "/api/validate")
        return json({ ok: true, errors: [], warnings: [] });
      return json({});
    });
    let sceneRequests = 0;
    await page.route("**/output/**", (r) => {
      sceneRequests++;
      return r.fulfill({
        contentType: "model/gltf-binary",
        body: characterScene || glb(),
      });
    });
    await page.goto(url);
    await page.getByRole("button", { name: "New", exact: true }).click();
    await page.getByLabel("Project ID").fill("demo");
    await page
      .getByRole("button", { name: "Create character", exact: true })
      .click();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
      "Demo character",
    );
    await page.getByLabel("Name", { exact: true }).fill("Edited character");
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
      "Edited character",
    );
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
      "Demo character",
    );
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
      "Edited character",
    );
    await page.getByRole("button", { name: /Demo jacket/ }).click();
    await page.getByRole("button", { name: /Demo pistol/ }).click();
    await page
      .getByRole("button", { name: "Save project", exact: true })
      .click();
    await expect.poll(() => saved.length).toBe(1);
    assert.equal(saved[0].project.name, "Edited character");
    assert.equal(
      saved[0].project.appearances[0].equipment.Clo_OuterChest,
      "jacket",
    );
    assert.deepEqual(saved[0].project.loadout, ["weapon"]);
    assert.equal(saved[0].project.ai.profile, "combat");
    await page
      .getByRole("button", { name: "Update preview", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Update preview", exact: true }),
    ).toBeEnabled();
    await expect.poll(() => sceneRequests).toBeGreaterThan(0);
    await expect(page.getByText("Loading scene…", { exact: true })).toBeHidden({
      timeout: 60000,
    });
    await page
      .getByRole("button", { name: "Export character", exact: true })
      .click();
    await expect(
      page.getByRole("link", { name: "Character archive", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: resolve(temporary, "character.png"),
      fullPage: true,
    });
  });
  const building = await packageApp("building-builder/ui");
  await withPage(building, "hosted", async (page, url) => {
    const starter = {
      schema_version: 1,
      id: "demo",
      name: "Demo building",
      revision: 0,
      kit: "common",
      origin: [100, 100, 700],
      yaw: 0,
      wall_appearance: "wall",
      floor_appearance: "floor",
      rooms: [{ id: "main", x: 0, y: 0, width: 2, depth: 2, level: 0 }],
      objects: [],
      openings: {},
      partitions: [],
      shell_rooms: [],
      stairs: [],
      lights: [],
      audio_areas: [],
      door_states: {},
      door_devices: {},
      workstations: [],
      retrofit: [],
      shells: [],
      navigation: {
        export: false,
        radius: 0.3,
        height: 1.8,
        climb: 0.6,
        layer: 200,
        connections: [],
      },
    };
    const kit = {
      id: "common",
      name: "Common",
      storey_height: 4.2,
      wall_height: 3.8,
      wall_appearances: ["wall"],
      floor_appearances: ["floor"],
    };
    const saves = [],
      exports = [],
      compiles = [];
    const compile = (project) => ({
      project,
      placements: project.objects.map((o) => ({
        ...o,
        role: "object",
        bounds: {
          min: [-0.5, -0.5, 0],
          max: [0.5, 0.5, 1],
          dimensions: [1, 1, 1],
        },
        level: 0,
      })),
      solids: [],
      edges: [
        { id: "0:x:0:0", axis: "x", x: 0, y: 0, level: 0, shared: false },
      ],
      diagnostics: [],
    });
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname,
        body = route.request().postDataJSON(),
        json = (value) =>
          route.fulfill({
            contentType: "application/json",
            body: JSON.stringify(value),
          });
      if (path === "/api/bootstrap")
        return json({
          starter,
          kit,
          kits: [kit],
          projects: [],
          catalogue_count: 1,
          library_source: "Fixture",
        });
      if (path === "/api/compile") {
        compiles.push(body);
        return json(compile(body));
      }
      if (path === "/api/library")
        return json({
          total: 1,
          entries: [
            {
              id: "desk",
              name: "Demo desk",
              role: "furniture",
              kind: "assembly",
              bounds: { dimensions: [1, 1, 1] },
              appearances: ["default"],
              states: {
                default: {
                  resolution: "resolved",
                  preview: "pending",
                  diagnostics: [],
                },
              },
            },
          ],
        });
      if (path === "/api/preview")
        return route.fulfill({
          contentType: "model/gltf-binary",
          body: buildingScene || glb(),
        });
      if (path === "/api/save") {
        saves.push(body);
        return json({ ok: true });
      }
      if (path === "/api/export") {
        exports.push(body);
        return json({
          meshes: 1,
          entities: 0,
          colliders: 0,
          verified_resources: 1,
          archive_sha256: "fixture",
          diagnostics: [],
          files: ["demo.zip"],
          export_id: "fixture",
        });
      }
      if (path === "/api/shell/sites") return json([]);
      if (path === "/api/route")
        return json({ connected: true, faces: [1], triangles: [] });
      return json({});
    });
    await page.goto(url);
    await expect(
      page.getByRole("button", { name: "+ Add room", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "+ Add room", exact: true }).click();
    await expect.poll(() => compiles.at(-1).rooms.length).toBe(2);
    const selection = page
      .locator("aside")
      .last()
      .locator("details")
      .filter({ has: page.locator("summary", { hasText: /^Selection$/ }) });
    await selection.getByLabel("Width", { exact: true }).fill("3");
    await page
      .getByRole("button", { name: "main · floor 0", exact: true })
      .click();
    const newRoom = compiles.at(-1).rooms.at(-1).id;
    await page
      .getByRole("button", { name: newRoom + " · floor 0", exact: true })
      .click();
    await expect(selection.getByLabel("Width", { exact: true })).toHaveValue(
      "3",
    );
    await page
      .getByRole("button", { name: "Save project", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText("Apply or discard");
    assert.equal(saves.length, 0);
    await selection
      .getByRole("button", { name: "Apply settings", exact: true })
      .click();
    await expect.poll(() => compiles.at(-1).rooms.at(-1).width).toBe(3);
    await page
      .getByRole("button", { name: "Save project", exact: true })
      .click();
    await expect.poll(() => saves.length).toBe(1);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect.poll(() => compiles.at(-1).rooms.at(-1).width).toBe(2);
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect.poll(() => compiles.at(-1).rooms.at(-1).width).toBe(3);
    await page
      .getByRole("button", { name: "Wall 0:x:0:0", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "Opening", exact: true })
      .selectOption("door_manual");
    await expect
      .poll(() => compiles.at(-1).openings["0:x:0:0"])
      .toBe("door_manual");
    await page.getByRole("button", { name: "Library", exact: true }).click();
    await page
      .getByRole("button", { name: "+ Place on plan", exact: true })
      .click();
    await page
      .getByRole("img", { name: "Building plan. Select rooms and wall bays." })
      .click({ position: { x: 150, y: 150 } });
    await expect.poll(() => compiles.at(-1).objects.length).toBe(1);
    await page
      .getByRole("button", { name: "Export native archive", exact: true })
      .click();
    await expect(
      page.getByRole("link", { name: "Download demo.zip" }),
    ).toBeVisible();
    assert.equal(exports.length, 1);
    assert.equal(exports[0].objects[0].asset, "desk");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Close", exact: true })
      .click();
    await expect(page.getByText("Loading scene…", { exact: true })).toBeHidden({
      timeout: 60000,
    });
    await page.screenshot({
      path: resolve(temporary, "building.png"),
      fullPage: true,
    });
  });
  console.log(
    `${checks.length} browser workflows passed. Screenshots: ${temporary}`,
  );
} finally {
  await browser.close();
  const target = resolve(temporary);
  if (
    !target.startsWith(resolve(tmpdir()) + sep) ||
    !target.split(sep).at(-1).startsWith("ghostline-react-")
  )
    throw Error(
      "Unexpected test directory",
    ); /* Retain screenshots and fixtures for review. */
}
