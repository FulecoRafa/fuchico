import { codeFolding } from "@codemirror/language";
import type { EditorState, Extension } from "@codemirror/state";

type RegionPlaceholderInfo = { name: string; lineCount: number };

function prepareRegionPlaceholder(
  state: EditorState,
  range: { from: number; to: number },
  startMarker: string,
): RegionPlaceholderInfo | null {
  if (!startMarker.trim()) return null;
  const startLine = state.doc.lineAt(range.from - 1);
  const trimmed = startLine.text.trimStart();
  if (!trimmed.startsWith(startMarker)) return null;
  const name = trimmed.slice(startMarker.length).trim() || "Region";
  // range.from/to are the marker lines' own boundaries (startLine.to,
  // endLine.to), so both marker lines are excluded from the body count.
  const endLine = state.doc.lineAt(range.to);
  const lineCount = Math.max(0, endLine.number - startLine.number - 1);
  return { name, lineCount };
}

function regionPlaceholderDOM(
  onclick: (event: Event) => void,
  prepared: RegionPlaceholderInfo | null,
): HTMLElement {
  if (!prepared) {
    const span = document.createElement("span");
    span.className = "cm-foldPlaceholder";
    span.textContent = "…";
    span.onclick = onclick;
    return span;
  }

  const pill = document.createElement("span");
  pill.className = "cm-region-fold-pill";
  pill.setAttribute("aria-label", `Folded region: ${prepared.name}`);
  pill.onclick = onclick;

  const icon = document.createElement("span");
  icon.className = "cm-region-fold-icon";
  icon.textContent = "\u{1F4C1}"; // 📁

  const name = document.createElement("span");
  name.className = "cm-region-fold-name";
  name.textContent = prepared.name;

  const count = document.createElement("span");
  count.className = "cm-region-fold-count";
  count.textContent = `${prepared.lineCount} lines`;

  pill.append(icon, name, count);
  return pill;
}

export function regionFoldWidgetExtension(startMarker: string): Extension {
  return codeFolding({
    preparePlaceholder: (state, range) =>
      prepareRegionPlaceholder(state, range, startMarker),
    placeholderDOM: (_view, onclick, prepared) =>
      regionPlaceholderDOM(onclick, prepared as RegionPlaceholderInfo | null),
  });
}
