import { useI18n } from "@/lib/i18n";
import { useEditorSettings } from "./lib/editorSettings";

/** Vault-relative folders used by daily notes, templates and attachments. */
export function VaultSection() {
  const { t } = useI18n();
  const { settings, setSettings } = useEditorSettings();
  return (
    <div className="settings-section">
      <div className="settings-section-title">{t("settings.vault.title")}</div>
      <p className="settings-section-desc">
        {t("settings.vault.descPrefix")} {"{{date}}"}, {"{{time}}"},{" "}
        {"{{title}}"} {t("settings.vault.and")} {"{{date:YYYY-MM-DD}}"}
        {t("settings.vault.descImages")} <code>attachments/</code>.
      </p>
      <div className="settings-form">
        <div className="settings-field">
          <span className="settings-label">
            {t("settings.vault.dailyNotesFolder")}
          </span>
          <input
            type="text"
            className="settings-input"
            value={settings.dailyNotesFolder}
            onChange={(e) => setSettings({ dailyNotesFolder: e.target.value })}
          />
        </div>
        <div className="settings-field">
          <span className="settings-label">
            {t("settings.vault.templatesFolder")}
          </span>
          <input
            type="text"
            className="settings-input"
            value={settings.templatesFolder}
            onChange={(e) => setSettings({ templatesFolder: e.target.value })}
          />
          <span className="settings-hint">
            {t("settings.vault.templatesHintPrefix")} <code>daily.md</code>{" "}
            {t("settings.vault.templatesHintSuffix")}
          </span>
        </div>
        <div className="settings-field">
          <span className="settings-label">
            {t("settings.vault.externalTool")}
          </span>
          <input
            type="text"
            className="settings-input"
            placeholder={t("settings.vault.externalToolPlaceholder")}
            value={settings.externalTool}
            onChange={(e) => setSettings({ externalTool: e.target.value })}
          />
          <span className="settings-hint">
            {t("settings.vault.externalToolHint")}
          </span>
        </div>
      </div>
    </div>
  );
}
