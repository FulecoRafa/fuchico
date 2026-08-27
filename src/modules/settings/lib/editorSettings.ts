import { useSyncExternalStore } from "react";

export type Palette = "ayu" | "dracula" | "catppuccin" | "custom";
export type ColorMode = "system" | "light" | "dark";
export type KeybindingMode = "helix" | "vim" | "normal";

export type ShortcutAction =
  | "openOutline"
  | "toggleCheckboxAtCursor"
  | "insertDate"
  | "insertDateTime"
  | "insertRegion"
  | "insertTable"
  | "toggleTaskLine"
  | "pickDueDate"
  | "pickRecurrence";

export type Shortcuts = Record<ShortcutAction, string>;

export type EditorSettings = {
  palette: Palette;
  mode: ColorMode;
  customThemeCss: string;
  keybindingMode: KeybindingMode;
  shortcuts: Shortcuts;
  foldStartMarker: string;
  foldEndMarker: string;
  /** App-wide UI font family (--font-sans). Empty string = default stack. */
  uiFont: string;
  /** Editor font family (--font-mono). Empty string = default stack. */
  editorFont: string;
  /** Helix/Vim-style gutter: current line shows its absolute number, all
   * other lines show their distance from it. */
  relativeLineNumbers: boolean;
  /** Number of spaces per indent level / tab stop. */
  tabSize: number;
  /** Editor content font size in px (Mod +/- adjusts, Mod-0 resets). */
  editorFontSize: number;
  /** Whole-app UI zoom factor (Mod-Shift +/- adjusts, Mod-Shift-0 resets).
   * Independent from the editor font size. */
  uiScale: number;
  /** Vault-relative folder for daily notes (`YYYY-MM-DD.md`). */
  dailyNotesFolder: string;
  /** Vault-relative folder whose Markdown files are offered as templates. A
   * `daily.md` there seeds new daily notes. */
  templatesFolder: string;
  /** Application name used by "Open with external tool" (issue #20), e.g.
   * "Visual Studio Code". Empty = the OS default handler. */
  externalTool: string;
};

export const EDITOR_FONT_SIZE_DEFAULT = 13;
export const EDITOR_FONT_SIZE_MIN = 8;
export const EDITOR_FONT_SIZE_MAX = 32;
export const UI_SCALE_DEFAULT = 1;
export const UI_SCALE_MIN = 0.7;
export const UI_SCALE_MAX = 1.6;

export function clampEditorFontSize(size: number): number {
  if (!Number.isFinite(size)) return EDITOR_FONT_SIZE_DEFAULT;
  return Math.min(EDITOR_FONT_SIZE_MAX, Math.max(EDITOR_FONT_SIZE_MIN, size));
}

export function clampUiScale(scale: number): number {
  if (!Number.isFinite(scale)) return UI_SCALE_DEFAULT;
  const clamped = Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, scale));
  return Math.round(clamped * 100) / 100;
}

const STORAGE_KEY = "helix.editorSettings";

export const DEFAULT_SETTINGS: EditorSettings = {
  palette: "ayu",
  mode: "system",
  customThemeCss: "",
  keybindingMode: "helix",
  shortcuts: {
    openOutline: "Mod-o",
    toggleCheckboxAtCursor: "Mod-Enter",
    insertDate: "Mod-Shift-d",
    insertDateTime: "Mod-Alt-d",
    insertRegion: "Mod-Shift-r",
    insertTable: "Mod-Alt-t",
    toggleTaskLine: "Mod-Shift-Enter",
    pickDueDate: "Mod-Shift-.",
    pickRecurrence: "Mod-Shift-,",
  },
  foldStartMarker: ":::fold",
  foldEndMarker: ":::endfold",
  uiFont: "",
  editorFont: "",
  relativeLineNumbers: false,
  tabSize: 2,
  editorFontSize: EDITOR_FONT_SIZE_DEFAULT,
  uiScale: UI_SCALE_DEFAULT,
  dailyNotesFolder: "daily",
  templatesFolder: "templates",
  externalTool: "",
};

function load(): EditorSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<EditorSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      shortcuts: { ...DEFAULT_SETTINGS.shortcuts, ...parsed.shortcuts },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

let state: EditorSettings = load();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

// Each OS window runs its own JS instance of this module; `storage` fires in
// the *other* windows when one of them writes, so re-read and re-emit there
// (issue #29).
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY) return;
    state = load();
    emit();
  });
}

/** Module-level pub-sub so `SettingsView` and `EditorPane` -- two separately
 * mounted components -- stay in sync without a React context provider. */
export const editorSettingsStore = {
  get(): EditorSettings {
    return state;
  },
  set(partial: Partial<EditorSettings>) {
    state = { ...state, ...partial };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    emit();
  },
  setShortcut(action: ShortcutAction, binding: string) {
    state = { ...state, shortcuts: { ...state.shortcuts, [action]: binding } };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    emit();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function useEditorSettings() {
  const settings = useSyncExternalStore(
    editorSettingsStore.subscribe,
    editorSettingsStore.get,
  );
  return {
    settings,
    setSettings: editorSettingsStore.set,
    setShortcut: editorSettingsStore.setShortcut,
  };
}
