import type {
  CompletionContext,
  CompletionResult,
  CompletionSource,
} from "@codemirror/autocomplete";
import type { EditorView } from "@codemirror/view";
import { invoke } from "@tauri-apps/api/core";
import type { CompletionProvider } from "./completion";
import { fuzzyMatch } from "./fuzzyMatch";
import { resolveWikilinkTarget } from "./wikilinks";

/**
 * Heading-reference completion for `[[Note#heading]]` links, contributed to
 * the editor's shared completion aggregator (see `completion.ts`).
 *
 * Triggers on `[[<target>#<query>` where `<target>` is empty (current
 * document) or a note name resolvable via `getVaultFiles()`. For another
 * note, the source is async: it resolves the wikilink target the same way
 * `wikilinkCompletionProvider` does (`resolveWikilinkTarget`) and reads the
 * file's content through the `fs_read_file` Tauri command to extract its
 * headings. For the current document, headings are parsed straight from
 * `context.state.doc` -- no round trip needed since the buffer may hold
 * unsaved edits.
 */

type ReadResult =
  | { kind: "text"; content: string; size: number }
  | { kind: "binary"; size: number }
  | { kind: "toolarge"; size: number; limit: number };

const HEADING_TRIGGER_RE = /\[\[([^[\]#]*)#([^[\]]*)$/;
const MAX_COMPLETIONS = 50;

/** Extracts ATX heading text (`# Heading` through `###### Heading`) from
 * Markdown source, skipping content inside fenced (``` or ~~~) code blocks.
 * Trailing closing `#`s (`## Heading ##`) are stripped. */
export function extractHeadings(text: string): string[] {
  const headings: string[] = [];
  let fence: string | null = null;

  for (const line of text.split("\n")) {
    const fenceMatch = /^\s*(`{3,}|~{3,})/.exec(line);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      fence = fence === null ? marker : fence === marker ? null : fence;
      continue;
    }
    if (fence !== null) continue;

    const headingMatch = /^#{1,6}\s+(.+?)\s*#*\s*$/.exec(line);
    if (headingMatch) headings.push(headingMatch[1].trim());
  }

  return headings;
}

function headingCompletionSource(
  getVaultFiles: () => readonly string[],
): CompletionSource {
  return async (
    context: CompletionContext,
  ): Promise<CompletionResult | null> => {
    const before = context.matchBefore(HEADING_TRIGGER_RE);
    if (!before) return null;

    const match = HEADING_TRIGGER_RE.exec(before.text);
    if (!match) return null;
    const [, target, query] = match;
    const from = before.to - query.length;

    let headings: string[];
    if (target.trim() === "") {
      headings = extractHeadings(context.state.doc.toString());
    } else {
      const resolved = resolveWikilinkTarget(target, getVaultFiles());
      if (!resolved) return null;
      try {
        const res = await invoke<ReadResult>("fs_read_file", {
          path: resolved,
        });
        if (res.kind !== "text") return null;
        headings = extractHeadings(res.content);
      } catch {
        return null;
      }
    }

    const scored = headings
      .map((heading) => {
        const m = fuzzyMatch(query, heading);
        return m.matched ? { heading, score: m.score } : null;
      })
      .filter((x): x is { heading: string; score: number } => x !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_COMPLETIONS);

    if (scored.length === 0) return null;

    const options = scored.map(({ heading }) => ({
      label: heading,
      type: "text",
      apply: (
        view: EditorView,
        _completion: unknown,
        applyFrom: number,
        applyTo: number,
      ) => {
        const after = view.state.doc.sliceString(applyTo, applyTo + 2);
        const hasClose = after === "]]";
        const insert = hasClose ? heading : `${heading}]]`;
        view.dispatch({
          changes: { from: applyFrom, to: applyTo, insert },
          selection: { anchor: applyFrom + insert.length },
        });
      },
    }));

    return { from, options, filter: false };
  };
}

/**
 * `[[Note#heading]]` completion, contributed to the editor's shared
 * completion aggregator. `getVaultFiles` is used to resolve the target note
 * (same lookup as `wikilinkCompletionProvider`); the current document is
 * always available for `[[#heading]]` self-references.
 */
export function headingCompletionProvider(
  getVaultFiles: () => readonly string[],
): CompletionProvider {
  return {
    source: headingCompletionSource(getVaultFiles),
    trigger: (before) => HEADING_TRIGGER_RE.test(before),
  };
}
