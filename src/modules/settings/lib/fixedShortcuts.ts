import type { MessageKey } from "@/lib/i18n/en";

/** Built-in (non-rebindable) shortcuts, listed so the whole keyboard map is
 * discoverable in one place (issue #7). Rendered in Settings › Keyboard
 * Shortcuts and reused by the command palette for its binding hints. Text
 * fields are i18n message keys; `keys` stays the raw key combination (fed to
 * `formatBinding`), except rows with `keysKey`, whose hint is itself a
 * translatable word ("Click", "Right-click"). */
export const FIXED_SHORTCUTS: {
  group: MessageKey;
  labelKey: MessageKey;
  descKey: MessageKey;
  keys: string;
  keysKey?: MessageKey;
}[] = [
  {
    group: "shortcuts.group.global",
    labelKey: "shortcuts.fixed.commandPalette.label",
    descKey: "shortcuts.fixed.commandPalette.desc",
    keys: "Mod-Shift-p",
  },
  {
    group: "shortcuts.group.global",
    labelKey: "shortcuts.fixed.quickOpen.label",
    descKey: "shortcuts.fixed.quickOpen.desc",
    keys: "Mod-p",
  },
  {
    group: "shortcuts.group.global",
    labelKey: "shortcuts.fixed.editorFontSize.label",
    descKey: "shortcuts.fixed.editorFontSize.desc",
    keys: "Mod-= / Mod-- / Mod-0",
  },
  {
    group: "shortcuts.group.global",
    labelKey: "shortcuts.fixed.uiZoom.label",
    descKey: "shortcuts.fixed.uiZoom.desc",
    keys: "Mod-Shift-= / Mod-Shift-- / Mod-Shift-0",
  },
  {
    group: "shortcuts.group.editor",
    labelKey: "shortcuts.fixed.helixPalette.label",
    descKey: "shortcuts.fixed.helixPalette.desc",
    keys: ":",
  },
  {
    group: "shortcuts.group.editor",
    labelKey: "shortcuts.fixed.save.label",
    descKey: "shortcuts.fixed.save.desc",
    keys: "Mod-s",
  },
  {
    group: "shortcuts.group.editor",
    labelKey: "shortcuts.fixed.findReplace.label",
    descKey: "shortcuts.fixed.findReplace.desc",
    keys: "Mod-f",
  },
  {
    group: "shortcuts.group.editor",
    labelKey: "shortcuts.fixed.taskAutocomplete.label",
    descKey: "shortcuts.fixed.taskAutocomplete.desc",
    keys: "@",
  },
  {
    group: "shortcuts.group.editor",
    labelKey: "shortcuts.fixed.pasteImage.label",
    descKey: "shortcuts.fixed.pasteImage.desc",
    keys: "Mod-v",
  },
  {
    group: "shortcuts.group.editor",
    labelKey: "shortcuts.fixed.followLink.label",
    descKey: "shortcuts.fixed.followLink.desc",
    keys: "Click",
    keysKey: "shortcuts.fixed.followLink.keys",
  },
  {
    group: "shortcuts.group.explorer",
    labelKey: "shortcuts.fixed.explorerNavigate.label",
    descKey: "shortcuts.fixed.explorerNavigate.desc",
    keys: "↑ ↓ ← →",
  },
  {
    group: "shortcuts.group.explorer",
    labelKey: "shortcuts.fixed.explorerOpen.label",
    descKey: "shortcuts.fixed.explorerOpen.desc",
    keys: "Enter",
  },
  {
    group: "shortcuts.group.explorer",
    labelKey: "shortcuts.fixed.explorerRename.label",
    descKey: "shortcuts.fixed.explorerRename.desc",
    keys: "F2",
  },
  {
    group: "shortcuts.group.explorer",
    labelKey: "shortcuts.fixed.explorerDelete.label",
    descKey: "shortcuts.fixed.explorerDelete.desc",
    keys: "Delete / Backspace",
  },
  {
    group: "shortcuts.group.explorer",
    labelKey: "shortcuts.fixed.explorerTypeAhead.label",
    descKey: "shortcuts.fixed.explorerTypeAhead.desc",
    keys: "a–z",
  },
  {
    group: "shortcuts.group.explorer",
    labelKey: "shortcuts.fixed.explorerMenu.label",
    descKey: "shortcuts.fixed.explorerMenu.desc",
    keys: "Right-click",
    keysKey: "shortcuts.fixed.explorerMenu.keys",
  },
  {
    group: "shortcuts.group.tabs",
    labelKey: "shortcuts.fixed.tabMenu.label",
    descKey: "shortcuts.fixed.tabMenu.desc",
    keys: "Right-click",
    keysKey: "shortcuts.fixed.tabMenu.keys",
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
