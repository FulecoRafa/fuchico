import { syntaxTree } from "@codemirror/language";
import {
  type EditorState,
  type Extension,
  type Range,
  StateEffect,
  StateField,
} from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  WidgetType,
} from "@codemirror/view";
import type { SyntaxNode, SyntaxNodeRef } from "@lezer/common";

/**
 * Renders GFM tables as an always-on, directly editable grid widget (never
 * shows raw `| a | b |` syntax), with Helix-flavored keyboard navigation:
 * hjkl/arrows move the active cell while not editing, i/Enter start editing
 * a cell's text, Esc steps back out (cell edit -> cell nav -> out of the
 * table). Requires the `Table` extension from @lezer/markdown to be enabled
 * on the markdown language (see languageDefinitions.ts) so `Table`/
 * `TableHeader`/`TableRow`/`TableCell`/`TableDelimiter` syntax nodes exist.
 */

const FLUSH_DEBOUNCE_MS = 200;

// ─── Parsing ────────────────────────────────────────────────────────────────

export type Align = "left" | "center" | "right" | null;

export type ParsedTable = {
  from: number;
  to: number;
  header: string[];
  align: Align[];
  rows: string[][];
};

function unescapePipes(s: string): string {
  return s.replace(/\\\|/g, "|");
}

function escapePipes(s: string): string {
  return s.replace(/\|/g, "\\|");
}

function cellsOfRow(state: EditorState, rowNode: SyntaxNodeRef): string[] {
  const pipes: { from: number; to: number }[] = [];
  const cur = rowNode.node.cursor();
  if (cur.firstChild()) {
    do {
      if (cur.name === "TableDelimiter") {
        pipes.push({ from: cur.from, to: cur.to });
      }
    } while (cur.nextSibling());
  }
  // A row with N cells has N+1 pipes -- slice the raw text between
  // consecutive pipes rather than counting TableCell nodes, since Lezer's
  // markdown Table extension doesn't emit a TableCell node for a cell
  // that's empty/whitespace-only. Counting nodes silently dropped empty
  // trailing cells from the parsed row, undercounting columns and making
  // insertColumn/insertRow operate on the wrong column count.
  const cells: string[] = [];
  for (let i = 0; i + 1 < pipes.length; i++) {
    cells.push(
      unescapePipes(
        state.doc.sliceString(pipes[i].to, pipes[i + 1].from).trim(),
      ),
    );
  }
  return cells;
}

function splitAlignRow(text: string): string[] {
  const trimmed = text.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|");
}

function parseAlignRow(text: string): Align[] {
  return splitAlignRow(text).map((seg) => {
    const s = seg.trim();
    const left = s.startsWith(":");
    const right = s.endsWith(":");
    if (left && right) return "center";
    if (right) return "right";
    if (left) return "left";
    return null;
  });
}

export function parseTableNode(
  state: EditorState,
  tableNode: SyntaxNode,
): ParsedTable {
  const from = tableNode.from;
  const to = tableNode.to;
  let header: string[] = [];
  let align: Align[] = [];
  const rows: string[][] = [];

  const cur = tableNode.cursor();
  if (cur.firstChild()) {
    do {
      if (cur.name === "TableHeader") {
        header = cellsOfRow(state, cur);
      } else if (cur.name === "TableDelimiter") {
        align = parseAlignRow(state.doc.sliceString(cur.from, cur.to));
      } else if (cur.name === "TableRow") {
        rows.push(cellsOfRow(state, cur));
      }
    } while (cur.nextSibling());
  }
  while (align.length < header.length) align.push(null);

  return { from, to, header, align, rows };
}

function findTableAt(
  view: EditorView,
  anchor: number,
): { node: SyntaxNode; parsed: ParsedTable } | null {
  let found: { node: SyntaxNode; parsed: ParsedTable } | null = null;
  syntaxTree(view.state).iterate({
    from: anchor,
    to: anchor,
    enter(node) {
      if (node.name !== "Table") return;
      found = {
        node: node.node,
        parsed: parseTableNode(view.state, node.node),
      };
      return false;
    },
  });
  return found;
}

// ─── Formatting (auto-format: pad columns for a readable raw .md) ──────────

function padCell(text: string, width: number, align: Align): string {
  const pad = Math.max(0, width - text.length);
  if (align === "right") return " ".repeat(pad) + text;
  if (align === "center") {
    const left = Math.floor(pad / 2);
    return " ".repeat(left) + text + " ".repeat(pad - left);
  }
  return text + " ".repeat(pad);
}

function computeColumnWidths(header: string[], rows: string[][]): number[] {
  const n = header.length;
  const widths = new Array(n).fill(3);
  header.forEach((h, i) => {
    widths[i] = Math.max(widths[i], h.length);
  });
  for (const row of rows) {
    row.forEach((c, i) => {
      if (i < n) widths[i] = Math.max(widths[i], c.length);
    });
  }
  return widths;
}

function formatDataRow(
  cells: string[],
  widths: number[],
  align: Align[],
): string {
  const parts = widths.map(
    (w, i) => ` ${padCell(escapePipes(cells[i] ?? ""), w, align[i] ?? null)} `,
  );
  return `|${parts.join("|")}|`;
}

function formatDelimiterRow(widths: number[], align: Align[]): string {
  const parts = widths.map((w, i) => {
    const a = align[i] ?? null;
    let dashes = "-".repeat(Math.max(3, w));
    if (a === "left") dashes = `:${dashes.slice(1)}`;
    else if (a === "right") dashes = `${dashes.slice(0, -1)}:`;
    else if (a === "center") dashes = `:${dashes.slice(1, -1)}:`;
    return ` ${dashes} `;
  });
  return `|${parts.join("|")}|`;
}

function formatTable(t: {
  header: string[];
  align: Align[];
  rows: string[][];
}): string {
  const widths = computeColumnWidths(t.header, t.rows);
  return [
    formatDataRow(t.header, widths, t.align),
    formatDelimiterRow(widths, t.align),
    ...t.rows.map((r) => formatDataRow(r, widths, t.align)),
  ].join("\n");
}

/** 2x2 default table markdown, used by the "insert table" command. */
export const DEFAULT_TABLE_MARKDOWN = formatTable({
  header: ["Column 1", "Column 2"],
  align: [null, null],
  rows: [["", ""]],
});

// ─── Active-cell / cell-edit-mode state ─────────────────────────────────────

export type TableEditState = {
  tableAnchor: number;
  activeRow: number;
  activeCol: number;
  cellEditing: boolean;
};

export const setTableEdit = StateEffect.define<TableEditState | null>();

export const tableEditField = StateField.define<TableEditState | null>({
  create: () => null,
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setTableEdit)) value = e.value;
    }
    if (value && tr.docChanged) {
      const mapped = tr.changes.mapPos(value.tableAnchor, -1);
      value = { ...value, tableAnchor: mapped };
    }
    return value;
  },
});

// ─── Widget ─────────────────────────────────────────────────────────────────

class TableWidget extends WidgetType {
  private destroyed = false;
  private resizeObserver: ResizeObserver | null = null;

  constructor(
    readonly from: number,
    readonly to: number,
    readonly parsed: ParsedTable,
    readonly editState: TableEditState | null,
  ) {
    super();
  }

  destroy(): void {
    this.destroyed = true;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }

  eq(other: TableWidget): boolean {
    const a = this.editState;
    const b = other.editState;
    return (
      JSON.stringify(this.parsed.header) ===
        JSON.stringify(other.parsed.header) &&
      JSON.stringify(this.parsed.align) ===
        JSON.stringify(other.parsed.align) &&
      JSON.stringify(this.parsed.rows) === JSON.stringify(other.parsed.rows) &&
      (a == null) === (b == null) &&
      (a == null ||
        (a.activeRow === b?.activeRow &&
          a.activeCol === b?.activeCol &&
          a.cellEditing === b?.cellEditing))
    );
  }

  toDOM(view: EditorView): HTMLElement {
    const parsed = this.parsed;
    const colCount = parsed.header.length;
    const liveCells: string[][] = [
      parsed.header.slice(),
      ...parsed.rows.map((r) => r.slice()),
    ];
    const align: Align[] = parsed.align.slice();
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    const anchor = this.editState?.tableAnchor ?? this.from;
    const editState = this.editState;

    // Outer container: the scrollable table wrapper on the left, and a
    // persistent "add column" button pinned to its right -- outside the
    // scroll area, so it stays reachable without scrolling a wide table.
    const container = document.createElement("div");
    container.className = "cm-table-container";
    container.contentEditable = "false";

    const wrap = document.createElement("div");
    wrap.className = "cm-table-wrap";
    wrap.contentEditable = "false";
    container.appendChild(wrap);

    // .cm-content doesn't line-wrap, so it has no intrinsic width limit --
    // without pinning this to the editor's real visible width, a wide
    // table grows .cm-content itself and the *whole buffer* scrolls
    // horizontally instead of just this table. Measure contentDOM itself
    // (not scrollDOM): scrollDOM's clientWidth also spans the line-number
    // gutter, which sits outside contentDOM -- pinning against it left the
    // container wide enough to overflow .cm-content by the gutter's width,
    // clipping/pushing the add-column button past the visible edge. Reserve
    // space for the add-column button so the container as a whole still fits.
    const syncWidth = () => {
      if (this.destroyed) return;
      wrap.style.maxWidth = `${view.contentDOM.clientWidth - 32}px`;
    };
    syncWidth();
    this.resizeObserver = new ResizeObserver(syncWidth);
    this.resizeObserver.observe(view.contentDOM);

    const table = document.createElement("table");
    table.className = "cm-table-grid";
    wrap.appendChild(table);

    const cellEls: HTMLElement[][] = [];
    const cellInputEls: (HTMLInputElement | null)[][] = [];

    const scheduleFocus = (target: HTMLElement, isInput: boolean) => {
      requestAnimationFrame(() => {
        if (this.destroyed) return;
        target.focus();
        if (isInput && target instanceof HTMLInputElement) {
          const end = target.value.length;
          target.setSelectionRange(end, end);
        }
      });
    };

    const currentTable = () => findTableAt(view, anchor);

    const flush = (immediate: boolean) => {
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      const run = () => {
        if (this.destroyed) return;
        const found = currentTable();
        if (!found) return;
        const text = formatTable({
          header: liveCells[0],
          align: align,
          rows: liveCells.slice(1),
        });
        const currentText = view.state.doc.sliceString(
          found.node.from,
          found.node.to,
        );
        if (text === currentText) return;
        try {
          view.dispatch({
            changes: {
              from: found.node.from,
              to: found.node.to,
              insert: text,
            },
          });
        } catch {
          // A dispatch triggered synchronously by a DOM event that fired
          // as a side effect of CodeMirror tearing down this widget's own
          // DOM (e.g. a "blur" fired by removing the focused element)
          // lands mid-update, which CodeMirror rejects. Retry just after
          // the current update finishes instead of losing the edit.
          setTimeout(run, 0);
        }
      };
      if (immediate) run();
      else flushTimer = setTimeout(run, FLUSH_DEBOUNCE_MS);
    };

    const activate = (row: number, col: number, editing: boolean) => {
      flush(true);
      const found = currentTable();
      const nextAnchor = found ? found.node.from : anchor;
      // Helix draws its own block cursor as a decoration at
      // state.selection.head, independent of DOM focus. Parking it exactly
      // at the table's boundary (rather than strictly inside the hidden
      // range) makes it render clipped right next to the widget instead of
      // being swallowed by the table's block-replace decoration -- looking
      // like a second, stuck cursor once focus moves into a cell's <input>.
      const pos = found
        ? Math.min(
            found.node.from + 1,
            Math.max(found.node.from, found.node.to - 1),
          )
        : anchor;
      view.dispatch({
        selection: { anchor: pos, head: pos },
        effects: setTableEdit.of({
          tableAnchor: nextAnchor,
          activeRow: row,
          activeCol: col,
          cellEditing: editing,
        }),
      });
      view.focus();
    };

    const rowCount = liveCells.length; // includes header at index 0

    const exitTable = (before: boolean) => {
      flush(true);
      const found = currentTable();
      const pos = found
        ? before
          ? Math.max(0, found.node.from - 1)
          : Math.min(view.state.doc.length, found.node.to + 1)
        : anchor;
      view.dispatch({
        effects: setTableEdit.of(null),
        selection: { anchor: pos, head: pos },
      });
      view.focus();
    };

    const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v));

    const moveActiveCell = (dr: number, dc: number) => {
      if (!editState) return;
      let r = editState.activeRow;
      let c = editState.activeCol + dc;
      if (c < 0) c = 0;
      if (c > colCount - 1) c = colCount - 1;
      r += dr;
      if (r < 0) {
        exitTable(true);
        return;
      }
      if (r > rowCount - 1) {
        exitTable(false);
        return;
      }
      activate(r, clamp(c, colCount - 1), false);
    };

    const tabMove = (forward: boolean) => {
      if (!editState) return;
      let r = editState.activeRow;
      let c = editState.activeCol + (forward ? 1 : -1);
      if (forward && c > colCount - 1) {
        c = 0;
        r += 1;
        if (r > rowCount - 1) {
          insertRow(rowCount - 1);
          r = rowCount; // liveCells now has a new last row at this index
        }
      } else if (!forward && c < 0) {
        c = colCount - 1;
        r = Math.max(0, r - 1);
      }
      activate(r, clamp(c, colCount - 1), true);
    };

    // ── Structural edits ──────────────────────────────────────────────────

    const insertRow = (afterIndex: number) => {
      const blank = new Array(colCount).fill("");
      liveCells.splice(afterIndex + 1, 0, blank);
      flush(true);
    };

    const removeRow = (rowIndex: number) => {
      if (rowIndex === 0) return; // never remove the header row
      if (liveCells.length <= 2) return; // keep at least one body row
      liveCells.splice(rowIndex, 1);
      const newActive = editState
        ? Math.min(editState.activeRow, liveCells.length - 1)
        : 0;
      flush(true);
      activate(newActive, editState?.activeCol ?? 0, false);
    };

    const insertColumn = (afterIndex: number) => {
      for (const row of liveCells) row.splice(afterIndex + 1, 0, "");
      align.splice(afterIndex + 1, 0, null);
      flush(true);
    };

    const onCellKeydown = (e: KeyboardEvent, r: number, c: number) => {
      const editing = !!editState?.cellEditing;
      if (e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        tabMove(!e.shiftKey);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (editing) activate(r, c, false);
        else exitTable(true);
        return;
      }
      if (!editing) {
        e.preventDefault();
        e.stopPropagation();
        switch (e.key) {
          case "h":
          case "ArrowLeft":
            moveActiveCell(0, -1);
            return;
          case "l":
          case "ArrowRight":
            moveActiveCell(0, 1);
            return;
          case "j":
          case "ArrowDown":
            moveActiveCell(1, 0);
            return;
          case "k":
          case "ArrowUp":
            moveActiveCell(-1, 0);
            return;
          case "i":
          case "Enter":
            activate(r, c, true);
            return;
          default:
            return;
        }
      }
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        const nr = r + 1;
        if (nr > rowCount - 1) insertRow(rowCount - 1);
        activate(nr, c, true);
      }
    };

    // Cells are never contentEditable: a live `<input>` (a form control,
    // opaque to CodeMirror's own DOM observer) replaces the static text
    // only in the single actively-edited cell. Real nested contentEditable
    // regions inside CM's own contentEditable root are not reliably
    // supported across browsers/WKWebView and previously froze the editor
    // (CM's DOM observer would see the in-place text mutations and try to
    // reconcile them; removing a focused nested-editable node mid-update
    // could also throw synchronously inside CM's own update cycle).
    const buildCell = (tag: "th" | "td", r: number, c: number): HTMLElement => {
      const el = document.createElement(tag);
      el.className =
        tag === "th" ? "cm-table-cell cm-table-cell-header" : "cm-table-cell";
      el.tabIndex = -1;

      const isActive =
        !!editState && editState.activeRow === r && editState.activeCol === c;
      const isEditingActive = isActive && !!editState?.cellEditing;

      if (isEditingActive) {
        const input = document.createElement("input");
        input.type = "text";
        input.className = "cm-table-cell-input";
        input.value = liveCells[r][c] ?? "";
        input.addEventListener("input", () => {
          liveCells[r][c] = input.value;
          flush(false);
        });
        input.addEventListener("blur", () => flush(true));
        input.addEventListener("keydown", (e) => onCellKeydown(e, r, c));
        el.appendChild(input);
        cellInputEls[r][c] = input;
      } else {
        const textSpan = document.createElement("span");
        textSpan.className = "cm-table-cell-text";
        textSpan.textContent = liveCells[r][c] ?? "";
        el.appendChild(textSpan);
        el.addEventListener("keydown", (e) => onCellKeydown(e, r, c));
        cellInputEls[r][c] = null;
      }

      el.addEventListener("click", () => {
        if (!isEditingActive) activate(r, c, true);
      });

      if (isActive) {
        el.classList.add(
          editState?.cellEditing
            ? "cm-table-cell-editing"
            : "cm-table-cell-active",
        );
      }

      cellEls[r][c] = el;
      return el;
    };

    // ── DOM: header row ──────────────────────────────────────────────────

    const theadRow = document.createElement("tr");
    cellEls.push([]);
    cellInputEls.push([]);
    for (let c = 0; c < colCount; c++) {
      const th = buildCell("th", 0, c);
      theadRow.appendChild(th);
    }
    const thead = document.createElement("thead");
    thead.appendChild(theadRow);
    table.appendChild(thead);

    // ── DOM: body rows ───────────────────────────────────────────────────

    const tbody = document.createElement("tbody");
    table.appendChild(tbody);

    for (let r = 1; r < rowCount; r++) {
      const tr = document.createElement("tr");
      cellEls.push([]);
      cellInputEls.push([]);
      for (let c = 0; c < colCount; c++) {
        const td = buildCell("td", r, c);

        if (c === 0) {
          // A plain div, not a <button> -- native <button> elements nested
          // inside CodeMirror's contentEditable tree silently swallow
          // click/mousedown/pointerdown in the Tauri/WKWebView build (no
          // JS error, no console output, even though hover/hit-testing
          // works fine), while a div with the same listeners works.
          const removeRowBtn = document.createElement("div");
          removeRowBtn.className = "cm-table-row-controls";
          removeRowBtn.setAttribute("role", "button");
          removeRowBtn.textContent = "×";
          removeRowBtn.title = "Remove row";
          removeRowBtn.contentEditable = "false";
          removeRowBtn.addEventListener("mousedown", (e) => e.preventDefault());
          removeRowBtn.addEventListener("click", (e) => {
            e.preventDefault();
            removeRow(r);
          });
          td.appendChild(removeRowBtn);
        }

        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }

    // Persistent "add row" affordance below the table.
    const addRowBar = document.createElement("div");
    addRowBar.className = "cm-table-add-row";
    addRowBar.contentEditable = "false";
    addRowBar.textContent = "+ Add row";
    addRowBar.addEventListener("mousedown", (e) => e.preventDefault());
    addRowBar.addEventListener("click", (e) => {
      e.preventDefault();
      insertRow(rowCount - 1);
    });
    wrap.appendChild(addRowBar);

    // Persistent "add column" affordance to the right of the table. A div,
    // not a <button> -- see the removeRowBtn comment above.
    const addColBtn = document.createElement("div");
    addColBtn.className = "cm-table-add-col";
    addColBtn.setAttribute("role", "button");
    addColBtn.textContent = "+";
    addColBtn.title = "Add column";
    addColBtn.contentEditable = "false";
    addColBtn.addEventListener("mousedown", (e) => e.preventDefault());
    addColBtn.addEventListener("click", (e) => {
      e.preventDefault();
      insertColumn(colCount - 1);
    });
    container.appendChild(addColBtn);

    // ── Focus the active cell (input if editing, cell itself if not) ──────

    if (editState) {
      const r = clamp(editState.activeRow, rowCount - 1);
      const c = clamp(editState.activeCol, colCount - 1);
      const el = cellEls[r]?.[c];
      if (el) {
        const input = cellInputEls[r]?.[c] ?? null;
        scheduleFocus(input ?? el, input !== null);
        el.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    }

    return container;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

// ─── Decoration builder ─────────────────────────────────────────────────────

function buildDecorations(state: EditorState): DecorationSet {
  const decs: Range<Decoration>[] = [];
  const editState = state.field(tableEditField, false) ?? null;

  syntaxTree(state).iterate({
    enter(node) {
      if (node.name !== "Table") return;
      const parsed = parseTableNode(state, node.node);
      const thisTableState =
        editState && editState.tableAnchor === node.from ? editState : null;
      decs.push(
        Decoration.replace({
          widget: new TableWidget(node.from, node.to, parsed, thisTableState),
          block: true,
        }).range(node.from, node.to),
      );
      return false;
    },
  });

  return Decoration.set(decs, true);
}

// Block-level decorations (Decoration.replace/widget with `block: true`)
// must come from a StateField, not a ViewPlugin -- CodeMirror throws
// "Block decorations may not be specified via plugins" otherwise, which
// corrupts the view's internal layout state (the freezes, stuck cursors,
// and "table doesn't render" symptoms all traced back to this).
const tableField = StateField.define<DecorationSet>({
  create(state) {
    return buildDecorations(state);
  },
  update(decorations, tr) {
    const editStateEffect = tr.effects.some((e) => e.is(setTableEdit));
    if (
      tr.docChanged ||
      editStateEffect ||
      syntaxTree(tr.state) !== syntaxTree(tr.startState)
    ) {
      return buildDecorations(tr.state);
    }
    return decorations.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

export const tableStyle: Extension = [tableEditField, tableField];
