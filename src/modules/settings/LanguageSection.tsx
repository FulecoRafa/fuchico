import { useI18n } from "@/lib/i18n";
import type { AppLanguage } from "./lib/editorSettings";
import { useEditorSettings } from "./lib/editorSettings";

/** Language names are endonyms, shown the same in every locale. */
const LANGUAGES: { value: AppLanguage; name: string | null }[] = [
  { value: "system", name: null },
  { value: "en", name: "English" },
  { value: "pt-BR", name: "Português (Brasil)" },
];

export function LanguageSection() {
  const { t } = useI18n();
  const { settings, setSettings } = useEditorSettings();

  return (
    <div className="settings-section">
      <div className="settings-section-title">
        {t("settings.language.title")}
      </div>
      <p className="settings-section-desc">{t("settings.language.desc")}</p>
      <div className="settings-form">
        <div className="settings-field">
          <span className="settings-label">{t("settings.language.label")}</span>
          <div className="theme-palette-options">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.value}
                type="button"
                className={`theme-palette-btn${settings.language === lang.value ? " theme-palette-btn-active" : ""}`}
                onClick={() => setSettings({ language: lang.value })}
              >
                {lang.name ?? t("settings.language.system")}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
