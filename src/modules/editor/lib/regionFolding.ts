import { foldService } from "@codemirror/language";
import type { Extension } from "@codemirror/state";

/**
 * Fold regions delimited by configurable start/end marker lines (default
 * `:::fold Name` / `:::endfold`) -- a convention of our own, not part of the
 * Markdown spec, since the whole region is rendered custom anyway (see
 * regionDecorations.ts / regionFoldWidget.ts). Nesting is supported by
 * tracking depth while scanning forward from a candidate start line.
 */
export function regionFoldingExtension(
  startMarker: string,
  endMarker: string,
): Extension {
  if (!startMarker.trim() || !endMarker.trim()) return [];

  return foldService.of((state, lineStart) => {
    const startLine = state.doc.lineAt(lineStart);
    if (startLine.from !== lineStart) return null;
    if (!startLine.text.trimStart().startsWith(startMarker)) return null;

    let depth = 0;
    for (let n = startLine.number + 1; n <= state.doc.lines; n++) {
      const line = state.doc.line(n);
      const text = line.text.trimStart();
      if (text.startsWith(startMarker)) {
        depth++;
      } else if (text.startsWith(endMarker)) {
        if (depth === 0) return { from: startLine.to, to: line.to };
        depth--;
      }
    }
    return null;
  });
}
