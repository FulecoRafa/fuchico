import { useSyncExternalStore } from "react";

export type SettingsSectionId =
  | "appearance"
  | "editor"
  | "shortcuts"
  | "vault"
  | "integrations"
  | "about";

export const SETTINGS_SECTIONS: readonly {
  id: SettingsSectionId;
  label: string;
  keywords: string[];
}[] = [
  {
    id: "appearance",
    label: "Appearance",
    keywords: ["theme", "font", "zoom"],
  },
  {
    id: "editor",
    label: "Editor",
    keywords: ["keybindings", "helix", "vim", "folding", "behavior"],
  },
  {
    id: "shortcuts",
    label: "Keyboard Shortcuts",
    keywords: ["keys", "hotkeys"],
  },
  {
    id: "vault",
    label: "Vault",
    keywords: ["folders", "daily", "templates", "external tool"],
  },
  { id: "integrations", label: "Integrations", keywords: ["caldav", "sync"] },
  { id: "about", label: "About", keywords: ["version"] },
];

const KEY = "helix.settingsSection";
const listeners = new Set<() => void>();
let current: SettingsSectionId = load();

function load(): SettingsSectionId {
  try {
    const v = localStorage.getItem(KEY);
    if (v && SETTINGS_SECTIONS.some((s) => s.id === v)) {
      return v as SettingsSectionId;
    }
  } catch {}
  return "appearance";
}

/** Which settings section is shown. Module-level so the palette/App can
 * pick a section before switching the main view to Settings. */
export const settingsNav = {
  get: () => current,
  set(id: SettingsSectionId) {
    if (id === current) return;
    current = id;
    try {
      localStorage.setItem(KEY, id);
    } catch {}
    for (const l of listeners) l();
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};

export function useSettingsSection(): SettingsSectionId {
  return useSyncExternalStore(settingsNav.subscribe, settingsNav.get);
}
