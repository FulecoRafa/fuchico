import { usePrefersDark } from "@/lib/usePrefersDark";
import { useEffect, useRef, useState } from "react";
import type { ColorMode, Palette } from "./lib/editorSettings";
import { useEditorSettings } from "./lib/editorSettings";

const PALETTES: { value: Palette; label: string }[] = [
  { value: "ayu", label: "Ayu" },
  { value: "dracula", label: "Dracula" },
  { value: "catppuccin", label: "Catppuccin" },
  { value: "custom", label: "Custom" },
];

const MODES: { value: ColorMode; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const PREVIEW_STYLE_ID = "fuchico-custom-theme-preview";

function setPreviewCss(css: string) {
  let tag = document.getElementById(
    PREVIEW_STYLE_ID,
  ) as HTMLStyleElement | null;
  if (!css.trim()) {
    tag?.remove();
    return;
  }
  if (!tag) {
    tag = document.createElement("style");
    tag.id = PREVIEW_STYLE_ID;
    document.head.appendChild(tag);
  }
  tag.textContent = `.theme-preview[data-palette="custom"] {\n${css}\n}`;
}

export function ThemeSection() {
  const { settings, setSettings } = useEditorSettings();
  const prefersDark = usePrefersDark();
  const [customCssDraft, setCustomCssDraft] = useState(settings.customThemeCss);
  const [applied, setApplied] = useState(true);
  const debounceRef = useRef<number | null>(null);

  const isDracula = settings.palette === "dracula";
  const resolvedMode: "light" | "dark" = isDracula
    ? "dark"
    : settings.mode === "system"
      ? prefersDark
        ? "dark"
        : "light"
      : settings.mode;

  useEffect(() => {
    if (settings.palette !== "custom") {
      setPreviewCss("");
      return;
    }
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      setPreviewCss(customCssDraft);
    }, 150);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [customCssDraft, settings.palette]);

  useEffect(() => {
    return () => setPreviewCss("");
  }, []);

  return (
    <div className="settings-section">
      <div className="settings-section-title">Theme</div>
      <p className="settings-section-desc">
        A theme is a color choice, independent of light/dark mode. Each palette
        may support a light and/or dark variant.
      </p>

      <div className="settings-form">
        <div className="settings-field">
          <span className="settings-label">Palette</span>
          <div className="theme-palette-options">
            {PALETTES.map((p) => (
              <button
                key={p.value}
                type="button"
                className={`theme-palette-btn${settings.palette === p.value ? " theme-palette-btn-active" : ""}`}
                onClick={() => setSettings({ palette: p.value })}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-field">
          <span className="settings-label">Mode</span>
          <div className="theme-palette-options">
            {MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                disabled={isDracula}
                className={`theme-palette-btn${settings.mode === m.value ? " theme-palette-btn-active" : ""}`}
                onClick={() => setSettings({ mode: m.value })}
              >
                {m.label}
              </button>
            ))}
          </div>
          {isDracula && (
            <span className="settings-hint">
              Dracula only ships a dark palette, so mode is fixed to dark.
            </span>
          )}
        </div>

        {settings.palette === "custom" && (
          <div className="settings-field">
            <span className="settings-label">Custom CSS variables</span>
            <textarea
              className="settings-input settings-textarea"
              rows={8}
              spellCheck={false}
              placeholder={
                "--background: oklch(1 0 0);\n--foreground: oklch(0.15 0 0);\n--primary: oklch(0.5 0.2 260);\n..."
              }
              value={customCssDraft}
              onChange={(e) => {
                setCustomCssDraft(e.target.value);
                setApplied(e.target.value === settings.customThemeCss);
              }}
            />
            <span className="settings-hint">
              Declarations are injected as-is into a{" "}
              <code>[data-palette="custom"]</code> rule. Preview updates as you
              type; click Apply to use it across the whole app.
            </span>
            <div className="settings-actions">
              <button
                type="button"
                className="btn"
                disabled={applied}
                onClick={() => {
                  setSettings({ customThemeCss: customCssDraft });
                  setApplied(true);
                }}
              >
                Apply
              </button>
              {applied && (
                <span className="settings-status settings-status-ok">
                  Applied
                </span>
              )}
            </div>
          </div>
        )}

        <div className="settings-field">
          <span className="settings-label">Preview</span>
          <div
            className="theme-preview"
            data-palette={settings.palette}
            data-mode={resolvedMode}
          >
            <div className="theme-preview-toolbar">
              <span className="theme-preview-dot" />
              <span className="theme-preview-dot" />
              <span className="theme-preview-dot" />
            </div>
            <div className="theme-preview-body">
              <div className="theme-preview-buttons">
                <span className="btn theme-preview-btn">Primary</span>
                <span className="btn btn-secondary theme-preview-btn">
                  Secondary
                </span>
              </div>
              <p className="theme-preview-text">
                The quick brown fox jumps over the lazy dog.
              </p>
              <pre className="theme-preview-code">
                <span className="theme-preview-syntax-keyword">function</span>{" "}
                <span className="theme-preview-syntax-function">greet</span>(
                <span className="theme-preview-syntax-type">name</span>) {"{"}
                {"\n  "}
                <span className="theme-preview-syntax-keyword">return</span>{" "}
                <span className="theme-preview-syntax-string">
                  `Hello, ${"{"}name{"}"}`
                </span>
                ; {"// "}
                <span className="theme-preview-syntax-comment">
                  greets someone
                </span>
                {"\n}"}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
