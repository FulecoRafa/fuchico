import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";

type ReadResult =
  | { kind: "text"; content: string; size: number }
  | { kind: "binary"; size: number }
  | { kind: "toolarge"; size: number; limit: number };

export type DocumentState =
  | { status: "loading" }
  | { status: "ready"; content: string; size: number }
  | { status: "binary"; size: number }
  | { status: "toolarge"; size: number; limit: number }
  | { status: "error"; message: string };

type Options = {
  path: string;
  onDirtyChange?: (dirty: boolean) => void;
};

const AUTOSAVE_DEBOUNCE_MS = 800;

export function useDocument({ path, onDirtyChange }: Options) {
  const [doc, setDoc] = useState<DocumentState>({ status: "loading" });
  const [dirty, setDirty] = useState(false);

  // Track the saved buffer so we can detect changes cheaply.
  const savedRef = useRef<string>("");
  const bufferRef = useRef<string>("");
  const dirtyRef = useRef(false);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearAutosaveTimer = useCallback(() => {
    if (autosaveTimerRef.current !== null) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
  }, []);
  // Unmount/path-change safety net -- a pending autosave must not fire
  // against a buffer/path that's no longer current.
  useEffect(() => clearAutosaveTimer, [clearAutosaveTimer]);

  const onDirtyChangeRef = useRef(onDirtyChange);
  useEffect(() => {
    onDirtyChangeRef.current = onDirtyChange;
  }, [onDirtyChange]);
  useEffect(() => {
    onDirtyChangeRef.current?.(dirty);
  }, [dirty]);

  // Load on path change or explicit reload.
  useEffect(() => {
    let cancelled = false;
    clearAutosaveTimer();
    setDoc({ status: "loading" });
    setDirty(false);

    invoke<ReadResult>("fs_read_file", { path })
      .then((res) => {
        if (cancelled) return;
        if (res.kind === "text") {
          savedRef.current = res.content;
          bufferRef.current = res.content;
          setDoc({ status: "ready", content: res.content, size: res.size });
        } else if (res.kind === "binary") {
          setDoc({ status: "binary", size: res.size });
        } else if (res.kind === "toolarge") {
          setDoc({ status: "toolarge", size: res.size, limit: res.limit });
        }
      })
      .catch((e) => {
        if (!cancelled) setDoc({ status: "error", message: String(e) });
      });

    return () => {
      cancelled = true;
    };
  }, [path, clearAutosaveTimer]);

  // Skipped while dirty (never clobber unsaved edits).
  const reload = useCallback((): boolean => {
    if (dirtyRef.current) return false;
    void invoke<ReadResult>("fs_read_file", { path })
      .then((res) => {
        if (res.kind === "text") {
          if (res.content === savedRef.current) return;
          savedRef.current = res.content;
          bufferRef.current = res.content;
          setDirty(false);
          setDoc({ status: "ready", content: res.content, size: res.size });
        } else if (res.kind === "binary") {
          setDoc({ status: "binary", size: res.size });
        } else if (res.kind === "toolarge") {
          setDoc({ status: "toolarge", size: res.size, limit: res.limit });
        }
      })
      .catch((e) => setDoc({ status: "error", message: String(e) }));
    return true;
  }, [path]);

  const save = useCallback(async () => {
    clearAutosaveTimer();
    if (bufferRef.current === savedRef.current) return;
    const content = bufferRef.current;
    await invoke("fs_write_file", { path, content, source: "editor" });
    savedRef.current = content;
    setDirty(false);
  }, [path, clearAutosaveTimer]);
  const saveRef = useRef(save);
  saveRef.current = save;

  // Adopt externally formatted content as the saved baseline.
  const markSaved = useCallback(
    (content: string) => {
      clearAutosaveTimer();
      savedRef.current = content;
      setDirty(bufferRef.current !== content);
    },
    [clearAutosaveTimer],
  );

  const onChange = useCallback(
    (next: string) => {
      bufferRef.current = next;
      const isDirty = next !== savedRef.current;
      setDirty(isDirty);
      clearAutosaveTimer();
      if (isDirty) {
        autosaveTimerRef.current = setTimeout(() => {
          autosaveTimerRef.current = null;
          void saveRef.current();
        }, AUTOSAVE_DEBOUNCE_MS);
      }
    },
    [clearAutosaveTimer],
  );

  return { doc, dirty, onChange, save, reload, markSaved };
}
