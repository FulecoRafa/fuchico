import type { Shortcuts } from "@/modules/settings/lib/editorSettings";
import { type ChangeSpec, EditorSelection, Prec } from "@codemirror/state";
import { type Command, type EditorView, keymap } from "@codemirror/view";
import { DEFAULT_TABLE_MARKDOWN, setTableEdit } from "./tableStyle";

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

function insertTable(view: EditorView): boolean {
  const { state } = view;
  const range = state.selection.main;
  const doc = state.doc;

  const needsLeadingBreak =
    range.from > 0 && doc.sliceString(range.from - 1, range.from) !== "\n";
  const needsTrailingBreak =
    range.to < doc.length && doc.sliceString(range.to, range.to + 1) !== "\n";

  const insert =
    (needsLeadingBreak ? "\n" : "") +
    DEFAULT_TABLE_MARKDOWN +
    (needsTrailingBreak ? "\n" : "");
  const tableFrom = range.from + (needsLeadingBreak ? 1 : 0);

  // Single transaction: the table's anchor is deterministic (tableFrom),
  // so there's no need for a second dispatch that re-parses the syntax
  // tree to find it -- that race could leave the edit-state effect
  // dispatched against a tree that hadn't caught up yet.
  //
  // The selection is placed one char *inside* the table (not at tableFrom,
  // its exact boundary) so it's fully swallowed by the table widget's
  // block-replace decoration. Helix draws its own block cursor at
  // selection.head regardless of DOM focus; at the boundary it renders
  // clipped right next to the widget as a second, stuck-looking cursor
  // once focus moves into a cell's <input>.
  view.dispatch({
    changes: { from: range.from, to: range.to, insert },
    selection: EditorSelection.cursor(tableFrom + 1),
    effects: setTableEdit.of({
      tableAnchor: tableFrom,
      activeRow: 0,
      activeCol: 0,
      cellEditing: true,
    }),
  });
  view.focus();
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
    insertTable: insertTable,
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
