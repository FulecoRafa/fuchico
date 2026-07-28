import { matchInlineTagsInLine } from "@/modules/tags/lib/parseTags";
import type {
  CompletionContext,
  CompletionResult,
} from "@codemirror/autocomplete";
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
import type { CompletionProvider } from "./completion";
import { fuzzyMatch } from "./fuzzyMatch";

/**
 * `#tag` decoration (clickable pill) plus completion, ported pattern-wise
 * from wikilinks.ts: replace the raw `#tag` text with a styled widget on
 * every line except the one the cursor is on, so the source stays editable
 * in place. Matching itself is shared with the vault-wide scanner via
 * `matchInlineTagsInLine` (see `modules/tags/lib/parseTags.ts`).
 */

class TagWidget extends WidgetType {
  constructor(
    readonly tag: string,
    readonly onClick: (tag: string) => void,
  ) {
    super();
  }

  eq(other: TagWidget): boolean {
    return other.tag === this.tag;
  }

  toDOM(): HTMLElement {
    const a = document.createElement("a");
    a.href = "#";
    a.textContent = `#${this.tag}`;
    a.className = "cm-tag";
    a.title = `Filter notes tagged #${this.tag}`;
    // Same reasoning as WikilinkWidget: CM's central click pipeline skips
    // replaced-range widgets whose ignoreEvent() is true, so handle the
    // click from the widget's own DOM instead of a view-level handler.
    a.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.onClick(this.tag);
    });
    return a;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

function isInsideCode(view: EditorView, pos: number): boolean {
  return /Code/.test(syntaxTree(view.state).resolveInner(pos, 1).name);
}

function buildDecorations(
  view: EditorView,
  onClick: (tag: string) => void,
): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  const cursorLine = view.state.doc.lineAt(
    view.state.selection.main.head,
  ).number;

  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = view.state.doc.lineAt(pos);
      if (line.number !== cursorLine) {
        for (const match of matchInlineTagsInLine(line.text)) {
          const start = line.from + match.from;
          const end = line.from + match.to;
          if (!isInsideCode(view, start)) {
            decorations.push(
              Decoration.replace({
                widget: new TagWidget(match.tag, onClick),
              }).range(start, end),
            );
          }
        }
      }
      pos = line.to + 1;
    }
  }

  return Decoration.set(decorations, true);
}

export type TagsOptions = {
  /** Called with the tag text (no leading `#`) when a rendered pill is
   * clicked, e.g. to open the tags panel filtered to that tag. */
  onTagClick: (tag: string) => void;
};

export function tagsExtension(opts: TagsOptions): Extension {
  const { onTagClick } = opts;

  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = buildDecorations(view, onTagClick);
      }
      update(u: ViewUpdate) {
        if (u.docChanged || u.viewportChanged || u.selectionSet) {
          this.decorations = buildDecorations(u.view, onTagClick);
        }
      }
    },
    { decorations: (v) => v.decorations },
  );
}

// ─── Autocomplete ───────────────────────────────────────────────────────────

const TAG_TRIGGER_RE = /(?:^|\s)#([\p{L}][\p{L}\p{N}_/-]*)$/u;
const MAX_COMPLETIONS = 50;

function tagCompletionSource(getAllTags: () => readonly string[]) {
  return (context: CompletionContext): CompletionResult | null => {
    const before = context.matchBefore(TAG_TRIGGER_RE);
    if (!before) return null;

    const hashIdx = before.text.lastIndexOf("#");
    const query = before.text.slice(hashIdx + 1);
    const from = before.to - query.length;
    const tags = getAllTags();

    const scored = tags
      .map((tag) => {
        const match = fuzzyMatch(query, tag);
        return match.matched ? { tag, score: match.score } : null;
      })
      .filter((x): x is { tag: string; score: number } => x !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_COMPLETIONS);

    if (scored.length === 0) return null;

    const options = scored.map(({ tag }) => ({
      label: tag,
      type: "text",
    }));

    return { from, options, filter: false };
  };
}

/**
 * `#tag` completion, contributed to the editor's shared completion
 * aggregator (see `completion.ts`).
 */
export function tagCompletionProvider(
  getAllTags: () => readonly string[],
): CompletionProvider {
  return {
    source: tagCompletionSource(getAllTags),
    trigger: (before) => TAG_TRIGGER_RE.test(before),
  };
}
