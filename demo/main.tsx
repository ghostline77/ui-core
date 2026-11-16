import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Color, Mesh } from "three";
import type { Object3D } from "three";
import {
  AppShell,
  AssetCard,
  Badge,
  Button,
  Checkbox,
  Dialog,
  Disclosure,
  Field,
  Input,
  Panel,
  SegmentedControl,
  Select,
  Slider,
  Status,
  Toolbar,
  Workspace,
} from "../src/index.js";
import { Viewport } from "../src/viewport/index.js";
import type {
  TransformMode,
  ViewportHandle,
  ViewportSource,
} from "../src/viewport/index.js";
import { createScene } from "./scenes.js";
import { disposeAsset } from "../src/viewport/engine.js";
import type { DemoAsset } from "./scenes.js";
import "../src/styles.css";
import "./showcase.css";

function Showcase() {
  const [asset, setAsset] = useState<DemoAsset>("case");
  const [url, setUrl] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [grid, setGrid] = useState(true);
  const [mode, setMode] = useState("inspect");
  const [selected, setSelected] = useState("");
  const [model, setModel] = useState<Object3D | null>(null);
  const [roughness, setRoughness] = useState(0.55);
  const [tint, setTint] = useState("#a1b68b");
  const [dialog, setDialog] = useState(false);
  const [message, setMessage] = useState("Ready");
  const [query, setQuery] = useState("");
  const [animations, setAnimations] = useState<string[]>([]);
  const viewport = useRef<ViewportHandle>(null);
  const object = useMemo(() => createScene(asset), [asset]);
  useEffect(() => () => disposeAsset(object), [object]);
  const source = useMemo<ViewportSource>(
    () => (url ? { kind: "gltf", url } : { kind: "object", object }),
    [url, object],
  );
  useEffect(
    () => () => {
      if (url.startsWith("blob:")) URL.revokeObjectURL(url);
    },
    [url],
  );
  useEffect(() => {
    model?.traverse((node) => {
      if (node instanceof Mesh)
        for (const material of Array.isArray(node.material)
          ? node.material
          : [node.material]) {
          if ("roughness" in material) material.roughness = roughness;
        }
    });
    viewport.current?.invalidate();
  }, [model, roughness]);
  const assets: { id: DemoAsset; name: string; shape: string }[] = [
    { id: "case", name: "Equipment case", shape: "▰" },
    { id: "room", name: "Modular room", shape: "⌑" },
    { id: "bust", name: "Studio bust", shape: "◉" },
  ];
  return (
    <AppShell
      product="UI core"
      project={
        <div className="grid gap-1">
          <strong>Workshop</strong>
          <span className="text-xs text-muted">Component showcase</span>
        </div>
      }
      actions={
        <>
          <Badge tone="success">Browser 3D</Badge>
          <Button onClick={() => setDialog(true)}>Open scene</Button>
          <Button variant="primary" onClick={() => viewport.current?.fit()}>
            Frame scene
          </Button>
        </>
      }
    >
      <Workspace
        library={
          <Panel title="Catalogue">
            <Input
              aria-label="Search assets"
              type="search"
              placeholder="Search assets…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Field label="Category">
              <Select defaultValue="all">
                <option value="all">All examples</option>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              {assets
                .filter((a) =>
                  a.name.toLowerCase().includes(query.toLowerCase()),
                )
                .map((a) => (
                  <AssetCard
                    key={a.id}
                    title={a.name}
                    selected={!url && asset === a.id}
                    onSelect={() => {
                      setUrl("");
                      setAsset(a.id);
                      setMessage("Ready");
                    }}
                  >
                    <div className="demo-tile" aria-hidden="true">
                      {a.shape}
                    </div>
                  </AssetCard>
                ))}
            </div>
            <Disclosure title="Components" open>
              <div className="flex flex-wrap gap-2">
                <Button size="sm">Default</Button>
                <Button size="sm" variant="primary">
                  Primary
                </Button>
                <Button size="sm" disabled>
                  Disabled
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge>Draft</Badge>
                <Badge tone="warning">Review</Badge>
                <Badge tone="danger">Failed</Badge>
              </div>
            </Disclosure>
          </Panel>
        }
        inspector={
          <Panel title="Inspector">
            <Field label="Name">
              <Input
                value={
                  url
                    ? "Imported scene"
                    : assets.find((a) => a.id === asset)!.name
                }
                readOnly
              />
            </Field>
            <Checkbox
              label="Show grid"
              checked={grid}
              onChange={(e) => setGrid(e.target.checked)}
            />
            <Disclosure title="Material" open>
              <Field label="Tint">
                <Input
                  type="color"
                  value={tint}
                  onChange={(e) => {
                    setTint(e.target.value);
                    model?.traverse((node) => {
                      if (node instanceof Mesh)
                        for (const material of Array.isArray(node.material)
                          ? node.material
                          : [node.material])
                          if (
                            "color" in material &&
                            material.color instanceof Color
                          )
                            material.color.set(e.target.value);
                    });
                    viewport.current?.invalidate();
                  }}
                />
              </Field>
              <Slider
                label="Roughness"
                value={roughness}
                min={0}
                max={1}
                step={0.05}
                onValueChange={setRoughness}
              />
            </Disclosure>
            <Disclosure title="Selection" open>
              {selected ? (
                <>
                  <strong className="text-sm">{selected}</strong>
                  <Button
                    size="sm"
                    onClick={() => viewport.current?.fit("perspective", true)}
                  >
                    Focus selection
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted">
                  Select an object in the viewport.
                </p>
              )}
            </Disclosure>
            {animations.length > 0 && (
              <Field label="Animation">
                <Select
                  onChange={(e) =>
                    viewport.current?.playAnimation(e.target.value || null)
                  }
                >
                  <option value="">Stopped</option>
                  {animations.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </Select>
              </Field>
            )}
            <Status>{message}</Status>
          </Panel>
        }
      >
        <Toolbar>
          <SegmentedControl
            label="Interaction mode"
            value={mode}
            onValueChange={setMode}
            options={[
              { value: "inspect", label: "Inspect" },
              { value: "translate", label: "Move" },
              { value: "rotate", label: "Rotate" },
              { value: "scale", label: "Scale" },
            ]}
          />
          <span className="ml-auto text-xs text-muted">
            {url ? "Imported scene" : assets.find((a) => a.id === asset)!.name}
          </span>
        </Toolbar>
        <Viewport
          ref={viewport}
          label="Asset preview"
          source={source}
          grid={grid}
          transformMode={mode === "inspect" ? null : (mode as TransformMode)}
          onSelect={(selection) => setSelected(selection?.name || "")}
          onLoad={(object, names) => {
            setModel(object);
            setAnimations(names);
            setMessage("Ready");
          }}
          onTransformCommit={(transform) =>
            setMessage("Updated " + transform.id)
          }
          onError={(error) => setMessage(error.message)}
        />
        <footer className="flex items-center justify-between border-t border-line px-4 py-3 text-xs text-muted">
          <span>F · focus selection</span>
          <span>Metres · Y up</span>
        </footer>
      </Workspace>
      <Dialog
        open={dialog}
        onClose={() => setDialog(false)}
        title="Open 3D scene"
        actions={
          <>
            <Button onClick={() => setDialog(false)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!urlInput.trim()}
              onClick={() => {
                setUrl(urlInput.trim());
                setDialog(false);
              }}
            >
              Open URL
            </Button>
          </>
        }
      >
        <Field label="glTF / GLB URL">
          <Input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="/assets/scene.glb"
          />
        </Field>
        <Field label="Or choose a self-contained GLB">
          <Input
            type="file"
            accept=".glb"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setUrl(URL.createObjectURL(file));
                setDialog(false);
              }
            }}
          />
        </Field>
      </Dialog>
    </AppShell>
  );
}

createRoot(document.getElementById("root")!).render(<Showcase />);
