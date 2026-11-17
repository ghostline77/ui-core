import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

export function runApps(script) {
  const directories = process.argv.slice(2);
  for (const directory of directories.length ? directories : ["."]) {
    const cwd = resolve(directory);
    const manifest = JSON.parse(readFileSync(resolve(cwd, "package.json"), "utf8"));
    const scope = manifest.workspaces ? ["--workspaces", "--if-present"] : ["--workspaces=false"];
    const args = [...scope, "run", script];
    if (process.env.npm_execpath) {
      execFileSync(process.execPath, [process.env.npm_execpath, ...args], { cwd, stdio: "inherit" });
    } else if (process.platform === "win32") {
      execFileSync("cmd.exe", ["/d", "/c", "npm", ...args], { cwd, stdio: "inherit" });
    } else {
      execFileSync("npm", args, { cwd, stdio: "inherit" });
    }
  }
}
