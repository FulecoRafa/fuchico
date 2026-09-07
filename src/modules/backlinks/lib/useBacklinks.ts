import {
  resolveRelativeMarkdownLink,
  resolveWikilinkTarget,
} from "@/modules/editor/lib/wikilinks";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useMemo, useState } from "react";

export type LinkRef = {
  path: string;
  line: number;
  target: string;
  kind: "wiki" | "markdown";
  context: string;
};

export type Backlink = { line: number; context: string };
export type BacklinkGroup = { path: string; refs: Backlink[] };

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; refs: LinkRef[] }
  | { status: "error"; message: string };

/** Vault-wide outgoing-link index from the Rust `links_scan` command,
 * refreshed on every save / fs change (issue #21). */
export function useLinkIndex(rootPath: string | null) {
  const [state, setState] = useState<State>({ status: "idle" });

  const scan = useCallback(async (root: string) => {
    setState((s) => (s.status === "loaded" ? s : { status: "loading" }));
    try {
      const refs = await invoke<LinkRef[]>("links_scan", { root });
      setState({ status: "loaded", refs });
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
    const unlisteners = [
      listen("fs:file-written", () => void scan(rootPath)),
      listen("fs:changed", () => void scan(rootPath)),
    ];
    return () => {
      for (const u of unlisteners) void u.then((stop) => stop());
    };
  }, [rootPath, scan]);

  return state;
}

/** Groups every link that resolves to `targetPath` by the note it lives in.
 * Pure, so it can be unit-tested without Tauri. */
export function backlinksFor(
  refs: readonly LinkRef[],
  targetPath: string,
  vaultFiles: readonly string[],
): BacklinkGroup[] {
  const groups = new Map<string, Backlink[]>();
  for (const ref of refs) {
    if (ref.path === targetPath) continue;
    const resolved =
      ref.kind === "wiki"
        ? resolveWikilinkTarget(ref.target, vaultFiles)
        : resolveRelativeMarkdownLink(ref.target, ref.path);
    if (resolved !== targetPath) continue;
    const list = groups.get(ref.path) ?? [];
    if (!list.some((b) => b.line === ref.line)) {
      list.push({ line: ref.line, context: ref.context });
    }
    groups.set(ref.path, list);
  }
  return [...groups.entries()]
    .map(([path, refs]) => ({ path, refs }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

export function useBacklinks(
  rootPath: string | null,
  targetPath: string | null,
  vaultFiles: readonly string[],
) {
  const index = useLinkIndex(rootPath);
  const groups = useMemo(
    () =>
      index.status === "loaded" && targetPath
        ? backlinksFor(index.refs, targetPath, vaultFiles)
        : [],
    [index, targetPath, vaultFiles],
  );
  return { index, groups };
}
