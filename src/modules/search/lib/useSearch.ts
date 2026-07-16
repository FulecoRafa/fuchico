import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

export type SearchMatch = {
  file: string;
  line: number;
  column: number;
  text: string;
};

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; matches: SearchMatch[] }
  | { status: "error"; message: string };

const DEBOUNCE_MS = 200;

/** Debounced cross-file text search over the open folder, backed by the
 * Rust `search_files` command. */
export function useSearch(rootPath: string | null, query: string) {
  const [state, setState] = useState<State>({ status: "idle" });

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
  }, [rootPath, query]);

  return state;
}
