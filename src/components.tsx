import { cloneElement, isValidElement, useEffect, useId, useRef } from "react";
import type {
  AriaAttributes,
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";
import { cn } from "./utils.js";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "primary" | "ghost" | "danger";
  size?: "sm" | "md";
}
export function Button({
  variant = "default",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "gl-button inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control border text-sm transition-colors disabled:cursor-default disabled:opacity-40",
        size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3 py-2",
        {
          "border-line bg-surface text-foreground hover:bg-[#303a2e] hover:border-[#85957e]":
            variant === "default",
          "border-accent bg-accent text-accent-ink font-semibold hover:bg-accent-hover":
            variant === "primary",
          "border-transparent bg-transparent text-muted hover:text-foreground hover:bg-surface":
            variant === "ghost",
          "border-danger/40 text-danger hover:bg-danger/10":
            variant === "danger",
        },
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  const id = useId();
  const control = isValidElement<AriaAttributes>(children)
    ? cloneElement(children, {
        "aria-describedby":
          [children.props["aria-describedby"], hint || error ? id : ""]
            .filter(Boolean)
            .join(" ") || undefined,
        "aria-invalid": error ? true : children.props["aria-invalid"],
      })
    : children;
  return (
    <div className={cn("grid gap-1.5", className)} {...props}>
      <label className="grid gap-1.5 text-xs text-muted">
        <span>{label}</span>
        {control}
      </label>
      {(hint || error) && (
        <p
          id={id}
          className={cn("text-xs", error ? "text-danger" : "text-muted")}
          role={error ? "alert" : undefined}
        >
          {error || hint}
        </p>
      )}
    </div>
  );
}
const inputClass =
  "w-full min-w-0 rounded-control border border-line bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted disabled:opacity-40";
export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("gl-input", inputClass, className)} {...props} />;
}
export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn("gl-select", inputClass, className)} {...props} />
  );
}
export function Checkbox({
  label,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: string }) {
  return (
    <label className={cn("flex items-center gap-2 text-sm", className)}>
      <input type="checkbox" className="size-4 accent-accent" {...props} />
      {label}
    </label>
  );
}
export function Slider({
  label,
  value,
  onValueChange,
  className,
  ...props
}: Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onChange"
> & { label: string; value: number; onValueChange: (value: number) => void }) {
  return (
    <label className={cn("grid gap-2 text-xs text-muted", className)}>
      <span className="flex justify-between gap-3">
        {label}
        <output className="text-foreground tabular-nums">{value}</output>
      </span>
      <input
        type="range"
        className="gl-range"
        value={value}
        onChange={(event) => onValueChange(event.currentTarget.valueAsNumber)}
        {...props}
      />
    </label>
  );
}

export function Panel({
  title,
  actions,
  children,
  className,
  ...props
}: HTMLAttributes<HTMLElement> & { title?: string; actions?: ReactNode }) {
  return (
    <section className={cn("grid content-start gap-4", className)} {...props}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3">
          {title && (
            <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          )}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
export function Disclosure({
  title,
  children,
  open = false,
}: {
  title: string;
  children: ReactNode;
  open?: boolean;
}) {
  return (
    <details className="border-t border-line py-4" open={open}>
      <summary className="text-sm font-medium">{title}</summary>
      <div className="grid gap-4 pt-4">{children}</div>
    </details>
  );
}
export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs",
        {
          "border-line text-muted": tone === "neutral",
          "border-accent/30 bg-accent/10 text-accent": tone === "success",
          "border-warning/30 text-warning": tone === "warning",
          "border-danger/30 text-danger": tone === "danger",
        },
        className,
      )}
      {...props}
    />
  );
}
export function Status({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "danger";
}) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      aria-live="polite"
      className={cn(
        "text-xs",
        tone === "danger" ? "text-danger" : "text-muted",
      )}
    >
      {children}
    </div>
  );
}
export function Toolbar({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 border-b border-line p-3",
        className,
      )}
      {...props}
    />
  );
}

export interface SegmentedOption {
  value: string;
  label: string;
  disabled?: boolean;
}
export function SegmentedControl({
  label,
  options,
  value,
  onValueChange,
}: {
  label: string;
  options: readonly SegmentedOption[];
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1">
      {options.map((option) => (
        <Button
          key={option.value}
          size="sm"
          disabled={option.disabled}
          aria-pressed={value === option.value}
          onClick={() => onValueChange(option.value)}
          className={
            value === option.value
              ? "border-accent text-accent bg-accent/10"
              : ""
          }
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

export function AssetCard({
  title,
  image,
  selected = false,
  onSelect,
  children,
  disabled = false,
}: {
  title: string;
  image?: string;
  selected?: boolean;
  disabled?: boolean;
  onSelect: () => void;
  children?: ReactNode;
}) {
  return (
    <article
      className={cn(
        "overflow-hidden border bg-surface",
        selected ? "border-accent ring-1 ring-accent" : "border-line",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        disabled={disabled}
        aria-pressed={selected}
        className="block w-full text-left disabled:opacity-40"
      >
        {image && (
          <img
            loading="lazy"
            src={image}
            alt=""
            className="aspect-square w-full object-contain bg-[#687366]"
          />
        )}
        <strong className="block p-3 text-xs font-medium leading-relaxed">
          {title}
        </strong>
      </button>
      {children && <div className="px-3 pb-3">{children}</div>}
    </article>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="grid place-items-center gap-3 p-8 text-center">
      <h2 className="text-xl font-medium">{title}</h2>
      {children && (
        <div className="max-w-sm text-sm text-muted">{children}</div>
      )}
      {action}
    </div>
  );
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="gl-dialog"
      aria-labelledby={titleId}
      onClose={() => {
        if (open) onClose();
      }}
    >
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 id={titleId} className="text-lg font-semibold">
          {title}
        </h2>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Close dialog"
          onClick={() => ref.current?.close()}
        >
          ×
        </Button>
      </div>
      <div className="grid gap-4">{children}</div>
      {actions && <div className="mt-6 flex justify-end gap-2">{actions}</div>}
    </dialog>
  );
}
