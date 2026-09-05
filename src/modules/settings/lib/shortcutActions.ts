import type { MessageKey } from "@/lib/i18n/en";
import type { ShortcutAction } from "./editorSettings";

/** Rebindable editor actions: shown in Settings › Keyboard Shortcuts and
 * exposed as "Editor: …" palette commands. Labels/descriptions are i18n
 * keys — render with `t(labelKey)` / `t(descKey)`. */
export const SHORTCUT_ACTIONS: {
  value: ShortcutAction;
  labelKey: MessageKey;
  descKey: MessageKey;
}[] = [
  {
    value: "openOutline",
    labelKey: "shortcutAction.openOutline.label",
    descKey: "shortcutAction.openOutline.desc",
  },
  {
    value: "toggleCheckboxAtCursor",
    labelKey: "shortcutAction.toggleCheckboxAtCursor.label",
    descKey: "shortcutAction.toggleCheckboxAtCursor.desc",
  },
  {
    value: "insertDate",
    labelKey: "shortcutAction.insertDate.label",
    descKey: "shortcutAction.insertDate.desc",
  },
  {
    value: "insertDateTime",
    labelKey: "shortcutAction.insertDateTime.label",
    descKey: "shortcutAction.insertDateTime.desc",
  },
  {
    value: "insertRegion",
    labelKey: "shortcutAction.insertRegion.label",
    descKey: "shortcutAction.insertRegion.desc",
  },
  {
    value: "insertTable",
    labelKey: "shortcutAction.insertTable.label",
    descKey: "shortcutAction.insertTable.desc",
  },
  {
    value: "toggleTaskLine",
    labelKey: "shortcutAction.toggleTaskLine.label",
    descKey: "shortcutAction.toggleTaskLine.desc",
  },
  {
    value: "pickDueDate",
    labelKey: "shortcutAction.pickDueDate.label",
    descKey: "shortcutAction.pickDueDate.desc",
  },
  {
    value: "pickRecurrence",
    labelKey: "shortcutAction.pickRecurrence.label",
    descKey: "shortcutAction.pickRecurrence.desc",
  },
];
