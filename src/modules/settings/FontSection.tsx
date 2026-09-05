import { useI18n } from "@/lib/i18n";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import {
  clampEditorFontSize,
  clampUiScale,
  EDITOR_FONT_SIZE_MAX,
  EDITOR_FONT_SIZE_MIN,
  UI_SCALE_MAX,
  UI_SCALE_MIN,
  useEditorSettings,
} from "./lib/editorSettings";

type FontsState =
  | { status: "loading" }
  | { status: "loaded"; families: string[] }
  | { status: "error"; message: string };

export function FontSection() {
  const { t } = useI18n();
  const { settings, setSettings } = useEditorSettings();
  const [fonts, setFonts] = useState<FontsState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    invoke<string[]>("fonts_list_system")
      .then((families) => {
        if (!cancelled) setFonts({ status: "loaded", families });
      })
      .catch((e) => {
        if (!cancelled) setFonts({ status: "error", message: String(e) });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="settings-section">
      <div className="settings-section-title">{t("settings.font.title")}</div>
      <p className="settings-section-desc">{t("settings.font.desc")}</p>
      <div className="settings-form">
        <div className="settings-field">
          <span className="settings-label">{t("settings.font.uiFont")}</span>
          {fonts.status === "loading" && (
            <span className="settings-hint">{t("settings.font.loading")}</span>
          )}
          {fonts.status === "error" && (
            <span className="settings-hint">
              {t("settings.font.error", { message: fonts.message })}
            </span>
          )}
          {fonts.status === "loaded" && (
            <select
              className="settings-input"
              value={settings.uiFont}
              onChange={(e) => setSettings({ uiFont: e.target.value })}
            >
              <option value="">{t("common.default")}</option>
              {fonts.families.map((family) => (
                <option key={family} value={family}>
                  {family}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="settings-field">
          <span className="settings-label">
            {t("settings.font.editorFont")}
          </span>
          {fonts.status === "loading" && (
            <span className="settings-hint">{t("settings.font.loading")}</span>
          )}
          {fonts.status === "error" && (
            <span className="settings-hint">
              {t("settings.font.error", { message: fonts.message })}
            </span>
          )}
          {fonts.status === "loaded" && (
            <select
              className="settings-input"
              value={settings.editorFont}
              onChange={(e) => setSettings({ editorFont: e.target.value })}
            >
              <option value="">{t("common.default")}</option>
              {fonts.families.map((family) => (
                <option key={family} value={family}>
                  {family}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="settings-field">
          <span className="settings-label">
            {t("settings.font.editorFontSize")}
          </span>
          <input
            type="number"
            className="settings-input settings-input-number"
            min={EDITOR_FONT_SIZE_MIN}
            max={EDITOR_FONT_SIZE_MAX}
            value={settings.editorFontSize}
            onChange={(e) =>
              setSettings({
                editorFontSize: clampEditorFontSize(e.target.valueAsNumber),
              })
            }
          />
          <span className="settings-hint">
            {t("settings.font.editorFontSizeHint")}
          </span>
        </div>

        <div className="settings-field">
          <span className="settings-label">{t("settings.font.uiZoom")}</span>
          <input
            type="number"
            className="settings-input settings-input-number"
            min={Math.round(UI_SCALE_MIN * 100)}
            max={Math.round(UI_SCALE_MAX * 100)}
            step={10}
            value={Math.round(settings.uiScale * 100)}
            onChange={(e) =>
              setSettings({
                uiScale: clampUiScale(e.target.valueAsNumber / 100),
              })
            }
          />
          <span className="settings-hint">{t("settings.font.uiZoomHint")}</span>
        </div>

        <div className="settings-field">
          <span className="settings-label">{t("common.preview")}</span>
          <div className="theme-preview">
            <div className="theme-preview-toolbar">
              <span className="theme-preview-dot" />
              <span className="theme-preview-dot" />
              <span className="theme-preview-dot" />
            </div>
            <div className="theme-preview-body">
              <div
                className="theme-preview-buttons"
                style={
                  settings.uiFont ? { fontFamily: `"${settings.uiFont}"` } : {}
                }
              >
                <span className="btn theme-preview-btn">
                  {t("settings.preview.primary")}
                </span>
                <span className="btn btn-secondary theme-preview-btn">
                  {t("settings.preview.secondary")}
                </span>
              </div>
              <p
                className="theme-preview-text"
                style={
                  settings.uiFont ? { fontFamily: `"${settings.uiFont}"` } : {}
                }
              >
                {t("settings.preview.pangram")}
              </p>
              <pre
                className="theme-preview-code"
                style={
                  settings.editorFont
                    ? { fontFamily: `"${settings.editorFont}"` }
                    : {}
                }
              >
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
