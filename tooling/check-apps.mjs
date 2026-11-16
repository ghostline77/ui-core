import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const tsc = require.resolve("typescript/bin/tsc");
for (const app of [
  "character-builder/ui",
  "building-builder/ui",
  "item-builder/ui",
  "quest-builder/ui",
  "race-builder/ui",
  "items/web",
  "vehicles/web",
  "workspots/ui",
]) {
  const result = spawnSync(
    process.execPath,
    [tsc, "--project", `${app}/tsconfig.json`],
    { stdio: "inherit" },
  );
  if (result.status !== 0) process.exit(result.status || 1);
}
