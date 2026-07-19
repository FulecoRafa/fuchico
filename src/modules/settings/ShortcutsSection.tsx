import { useState } from "react";
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

export function ShortcutsSection() {
  const { settings, setShortcut } = useEditorSettings();
  const [recording, setRecording] = useState<ShortcutAction | null>(null);

  return (
    <div className="settings-section">
      <div className="settings-section-title">Keyboard Shortcuts</div>
      <p className="settings-section-desc">
        Click a binding, then press the new key combination.
      </p>
      <div className="settings-form">
        {ACTIONS.map((a) => (
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
      </div>
    </div>
  );
}
