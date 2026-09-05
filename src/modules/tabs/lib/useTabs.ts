import { useCallback, useState } from "react";

export type Tab = {
  path: string;
  dirty: boolean;
  focusLine?: number;
  focusToken: number;
};

export function useTabs() {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);

  const openFile = useCallback((path: string, focusLine?: number) => {
    setTabs((prev) => {
      const existing = prev.find((t) => t.path === path);
      if (existing) {
        return prev.map((t) =>
          t.path === path
            ? { ...t, focusLine, focusToken: t.focusToken + 1 }
            : t,
        );
      }
      return [...prev, { path, dirty: false, focusLine, focusToken: 1 }];
    });
    setActivePath(path);
  }, []);

  const closeTab = useCallback((path: string) => {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.path === path);
      if (idx === -1) return prev;
      const next = prev.filter((t) => t.path !== path);
      setActivePath((current) => {
        if (current !== path) return current;
        if (next.length === 0) return null;
        return next[Math.min(idx, next.length - 1)].path;
      });
      return next;
    });
  }, []);

  const setDirty = useCallback((path: string, dirty: boolean) => {
    setTabs((prev) => {
      const target = prev.find((t) => t.path === path);
      if (!target || target.dirty === dirty) return prev;
      return prev.map((t) => (t.path === path ? { ...t, dirty } : t));
    });
  }, []);

  const closeAll = useCallback(() => {
    setTabs([]);
    setActivePath(null);
  }, []);

  const closeOthers = useCallback((path: string) => {
    setTabs((prev) => {
      const kept = prev.filter((t) => t.path === path);
      if (kept.length === prev.length) return prev;
      setActivePath((current) =>
        kept.some((t) => t.path === current)
          ? current
          : (kept[0]?.path ?? null),
      );
      return kept;
    });
  }, []);

  /** A file or folder was renamed/moved on disk: rewrite the paths of any tabs
   * under it so they keep pointing at a live file. */
  const handlePathRenamed = useCallback((from: string, to: string) => {
    const remap = (path: string) => {
      if (path === from) return to;
      if (path.startsWith(`${from}/`)) return to + path.slice(from.length);
      return path;
    };
    setTabs((prev) => {
      if (!prev.some((t) => t.path !== remap(t.path))) return prev;
      return prev.map((t) => ({ ...t, path: remap(t.path) }));
    });
    setActivePath((current) => (current ? remap(current) : current));
  }, []);

  /** A file or folder was deleted on disk: close any tabs under it. */
  const handlePathDeleted = useCallback((path: string) => {
    const gone = (p: string) => p === path || p.startsWith(`${path}/`);
    setTabs((prev) => {
      const idx = prev.findIndex((t) => gone(t.path));
      if (idx === -1) return prev;
      const next = prev.filter((t) => !gone(t.path));
      setActivePath((current) => {
        if (current === null || !gone(current)) return current;
        if (next.length === 0) return null;
        return next[Math.min(idx, next.length - 1)].path;
      });
      return next;
    });
  }, []);

  return {
    tabs,
    activePath,
    setActivePath,
    openFile,
    closeTab,
    setDirty,
    closeAll,
    closeOthers,
    handlePathRenamed,
    handlePathDeleted,
  };
}
