import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

/** Window labels for single-file editor windows (issue #29). Must match the
 * `editor-*` pattern in `src-tauri/capabilities/editor-window.json`. */
export const EDITOR_WINDOW_PREFIX = "editor-";

function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

/** Window labels only allow [a-zA-Z0-9-/:_], so hash the path. */
export function editorWindowLabel(path: string): string {
  let h = 0;
  for (let i = 0; i < path.length; i++) h = (h * 31 + path.charCodeAt(i)) >>> 0;
  return `${EDITOR_WINDOW_PREFIX}${h.toString(36)}`;
}

export function editorWindowUrl(path: string, rootPath: string | null): string {
  const q = new URLSearchParams({ window: "editor", path });
  if (rootPath) q.set("root", rootPath);
  return `index.html?${q.toString()}`;
}

/** Opens `path` in its own OS window, or focuses the window that already
 * shows it. */
export async function openEditorWindow(
  path: string,
  rootPath: string | null,
): Promise<void> {
  const label = editorWindowLabel(path);
  const existing = await WebviewWindow.getByLabel(label);
  if (existing) {
    await existing.setFocus();
    return;
  }
  new WebviewWindow(label, {
    url: editorWindowUrl(path, rootPath),
    title: basename(path),
    width: 900,
    height: 650,
    // Same as the main window: required for HTML5 drag-and-drop on macOS.
    dragDropEnabled: false,
  });
}
