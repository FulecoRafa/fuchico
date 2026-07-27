import { useEditorSettings } from "./lib/editorSettings";

const TAB_SIZES = [2, 4, 8] as const;

export function EditorBehaviorSection() {
  const { settings, setSettings } = useEditorSettings();

  return (
    <div className="settings-section">
      <div className="settings-section-title">Editor Behavior</div>
      <p className="settings-section-desc">
        Gutter and indentation preferences for the code editor.
      </p>
      <div className="settings-form">
        <div className="settings-field">
          <span className="settings-label">Relative line numbers</span>
          <div className="theme-palette-options">
            <button
              type="button"
              title="Every line shows its absolute number."
              className={`theme-palette-btn${!settings.relativeLineNumbers ? " theme-palette-btn-active" : ""}`}
              onClick={() => setSettings({ relativeLineNumbers: false })}
            >
              Absolute
            </button>
            <button
              type="button"
              title="The current line shows its absolute number; every other line shows its distance from the cursor."
              className={`theme-palette-btn${settings.relativeLineNumbers ? " theme-palette-btn-active" : ""}`}
              onClick={() => setSettings({ relativeLineNumbers: true })}
            >
              Relative
            </button>
          </div>
          <span className="settings-hint">
            Helix/Vim-style: handy for jumping N lines with motion commands.
          </span>
        </div>

        <div className="settings-field">
          <span className="settings-label">Tab size</span>
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
            Spaces per indent level and per tab stop.
          </span>
        </div>
      </div>
    </div>
  );
}
