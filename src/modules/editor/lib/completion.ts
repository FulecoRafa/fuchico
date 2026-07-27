import {
  acceptCompletion,
  autocompletion,
  type CompletionSource,
  closeCompletion,
  moveCompletionSelection,
  pickedCompletion,
  startCompletion,
} from "@codemirror/autocomplete";
import { type Extension, Prec } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";

/**
 * Keymap that drives the completion popup, kept at `Prec.highest` so it wins
 * over the modal keymap (`vim`/`helix` are also elevated to `Prec.highest` in
 * `extensions.ts`, and would otherwise swallow Enter/arrows into the buffer).
 *
 * MUST be placed BEFORE the keybinding compartment in the editor's extension
 * array: within the `Prec.highest` group, ties are broken by tree order, so an
 * earlier position beats helix. Every command here returns `false` when no
 * completion is open, so the key falls straight through to the modal keymap in
 * normal use (Enter still inserts a newline, Escape still exits insert mode).
 */
export const completionKeymap: Extension = Prec.highest(
  keymap.of([
    { key: "Enter", run: acceptCompletion },
    { key: "ArrowDown", run: moveCompletionSelection(true) },
    { key: "ArrowUp", run: moveCompletionSelection(false) },
    { key: "Escape", run: closeCompletion },
  ]),
);

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
    // Don't reopen the popup on the very edit that accepted a completion:
    // the inserted text usually still matches the trigger (e.g. `[[note`),
    // which would immediately pop the menu back up.
    if (u.transactions.some((tr) => tr.annotation(pickedCompletion) != null))
      return;
    const head = u.state.selection.main.head;
    const line = u.state.doc.lineAt(head);
    const before = line.text.slice(0, head - line.from);
    if (triggers.some((t) => t(before))) startCompletion(u.view);
  });

  return [completion, completionTrigger];
}
