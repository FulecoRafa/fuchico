import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";

/**
 * Recursive list of every Markdown file's absolute path under `rootPath`,
 * for wikilink resolution/autocomplete in EditorPane. Refetched whenever the
 * root changes or the watcher reports a change (so notes created after the
 * vault was opened resolve too); the file explorer's own tree state stays lazy/non-recursive
 * (`fs_read_dir`), so this needs its own recursive backend call.
 */
export function useVaultFiles(rootPath: string | null): string[] {
  const [files, setFiles] = useState<string[]>([]);

  useEffect(() => {
    if (!rootPath) {
      setFiles([]);
      return;
    }
    let cancelled = false;
    const refresh = () => {
      void invoke<string[]>("fs_list_markdown_files", { root: rootPath })
        .then((result) => {
          if (!cancelled) setFiles(result);
        })
        .catch(() => {
          if (!cancelled) setFiles([]);
        });
    };
    refresh();
    const unlisten = listen("fs:changed", refresh);
    return () => {
      cancelled = true;
      void unlisten.then((stop) => stop());
    };
  }, [rootPath]);

  return files;
}
