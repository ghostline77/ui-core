import { buildApp } from "./build-ui.mjs";
const apps = [
  "character-builder/ui",
  "building-builder/ui",
  "item-builder/ui",
  "quest-builder/ui",
  "race-builder/ui",
  "items/web",
  "vehicles/web",
  "workspots/ui",
];
for (const app of apps) await buildApp(app);
