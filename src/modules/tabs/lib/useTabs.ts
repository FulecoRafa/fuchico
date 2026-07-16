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

  return {
    tabs,
    activePath,
    setActivePath,
    openFile,
    closeTab,
    setDirty,
    closeAll,
  };
}
