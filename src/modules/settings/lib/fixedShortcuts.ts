/** Built-in (non-rebindable) shortcuts, listed so the whole keyboard map is
 * discoverable in one place (issue #7). Rendered in Settings › Keyboard
 * Shortcuts and reused by the command palette for its binding hints. */
export const FIXED_SHORTCUTS: {
  group: string;
  label: string;
  desc: string;
  keys: string;
}[] = [
  {
    group: "Global",
    label: "Command palette",
    desc: "Run any app command by name.",
    keys: "Mod-Shift-p",
  },
  {
    group: "Global",
    label: "Quick open file",
    desc: "Fuzzy-find a note in the vault.",
    keys: "Mod-p",
  },
  {
    group: "Global",
    label: "Editor font size",
    desc: "Bigger / smaller / reset editor text.",
    keys: "Mod-= / Mod-- / Mod-0",
  },
  {
    group: "Global",
    label: "UI zoom",
    desc: "Zoom the whole app in / out / reset.",
    keys: "Mod-Shift-= / Mod-Shift-- / Mod-Shift-0",
  },
  {
    group: "Editor",
    label: "Command palette from Helix",
    desc: "In Helix normal mode, : opens the command palette; :q, :w, :wq and :<line> work as aliases.",
    keys: ":",
  },
  {
    group: "Editor",
    label: "Save",
    desc: "Write the current file to disk.",
    keys: "Mod-s",
  },
  {
    group: "Editor",
    label: "Find / replace",
    desc: "Search within the current file.",
    keys: "Mod-f",
  },
  {
    group: "Editor",
    label: "Task date / repeat autocomplete",
    desc: "Type @due, @today, @repeat (or 📅 / 🔁) on a task line to pick a date or rule.",
    keys: "@",
  },
  {
    group: "Editor",
    label: "Paste image",
    desc: "Paste or drop an image to save it under attachments/ and link it.",
    keys: "Mod-v",
  },
  {
    group: "Editor",
    label: "Follow link",
    desc: "Open the [[wikilink]] or Markdown link under the cursor.",
    keys: "Click",
  },
  {
    group: "File explorer",
    label: "Navigate",
    desc: "Move selection, expand/collapse folders.",
    keys: "↑ ↓ ← →",
  },
  {
    group: "File explorer",
    label: "Open / toggle folder",
    desc: "Open the selected file or expand/collapse the folder.",
    keys: "Enter",
  },
  {
    group: "File explorer",
    label: "Rename",
    desc: "Rename the selected entry.",
    keys: "F2",
  },
  {
    group: "File explorer",
    label: "Delete",
    desc: "Delete the selected entry (asks for confirmation).",
    keys: "Delete / Backspace",
  },
  {
    group: "File explorer",
    label: "Type-ahead",
    desc: "Type a name prefix to jump to the matching entry.",
    keys: "a–z",
  },
  {
    group: "File explorer",
    label: "Context menu",
    desc: "New file/folder, rename, delete.",
    keys: "Right-click",
  },
  {
    group: "Tabs",
    label: "Tab menu",
    desc: "Close, close others, close all.",
    keys: "Right-click",
  },
];

const IS_MAC =
  typeof navigator !== "undefined" &&
  /Mac|iP(hone|ad|od)/.test(navigator.platform);

const MAC_MODS: Record<string, string> = {
  Mod: "⌘",
  Meta: "⌘",
  Ctrl: "⌃",
  Alt: "⌥",
  Shift: "⇧",
};

const OTHER_MODS: Record<string, string> = {
  Mod: "Ctrl",
  Meta: "Win",
  Ctrl: "Ctrl",
  Alt: "Alt",
  Shift: "Shift",
};

function formatChunk(chunk: string, isMac: boolean): string {
  const mods: string[] = [];
  let rest = chunk;
  for (;;) {
    // `(.+)` keeps the key non-empty so "Mod--" parses as Mod + "-".
    const m = /^(Mod|Meta|Ctrl|Alt|Shift)-(.+)$/.exec(rest);
    if (!m) break;
    mods.push(m[1]);
    rest = m[2];
  }
  if (mods.length === 0) return chunk;
  const key = rest.length === 1 ? rest.toUpperCase() : rest;
  return isMac
    ? mods.map((m) => MAC_MODS[m]).join("") + key
    : [...mods.map((m) => OTHER_MODS[m]), key].join("+");
}

/**
 * Renders a stored binding like "Mod-Shift-p" as "⌘⇧P" (macOS) or
 * "Ctrl+Shift+P". Strings without a leading modifier ("F2", "Click",
 * "Enter", "@") pass through untouched; " / " separates alternatives.
 */
export function formatBinding(
  binding: string,
  isMac: boolean = IS_MAC,
): string {
  return binding
    .split(" / ")
    .map((chunk) => formatChunk(chunk, isMac))
    .join(" / ");
}
