import { useI18n } from "@/lib/i18n";
import { useEditorSettings } from "./lib/editorSettings";

export function FoldingSection() {
  const { t } = useI18n();
  const { settings, setSettings } = useEditorSettings();

  return (
    <div className="settings-section">
      <div className="settings-section-title">
        {t("settings.folding.title")}
      </div>
      <p className="settings-section-desc">{t("settings.folding.desc")}</p>
      <div className="settings-form">
        <div className="settings-field">
          <span className="settings-label">
            {t("settings.folding.startMarker")}
          </span>
          <input
            type="text"
            className="settings-input"
            value={settings.foldStartMarker}
            onChange={(e) => setSettings({ foldStartMarker: e.target.value })}
            spellCheck={false}
          />
          <span className="settings-hint">
            {t("settings.folding.eg")}{" "}
            <code>
              {settings.foldStartMarker} {t("settings.folding.regionName")}
            </code>
          </span>
        </div>
        <div className="settings-field">
          <span className="settings-label">
            {t("settings.folding.endMarker")}
          </span>
          <input
            type="text"
            className="settings-input"
            value={settings.foldEndMarker}
            onChange={(e) => setSettings({ foldEndMarker: e.target.value })}
            spellCheck={false}
          />
        </div>

        <div className="settings-field">
          <span className="settings-label">{t("common.preview")}</span>
          <div className="folding-preview">
            <div className="folding-preview-row">
              <span className="folding-preview-label">
                {t("settings.folding.expanded")}
              </span>
              <div className="cm-region-bar cm-region-bar-start folding-preview-bar">
                <span className="cm-region-chevron">▾</span>
                <span className="cm-region-icon">📁</span>
                <span className="cm-region-label">
                  {t("settings.folding.regionName")}
                </span>
              </div>
            </div>
            <div className="folding-preview-row">
              <span className="folding-preview-label">
                {t("settings.folding.collapsed")}
              </span>
              <span className="cm-region-fold-pill folding-preview-pill">
                <span className="cm-region-fold-icon">📁</span>
                <span className="cm-region-fold-name">
                  {t("settings.folding.regionName")}
                </span>
                <span className="cm-region-fold-count">
                  {t("settings.folding.linesExample")}
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
