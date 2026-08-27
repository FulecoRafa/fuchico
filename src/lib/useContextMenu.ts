import { useCallback, useState } from "react";

export type ContextMenuState<T> = { x: number; y: number; data: T } | null;

/** Position + payload state for a right-click `<ContextMenu>`; `open` is
 * meant to be bound to an element's `onContextMenu`. */
export function useContextMenu<T>() {
  const [menu, setMenu] = useState<ContextMenuState<T>>(null);
  const open = useCallback((e: React.MouseEvent, data: T) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, data });
  }, []);
  const close = useCallback(() => setMenu(null), []);
  return { menu, open, close };
}
