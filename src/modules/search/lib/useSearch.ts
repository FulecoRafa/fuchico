import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

export type SearchMatch = {
  file: string;
  line: number;
  column: number;
  text: string;
};

export type ReplaceResult = { filesChanged: number; replacements: number };

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; matches: SearchMatch[] }
  | { status: "error"; message: string };

const DEBOUNCE_MS = 200;

/** Debounced cross-file text search over the open folder, backed by the
 * Rust `search_files` command. Bump `refreshToken` to re-run the same query
 * (e.g. after a replace rewrote files). */
export function useSearch(
  rootPath: string | null,
  query: string,
  refreshToken = 0,
) {
  const [state, setState] = useState<State>({ status: "idle" });

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshToken is the explicit re-run signal
  useEffect(() => {
    if (!rootPath || query.trim().length === 0) {
      setState({ status: "idle" });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    const timer = setTimeout(() => {
      invoke<SearchMatch[]>("search_files", { root: rootPath, query })
        .then((matches) => {
          if (!cancelled) setState({ status: "loaded", matches });
        })
        .catch((e) => {
          if (!cancelled) setState({ status: "error", message: String(e) });
        });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [rootPath, query, refreshToken]);

  return state;
}

/** Vault-wide, case-insensitive replace (issue #25). Restrict to `files`
 * (canonical paths) to replace within a subset, e.g. one result group. The
 * backend emits `fs:file-written` per changed file so open editors and
 * indexes refresh themselves. */
export function replaceInFiles(
  root: string,
  query: string,
  replacement: string,
  files?: string[],
): Promise<ReplaceResult> {
  return invoke<{ files_changed: number; replacements: number }>(
    "search_replace_files",
    { root, query, replacement, files: files ?? null },
  ).then((r) => ({
    filesChanged: r.files_changed,
    replacements: r.replacements,
  }));
}
