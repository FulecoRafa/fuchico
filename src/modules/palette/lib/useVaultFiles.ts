import type { DirEntry } from "@/modules/explorer/lib/useFileTree";
import { joinPath } from "@/modules/explorer/lib/useFileTree";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; files: string[] }
  | { status: "error"; message: string };

/** Recursively walks `root` via the existing `fs_read_dir` Tauri command
 * (the same one the file explorer uses per-directory) to build a flat list
 * of file paths for the quick switcher. Hidden entries (dotfiles/dotdirs,
 * e.g. `.git`) are skipped since `fs_read_dir` is called with
 * `showHidden: false`; symlinks are skipped to avoid cycles. */
async function walkVault(root: string): Promise<string[]> {
  const files: string[] = [];

  async function walkDir(dir: string): Promise<void> {
    let entries: DirEntry[];
    try {
      entries = await invoke<DirEntry[]>("fs_read_dir", {
        path: dir,
        showHidden: false,
      });
    } catch {
      return;
    }
    const subdirs: string[] = [];
    for (const entry of entries) {
      const full = joinPath(dir, entry.name);
      if (entry.kind === "dir") {
        subdirs.push(full);
      } else if (entry.kind === "file") {
        files.push(full);
      }
    }
    await Promise.all(subdirs.map((d) => walkDir(d)));
  }

  await walkDir(root);
  return files;
}

/** Lazily walks the vault for a flat file list, only while `active` is true
 * (i.e. while the quick switcher is open), and caches the result per root
 * so reopening the switcher doesn't re-walk the whole tree every time. */
export function useVaultFiles(rootPath: string | null, active: boolean) {
  const [state, setState] = useState<State>({ status: "idle" });
  const cacheRef = useRef<{ root: string; files: string[] } | null>(null);

  useEffect(() => {
    if (!active || !rootPath) return;
    if (cacheRef.current && cacheRef.current.root === rootPath) {
      setState({ status: "loaded", files: cacheRef.current.files });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    walkVault(rootPath)
      .then((files) => {
        if (cancelled) return;
        cacheRef.current = { root: rootPath, files };
        setState({ status: "loaded", files });
      })
      .catch((e) => {
        if (!cancelled) setState({ status: "error", message: String(e) });
      });
    return () => {
      cancelled = true;
    };
  }, [rootPath, active]);

  return state;
}
