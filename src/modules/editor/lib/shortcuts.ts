import type { Shortcuts } from "@/modules/settings/lib/editorSettings";
import { type ChangeSpec, EditorSelection, Prec } from "@codemirror/state";
import { type Command, type EditorView, keymap } from "@codemirror/view";

const CHECKBOX_RE = /\[([ xX])\]/;

function toggleCheckboxAtCursor(view: EditorView): boolean {
  const { state } = view;
  const changes: ChangeSpec[] = [];
  for (const range of state.selection.ranges) {
    const line = state.doc.lineAt(range.head);
    const m = CHECKBOX_RE.exec(line.text);
    if (!m || m.index === undefined) continue;
    const from = line.from + m.index;
    const checked = m[1] === "x" || m[1] === "X";
    changes.push({ from, to: from + 3, insert: checked ? "[ ]" : "[x]" });
  }
  if (changes.length === 0) return false;
  view.dispatch({ changes });
  return true;
}

function formatDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${formatDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function insertAtCursor(view: EditorView, text: string): boolean {
  view.dispatch(
    view.state.changeByRange((range) => {
      const insert = text;
      return {
        changes: { from: range.from, to: range.to, insert },
        range: EditorSelection.cursor(range.from + insert.length),
      };
    }),
  );
  return true;
}

function insertRegion(
  view: EditorView,
  startMarker: string,
  endMarker: string,
): boolean {
  view.dispatch(
    view.state.changeByRange((range) => {
      const doc = view.state.doc;
      if (range.empty) {
        const insert = `${startMarker} Region\n${endMarker}\n`;
        return {
          changes: { from: range.from, insert },
          range: EditorSelection.cursor(range.from + startMarker.length + 1),
        };
      }
      const startLine = doc.lineAt(range.from);
      const endLine = doc.lineAt(range.to);
      const insertStart = `${startMarker} Region\n`;
      const insertEnd = `\n${endMarker}`;
      return {
        changes: [
          { from: startLine.from, insert: insertStart },
          { from: endLine.to, insert: insertEnd },
        ],
        range: EditorSelection.range(
          startLine.from,
          endLine.to + insertStart.length + insertEnd.length,
        ),
      };
    }),
  );
  return true;
}

export function shortcutsExtension(
  bindings: Shortcuts,
  foldMarkers: { start: string; end: string },
  onOpenOutline: () => void,
) {
  const commands: Record<string, Command> = {
    openOutline: () => {
      onOpenOutline();
      return true;
    },
    toggleCheckboxAtCursor: toggleCheckboxAtCursor,
    insertDate: (view) => insertAtCursor(view, formatDate(new Date())),
    insertDateTime: (view) => insertAtCursor(view, formatDateTime(new Date())),
    insertRegion: (view) =>
      insertRegion(view, foldMarkers.start, foldMarkers.end),
  };

  return Prec.highest(
    keymap.of(
      (Object.keys(bindings) as (keyof Shortcuts)[]).map((action) => ({
        key: bindings[action],
        preventDefault: true,
        run: commands[action],
      })),
    ),
  );
}
