import { restore, serializeAsJSON } from "@excalidraw/excalidraw";
import type {
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";
import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";

type ReadResult =
  | { kind: "text"; content: string; size: number }
  | { kind: "binary"; size: number }
  | { kind: "toolarge"; size: number; limit: number };

export type ExcalidrawDocState =
  | { status: "loading" }
  | { status: "ready"; initialData: ExcalidrawInitialDataState }
  | { status: "error"; message: string };

const AUTOSAVE_DELAY_MS = 1000;

type Options = {
  path: string;
  onDirtyChange?: (dirty: boolean) => void;
};

/**
 * Loads a `.excalidraw` scene and autosaves it back to disk shortly after
 * each change, mirroring the text editor's dirty-tracking but without a
 * manual save step -- Excalidraw's onChange fires on every stroke, so
 * writes are debounced rather than immediate.
 */
export function useExcalidrawDocument({ path, onDirtyChange }: Options) {
  const [doc, setDoc] = useState<ExcalidrawDocState>({ status: "loading" });
  const savedRef = useRef<string>("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);

  const onDirtyChangeRef = useRef(onDirtyChange);
  onDirtyChangeRef.current = onDirtyChange;

  useEffect(() => {
    let cancelled = false;
    setDoc({ status: "loading" });
    if (timerRef.current) clearTimeout(timerRef.current);

    invoke<ReadResult>("fs_read_file", { path })
      .then((res) => {
        if (cancelled) return;
        if (res.kind !== "text") {
          setDoc({ status: "error", message: "Not a valid drawing file" });
          return;
        }
        const trimmed = res.content.trim();
        try {
          const parsed = trimmed ? JSON.parse(trimmed) : {};
          // collaborators is session-only state (never meant to be persisted)
          // and restore() only replaces a field with its default when it's
          // absent -- a plain `{}` left over from an old hand-rolled save
          // (or any future non-Map value) would otherwise pass straight
          // through untouched and crash Excalidraw's renderer, which calls
          // .forEach on it expecting a real Map. Deleting it here forces
          // restore() to fall back to `new Map()`.
          const { collaborators: _collaborators, ...restAppState } =
            parsed.appState ?? {};
          const restored = restore(
            {
              elements: parsed.elements ?? [],
              appState: restAppState,
              files: parsed.files ?? {},
            },
            null,
            null,
          );
          savedRef.current = serializeAsJSON(
            restored.elements,
            restored.appState,
            restored.files,
            "local",
          );
          setDoc({
            status: "ready",
            initialData: {
              elements: restored.elements,
              appState: restored.appState,
              files: restored.files,
            },
          });
        } catch {
          setDoc({ status: "error", message: "Malformed drawing file" });
        }
      })
      .catch((e) => {
        if (!cancelled) setDoc({ status: "error", message: String(e) });
      });

    return () => {
      cancelled = true;
    };
  }, [path]);

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const api = apiRef.current;
    if (!api) return;
    const content = serializeAsJSON(
      api.getSceneElements(),
      api.getAppState(),
      api.getFiles(),
      "local",
    );
    if (content === savedRef.current) return;
    await invoke("fs_write_file", { path, content, source: "editor" });
    savedRef.current = content;
    onDirtyChangeRef.current?.(false);
  }, [path]);

  const onChange = useCallback(() => {
    onDirtyChangeRef.current?.(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void flush();
    }, AUTOSAVE_DELAY_MS);
  }, [flush]);

  // Flush on unmount (e.g. switching tabs) so a pending debounce isn't lost.
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        void flush();
      }
    };
  }, [flush]);

  return { doc, onChange, apiRef, flush };
}
