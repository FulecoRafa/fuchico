import { useI18n } from "@/lib/i18n";
import { openUrl } from "@tauri-apps/plugin-opener";
import { version } from "../../../package.json";

const REPO = "https://github.com/FulecoRafa/fuchico";

export function AboutSection() {
  const { t } = useI18n();
  return (
    <div className="settings-section">
      <div className="settings-section-title">{t("settings.about.title")}</div>
      <p className="settings-section-desc">
        {t("settings.about.desc", { version })}
      </p>
      <div className="settings-actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => void openUrl(REPO)}
        >
          {t("settings.about.github")}
        </button>
      </div>
    </div>
  );
}
