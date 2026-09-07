import { useSyncExternalStore } from "react";

export type BuiltinPalette = "ayu" | "dracula" | "catppuccin";
export type Palette = BuiltinPalette | "custom";

/** A user-defined theme: CSS custom-property declarations injected under
 * `:root[data-palette="custom"]` while it is the active custom theme
 * (issue #3). */
export type CustomTheme = { id: string; name: string; css: string };
export type ColorMode = "system" | "light" | "dark";
export type KeybindingMode = "helix" | "vim" | "normal";
/** UI language setting; "system" resolves via `navigator.language`. */
export type AppLanguage = "system" | "en" | "pt-BR";

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
  /** UI language; "system" follows the OS language (issue #48). */
  language: AppLanguage;
  palette: Palette;
  mode: ColorMode;
  /** Named custom themes; `customThemeId` picks the one applied while
   * `palette === "custom"` (issue #3). */
  customThemes: CustomTheme[];
  customThemeId: string | null;
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
  /** Columns at which a vertical guide line is drawn (issue #18). Empty =
   * no rulers. */
  rulers: number[];
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
  language: "system",
  palette: "ayu",
  mode: "system",
  customThemes: [],
  customThemeId: null,
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
  rulers: [],
  editorFontSize: EDITOR_FONT_SIZE_DEFAULT,
  uiScale: UI_SCALE_DEFAULT,
  dailyNotesFolder: "daily",
  templatesFolder: "templates",
  externalTool: "",
};

export function newCustomThemeId(): string {
  return `theme-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** The custom theme currently selected, or null when none exists. */
export function activeCustomTheme(s: EditorSettings): CustomTheme | null {
  return s.customThemes.find((t) => t.id === s.customThemeId) ?? null;
}

function load(): EditorSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<EditorSettings> & {
      /** Pre-#3 single custom theme, migrated into `customThemes`. */
      customThemeCss?: string;
    };
    const { customThemeCss, ...rest } = parsed;
    const merged: EditorSettings = {
      ...DEFAULT_SETTINGS,
      ...rest,
      shortcuts: { ...DEFAULT_SETTINGS.shortcuts, ...parsed.shortcuts },
    };
    if (
      typeof customThemeCss === "string" &&
      customThemeCss.trim() &&
      merged.customThemes.length === 0
    ) {
      const theme = {
        id: newCustomThemeId(),
        name: "Custom",
        css: customThemeCss,
      };
      merged.customThemes = [theme];
      merged.customThemeId = theme.id;
    }
    if (
      merged.customThemeId !== null &&
      !merged.customThemes.some((t) => t.id === merged.customThemeId)
    ) {
      merged.customThemeId = merged.customThemes[0]?.id ?? null;
    }
    return merged;
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
