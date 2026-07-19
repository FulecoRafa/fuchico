import { useEditorSettings } from "./lib/editorSettings";

export function FoldingSection() {
  const { settings, setSettings } = useEditorSettings();

  return (
    <div className="settings-section">
      <div className="settings-section-title">Fold Regions</div>
      <p className="settings-section-desc">
        Wrap any lines between a start and end marker to make them foldable —
        this is an app-specific convention, not part of Markdown. The rest of
        the start-marker line becomes the region's name.
      </p>
      <div className="settings-form">
        <div className="settings-field">
          <span className="settings-label">Start marker</span>
          <input
            type="text"
            className="settings-input"
            value={settings.foldStartMarker}
            onChange={(e) => setSettings({ foldStartMarker: e.target.value })}
            spellCheck={false}
          />
          <span className="settings-hint">
            e.g. <code>{settings.foldStartMarker} Region name</code>
          </span>
        </div>
        <div className="settings-field">
          <span className="settings-label">End marker</span>
          <input
            type="text"
            className="settings-input"
            value={settings.foldEndMarker}
            onChange={(e) => setSettings({ foldEndMarker: e.target.value })}
            spellCheck={false}
          />
        </div>

        <div className="settings-field">
          <span className="settings-label">Preview</span>
          <div className="folding-preview">
            <div className="folding-preview-row">
              <span className="folding-preview-label">Expanded</span>
              <div className="cm-region-bar cm-region-bar-start folding-preview-bar">
                <span className="cm-region-chevron">▾</span>
                <span className="cm-region-icon">📁</span>
                <span className="cm-region-label">Region name</span>
              </div>
            </div>
            <div className="folding-preview-row">
              <span className="folding-preview-label">Collapsed</span>
              <span className="cm-region-fold-pill folding-preview-pill">
                <span className="cm-region-fold-icon">📁</span>
                <span className="cm-region-fold-name">Region name</span>
                <span className="cm-region-fold-count">3 lines</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
