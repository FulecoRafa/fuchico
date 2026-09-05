import { type MessageKey, useI18n } from "@/lib/i18n";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { ShortcutAction } from "./lib/editorSettings";
import { useEditorSettings } from "./lib/editorSettings";
import { FIXED_SHORTCUTS as FIXED, formatBinding } from "./lib/fixedShortcuts";
import { SHORTCUT_ACTIONS as ACTIONS } from "./lib/shortcutActions";

const MODIFIER_KEYS = new Set(["Control", "Meta", "Alt", "Shift"]);

function bindingFromEvent(e: React.KeyboardEvent): string | null {
  if (MODIFIER_KEYS.has(e.key)) return null;
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push("Mod");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  parts.push(key);
  return parts.join("-");
}

function matches(q: string, ...fields: string[]): boolean {
  if (!q) return true;
  const hay = fields.join(" ").toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => hay.includes(term));
}

export function ShortcutsSection() {
  const { t, locale } = useI18n();
  const { settings, setShortcut } = useEditorSettings();
  const [recording, setRecording] = useState<ShortcutAction | null>(null);
  const [query, setQuery] = useState("");

  // biome-ignore lint/correctness/useExhaustiveDependencies: `locale` re-runs the filter so it matches translated text
  const rebindable = useMemo(
    () =>
      ACTIONS.filter((a) =>
        matches(
          query,
          "editor",
          t(a.labelKey),
          t(a.descKey),
          settings.shortcuts[a.value],
          formatBinding(settings.shortcuts[a.value]),
        ),
      ),
    [query, settings.shortcuts, locale],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: `locale` re-runs the filter so it matches translated text
  const fixed = useMemo(
    () =>
      FIXED.filter((f) =>
        matches(
          query,
          t(f.group),
          t(f.labelKey),
          t(f.descKey),
          f.keysKey ? t(f.keysKey) : f.keys,
          formatBinding(f.keys),
        ),
      ),
    [query, locale],
  );
  const groups = useMemo(() => {
    const out = new Map<MessageKey, typeof FIXED>();
    for (const f of fixed) {
      const list = out.get(f.group) ?? [];
      list.push(f);
      out.set(f.group, list);
    }
    return [...out.entries()];
  }, [fixed]);

  return (
    <div className="settings-section" id="settings-shortcuts">
      <div className="settings-section-title">{t("shortcuts.title")}</div>
      <p className="settings-section-desc">{t("shortcuts.desc")}</p>
      <div className="settings-shortcut-search">
        <Search size={13} strokeWidth={1.75} />
        <input
          type="search"
          className="settings-input"
          placeholder={t("shortcuts.searchPlaceholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="settings-form">
        {rebindable.length > 0 && (
          <div className="settings-shortcut-group">
            {t("shortcuts.editorRebindable")}
          </div>
        )}
        {rebindable.map((a) => (
          <div key={a.value} className="settings-shortcut-row">
            <div className="settings-shortcut-info">
              <span className="settings-shortcut-label">{t(a.labelKey)}</span>
              <span className="settings-hint">{t(a.descKey)}</span>
            </div>
            <button
              type="button"
              className={`settings-shortcut-key${recording === a.value ? " settings-shortcut-key-recording" : ""}`}
              onClick={() => setRecording(a.value)}
              onBlur={() => setRecording((r) => (r === a.value ? null : r))}
              onKeyDown={(e) => {
                if (recording !== a.value) return;
                e.preventDefault();
                if (e.key === "Escape") {
                  setRecording(null);
                  return;
                }
                const binding = bindingFromEvent(e);
                if (!binding) return;
                setShortcut(a.value, binding);
                setRecording(null);
              }}
            >
              {recording === a.value
                ? t("shortcuts.pressKeys")
                : formatBinding(settings.shortcuts[a.value])}
            </button>
          </div>
        ))}
        {groups.map(([group, items]) => (
          <div key={group} className="settings-shortcut-groupwrap">
            <div className="settings-shortcut-group">{t(group)}</div>
            {items.map((f) => (
              <div key={f.labelKey} className="settings-shortcut-row">
                <div className="settings-shortcut-info">
                  <span className="settings-shortcut-label">
                    {t(f.labelKey)}
                  </span>
                  <span className="settings-hint">{t(f.descKey)}</span>
                </div>
                <span className="settings-shortcut-key settings-shortcut-key-fixed">
                  {f.keysKey ? t(f.keysKey) : formatBinding(f.keys)}
                </span>
              </div>
            ))}
          </div>
        ))}
        {rebindable.length === 0 && fixed.length === 0 && (
          <span className="settings-hint">
            {t("shortcuts.noMatch", { query })}
          </span>
        )}
      </div>
    </div>
  );
}
