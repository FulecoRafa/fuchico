import { syntaxTree } from "@codemirror/language";
import type { Extension, Range } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  type EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import type { TreeCursor } from "@lezer/common";
import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";

export type MermaidOpenPayload = { blockKey: string; text: string };

const UPDATE_DEBOUNCE_MS = 400;

function mermaidBlockAt(
  view: EditorView,
  pos: number,
): { text: string } | null {
  let result: { text: string } | null = null;
  syntaxTree(view.state).iterate({
    from: pos,
    to: pos,
    enter(node) {
      if (node.name !== "FencedCode") return;
      if (!isMermaidFence(view, node.node.cursor())) return;
      const openingLine = view.state.doc.lineAt(node.from);
      const closingLine = view.state.doc.lineAt(node.to);
      const from = openingLine.to + 1;
      const to = closingLine.from;
      result = { text: view.state.doc.sliceString(from, Math.max(from, to)) };
    },
  });
  return result;
}

function isMermaidFence(view: EditorView, cursor: TreeCursor): boolean {
  if (!cursor.firstChild()) return false;
  do {
    if (cursor.name === "CodeInfo") {
      return (
        view.state.doc
          .sliceString(cursor.from, cursor.to)
          .trim()
          .toLowerCase() === "mermaid"
      );
    }
  } while (cursor.nextSibling());
  return false;
}

class MermaidButtonWidget extends WidgetType {
  constructor(readonly onClick: () => void) {
    super();
  }
  eq(): boolean {
    return true;
  }
  toDOM(): HTMLElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cm-mermaid-preview-btn";
    btn.title = "Preview diagram";
    btn.textContent = "▶ Preview diagram";
    btn.addEventListener("mousedown", (e) => e.preventDefault());
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      this.onClick();
    });
    return btn;
  }
  ignoreEvent(): boolean {
    return true;
  }
}

type TrackedBlock = { anchor: number; lastText: string | null };

/**
 * Adds a "Preview diagram" button above every ```mermaid fenced block,
 * opening a live-updating diagram view (docked pane or separate window,
 * decided by the caller). Open blocks are tracked by an editor-generated
 * uuid (blockKey), independent of position -- only the anchor position is
 * remapped through each transaction to relocate the block as the document
 * is edited above/below it. Live updates and lifecycle (request current
 * text, notify the block closed) travel over the same Tauri event bus used
 * for popped-out windows, so docked and windowed panes share one protocol.
 */
export function mermaidPreviewExtension(
  onOpen: (payload: MermaidOpenPayload) => void,
): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      tracked = new Map<string, TrackedBlock>();
      unlistenRequest: UnlistenFn | null = null;
      unlistenClosed: UnlistenFn | null = null;
      timer: ReturnType<typeof setTimeout> | null = null;

      constructor(view: EditorView) {
        this.decorations = this.buildDecorations(view);
        void listen<{ blockKey: string }>("mermaid:request", ({ payload }) => {
          this.emitBlock(view, payload.blockKey, true);
        }).then((fn) => {
          this.unlistenRequest = fn;
        });
        void listen<{ blockKey: string }>("mermaid:closed", ({ payload }) => {
          this.tracked.delete(payload.blockKey);
        }).then((fn) => {
          this.unlistenClosed = fn;
        });
      }

      buildDecorations(view: EditorView): DecorationSet {
        const decs: Range<Decoration>[] = [];
        syntaxTree(view.state).iterate({
          from: view.viewport.from,
          to: view.viewport.to,
          enter: (node) => {
            if (node.name !== "FencedCode") return;
            if (!isMermaidFence(view, node.node.cursor())) return;
            const anchor = node.from;
            const openingLine = view.state.doc.lineAt(node.from);
            decs.push(
              Decoration.widget({
                widget: new MermaidButtonWidget(() =>
                  this.openBlock(view, anchor),
                ),
                side: 1,
              }).range(openingLine.to),
            );
            return false;
          },
        });
        return Decoration.set(decs, true);
      }

      openBlock(view: EditorView, anchor: number) {
        const block = mermaidBlockAt(view, anchor);
        if (!block) return;
        const blockKey = crypto.randomUUID();
        this.tracked.set(blockKey, { anchor, lastText: block.text });
        onOpen({ blockKey, text: block.text });
      }

      emitBlock(view: EditorView, blockKey: string, force: boolean) {
        const tracked = this.tracked.get(blockKey);
        if (!tracked) return;
        const block = mermaidBlockAt(view, tracked.anchor);
        const text = block?.text ?? null;
        if (!force && text === tracked.lastText) return;
        tracked.lastText = text;
        void emit("mermaid:update", { blockKey, text });
      }

      scheduleEmit(view: EditorView) {
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(() => {
          for (const blockKey of this.tracked.keys()) {
            this.emitBlock(view, blockKey, false);
          }
        }, UPDATE_DEBOUNCE_MS);
      }

      update(u: ViewUpdate) {
        // The markdown language attaches asynchronously after mount (see
        // EditorPane's languageCompartment reconfigure), which changes the
        // syntax tree without a doc or viewport change -- catch that too, or
        // the button never appears until the next edit/scroll.
        if (
          u.docChanged ||
          u.viewportChanged ||
          syntaxTree(u.state) !== syntaxTree(u.startState)
        ) {
          this.decorations = this.buildDecorations(u.view);
        }
        if (u.docChanged && this.tracked.size > 0) {
          for (const tracked of this.tracked.values()) {
            tracked.anchor = u.changes.mapPos(tracked.anchor);
          }
          this.scheduleEmit(u.view);
        }
      }

      destroy() {
        if (this.timer) clearTimeout(this.timer);
        this.unlistenRequest?.();
        this.unlistenClosed?.();
      }
    },
    { decorations: (v) => v.decorations },
  );
}
