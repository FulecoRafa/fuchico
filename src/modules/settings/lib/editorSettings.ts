import { useSyncExternalStore } from "react";

export type Palette = "ayu" | "dracula" | "catppuccin" | "custom";
export type ColorMode = "system" | "light" | "dark";
export type KeybindingMode = "helix" | "vim" | "normal";

export type ShortcutAction =
  | "openOutline"
  | "toggleCheckboxAtCursor"
  | "insertDate"
  | "insertDateTime"
  | "insertRegion";

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
};

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
  },
  foldStartMarker: ":::fold",
  foldEndMarker: ":::endfold",
  uiFont: "",
  editorFont: "",
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
