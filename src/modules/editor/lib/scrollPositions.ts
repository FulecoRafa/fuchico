/** Module-level cache of each open file's editor scroll offset, keyed by
 * path. `EditorPane` is remounted (fresh CodeMirror instance) every time the
 * active tab changes, so scroll position isn't retained by the DOM/view
 * across tab switches -- this cache is what lets it be restored. */
const scrollPositions = new Map<string, number>();

export function getScrollPosition(path: string): number | undefined {
  return scrollPositions.get(path);
}

export function setScrollPosition(path: string, top: number): void {
  scrollPositions.set(path, top);
}
