import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

export type DocStats = {
  words: number;
  readingTimeMin: number;
};

const WORDS_PER_MINUTE = 200;
const REPORT_DEBOUNCE_MS = 200;

export function computeDocStats(text: string): DocStats {
  const trimmed = text.trim();
  const words = trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
  const readingTimeMin =
    words === 0 ? 0 : Math.max(1, Math.round(words / WORDS_PER_MINUTE));
  return { words, readingTimeMin };
}

/** Reports live word-count/reading-time stats as the document changes,
 * debounced so large notes don't recompute on every keystroke. One instance
 * per editor (created inside the extensions useMemo), so the debounce timer
 * is naturally scoped to that pane. */
export function docStatsReporterExtension(
  onStats: (stats: DocStats) => void,
): Extension {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return EditorView.updateListener.of((update) => {
    if (!update.docChanged) return;
    if (timer !== null) clearTimeout(timer);
    const text = update.state.doc.toString();
    timer = setTimeout(() => {
      timer = null;
      onStats(computeDocStats(text));
    }, REPORT_DEBOUNCE_MS);
  });
}
