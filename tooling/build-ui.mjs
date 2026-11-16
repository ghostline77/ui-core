import { build, createServer } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createReadStream, statSync } from "node:fs";

export async function buildApp(directory, dev = false) {
  const root = resolve(directory);
  const catalogue = /[\\/](items|vehicles)[\\/]web$/.test(root);
  const quest = /[\\/]quest-builder[\\/]ui$/.test(root);
  const ports = {
    "character-builder": 8787,
    "building-builder": 8792,
    "item-builder": 8793,
    "quest-builder": 8790,
    "race-builder": 8795,
    items: 8801,
    vehicles: 8802,
    workspots: 8820,
  };
  const project = root.split(/[\\/]/).at(-2);
  const target =
    process.env.GHOSTLINE_UI_BACKEND ||
    `http://127.0.0.1:${ports[project] || 8787}`;
  const localOrigin = {
    name: "local-editor-origin",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const origin = request.headers.origin;
        if (origin) {
          try {
            if (new URL(origin).host !== request.headers.host) {
              response.statusCode = 403;
              response.end("Cross-origin editor request rejected");
              return;
            }
          } catch {
            response.statusCode = 403;
            response.end("Invalid editor origin");
            return;
          }
        }
        next();
      });
    },
  };
  const catalogueData = {
    name: "published-catalogue-data",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        try {
          const url = decodeURIComponent((request.url || "/").split("?")[0]);
          if (
            !url.startsWith("/data/") &&
            !url.startsWith("/media/") &&
            url !== "/assets/config.js"
          )
            return next();
          const published = resolve(root, "../dist/catalogue"),
            path = resolve(published, "." + url);
          if (
            !path.startsWith(published + "/") &&
            !path.startsWith(published + "\\")
          )
            return next();
          if (!statSync(path).isFile()) return next();
          response.setHeader(
            "Content-Type",
            path.endsWith(".js")
              ? "text/javascript"
              : path.endsWith(".json")
                ? "application/json"
                : path.endsWith(".png")
                  ? "image/png"
                  : path.endsWith(".webp")
                    ? "image/webp"
                    : path.endsWith(".jpg") || path.endsWith(".jpeg")
                      ? "image/jpeg"
                      : "application/octet-stream",
          );
          createReadStream(path).pipe(response);
        } catch {
          next();
        }
      });
    },
  };
  const config = {
    configFile: false,
    root,
    base: catalogue ? "./" : "/",
    plugins: [
      react(),
      localOrigin,
      ...(catalogue
        ? [
            catalogueData,
            {
              name: "offline-classic-script",
              enforce: "post",
              generateBundle: {
                order: "post",
                handler(_, bundle) {
                  for (const entry of Object.values(bundle))
                    if (
                      entry.type === "asset" &&
                      entry.fileName === "index.html"
                    )
                      entry.source = String(entry.source)
                        .replace(/type="module"\s*/g, "defer ")
                        .replace(/crossorigin\s*/g, "");
                },
              },
            },
          ]
        : []),
    ],
    server: {
      host: "127.0.0.1",
      port:
        Number(process.env.GHOSTLINE_UI_PORT) || (ports[project] || 8796) + 100,
      strictPort: true,
      hmr: false,
      fs: { allow: [resolve(root, "../..")] },
      proxy: catalogue
        ? {}
        : Object.fromEntries(
            [
              "/api",
              "/media",
              "/output",
              "/data",
              "/assets/inter.woff2",
              "/assets/icon-",
            ].map((path) => [
              path,
              {
                target,
                changeOrigin: true,
                configure(proxy) {
                  proxy.on("proxyReq", (forward, request) => {
                    if (request.headers.origin)
                      forward.setHeader("origin", target);
                  });
                },
              },
            ]),
          ),
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
      target: "es2022",
      cssCodeSplit: false,
      assetsInlineLimit: 1_000_000,
      rollupOptions: {
        output: {
          entryFileNames: quest || catalogue ? "assets/app.js" : "app.js",
          assetFileNames: (asset) =>
            asset.names?.some((name) => name.endsWith(".css"))
              ? quest || catalogue
                ? "assets/style.css"
                : "style.css"
              : "assets/[name][extname]",
          inlineDynamicImports: true,
          ...(catalogue ? { format: "iife", name: "GhostlineCatalogue" } : {}),
        },
      },
    },
  };
  if (dev) {
    const server = await createServer(config);
    await server.listen();
    server.printUrls();
  } else await build(config);
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await buildApp(process.argv[2] || ".", process.argv.includes("--dev"));
