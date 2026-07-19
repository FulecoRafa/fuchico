import type { KeybindingMode } from "./lib/editorSettings";
import { useEditorSettings } from "./lib/editorSettings";

const MODES: { value: KeybindingMode; label: string; desc: string }[] = [
  {
    value: "helix",
    label: "Helix",
    desc: "Modal editing, Helix-style selection-first commands.",
  },
  { value: "vim", label: "Vim", desc: "Modal editing, Vim keybindings." },
  {
    value: "normal",
    label: "Normal",
    desc: "Standard text-editor keybindings, no modes.",
  },
];

export function KeybindingSection() {
  const { settings, setSettings } = useEditorSettings();

  return (
    <div className="settings-section">
      <div className="settings-section-title">Keybindings</div>
      <p className="settings-section-desc">
        Choose how the editor interprets keystrokes. Takes effect immediately in
        any open file.
      </p>
      <div className="theme-palette-options">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            title={m.desc}
            className={`theme-palette-btn${settings.keybindingMode === m.value ? " theme-palette-btn-active" : ""}`}
            onClick={() => setSettings({ keybindingMode: m.value })}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}
