import type {
  CompletionContext,
  CompletionResult,
  CompletionSource,
} from "@codemirror/autocomplete";
import { syntaxTree } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";
import type { CompletionProvider } from "./completion";
import { fuzzyMatch } from "./fuzzyMatch";

/**
 * Plain-text word completion, contributed to the editor's shared completion
 * aggregator (see `completion.ts`). Offers distinct words already present
 * elsewhere in the document, fuzzy-matched against the word currently being
 * typed -- a lightweight local dictionary, no vault-wide indexing.
 *
 * Deliberately conservative to stay out of the way of the more specific
 * providers and of ordinary prose:
 *  - requires a 4+ character alphabetic prefix before it does anything;
 *  - never fires inside an open `[[...` wikilink/heading context (those
 *    providers own that territory);
 *  - never fires inside code (fenced or inline), via the same
 *    `syntaxTree().resolveInner()` check `wikilinks.ts` uses for its
 *    decorations.
 */

const MIN_PREFIX_LENGTH = 4;
const WORD_TRIGGER_RE = new RegExp(
  `[A-Za-z][A-Za-z0-9_-]{${MIN_PREFIX_LENGTH - 1},}$`,
);
const WORD_RE = /[A-Za-z][A-Za-z0-9_-]{3,}/g;
const OPEN_WIKILINK_RE = /\[\[[^[\]]*$/;
const MAX_COMPLETIONS = 20;

function isInsideCode(state: EditorState, pos: number): boolean {
  return /Code/.test(syntaxTree(state).resolveInner(pos, 1).name);
}

/** Distinct words (4+ chars, letters/digits/`_`/`-`) found in `text`, in
 * first-seen order. */
export function extractWords(text: string): string[] {
  const seen = new Set<string>();
  const words: string[] = [];
  WORD_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex-exec loop
  while ((m = WORD_RE.exec(text))) {
    if (!seen.has(m[0])) {
      seen.add(m[0]);
      words.push(m[0]);
    }
  }
  return words;
}

function wordCompletionSource(): CompletionSource {
  return (context: CompletionContext): CompletionResult | null => {
    const pos = context.pos;
    const line = context.state.doc.lineAt(pos);
    const before = line.text.slice(0, pos - line.from);
    if (OPEN_WIKILINK_RE.test(before)) return null;

    const match = context.matchBefore(WORD_TRIGGER_RE);
    if (!match) return null;
    if (isInsideCode(context.state, pos)) return null;

    const query = match.text;
    const queryLower = query.toLowerCase();
    const scored = extractWords(context.state.doc.toString())
      .filter((word) => word.toLowerCase() !== queryLower)
      .map((word) => {
        const m = fuzzyMatch(query, word);
        return m.matched ? { word, score: m.score } : null;
      })
      .filter((x): x is { word: string; score: number } => x !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_COMPLETIONS);

    if (scored.length === 0) return null;

    return {
      from: match.from,
      options: scored.map(({ word }) => ({ label: word, type: "text" })),
      filter: false,
    };
  };
}

/**
 * Document-local word completion, contributed to the editor's shared
 * completion aggregator. No vault file access needed -- candidates come
 * straight from the current buffer.
 */
export function wordCompletionProvider(): CompletionProvider {
  return {
    source: wordCompletionSource(),
    trigger: (before) =>
      !OPEN_WIKILINK_RE.test(before) && WORD_TRIGGER_RE.test(before),
  };
}
