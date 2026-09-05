import { type MessageKey, useI18n } from "@/lib/i18n";
import type { KeybindingMode } from "./lib/editorSettings";
import { useEditorSettings } from "./lib/editorSettings";

/** Helix/Vim are proper nouns; "Normal" and the descriptions translate. */
const MODES: {
  value: KeybindingMode;
  label: string | null;
  labelKey: MessageKey | null;
  descKey: MessageKey;
}[] = [
  {
    value: "helix",
    label: "Helix",
    labelKey: null,
    descKey: "settings.keybindings.helixDesc",
  },
  {
    value: "vim",
    label: "Vim",
    labelKey: null,
    descKey: "settings.keybindings.vimDesc",
  },
  {
    value: "normal",
    label: null,
    labelKey: "settings.keybindings.normalLabel",
    descKey: "settings.keybindings.normalDesc",
  },
];

export function KeybindingSection() {
  const { t } = useI18n();
  const { settings, setSettings } = useEditorSettings();

  return (
    <div className="settings-section">
      <div className="settings-section-title">
        {t("settings.keybindings.title")}
      </div>
      <p className="settings-section-desc">{t("settings.keybindings.desc")}</p>
      <div className="theme-palette-options">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            title={t(m.descKey)}
            className={`theme-palette-btn${settings.keybindingMode === m.value ? " theme-palette-btn-active" : ""}`}
            onClick={() => setSettings({ keybindingMode: m.value })}
          >
            {m.label ?? (m.labelKey ? t(m.labelKey) : "")}
          </button>
        ))}
      </div>
    </div>
  );
}
