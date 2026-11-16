import type { ReactNode } from "react";
import { cn } from "./utils.js";

export function AppShell({
  product,
  project,
  actions,
  children,
  className,
  homeHref = "./",
}: {
  product: string;
  project?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  homeHref?: string;
}) {
  return (
    <div
      className={cn("gl-root gl-app-shell flex min-h-dvh flex-col", className)}
    >
      <header className="gl-app-header flex h-auto flex-wrap items-center gap-6 border-b border-line bg-[#151816] px-6 py-4">
        <a
          href={homeHref}
          className="gl-brand text-base font-extrabold tracking-[.14em] text-accent"
        >
          GHOSTLINE
          <span className="mt-1 block text-[9px] font-medium tracking-[.18em] text-muted">
            {product.toUpperCase()}
          </span>
        </a>
        {project && (
          <div className="gl-project-context border-l border-line pl-6 text-sm">
            {project}
          </div>
        )}
        <nav
          aria-label="Project actions"
          className="gl-project-actions actions static ml-auto flex flex-wrap items-center gap-2 bg-transparent p-0"
        >
          {actions}
        </nav>
      </header>
      {children}
    </div>
  );
}
export function Workspace({
  library,
  inspector,
  children,
}: {
  library: ReactNode;
  inspector?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="gl-workspace" data-inspector={Boolean(inspector)}>
      <aside
        aria-label="Asset library"
        className="overflow-auto border-r border-line bg-background p-5"
      >
        {library}
      </aside>
      <section
        aria-label="Workspace"
        className="gl-stage relative flex min-h-[420px] min-w-0 flex-col"
      >
        {children}
      </section>
      {inspector && (
        <aside
          aria-label="Inspector"
          className="gl-inspector overflow-auto border-l border-line bg-panel p-5"
        >
          {inspector}
        </aside>
      )}
    </main>
  );
}
