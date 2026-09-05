import type { Extension } from "@codemirror/state";
import { EditorView, ViewPlugin } from "@codemirror/view";

/** Cache of each file's editor scroll offset, keyed by path. `EditorPane`
 * is remounted (fresh CodeMirror instance) every time the active tab
 * changes, so scroll position isn't retained by the DOM/view across tab
 * switches -- this cache is what lets it be restored. It's also persisted to
 * localStorage (debounced) so positions survive app restarts (issue #14). */
const STORAGE_KEY = "helix.scrollPositions";
const MAX_ENTRIES = 500;
const SAVE_DELAY_MS = 400;

const scrollPositions = new Map<string, number>(load());
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function load(): [string, number][] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is [string, number] =>
        Array.isArray(e) &&
        typeof e[0] === "string" &&
        typeof e[1] === "number",
    );
  } catch {
    return [];
  }
}

function scheduleSave(): void {
  if (saveTimer !== null) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      // Map preserves insertion order; re-inserting on set keeps the most
      // recently scrolled files at the tail, so trimming drops the oldest.
      const entries = [...scrollPositions.entries()].slice(-MAX_ENTRIES);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // Storage full or unavailable: in-memory cache still works.
    }
  }, SAVE_DELAY_MS);
}

export function getScrollPosition(path: string): number | undefined {
  return scrollPositions.get(path);
}

export function setScrollPosition(path: string, top: number): void {
  scrollPositions.delete(path);
  scrollPositions.set(path, top);
  scheduleSave();
}

/** Restores the cached offset when the view is created and keeps the cache
 * fresh on scroll / destroy. Lives inside CodeMirror rather than a React
 * effect because `<CodeMirror>` only mounts once the document is ready and
 * @uiw creates the view a render later than the parent's effects run. */
export function scrollPersistenceExtension(path: string): Extension {
  return [
    ViewPlugin.define((view) => {
      const saved = getScrollPosition(path);
      if (saved !== undefined) {
        requestAnimationFrame(() => {
          view.scrollDOM.scrollTop = saved;
        });
      }
      return {
        destroy() {
          setScrollPosition(path, view.scrollDOM.scrollTop);
        },
      };
    }),
    EditorView.domEventHandlers({
      scroll(_event, view) {
        setScrollPosition(path, view.scrollDOM.scrollTop);
        return false;
      },
    }),
  ];
}
