import type { Extension, Range } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  type EditorView,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";
import { parseFrontmatter } from "./parseFrontmatter";

/**
 * Visually distinguishes a leading YAML frontmatter block (`---\n…\n---`):
 * the whole block gets a subtle background, the `---` fence lines get a
 * dedicated style, and each `key:` gets a dimmed/muted color. Follows the
 * live-preview philosophy of markdownStyle.ts/regionDecorations.ts -- pure
 * CSS classes on line/text ranges, so the raw YAML stays fully editable in
 * place (nothing is replaced or hidden, unlike e.g. wikilinks.ts's widgets).
 *
 * Re-parsing is cheap: `parseFrontmatter` only ever looks at the first N
 * lines up to the closing fence, so this is line-count-of-frontmatter work
 * per document edit, not whole-document work.
 */

const KEY_RE = /^([ \t]*)([^:\s][^:]*)(:)/;

function buildDecorations(view: EditorView): DecorationSet {
  const doc = view.state.doc;
  // parseFrontmatter only cares about the start of the document, but needs
  // the raw text to find the closing fence -- capping the slice keeps this
  // cheap even for huge notes with runaway/unterminated frontmatter.
  const head = doc.sliceString(0, Math.min(doc.length, 20_000));
  const parsed = parseFrontmatter(head);
  if (!parsed) return Decoration.none;

  const decorations: Range<Decoration>[] = [];
  const endLine = parsed.endLine;

  for (let n = 1; n <= endLine; n++) {
    const line = doc.line(n);
    const isFence = n === 1 || n === endLine;
    decorations.push(
      Decoration.line({
        class: isFence
          ? "cm-frontmatter-line cm-frontmatter-fence"
          : "cm-frontmatter-line",
      }).range(line.from),
    );

    if (!isFence) {
      const m = line.text.match(KEY_RE);
      if (m) {
        const keyFrom = line.from + m[1].length;
        const keyTo = keyFrom + m[2].length;
        decorations.push(
          Decoration.mark({ class: "cm-frontmatter-key" }).range(
            keyFrom,
            keyTo,
          ),
        );
      }
    }
  }

  return Decoration.set(decorations, true);
}

export const frontmatterStyle = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }
    update(u: ViewUpdate) {
      // Frontmatter only ever lives at the very top of the document, so a
      // plain doc-changed check would over-fire on edits far below it --
      // but keeping this simple (matching markdownStyle.ts's own
      // docChanged-triggers-full-rebuild pattern) is fine given the capped,
      // cheap re-parse above.
      if (u.docChanged || u.viewportChanged) {
        this.decorations = buildDecorations(u.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

/** CodeMirror extension: styles a leading YAML frontmatter block in place. */
export function frontmatterExtension(): Extension {
  return frontmatterStyle;
}
