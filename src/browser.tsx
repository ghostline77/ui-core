import { useEffect, useRef, useState } from "react";
import { Button } from "./components.js";
export type BrowserJson =
  | null
  | boolean
  | number
  | string
  | BrowserJson[]
  | { [key: string]: BrowserJson | undefined };
export function useHash(): string {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const change = () => setHash(location.hash);
    addEventListener("hashchange", change);
    return () => removeEventListener("hashchange", change);
  }, []);
  return hash;
}
const scriptResults = new Map<string, Promise<unknown>>();
let scriptQueue: Promise<unknown> = Promise.resolve();
/** Classic data scripts preserve file:// support. Serialize scripts whose publisher uses a single result global. */
export function readBrowserScript<T>(path: string, read: () => T): Promise<T> {
  const existing = scriptResults.get(path);
  if (existing) return existing as Promise<T>;
  const result = scriptQueue
    .catch(() => undefined)
    .then(
      () =>
        new Promise<T>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = path;
          script.onload = () => {
            try {
              resolve(read());
            } catch (error) {
              reject(error);
            } finally {
              script.remove();
            }
          };
          script.onerror = () => {
            script.remove();
            reject(Error("Native details could not be loaded."));
          };
          document.head.append(script);
        }),
    );
  scriptResults.set(path, result);
  scriptQueue = result;
  result.catch(() => scriptResults.delete(path));
  return result;
}
export function NativeDetails({
  path,
  read,
  title = "Native details",
}: {
  path: string;
  read: () => BrowserJson;
  title?: string;
}) {
  const [state, setState] = useState<{ value?: BrowserJson; error?: string }>(
    {},
  );
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    if (!opened) return;
    let current = true;
    setState({});
    readBrowserScript(path, read).then(
      (value) => {
        if (current) setState({ value });
      },
      (error) => {
        if (current) setState({ error: String(error) });
      },
    );
    return () => {
      current = false;
    };
  }, [path, opened]);
  return (
    <details
      className="rounded border border-line p-4"
      onToggle={(event) => setOpened(event.currentTarget.open)}
    >
      <summary>{title}</summary>
      {state.error ? (
        <p role="alert" className="py-3 text-danger">
          {state.error}
        </p>
      ) : state.value !== undefined ? (
        <pre className="mt-4 overflow-auto whitespace-pre-wrap break-all text-xs">
          {JSON.stringify(state.value, null, 2)}
        </pre>
      ) : (
        <p className="py-3 text-muted">Loading native details…</p>
      )}
    </details>
  );
}
export function CopyJson({
  value,
  label = "Copy selection reference",
}: {
  value: unknown;
  label?: string;
}) {
  const [fallback, setFallback] = useState(false),
    [copied, setCopied] = useState(false),
    ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (fallback) {
      ref.current?.focus();
      ref.current?.select();
    }
  }, [fallback]);
  return (
    <div className="space-y-2">
      <Button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
            setCopied(true);
          } catch {
            setFallback(true);
          }
        }}
      >
        {copied ? "Copied" : label}
      </Button>
      {fallback && (
        <label className="grid gap-2 text-sm">
          Copy this reference
          <textarea
            ref={ref}
            readOnly
            className="min-h-32 rounded border border-line bg-background p-3 font-mono text-xs"
            value={JSON.stringify(value, null, 2)}
          />
        </label>
      )}
    </div>
  );
}
export interface BrowserMedia {
  path: string;
  view: string;
  size?: number;
  appearance?: string | null;
}
export function NativeGallery({
  media,
  label,
  base = "",
  compact = false,
}: {
  media: BrowserMedia[];
  label: string;
  base?: string;
  compact?: boolean;
}) {
  const [index, setIndex] = useState(0),
    [failed, setFailed] = useState(""),
    [enlarged, setEnlarged] = useState(false),
    dialog = useRef<HTMLDialogElement>(null);
  const selected = media[index] || media[0],
    url = selected
      ? (base ? base.replace(/\/$/, "") + "/" : "") + selected.path
      : "";
  useEffect(() => {
    if (enlarged) dialog.current?.showModal();
    else dialog.current?.close();
  }, [enlarged]);
  return (
    <div className="space-y-2">
      <div
        className={`flex items-center justify-center overflow-hidden rounded-lg border border-line bg-black/20 ${compact ? "h-44" : "aspect-square"}`}
      >
        {selected && failed !== url ? (
          <button
            type="button"
            className="h-full w-full"
            aria-label={`Enlarge ${label}`}
            onClick={() => setEnlarged(true)}
          >
            <img
              loading="lazy"
              className="h-full w-full object-contain"
              src={url}
              alt={`${label} — ${selected.view}`}
              onError={() => setFailed(url)}
            />
          </button>
        ) : (
          <span className="p-5 text-sm text-muted">
            {failed ? "Image unavailable" : "No published preview"}
          </span>
        )}
      </div>
      {media.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {media.map((m, i) => (
            <Button
              key={`${m.path}-${i}`}
              size="sm"
              variant={i === index ? "primary" : "ghost"}
              aria-pressed={i === index}
              onClick={() => setIndex(i)}
            >
              {m.view}
            </Button>
          ))}
        </div>
      )}
      <dialog
        ref={dialog}
        onCancel={() => setEnlarged(false)}
        onClose={() => setEnlarged(false)}
        className="m-auto max-h-[95dvh] w-[min(1000px,95vw)] rounded-lg border border-line bg-panel p-4 text-foreground backdrop:bg-black/80"
      >
        <Button onClick={() => setEnlarged(false)}>Close</Button>
        <img
          className="max-h-[80dvh] w-full object-contain"
          src={url}
          alt={`${label} — ${selected?.view}`}
        />
        <p className="mt-2 break-all text-xs text-muted">{label}</p>
      </dialog>
    </div>
  );
}
