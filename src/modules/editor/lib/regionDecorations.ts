import {
  foldable,
  foldEffect,
  foldedRanges,
  unfoldEffect,
} from "@codemirror/language";
import type { Extension, Range } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  type EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";

class RegionStartWidget extends WidgetType {
  constructor(
    readonly name: string,
    readonly lineFrom: number,
  ) {
    super();
  }

  eq(other: RegionStartWidget): boolean {
    return other.name === this.name && other.lineFrom === this.lineFrom;
  }

  toDOM(view: EditorView): HTMLElement {
    const bar = document.createElement("span");
    bar.className = "cm-region-bar cm-region-bar-start";
    bar.contentEditable = "false";

    const chevron = document.createElement("span");
    chevron.className = "cm-region-chevron";
    chevron.textContent = "▾";
    chevron.addEventListener("mousedown", (e) => e.preventDefault());
    chevron.addEventListener("click", () => {
      const line = view.state.doc.lineAt(this.lineFrom);
      const range = foldable(view.state, line.from, line.to);
      if (range) view.dispatch({ effects: foldEffect.of(range) });
    });

    const icon = document.createElement("span");
    icon.className = "cm-region-icon";
    icon.textContent = "\u{1F4C1}"; // 📁

    const label = document.createElement("span");
    label.className = "cm-region-label";
    label.textContent = this.name;

    bar.append(chevron, icon, label);
    return bar;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

class RegionEndWidget extends WidgetType {
  eq(): boolean {
    return true;
  }

  toDOM(): HTMLElement {
    const bar = document.createElement("span");
    bar.className = "cm-region-bar cm-region-bar-end";
    bar.contentEditable = "false";
    return bar;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

// While folded, the fold's own placeholder pill (regionFoldWidget.ts) sits
// immediately after this marker line's text -- so the raw marker text just
// needs to disappear, not compete with a full-width bar for space on the
// same line.
class HiddenMarkerWidget extends WidgetType {
  eq(): boolean {
    return true;
  }

  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "cm-region-marker-hidden";
    return span;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

function foldedRangeEndingAfter(view: EditorView, pos: number): number | null {
  let end: number | null = null;
  foldedRanges(view.state).between(pos, pos, (from, to) => {
    if (from === pos) end = to;
  });
  return end;
}

function buildDecorations(
  view: EditorView,
  startMarker: string,
  endMarker: string,
): DecorationSet {
  if (!startMarker.trim() || !endMarker.trim()) return Decoration.none;

  const decorations: Range<Decoration>[] = [];
  const doc = view.state.doc;
  const cursorLine = doc.lineAt(view.state.selection.main.head).number;
  let depth = 0;
  let skipUntilLine = 0;

  for (let n = 1; n <= doc.lines; n++) {
    if (n <= skipUntilLine) continue;
    const line = doc.line(n);
    const trimmed = line.text.trimStart();

    if (trimmed.startsWith(startMarker)) {
      const name = trimmed.slice(startMarker.length).trim() || "Region";
      const foldedTo = foldedRangeEndingAfter(view, line.to);

      if (foldedTo !== null) {
        skipUntilLine = doc.lineAt(foldedTo).number;
        if (n !== cursorLine) {
          decorations.push(
            Decoration.replace({ widget: new HiddenMarkerWidget() }).range(
              line.from,
              line.to,
            ),
          );
        }
        continue;
      }

      if (n !== cursorLine) {
        decorations.push(
          Decoration.line({ class: "cm-region-start-line" }).range(line.from),
        );
        decorations.push(
          Decoration.replace({
            widget: new RegionStartWidget(name, line.from),
          }).range(line.from, line.to),
        );
      }
      depth++;
      continue;
    }

    if (trimmed.startsWith(endMarker)) {
      if (depth > 0) depth--;
      if (n !== cursorLine) {
        decorations.push(
          Decoration.line({ class: "cm-region-end-line" }).range(line.from),
        );
        decorations.push(
          Decoration.replace({ widget: new RegionEndWidget() }).range(
            line.from,
            line.to,
          ),
        );
      }
      continue;
    }

    if (depth > 0) {
      decorations.push(
        Decoration.line({ class: "cm-region-body-line" }).range(line.from),
      );
    }
  }

  return Decoration.set(decorations, true);
}

function foldStateChanged(u: ViewUpdate): boolean {
  return u.transactions.some((tr) =>
    tr.effects.some((e) => e.is(foldEffect) || e.is(unfoldEffect)),
  );
}

export function regionDecorationsExtension(
  startMarker: string,
  endMarker: string,
): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = buildDecorations(view, startMarker, endMarker);
      }
      update(u: ViewUpdate) {
        if (
          u.docChanged ||
          u.viewportChanged ||
          u.selectionSet ||
          foldStateChanged(u)
        ) {
          this.decorations = buildDecorations(u.view, startMarker, endMarker);
        }
      }
    },
    { decorations: (v) => v.decorations },
  );
}
