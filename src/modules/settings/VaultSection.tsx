import { useEditorSettings } from "./lib/editorSettings";

/** Vault-relative folders used by daily notes, templates and attachments. */
export function VaultSection() {
  const { settings, setSettings } = useEditorSettings();
  return (
    <div className="settings-section">
      <div className="settings-section-title">Vault Folders</div>
      <p className="settings-section-desc">
        Relative to the open vault. "Open Today's Daily Note" and "New Note from
        Template" live in the command palette (Cmd/Ctrl-Shift-P); templates may
        use {"{{date}}"}, {"{{time}}"}, {"{{title}}"} and{" "}
        {"{{date:YYYY-MM-DD}}"}. Pasted images go to <code>attachments/</code>.
      </p>
      <div className="settings-form">
        <div className="settings-field">
          <span className="settings-label">Daily notes folder</span>
          <input
            type="text"
            className="settings-input"
            value={settings.dailyNotesFolder}
            onChange={(e) => setSettings({ dailyNotesFolder: e.target.value })}
          />
        </div>
        <div className="settings-field">
          <span className="settings-label">Templates folder</span>
          <input
            type="text"
            className="settings-input"
            value={settings.templatesFolder}
            onChange={(e) => setSettings({ templatesFolder: e.target.value })}
          />
          <span className="settings-hint">
            A <code>daily.md</code> here seeds new daily notes.
          </span>
        </div>
      </div>
    </div>
  );
}
