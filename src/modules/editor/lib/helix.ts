import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { commands } from "codemirror-helix";

export type HelixHandlers = { save: () => void; close: () => void };

export type HelixMode = "normal" | "insert" | "select";

const MODE_LABEL: Record<string, HelixMode> = {
  NOR: "normal",
  INS: "insert",
  SEL: "select",
};

/**
 * codemirror-helix doesn't export its mode state field, only a built-in
 * bottom status panel (`.cm-hx-status-panel`) that renders it as text. We
 * read that DOM node on every update to mirror the mode out to a callback
 * (so it can be shown as a chip outside the editor), and hide the panel
 * itself since the chip replaces it.
 */
export function helixModeReporterExtension(
  onMode: (mode: HelixMode) => void,
): Extension {
  return [
    EditorView.updateListener.of((update) => {
      const label = update.view.dom.querySelector(
        ".cm-hx-status-panel > span:first-child",
      )?.textContent;
      if (label && label in MODE_LABEL) onMode(MODE_LABEL[label]);
    }),
    EditorView.theme({
      ".cm-hx-status-panel": { display: "none !important" },
    }),
  ];
}

/** A CodeMirror extension that binds :w / :q / :wq ex commands to this view. */
export function helixHandlersExtension(
  getHandlers: () => HelixHandlers,
): Extension {
  return commands.of([
    {
      name: "write",
      aliases: ["w"],
      help: "Save the current file",
      handler() {
        getHandlers().save();
      },
    },
    {
      name: "quit",
      aliases: ["q"],
      help: "Close the current file",
      handler() {
        getHandlers().close();
      },
    },
    {
      name: "wq",
      aliases: ["x"],
      help: "Save and close the current file",
      handler() {
        const h = getHandlers();
        h.save();
        h.close();
      },
    },
  ]);
}
