import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef } from "react";

const OPEN_FILES_EVENT = "app:open-files";

export interface OpenRequestHandlers {
  /** Current vault root, or null when no folder is open. */
  rootPath: string | null;
  /** Adopt `dir` as the vault (persisting it the same way Open Folder does). */
  setRoot: (dir: string) => void;
  /** Open a note that lives inside the current vault in a tab. */
  openInVault: (path: string) => void;
  /** Open a note from elsewhere in its own single-file window. */
  openElsewhere: (path: string) => void;
}

function dirname(path: string): string {
  const i = path.lastIndexOf("/");
  return i <= 0 ? "/" : path.slice(0, i);
}

export function isInside(root: string, path: string): boolean {
  const base = root.endsWith("/") ? root : `${root}/`;
  return path.startsWith(base);
}

/** Decides where a file handed over by the OS should open (issue #38):
 * no vault yet → its folder becomes the vault; inside the vault → a tab;
 * anywhere else → a standalone editor window. Returns the root that is in
 * effect afterwards so a batch of files is routed consistently. */
export function routeOpenRequest(
  path: string,
  h: OpenRequestHandlers,
): string | null {
  if (!h.rootPath) {
    const dir = dirname(path);
    h.setRoot(dir);
    h.openInVault(path);
    return dir;
  }
  if (isInside(h.rootPath, path)) {
    h.openInVault(path);
  } else {
    h.openElsewhere(path);
  }
  return h.rootPath;
}

/** Drains files queued before the webview was ready, then keeps listening
 * for later ones (Finder double-click, `open -a`, second CLI launch).
 * `enabled` gates the initial drain until the last vault has been restored,
 * so a file inside it opens as a tab instead of re-rooting the vault. */
export function useOpenRequests(
  enabled: boolean,
  handlers: OpenRequestHandlers,
): void {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const handle = (paths: string[]) => {
      const h = { ...ref.current };
      for (const p of paths) h.rootPath = routeOpenRequest(p, h);
    };
    void invoke<string[]>("open_requests_take")
      .then((paths) => {
        if (!cancelled && paths.length) handle(paths);
      })
      .catch(() => {});
    const unlisten = listen<string[]>(OPEN_FILES_EVENT, (e) =>
      handle(e.payload),
    );
    return () => {
      cancelled = true;
      void unlisten.then((fn) => fn());
    };
  }, [enabled]);
}
