import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import type { ReactNode } from "react";

/** Mounts the React-owned shell before starting a tool's domain controller.
 * Controller-owned lists/editors must remain empty leaves in the shell.
 */
export function mountApp(
  shell: ReactNode,
  start: () => Promise<unknown>,
): void {
  const root = document.getElementById("root");
  if (!root) throw new Error("Application root is missing");
  document.body.classList.add("gl-root");
  flushSync(() => createRoot(root).render(shell));
  void start().catch((error) => {
    console.error(error);
    const message = document.createElement("div");
    message.setAttribute("role", "alert");
    message.className = "gl-startup-error";
    message.textContent =
      "The application could not start. " +
      (error instanceof Error ? error.message : String(error));
    root.prepend(message);
  });
}
