import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";

/** Show the file/folder selected in the OS file manager (Finder, Explorer…). */
export function revealInFileManager(path: string): Promise<void> {
  return revealItemInDir(path).catch((e) => {
    console.warn("reveal failed", e);
  });
}

/** Open `path` with the app named in Settings › External Tool (issue #20),
 * or the OS default handler when no tool is configured. `openWith` is the
 * application name as the OS knows it (e.g. "Visual Studio Code"). */
export function openWithExternalTool(
  path: string,
  openWith?: string,
): Promise<void> {
  const app = openWith?.trim();
  return openPath(path, app ? app : undefined).catch((e) => {
    window.alert(`Could not open with ${app || "the default app"}: ${e}`);
  });
}

export function copyPathToClipboard(path: string): Promise<void> {
  return navigator.clipboard.writeText(path).catch((e) => {
    console.warn("clipboard write failed", e);
  });
}
