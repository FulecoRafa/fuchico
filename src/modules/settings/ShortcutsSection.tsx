import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { ShortcutAction } from "./lib/editorSettings";
import { useEditorSettings } from "./lib/editorSettings";

const ACTIONS: { value: ShortcutAction; label: string; desc: string }[] = [
  {
    value: "openOutline",
    label: "Go to header",
    desc: "Open the document outline (fuzzy-searchable header list).",
  },
  {
    value: "toggleCheckboxAtCursor",
    label: "Toggle checkbox",
    desc: "Mark/unmark the checkbox on the cursor's line.",
  },
  {
    value: "insertDate",
    label: "Insert date",
    desc: "Insert today's date at the cursor.",
  },
  {
    value: "insertDateTime",
    label: "Insert date & time",
    desc: "Insert the current date and time at the cursor.",
  },
  {
    value: "insertRegion",
    label: "Insert fold region",
    desc: "Wrap the selected lines in a foldable region (or insert an empty one at the cursor).",
  },
  {
    value: "insertTable",
    label: "Insert table",
    desc: "Insert a 2x2 Markdown table at the cursor and start editing the header.",
  },
];

/** Shortcuts that are built in (not rebindable), listed so the whole map is
 * discoverable in one searchable place (issue #7). */
const FIXED: { group: string; label: string; desc: string; keys: string }[] = [
  {
    group: "Global",
    label: "Command palette",
    desc: "Run any app command by name.",
    keys: "Mod-Shift-p",
  },
  {
    group: "Global",
    label: "Quick open file",
    desc: "Fuzzy-find a note in the vault.",
    keys: "Mod-p",
  },
  {
    group: "Global",
    label: "Editor font size",
    desc: "Bigger / smaller / reset editor text.",
    keys: "Mod-= / Mod-- / Mod-0",
  },
  {
    group: "Global",
    label: "UI zoom",
    desc: "Zoom the whole app in / out / reset.",
    keys: "Mod-Shift-= / Mod-Shift-- / Mod-Shift-0",
  },
  {
    group: "Editor",
    label: "Save",
    desc: "Write the current file to disk.",
    keys: "Mod-s",
  },
  {
    group: "Editor",
    label: "Find / replace",
    desc: "Search within the current file.",
    keys: "Mod-f",
  },
  {
    group: "Editor",
    label: "Paste image",
    desc: "Paste or drop an image to save it under attachments/ and link it.",
    keys: "Mod-v",
  },
  {
    group: "Editor",
    label: "Follow link",
    desc: "Open the [[wikilink]] or Markdown link under the cursor.",
    keys: "Click",
  },
  {
    group: "File explorer",
    label: "Navigate",
    desc: "Move selection, expand/collapse folders.",
    keys: "↑ ↓ ← →",
  },
  {
    group: "File explorer",
    label: "Open / toggle folder",
    desc: "Open the selected file or expand/collapse the folder.",
    keys: "Enter",
  },
  {
    group: "File explorer",
    label: "Rename",
    desc: "Rename the selected entry.",
    keys: "F2",
  },
  {
    group: "File explorer",
    label: "Delete",
    desc: "Delete the selected entry (asks for confirmation).",
    keys: "Delete / Backspace",
  },
  {
    group: "File explorer",
    label: "Type-ahead",
    desc: "Type a name prefix to jump to the matching entry.",
    keys: "a–z",
  },
  {
    group: "File explorer",
    label: "Context menu",
    desc: "New file/folder, rename, delete.",
    keys: "Right-click",
  },
  {
    group: "Tabs",
    label: "Tab menu",
    desc: "Close, close others, close all.",
    keys: "Right-click",
  },
];

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
  const { settings, setShortcut } = useEditorSettings();
  const [recording, setRecording] = useState<ShortcutAction | null>(null);
  const [query, setQuery] = useState("");

  const rebindable = useMemo(
    () =>
      ACTIONS.filter((a) =>
        matches(query, "editor", a.label, a.desc, settings.shortcuts[a.value]),
      ),
    [query, settings.shortcuts],
  );
  const fixed = useMemo(
    () => FIXED.filter((f) => matches(query, f.group, f.label, f.desc, f.keys)),
    [query],
  );
  const groups = useMemo(() => {
    const out = new Map<string, typeof FIXED>();
    for (const f of fixed) {
      const list = out.get(f.group) ?? [];
      list.push(f);
      out.set(f.group, list);
    }
    return [...out.entries()];
  }, [fixed]);

  return (
    <div className="settings-section" id="settings-shortcuts">
      <div className="settings-section-title">Keyboard Shortcuts</div>
      <p className="settings-section-desc">
        Everything the keyboard can do, in one place. Editor actions are
        rebindable: click a binding, then press the new key combination.
      </p>
      <div className="settings-shortcut-search">
        <Search size={13} strokeWidth={1.75} />
        <input
          type="search"
          className="settings-input"
          placeholder="Search shortcuts…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="settings-form">
        {rebindable.length > 0 && (
          <div className="settings-shortcut-group">Editor (rebindable)</div>
        )}
        {rebindable.map((a) => (
          <div key={a.value} className="settings-shortcut-row">
            <div className="settings-shortcut-info">
              <span className="settings-shortcut-label">{a.label}</span>
              <span className="settings-hint">{a.desc}</span>
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
                ? "Press keys…"
                : settings.shortcuts[a.value]}
            </button>
          </div>
        ))}
        {groups.map(([group, items]) => (
          <div key={group} className="settings-shortcut-groupwrap">
            <div className="settings-shortcut-group">{group}</div>
            {items.map((f) => (
              <div key={f.label} className="settings-shortcut-row">
                <div className="settings-shortcut-info">
                  <span className="settings-shortcut-label">{f.label}</span>
                  <span className="settings-hint">{f.desc}</span>
                </div>
                <span className="settings-shortcut-key settings-shortcut-key-fixed">
                  {f.keys}
                </span>
              </div>
            ))}
          </div>
        ))}
        {rebindable.length === 0 && fixed.length === 0 && (
          <span className="settings-hint">No shortcuts match "{query}".</span>
        )}
      </div>
    </div>
  );
}
