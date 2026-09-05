import { useTheme } from "@/modules/settings/lib/useTheme";
import { useZoomShortcuts } from "@/modules/settings/lib/useZoomShortcuts";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";
import { EditorPane } from "./EditorPane";
import { useVaultFiles } from "./lib/useVaultFiles";

function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

/** Slim shell rendered in a secondary OS window (issue #29): one editor,
 * no explorer/sidebar. Wikilinks navigate within this window. Settings stay
 * in sync with the main window through the `storage` event
 * (see `editorSettings.ts`). */
export function EditorWindowApp({
  initialPath,
  rootPath,
}: {
  initialPath: string;
  rootPath: string | null;
}) {
  useTheme();
  useZoomShortcuts();
  const [path, setPath] = useState(initialPath);
  const [dirty, setDirty] = useState(false);
  const vaultFiles = useVaultFiles(rootPath);

  useEffect(() => {
    document.title = `${dirty ? "● " : ""}${basename(path)}`;
  }, [path, dirty]);

  return (
    <div className="editor-window">
      <EditorPane
        key={path}
        path={path}
        rootPath={rootPath}
        vaultFiles={vaultFiles}
        onDirtyChange={setDirty}
        onNavigateFile={(next) => setPath(next)}
        onClose={() => void getCurrentWindow().close()}
      />
    </div>
  );
}
