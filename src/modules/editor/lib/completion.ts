import {
  autocompletion,
  type CompletionSource,
  startCompletion,
} from "@codemirror/autocomplete";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

/**
 * Shared autocomplete aggregator for the editor.
 *
 * Every completion feature (`[[` wikilinks, `#` tags, heading refs, plain-word
 * completion, …) must funnel through this ONE `autocompletion()` instance:
 * `codemirror-helix` breaks CodeMirror's normal completion flow, so we can't
 * register sources via `languageData` and we can't run multiple independent
 * `autocompletion()` extensions side by side. See the notes in `wikilinks.ts`
 * and the project memory `helix-autocomplete-gotcha`.
 *
 * A provider contributes:
 *  - `source`: a standard CodeMirror `CompletionSource` that returns options
 *    when the cursor is in its context (or `null` otherwise);
 *  - `trigger` (optional): given the text on the current line before the
 *    cursor, returns true when a just-made edit should explicitly open the
 *    popup. This is the helix workaround — helix's insert-mode input doesn't
 *    emit the `input.type` userEvent that `activateOnTyping` relies on, and it
 *    swallows Ctrl-Space, so we open the popup ourselves from an update
 *    listener whenever any provider's trigger matches.
 */
export type CompletionProvider = {
  source: CompletionSource;
  trigger?: (lineBeforeCursor: string) => boolean;
};

export function editorCompletionExtension(
  providers: readonly CompletionProvider[],
): Extension {
  const completion = autocompletion({
    override: providers.map((p) => p.source),
    activateOnTyping: true,
  });

  const triggers = providers
    .map((p) => p.trigger)
    .filter((t): t is (lineBeforeCursor: string) => boolean => t != null);

  const completionTrigger = EditorView.updateListener.of((u) => {
    if (!u.docChanged || triggers.length === 0) return;
    const head = u.state.selection.main.head;
    const line = u.state.doc.lineAt(head);
    const before = line.text.slice(0, head - line.from);
    if (triggers.some((t) => t(before))) startCompletion(u.view);
  });

  return [completion, completionTrigger];
}
