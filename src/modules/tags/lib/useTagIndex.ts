import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useState } from "react";

export type TagEntry = {
  tag: string;
  count: number;
  files: string[];
};

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; entries: TagEntry[] }
  | { status: "error"; message: string };

/**
 * Vault-wide tag index, backed by the Rust `tags_scan` command: every
 * inline `#tag` plus frontmatter `tags:` list, aggregated with counts and
 * the notes that reference each tag. Re-scans whenever a file is saved,
 * same trigger as `useAgenda`/`useSearch`.
 */
export function useTagIndex(rootPath: string | null) {
  const [state, setState] = useState<State>({ status: "idle" });

  const scan = useCallback(async (root: string) => {
    setState((s) => (s.status === "loaded" ? s : { status: "loading" }));
    try {
      const entries = await invoke<TagEntry[]>("tags_scan", { root });
      setState({ status: "loaded", entries });
    } catch (e) {
      setState({ status: "error", message: String(e) });
    }
  }, []);

  useEffect(() => {
    if (!rootPath) {
      setState({ status: "idle" });
      return;
    }
    void scan(rootPath);
  }, [rootPath, scan]);

  useEffect(() => {
    if (!rootPath) return;
    const unlisten = listen("fs:file-written", () => {
      void scan(rootPath);
    });
    return () => {
      void unlisten.then((stop) => stop());
    };
  }, [rootPath, scan]);

  return {
    state,
    refresh: useCallback(() => {
      if (rootPath) void scan(rootPath);
    }, [rootPath, scan]),
  };
}
