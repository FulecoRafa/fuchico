import { type MessageKey, useI18n } from "@/lib/i18n";
import { usePrefersDark } from "@/lib/usePrefersDark";
import { useEffect, useRef, useState } from "react";
import type { ColorMode, Palette } from "./lib/editorSettings";
import { useEditorSettings } from "./lib/editorSettings";

/** Palette names are proper nouns except "Custom", which is translated. */
const PALETTES: { value: Palette; label: string | null }[] = [
  { value: "ayu", label: "Ayu" },
  { value: "dracula", label: "Dracula" },
  { value: "catppuccin", label: "Catppuccin" },
  { value: "custom", label: null },
];

const MODES: { value: ColorMode; labelKey: MessageKey }[] = [
  { value: "system", labelKey: "settings.theme.modeSystem" },
  { value: "light", labelKey: "settings.theme.modeLight" },
  { value: "dark", labelKey: "settings.theme.modeDark" },
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
  const { t } = useI18n();
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
      <div className="settings-section-title">{t("settings.theme.title")}</div>
      <p className="settings-section-desc">{t("settings.theme.desc")}</p>

      <div className="settings-form">
        <div className="settings-field">
          <span className="settings-label">{t("settings.theme.palette")}</span>
          <div className="theme-palette-options">
            {PALETTES.map((p) => (
              <button
                key={p.value}
                type="button"
                className={`theme-palette-btn${settings.palette === p.value ? " theme-palette-btn-active" : ""}`}
                onClick={() => setSettings({ palette: p.value })}
              >
                {p.label ?? t("settings.theme.paletteCustom")}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-field">
          <span className="settings-label">{t("settings.theme.mode")}</span>
          <div className="theme-palette-options">
            {MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                disabled={isDracula}
                className={`theme-palette-btn${settings.mode === m.value ? " theme-palette-btn-active" : ""}`}
                onClick={() => setSettings({ mode: m.value })}
              >
                {t(m.labelKey)}
              </button>
            ))}
          </div>
          {isDracula && (
            <span className="settings-hint">
              {t("settings.theme.draculaHint")}
            </span>
          )}
        </div>

        {settings.palette === "custom" && (
          <div className="settings-field">
            <span className="settings-label">
              {t("settings.theme.customCss")}
            </span>
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
              {t("settings.theme.customCssHintPrefix")}{" "}
              <code>[data-palette="custom"]</code>{" "}
              {t("settings.theme.customCssHintSuffix")}
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
                {t("common.apply")}
              </button>
              {applied && (
                <span className="settings-status settings-status-ok">
                  {t("common.applied")}
                </span>
              )}
            </div>
          </div>
        )}

        <div className="settings-field">
          <span className="settings-label">{t("common.preview")}</span>
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
                <span className="btn theme-preview-btn">
                  {t("settings.preview.primary")}
                </span>
                <span className="btn btn-secondary theme-preview-btn">
                  {t("settings.preview.secondary")}
                </span>
              </div>
              <p className="theme-preview-text">
                {t("settings.preview.pangram")}
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
