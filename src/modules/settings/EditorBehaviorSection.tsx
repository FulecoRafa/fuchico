import { useI18n } from "@/lib/i18n";
import { useEditorSettings } from "./lib/editorSettings";

const TAB_SIZES = [2, 4, 8] as const;

export function EditorBehaviorSection() {
  const { t } = useI18n();
  const { settings, setSettings } = useEditorSettings();

  return (
    <div className="settings-section">
      <div className="settings-section-title">
        {t("settings.behavior.title")}
      </div>
      <p className="settings-section-desc">{t("settings.behavior.desc")}</p>
      <div className="settings-form">
        <div className="settings-field">
          <span className="settings-label">
            {t("settings.behavior.relativeLineNumbers")}
          </span>
          <div className="theme-palette-options">
            <button
              type="button"
              title={t("settings.behavior.absoluteTitle")}
              className={`theme-palette-btn${!settings.relativeLineNumbers ? " theme-palette-btn-active" : ""}`}
              onClick={() => setSettings({ relativeLineNumbers: false })}
            >
              {t("settings.behavior.absolute")}
            </button>
            <button
              type="button"
              title={t("settings.behavior.relativeTitle")}
              className={`theme-palette-btn${settings.relativeLineNumbers ? " theme-palette-btn-active" : ""}`}
              onClick={() => setSettings({ relativeLineNumbers: true })}
            >
              {t("settings.behavior.relative")}
            </button>
          </div>
          <span className="settings-hint">
            {t("settings.behavior.relativeHint")}
          </span>
        </div>

        <div className="settings-field">
          <span className="settings-label">
            {t("settings.behavior.tabSize")}
          </span>
          <div className="theme-palette-options">
            {TAB_SIZES.map((size) => (
              <button
                key={size}
                type="button"
                className={`theme-palette-btn${settings.tabSize === size ? " theme-palette-btn-active" : ""}`}
                onClick={() => setSettings({ tabSize: size })}
              >
                {size}
              </button>
            ))}
          </div>
          <span className="settings-hint">
            {t("settings.behavior.tabSizeHint")}
          </span>
        </div>
      </div>
    </div>
  );
}
