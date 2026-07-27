import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

/**
 * Recursive list of every Markdown file's absolute path under `rootPath`,
 * for wikilink resolution/autocomplete in EditorPane. Refetched whenever the
 * root changes; the file explorer's own tree state stays lazy/non-recursive
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
    void invoke<string[]>("fs_list_markdown_files", { root: rootPath })
      .then((result) => {
        if (!cancelled) setFiles(result);
      })
      .catch(() => {
        if (!cancelled) setFiles([]);
      });
    return () => {
      cancelled = true;
    };
  }, [rootPath]);

  return files;
}
