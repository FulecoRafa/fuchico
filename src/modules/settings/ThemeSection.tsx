import { type MessageKey, useI18n } from "@/lib/i18n";
import { usePrefersDark } from "@/lib/usePrefersDark";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { Copy, Download, Plus, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type {
  BuiltinPalette,
  ColorMode,
  CustomTheme,
} from "./lib/editorSettings";
import {
  activeCustomTheme,
  newCustomThemeId,
  useEditorSettings,
} from "./lib/editorSettings";
import {
  parseThemeFile,
  serializeTheme,
  themeFileName,
} from "./lib/themeFiles";
import { snapshotCurrentTheme } from "./lib/themeVariables";
import { ThemeCssEditor } from "./ThemeCssEditor";

/** Palette names are proper nouns. */
const PALETTES: { value: BuiltinPalette; label: string }[] = [
  { value: "ayu", label: "Ayu" },
  { value: "dracula", label: "Dracula" },
  { value: "catppuccin", label: "Catppuccin" },
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

function stem(path: string): string {
  const base = path.slice(path.lastIndexOf("/") + 1);
  return base.replace(/\.fuchico-theme\.css$|\.css$/i, "");
}

export function ThemeSection() {
  const { t } = useI18n();
  const { settings, setSettings } = useEditorSettings();
  const prefersDark = usePrefersDark();
  const active = activeCustomTheme(settings);
  const editing = settings.palette === "custom" ? active : null;
  const [cssDraft, setCssDraft] = useState(editing?.css ?? "");
  const [applied, setApplied] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);

  // Switching themes replaces the draft; edits to the draft never leak into
  // another theme.
  const editingId = editing?.id ?? null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset only when the edited theme changes identity
  useEffect(() => {
    setCssDraft(editing?.css ?? "");
    setApplied(true);
  }, [editingId]);

  const isDracula = settings.palette === "dracula";
  const resolvedMode: "light" | "dark" = isDracula
    ? "dark"
    : settings.mode === "system"
      ? prefersDark
        ? "dark"
        : "light"
      : settings.mode;

  useEffect(() => {
    if (!editing) {
      setPreviewCss("");
      return;
    }
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      setPreviewCss(cssDraft);
    }, 150);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [cssDraft, editing]);

  useEffect(() => {
    return () => setPreviewCss("");
  }, []);

  const updateTheme = (id: string, patch: Partial<CustomTheme>) => {
    setSettings({
      customThemes: settings.customThemes.map((th) =>
        th.id === id ? { ...th, ...patch } : th,
      ),
    });
  };

  const addTheme = (theme: Omit<CustomTheme, "id">) => {
    const created = { ...theme, id: newCustomThemeId() };
    setSettings({
      customThemes: [...settings.customThemes, created],
      customThemeId: created.id,
      palette: "custom",
    });
    return created;
  };

  const uniqueName = (base: string) => {
    const names = new Set(settings.customThemes.map((th) => th.name));
    if (!names.has(base)) return base;
    let i = 2;
    while (names.has(`${base} ${i}`)) i++;
    return `${base} ${i}`;
  };

  const createTheme = () =>
    addTheme({
      name: uniqueName(t("settings.theme.newThemeName")),
      css: snapshotCurrentTheme(),
    });

  const duplicateTheme = () => {
    if (!editing) return;
    addTheme({ name: uniqueName(editing.name), css: cssDraft });
  };

  const deleteTheme = () => {
    if (!editing) return;
    if (
      !window.confirm(t("settings.theme.deleteConfirm", { name: editing.name }))
    )
      return;
    const remaining = settings.customThemes.filter(
      (th) => th.id !== editing.id,
    );
    setSettings({
      customThemes: remaining,
      customThemeId: remaining[0]?.id ?? null,
      palette: remaining.length ? "custom" : "ayu",
    });
  };

  const exportTheme = async () => {
    if (!editing) return;
    const target = await save({
      defaultPath: themeFileName(editing.name),
      filters: [{ name: "CSS", extensions: ["css"] }],
    });
    if (!target) return;
    try {
      await invoke("fs_write_file", {
        path: target,
        content: serializeTheme({ ...editing, css: cssDraft }),
        source: "theme-export",
      });
      setStatus(t("settings.theme.exported"));
    } catch (e) {
      setStatus(String(e));
    }
  };

  const importTheme = async () => {
    const picked = await open({
      multiple: false,
      directory: false,
      filters: [{ name: "CSS", extensions: ["css"] }],
    });
    if (typeof picked !== "string") return;
    try {
      const result = await invoke<{ kind: string; content?: string }>(
        "fs_read_file",
        { path: picked },
      );
      if (result.kind !== "text" || typeof result.content !== "string") {
        setStatus(t("settings.theme.importFailed"));
        return;
      }
      const parsed = parseThemeFile(result.content, stem(picked));
      addTheme({ name: uniqueName(parsed.name), css: parsed.css });
      setStatus(t("settings.theme.imported"));
    } catch (e) {
      setStatus(String(e));
    }
  };

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
                {p.label}
              </button>
            ))}
            {settings.customThemes.map((th) => (
              <button
                key={th.id}
                type="button"
                className={`theme-palette-btn${settings.palette === "custom" && settings.customThemeId === th.id ? " theme-palette-btn-active" : ""}`}
                onClick={() =>
                  setSettings({ palette: "custom", customThemeId: th.id })
                }
              >
                {th.name}
              </button>
            ))}
            <button
              type="button"
              className="theme-palette-btn theme-palette-btn-icon"
              title={t("settings.theme.newTheme")}
              onClick={createTheme}
            >
              <Plus size={13} strokeWidth={2} />
              {t("settings.theme.newTheme")}
            </button>
            <button
              type="button"
              className="theme-palette-btn theme-palette-btn-icon"
              title={t("settings.theme.importTheme")}
              onClick={() => void importTheme()}
            >
              <Upload size={13} strokeWidth={2} />
              {t("settings.theme.importTheme")}
            </button>
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

        {editing && (
          <>
            <div className="settings-field">
              <span className="settings-label">
                {t("settings.theme.themeName")}
              </span>
              <input
                type="text"
                className="settings-input"
                value={editing.name}
                onChange={(e) =>
                  updateTheme(editing.id, { name: e.target.value })
                }
              />
            </div>
            <div className="settings-field">
              <span className="settings-label">
                {t("settings.theme.customCss")}
              </span>
              <ThemeCssEditor
                value={cssDraft}
                onChange={(next) => {
                  setCssDraft(next);
                  setApplied(next === editing.css);
                }}
              />
              <span className="settings-hint">
                {t("settings.theme.customCssHintPrefix")}{" "}
                <code>[data-palette="custom"]</code>{" "}
                {t("settings.theme.customCssHintSuffix")}{" "}
                {t("settings.theme.autocompleteHint")}
              </span>
              <div className="settings-actions">
                <button
                  type="button"
                  className="btn"
                  disabled={applied}
                  onClick={() => {
                    updateTheme(editing.id, { css: cssDraft });
                    setApplied(true);
                  }}
                >
                  {t("common.apply")}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={duplicateTheme}
                >
                  <Copy size={13} strokeWidth={2} />
                  {t("settings.theme.duplicate")}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => void exportTheme()}
                >
                  <Download size={13} strokeWidth={2} />
                  {t("settings.theme.exportTheme")}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-danger"
                  onClick={deleteTheme}
                >
                  <Trash2 size={13} strokeWidth={2} />
                  {t("common.delete")}
                </button>
                {applied && (
                  <span className="settings-status settings-status-ok">
                    {t("common.applied")}
                  </span>
                )}
                {status && <span className="settings-status">{status}</span>}
              </div>
            </div>
          </>
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
