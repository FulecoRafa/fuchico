import type { ShortcutAction } from "./editorSettings";

/** Rebindable editor actions: shown in Settings › Keyboard Shortcuts and
 * exposed as "Editor: …" palette commands. */
export const SHORTCUT_ACTIONS: {
  value: ShortcutAction;
  label: string;
  desc: string;
}[] = [
  {
    value: "openOutline",
    label: "Go to header",
    desc: "Open the document outline (fuzzy-searchable header list).",
  },
  {
    value: "toggleCheckboxAtCursor",
    label: "Toggle checkbox",
    desc: "Mark/unmark the checkbox on the cursor's line.",
  },
  {
    value: "insertDate",
    label: "Insert date",
    desc: "Insert today's date at the cursor.",
  },
  {
    value: "insertDateTime",
    label: "Insert date & time",
    desc: "Insert the current date and time at the cursor.",
  },
  {
    value: "insertRegion",
    label: "Insert fold region",
    desc: "Wrap the selected lines in a foldable region (or insert an empty one at the cursor).",
  },
  {
    value: "insertTable",
    label: "Insert table",
    desc: "Insert a 2x2 Markdown table at the cursor and start editing the header.",
  },
  {
    value: "toggleTaskLine",
    label: "Toggle task",
    desc: "Turn the current line into a `- [ ]` task (or back into plain text).",
  },
  {
    value: "pickDueDate",
    label: "Set due date…",
    desc: "Add or change the 📅 due date on the current line via a quick-pick list.",
  },
  {
    value: "pickRecurrence",
    label: "Set recurrence…",
    desc: "Add or change the 🔁 repeat rule on the current line via a quick-pick list.",
  },
];
