import type { Range } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import {
  Decoration,
  type DecorationSet,
  type EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";

/**
 * Live-preview style decorations for Markdown: hides marker characters on
 * lines the cursor isn't on, scales headings, renders task checkboxes and
 * callouts, and turns links into clickable widgets. Ported from
 * ~/Documents/Dev/codemirror-helix/step-2's markdownStyle.ts, adapted to
 * read colors from this app's theme tokens instead of a fixed palette.
 */

// ─── Checkbox ────────────────────────────────────────────────────────────────

class CheckboxWidget extends WidgetType {
  constructor(
    readonly checked: boolean,
    readonly from: number,
  ) {
    super();
  }

  eq(other: CheckboxWidget): boolean {
    return other.checked === this.checked && other.from === this.from;
  }

  toDOM(view: EditorView): HTMLElement {
    const wrap = document.createElement("span");
    wrap.className = "cm-task-checkbox";
    // Without this, WKWebView (Tauri's macOS webview) swallows clicks on
    // form controls nested inside a contenteditable region — the checkbox
    // renders but never toggles.
    wrap.contentEditable = "false";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = this.checked;
    const pos = this.from;
    input.addEventListener("mousedown", (e) => e.preventDefault());
    input.addEventListener("click", (e) => {
      e.preventDefault();
      const text = view.state.doc.sliceString(pos, pos + 3);
      const wasChecked = text === "[x]" || text === "[X]";
      view.dispatch({
        changes: { from: pos, to: pos + 3, insert: wasChecked ? "[ ]" : "[x]" },
      });
    });
    wrap.appendChild(input);
    return wrap;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

// ─── Callout header ──────────────────────────────────────────────────────────

const CALLOUT_META: Record<
  string,
  { icon: string; label: string; cls: string }
> = {
  NOTE: { icon: "ℹ", label: "Note", cls: "cm-callout-note" },
  TIP: { icon: "💡", label: "Tip", cls: "cm-callout-tip" },
  WARNING: { icon: "⚠", label: "Warning", cls: "cm-callout-warning" },
  IMPORTANT: { icon: "📌", label: "Important", cls: "cm-callout-important" },
  CAUTION: { icon: "🔥", label: "Caution", cls: "cm-callout-caution" },
};

class CalloutHeaderWidget extends WidgetType {
  constructor(readonly type: string) {
    super();
  }
  eq(other: CalloutHeaderWidget): boolean {
    return other.type === this.type;
  }

  toDOM(): HTMLElement {
    const meta = CALLOUT_META[this.type] ?? {
      icon: "📝",
      label: this.type,
      cls: "",
    };
    const span = document.createElement("span");
    span.className = `cm-callout-header ${meta.cls}-header`;
    span.textContent = `${meta.icon} ${meta.label}`;
    return span;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

// ─── Link widget ─────────────────────────────────────────────────────────────

class LinkWidget extends WidgetType {
  constructor(
    readonly text: string,
    readonly url: string,
  ) {
    super();
  }
  eq(other: LinkWidget): boolean {
    return other.text === this.text && other.url === this.url;
  }

  toDOM(): HTMLElement {
    const a = document.createElement("a");
    a.href = this.url;
    a.textContent = this.text;
    a.className = "cm-md-link-widget";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.title = this.url;
    return a;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

// ─── Decoration builder ───────────────────────────────────────────────────────

function buildDecorations(view: EditorView): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  const cursorLine = view.state.doc.lineAt(
    view.state.selection.main.head,
  ).number;

  syntaxTree(view.state).iterate({
    from: view.viewport.from,
    to: view.viewport.to,
    enter(node) {
      const nodeLine = view.state.doc.lineAt(node.from).number;
      const onCursorLine = nodeLine === cursorLine;

      switch (node.name) {
        case "ATXHeading1":
        case "ATXHeading2":
        case "ATXHeading3":
        case "ATXHeading4":
        case "ATXHeading5":
        case "ATXHeading6": {
          const level = node.name.slice(-1);
          const lineFrom = view.state.doc.lineAt(node.from).from;
          decorations.push(
            Decoration.line({ class: `cm-md-h${level}` }).range(lineFrom),
          );
          break;
        }

        case "HeaderMark":
          if (!onCursorLine) {
            const after = view.state.doc.sliceString(node.to, node.to + 1);
            decorations.push(
              Decoration.replace({}).range(
                node.from,
                after === " " ? node.to + 1 : node.to,
              ),
            );
          }
          break;

        case "EmphasisMark":
        case "CodeMark":
        case "StrikethroughMark":
          if (!onCursorLine) {
            decorations.push(Decoration.replace({}).range(node.from, node.to));
          }
          break;

        case "QuoteMark":
          if (!onCursorLine) {
            const after = view.state.doc.sliceString(node.to, node.to + 1);
            decorations.push(
              Decoration.replace({}).range(
                node.from,
                after === " " ? node.to + 1 : node.to,
              ),
            );
          }
          break;

        case "Blockquote": {
          const startLine = view.state.doc.lineAt(node.from);
          const endLine = view.state.doc.lineAt(node.to);
          const firstText = view.state.doc.sliceString(
            startLine.from,
            startLine.to,
          );
          const calloutMatch = firstText.match(
            /^(>\s*)(\[!(NOTE|WARNING|TIP|IMPORTANT|CAUTION)\])/i,
          );

          if (calloutMatch) {
            const type = calloutMatch[3].toUpperCase();
            const meta = CALLOUT_META[type];
            const cls = `cm-callout ${meta?.cls ?? "cm-callout-note"}`;
            for (let i = startLine.number; i <= endLine.number; i++) {
              decorations.push(
                Decoration.line({ class: cls }).range(
                  view.state.doc.line(i).from,
                ),
              );
            }
            const markerFrom = startLine.from + calloutMatch[1].length;
            const markerTo = markerFrom + calloutMatch[2].length;
            if (startLine.number !== cursorLine) {
              decorations.push(
                Decoration.replace({
                  widget: new CalloutHeaderWidget(type),
                }).range(markerFrom, markerTo),
              );
            }
          } else {
            for (let i = startLine.number; i <= endLine.number; i++) {
              decorations.push(
                Decoration.line({ class: "cm-md-blockquote" }).range(
                  view.state.doc.line(i).from,
                ),
              );
            }
          }
          break;
        }

        case "HorizontalRule": {
          const lineFrom = view.state.doc.lineAt(node.from).from;
          decorations.push(
            Decoration.line({ class: "cm-md-hr" }).range(lineFrom),
          );
          break;
        }

        case "TaskMarker": {
          const text = view.state.doc.sliceString(node.from, node.to);
          const checked = text === "[x]" || text === "[X]";
          decorations.push(
            Decoration.replace({
              widget: new CheckboxWidget(checked, node.from),
            }).range(node.from, node.to),
          );
          break;
        }

        case "Link": {
          if (onCursorLine) break;
          const raw = view.state.doc.sliceString(node.from, node.to);
          const m = raw.match(/^\[([^\]]*)\]\(([^)]*)\)$/);
          if (!m) break;
          decorations.push(
            Decoration.replace({ widget: new LinkWidget(m[1], m[2]) }).range(
              node.from,
              node.to,
            ),
          );
          break;
        }

        case "Autolink": {
          if (onCursorLine) break;
          const raw = view.state.doc.sliceString(node.from, node.to);
          const url = raw.startsWith("<") ? raw.slice(1, -1) : raw;
          decorations.push(
            Decoration.replace({ widget: new LinkWidget(url, url) }).range(
              node.from,
              node.to,
            ),
          );
          break;
        }
      }
    },
  });

  decorations.sort((a, b) => {
    if (a.from !== b.from) return a.from - b.from;
    return a.to - a.from - (b.to - b.from);
  });

  return Decoration.set(decorations, true);
}

export const markdownStyle = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.viewportChanged || u.selectionSet) {
        this.decorations = buildDecorations(u.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);
