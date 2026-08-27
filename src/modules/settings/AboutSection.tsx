import { openUrl } from "@tauri-apps/plugin-opener";
import { version } from "../../../package.json";

const REPO = "https://github.com/FulecoRafa/fuchico";

export function AboutSection() {
  return (
    <div className="settings-section">
      <div className="settings-section-title">About</div>
      <p className="settings-section-desc">
        Fuchico {version} — a keyboard-first Markdown notes app with Helix
        editing, tasks and agenda.
      </p>
      <div className="settings-actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => void openUrl(REPO)}
        >
          Source & issues on GitHub
        </button>
      </div>
    </div>
  );
}
