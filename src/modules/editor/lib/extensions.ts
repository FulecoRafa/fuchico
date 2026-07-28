import type { KeybindingMode } from "@/modules/settings/lib/editorSettings";
import {
  foldGutter,
  HighlightStyle,
  indentUnit,
  syntaxHighlighting,
} from "@codemirror/language";
import { lintGutter } from "@codemirror/lint";
import { search } from "@codemirror/search";
import {
  Compartment,
  EditorState,
  type Extension,
  Prec,
} from "@codemirror/state";
import { EditorView, lineNumbers } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import { vim } from "@replit/codemirror-vim";
import { helix } from "codemirror-helix";
import { regionDecorationsExtension } from "./regionDecorations";
import { regionFoldingExtension } from "./regionFolding";
import { regionFoldWidgetExtension } from "./regionFoldWidget";

// Compartments allow runtime reconfiguration without rebuilding state.
export const languageCompartment = new Compartment();
export const keybindingCompartment = new Compartment();
export const wrapCompartment = new Compartment();
export const shortcutsCompartment = new Compartment();
export const foldRegionCompartment = new Compartment();
export const lineNumberCompartment = new Compartment();
export const indentCompartment = new Compartment();

/** Absolute gutter by default; in relative mode the active line still shows
 * its absolute number (Helix/Vim convention) while every other line shows
 * its distance from the cursor. The redraw listener is required because
 * @codemirror/view's line-number gutter only repaints when the `lineNumbers`
 * facet's *identity* changes, not on plain selection changes -- so every
 * cursor move reconfigures the compartment with a fresh (but equivalent)
 * extension to force a repaint. */
export function lineNumbersExtensionFor(relative: boolean): Extension {
  if (!relative) return lineNumbers();
  return [
    lineNumbers({
      formatNumber: (lineNo, state) => {
        const current = state.doc.lineAt(state.selection.main.head).number;
        return lineNo === current
          ? String(lineNo)
          : String(Math.abs(lineNo - current));
      },
    }),
    EditorView.updateListener.of((update) => {
      if (!update.selectionSet || update.docChanged) return;
      update.view.dispatch({
        effects: lineNumberCompartment.reconfigure(
          lineNumbersExtensionFor(true),
        ),
      });
    }),
  ];
}

export function indentExtensionFor(tabSize: number): Extension {
  return [indentUnit.of(" ".repeat(tabSize)), EditorState.tabSize.of(tabSize)];
}

export function foldRegionExtensionFor(
  startMarker: string,
  endMarker: string,
): Extension {
  return [
    regionFoldWidgetExtension(startMarker),
    regionFoldingExtension(startMarker, endMarker),
    regionDecorationsExtension(startMarker, endMarker),
  ];
}

/** basicSetup is added before user extensions by @uiw/react-codemirror, so
 * modal keymaps must be elevated to Prec.highest to win over it. "normal"
 * uses CodeMirror's own default keymap, i.e. no modal extension at all. */
export function keybindingExtensionFor(mode: KeybindingMode): Extension {
  if (mode === "vim") return Prec.highest(vim());
  if (mode === "helix") return Prec.highest(helix());
  return [];
}

// Chevron-style fold markers matching the file explorer's disclosure
// triangle (rotate-on-open, same path shape) instead of foldGutter's
// default ⌄/› glyphs.
function makeFoldMarker(open: boolean): HTMLElement {
  const span = document.createElement("span");
  span.className = open
    ? "cm-fold-marker cm-fold-marker-open"
    : "cm-fold-marker";
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "10");
  svg.setAttribute("height", "10");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2.25");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M9 6l6 6-6 6");
  svg.appendChild(path);
  span.appendChild(svg);
  return span;
}

// Only what basicSetup doesn't already cover, to avoid duplicate extensions.
// basicSetup gives us line numbers, fold gutter, history, indentOnInput,
// bracketMatching, closeBrackets, autocompletion, highlightActiveLine,
// highlightSelectionMatches and the search keymap.
// Singleton: per-pane instances would inject duplicate style modules.
const chromeTheme = EditorView.theme({
  "&": {
    height: "100%",
    backgroundColor: "var(--background)",
    color: "var(--foreground)",
  },
  "&, &.cm-editor, &.cm-editor.cm-focused": {
    outline: "none",
  },
  ".cm-scroller": {
    fontFamily: "var(--font-mono)",
    fontSize: "13px",
    lineHeight: "1.55",
  },
  ".cm-content": {
    caretColor: "var(--foreground)",
  },
  ".cm-gutters": {
    backgroundColor: "var(--background)",
    color: "var(--muted-foreground)",
    border: "none",
  },
  ".cm-gutter-lint": { width: "0px" },
  ".cm-activeLine": {
    backgroundColor: "color-mix(in oklch, var(--foreground) 5%, transparent)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "color-mix(in oklch, var(--foreground) 6%, transparent)",
    color: "var(--foreground)",
  },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor:
      "color-mix(in oklch, var(--primary) 30%, transparent) !important",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "var(--foreground)",
  },
  ".cm-searchMatch": {
    backgroundColor:
      "color-mix(in oklch, var(--syntax-number) 30%, transparent)",
  },
  ".cm-searchMatch.cm-searchMatch-selected": {
    backgroundColor:
      "color-mix(in oklch, var(--syntax-number) 55%, transparent)",
  },
  ".cm-matchingBracket, .cm-nonmatchingBracket": {
    backgroundColor: "color-mix(in oklch, var(--foreground) 12%, transparent)",
    outline: "none",
  },
  ".cm-foldPlaceholder": {
    backgroundColor: "var(--secondary)",
    border: "1px solid var(--border)",
    color: "var(--muted-foreground)",
  },
  ".cm-tooltip": {
    backgroundColor: "var(--card)",
    color: "var(--card-foreground)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
  },
  ".cm-tooltip-autocomplete ul li[aria-selected]": {
    backgroundColor: "var(--accent)",
    color: "var(--accent-foreground)",
  },
  ".cm-panels": {
    backgroundColor: "var(--card)",
    color: "var(--card-foreground)",
  },
  // Vim/Helix-style block cursor in normal mode.
  ".cm-fat-cursor": {
    background:
      "color-mix(in oklch, var(--foreground) 45%, transparent) !important",
    outline:
      "1px solid color-mix(in oklch, var(--foreground) 65%, transparent) !important",
    borderRadius: "2px",
  },
  "&:not(.cm-focused) .cm-fat-cursor": {
    background: "transparent !important",
    outline:
      "1px solid color-mix(in oklch, var(--foreground) 40%, transparent) !important",
  },

  // ── Fold gutter chevrons ────────────────────────────────────────────────
  ".cm-foldGutter .cm-gutterElement": {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0",
  },
  ".cm-fold-marker": {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--muted-foreground)",
    cursor: "pointer",
    transition:
      "transform var(--dur-fast) var(--ease-premium), color var(--dur-fast) var(--ease-premium)",
  },
  ".cm-fold-marker-open": {
    transform: "rotate(90deg)",
  },
  ".cm-foldGutter .cm-gutterElement:hover .cm-fold-marker": {
    color: "var(--foreground)",
  },

  // ── Markdown live-preview styling ───────────────────────────────────────
  ".cm-md-h1": {
    fontSize: "1.6em",
    fontWeight: "700",
    lineHeight: "1.4",
    color: "var(--destructive)",
  },
  ".cm-md-h2": {
    fontSize: "1.4em",
    fontWeight: "700",
    lineHeight: "1.4",
    color: "var(--syntax-number)",
  },
  ".cm-md-h3": {
    fontSize: "1.2em",
    fontWeight: "700",
    lineHeight: "1.4",
    color: "var(--syntax-keyword)",
  },
  ".cm-md-h4": {
    fontSize: "1.08em",
    fontWeight: "700",
    color: "var(--syntax-string)",
  },
  ".cm-md-h5": {
    fontSize: "1em",
    fontWeight: "700",
    color: "var(--syntax-string)",
    opacity: "0.85",
  },
  ".cm-md-h6": {
    fontSize: "1em",
    fontWeight: "700",
    color: "var(--syntax-string)",
    opacity: "0.65",
  },

  ".cm-md-blockquote": {
    borderLeft: "3px solid var(--border)",
    paddingLeft: "1em",
    color: "var(--muted-foreground)",
  },

  ".cm-md-hr": {
    borderBottom: "1px solid var(--border)",
    marginBottom: "-1px",
  },

  ".cm-task-checkbox": {
    display: "inline-flex",
    alignItems: "center",
  },
  ".cm-task-checkbox input[type=checkbox]": {
    cursor: "pointer",
    width: "14px",
    height: "14px",
    accentColor: "var(--primary)",
    verticalAlign: "middle",
    marginRight: "2px",
  },

  ".cm-callout": { paddingLeft: "1em" },
  ".cm-callout-note": {
    backgroundColor:
      "color-mix(in oklch, var(--syntax-function) 8%, transparent)",
    borderLeft: "3px solid var(--syntax-function)",
  },
  ".cm-callout-tip": {
    backgroundColor:
      "color-mix(in oklch, var(--syntax-string) 8%, transparent)",
    borderLeft: "3px solid var(--syntax-string)",
  },
  ".cm-callout-warning": {
    backgroundColor:
      "color-mix(in oklch, var(--syntax-number) 10%, transparent)",
    borderLeft: "3px solid var(--syntax-number)",
  },
  ".cm-callout-important": {
    backgroundColor:
      "color-mix(in oklch, var(--syntax-keyword) 8%, transparent)",
    borderLeft: "3px solid var(--syntax-keyword)",
  },
  ".cm-callout-caution": {
    backgroundColor: "color-mix(in oklch, var(--destructive) 10%, transparent)",
    borderLeft: "3px solid var(--destructive)",
  },
  ".cm-callout-header": {
    fontWeight: "700",
    fontSize: "0.85em",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },
  ".cm-callout-note-header": { color: "var(--syntax-function)" },
  ".cm-callout-tip-header": { color: "var(--syntax-string)" },
  ".cm-callout-warning-header": { color: "var(--syntax-number)" },
  ".cm-callout-important-header": { color: "var(--syntax-keyword)" },
  ".cm-callout-caution-header": { color: "var(--destructive)" },

  ".cm-md-link-widget": {
    color: "var(--syntax-function)",
    textDecoration: "underline",
    cursor: "pointer",
  },
  ".cm-md-link-widget:hover": {
    color: "var(--foreground)",
  },

  ".cm-wikilink": {
    color: "var(--syntax-function)",
    textDecoration: "none",
    borderBottom:
      "1px solid color-mix(in oklch, var(--syntax-function) 45%, transparent)",
    cursor: "pointer",
  },
  ".cm-wikilink:hover": {
    color: "var(--foreground)",
    borderBottomColor: "var(--foreground)",
  },
  ".cm-wikilink-unresolved": {
    color: "var(--muted-foreground)",
    borderBottomStyle: "dashed",
  },

  // ── Frontmatter (YAML metadata block) ───────────────────────────────────
  ".cm-frontmatter-line": {
    backgroundColor: "color-mix(in oklch, var(--foreground) 4%, transparent)",
  },
  ".cm-frontmatter-fence": {
    color: "var(--muted-foreground)",
  },
  ".cm-frontmatter-key": {
    color: "var(--syntax-keyword)",
    opacity: "0.85",
  },

  // ── Tags (#tag pills) ───────────────────────────────────────────────────
  ".cm-tag": {
    color: "var(--syntax-keyword)",
    backgroundColor:
      "color-mix(in oklch, var(--syntax-keyword) 12%, transparent)",
    borderRadius: "999px",
    padding: "0 6px",
    cursor: "pointer",
  },
  ".cm-tag:hover": {
    backgroundColor:
      "color-mix(in oklch, var(--syntax-keyword) 22%, transparent)",
  },

  // ── Fenced code blocks ──────────────────────────────────────────────────
  ".cm-fence-header, .cm-fence-body, .cm-fence-footer": {
    backgroundColor: "var(--secondary)",
  },
  ".cm-fence-header": {
    borderTopLeftRadius: "var(--radius-sm)",
    borderTopRightRadius: "var(--radius-sm)",
    borderTop: "1px solid var(--border)",
    borderLeft: "1px solid var(--border)",
    borderRight: "1px solid var(--border)",
    paddingTop: "2px",
  },
  ".cm-fence-body": {
    borderLeft: "1px solid var(--border)",
    borderRight: "1px solid var(--border)",
  },
  ".cm-fence-footer": {
    borderBottomLeftRadius: "var(--radius-sm)",
    borderBottomRightRadius: "var(--radius-sm)",
    borderBottom: "1px solid var(--border)",
    borderLeft: "1px solid var(--border)",
    borderRight: "1px solid var(--border)",
    paddingBottom: "2px",
  },
  ".cm-fence-toolbar": {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    marginLeft: "12px",
    verticalAlign: "middle",
  },
  ".cm-fence-lang": {
    fontFamily: "var(--font-mono)",
    fontSize: "11px",
    backgroundColor: "var(--background)",
    color: "var(--muted-foreground)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    padding: "1px 4px",
    cursor: "pointer",
  },
  ".cm-fence-copy": {
    fontFamily: "var(--font-sans, inherit)",
    fontSize: "11px",
    backgroundColor: "var(--background)",
    color: "var(--muted-foreground)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    padding: "1px 6px",
    cursor: "pointer",
  },
  ".cm-fence-copy:hover, .cm-fence-lang:hover": {
    color: "var(--foreground)",
    borderColor: "var(--foreground)",
  },

  ".cm-mermaid-preview-btn": {
    display: "inline-block",
    marginLeft: "12px",
    fontFamily: "var(--font-sans, inherit)",
    fontSize: "11px",
    fontWeight: "600",
    backgroundColor:
      "color-mix(in oklch, var(--syntax-function) 14%, transparent)",
    color: "var(--syntax-function)",
    border:
      "1px solid color-mix(in oklch, var(--syntax-function) 40%, transparent)",
    borderRadius: "var(--radius-sm)",
    padding: "1px 6px",
    cursor: "pointer",
    verticalAlign: "middle",
  },
  ".cm-mermaid-preview-btn:hover": {
    backgroundColor:
      "color-mix(in oklch, var(--syntax-function) 24%, transparent)",
  },

  // ── Tables ───────────────────────────────────────────────────────────────
  // .cm-table-wrap's max-width is pinned in JS (see tableStyle.ts) to the
  // editor's own visible width: .cm-content has no intrinsic width limit
  // (the editor doesn't line-wrap), so without a hard pixel cap here a wide
  // table would grow .cm-content itself and scroll the *whole* buffer
  // horizontally instead of just the table.
  ".cm-table-container": {
    display: "flex",
    alignItems: "flex-start",
    gap: "4px",
    margin: "4px 0",
  },
  ".cm-table-wrap": {
    overflowX: "auto",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    flex: "0 1 auto",
  },
  ".cm-table-grid": {
    borderCollapse: "collapse",
    // auto (not fixed) + min-width so the table fills the available width
    // when it has few columns, but grows past it (triggering the wrap's
    // own horizontal scroll) when it has many.
    tableLayout: "auto",
    width: "auto",
    minWidth: "100%",
    fontFamily: "var(--font-sans, inherit)",
    fontSize: "13px",
  },
  ".cm-table-cell": {
    border: "1px solid var(--border)",
    padding: "4px 8px",
    minWidth: "80px",
    outline: "none",
    position: "relative",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  ".cm-table-cell-header": {
    backgroundColor: "var(--secondary)",
    fontWeight: "600",
  },
  ".cm-table-cell-text": {
    display: "block",
    minHeight: "1.4em",
  },
  ".cm-table-cell-input": {
    display: "block",
    width: "100%",
    border: "none",
    outline: "none",
    background: "transparent",
    color: "inherit",
    font: "inherit",
    fontWeight: "inherit",
    padding: "0",
  },
  ".cm-table-cell-active": {
    outline: "2px solid var(--primary)",
    outlineOffset: "-2px",
  },
  ".cm-table-cell-editing": {
    backgroundColor: "color-mix(in oklch, var(--primary) 8%, transparent)",
    outline: "2px solid var(--primary)",
    outlineOffset: "-2px",
    cursor: "text",
  },
  ".cm-table-row-controls": {
    visibility: "hidden",
    position: "absolute",
    top: "2px",
    right: "2px",
    fontFamily: "var(--font-sans, inherit)",
    fontSize: "10px",
    lineHeight: "1",
    backgroundColor: "var(--background)",
    color: "var(--muted-foreground)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    padding: "1px 4px",
    cursor: "pointer",
    transition: "color var(--dur-fast), border-color var(--dur-fast)",
  },
  ".cm-table-cell:hover .cm-table-row-controls": {
    visibility: "visible",
  },
  ".cm-table-row-controls:hover": {
    color: "var(--destructive)",
    borderColor: "var(--destructive)",
  },
  ".cm-table-add-col": {
    flex: "0 0 auto",
    fontFamily: "var(--font-sans, inherit)",
    fontSize: "13px",
    lineHeight: "1",
    color: "var(--muted-foreground)",
    backgroundColor: "var(--background)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    width: "22px",
    height: "22px",
    cursor: "pointer",
    transition: "color var(--dur-fast), border-color var(--dur-fast)",
  },
  ".cm-table-add-col:hover": {
    color: "var(--primary)",
    borderColor: "var(--primary)",
  },
  ".cm-table-add-row": {
    fontFamily: "var(--font-sans, inherit)",
    fontSize: "11px",
    color: "var(--muted-foreground)",
    padding: "3px 8px",
    cursor: "pointer",
    borderTop: "1px solid var(--border)",
    transition: "color var(--dur-fast), background-color var(--dur-fast)",
  },
  ".cm-table-add-row:hover": {
    color: "var(--foreground)",
    backgroundColor: "var(--secondary)",
  },
});

const syntaxHighlightStyle = HighlightStyle.define([
  { tag: t.comment, color: "var(--syntax-comment)", fontStyle: "italic" },
  { tag: [t.string, t.special(t.string)], color: "var(--syntax-string)" },
  { tag: [t.number, t.bool, t.null, t.atom], color: "var(--syntax-number)" },
  {
    tag: [t.keyword, t.controlKeyword, t.operatorKeyword, t.operator],
    color: "var(--syntax-keyword)",
  },
  {
    tag: [t.function(t.variableName), t.function(t.propertyName)],
    color: "var(--syntax-function)",
  },
  { tag: [t.className, t.typeName], color: "var(--syntax-type)" },
  {
    tag: [t.definition(t.variableName), t.propertyName],
    color: "var(--foreground)",
  },
  { tag: t.punctuation, color: "var(--muted-foreground)" },
  // No color here: heading text inherits its color from the per-level
  // .cm-md-h1..h6 line class set by markdownStyle.ts.
  { tag: t.heading, fontWeight: "700" },
  { tag: t.link, color: "var(--syntax-function)", textDecoration: "underline" },
  { tag: t.url, color: "var(--syntax-function)" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strong, fontWeight: "700" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: t.quote, color: "var(--muted-foreground)" },
  {
    tag: t.monospace,
    color: "var(--syntax-string)",
    fontFamily: "var(--font-mono)",
  },
  { tag: t.invalid, color: "var(--destructive)" },
]);

const SHARED_EXTENSIONS: readonly Extension[] = Object.freeze([
  search({ top: true }),
  lintGutter(),
  foldGutter({ markerDOM: makeFoldMarker }),
  chromeTheme,
  syntaxHighlighting(syntaxHighlightStyle),
]);

export function buildSharedExtensions(): readonly Extension[] {
  return SHARED_EXTENSIONS;
}
