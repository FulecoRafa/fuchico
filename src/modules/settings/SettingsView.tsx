import { Search } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { AboutSection } from "./AboutSection";
import { EditorBehaviorSection } from "./EditorBehaviorSection";
import { FoldingSection } from "./FoldingSection";
import { FontSection } from "./FontSection";
import { IntegrationsSection } from "./IntegrationsSection";
import { KeybindingSection } from "./KeybindingSection";
import {
  SETTINGS_SECTIONS,
  type SettingsSectionId,
  settingsNav,
  useSettingsSection,
} from "./lib/settingsNav";
import { ShortcutsSection } from "./ShortcutsSection";
import { ThemeSection } from "./ThemeSection";
import { VaultSection } from "./VaultSection";

type Props = {
  rootPath: string | null;
};

function SectionBody({
  id,
  rootPath,
}: {
  id: SettingsSectionId;
  rootPath: string | null;
}) {
  switch (id) {
    case "appearance":
      return (
        <>
          <ThemeSection />
          <FontSection />
        </>
      );
    case "editor":
      return (
        <>
          <KeybindingSection />
          <EditorBehaviorSection />
          <FoldingSection />
        </>
      );
    case "shortcuts":
      return <ShortcutsSection />;
    case "vault":
      return <VaultSection />;
    case "integrations":
      return <IntegrationsSection rootPath={rootPath} />;
    case "about":
      return <AboutSection />;
  }
}

/** Elements that count as one "setting" for search filtering. */
const FIELD_SELECTOR =
  ".settings-field, .settings-shortcut-row, .settings-account-row, .settings-link-row, .settings-actions";

/** Hide sections/fields whose text doesn't match `query`. Walking the DOM
 * keeps every *Section component untouched: whatever they render is
 * searchable by its visible text (issue #46). */
function applyFilter(root: HTMLElement, query: string) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (el: Element) => {
    const text = el.textContent?.toLowerCase() ?? "";
    return terms.every((t) => text.includes(t));
  };
  let visible = 0;
  for (const section of root.querySelectorAll<HTMLElement>(
    ".settings-section",
  )) {
    const fields = section.querySelectorAll<HTMLElement>(FIELD_SELECTOR);
    const head = [
      section.querySelector(".settings-section-title")?.textContent,
      section.querySelector(".settings-section-desc")?.textContent,
    ]
      .join(" ")
      .toLowerCase();
    const headMatches = terms.every((t) => head.includes(t));
    let shown = 0;
    for (const f of fields) {
      const show = terms.length === 0 || headMatches || matches(f);
      f.hidden = !show;
      if (show) shown++;
    }
    const sectionVisible =
      terms.length === 0 ||
      headMatches ||
      shown > 0 ||
      (fields.length === 0 && matches(section));
    section.hidden = !sectionVisible;
    if (sectionVisible) visible++;
  }
  return visible;
}

export function SettingsView({ rootPath }: Props) {
  const section = useSettingsSection();
  const [query, setQuery] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);
  const [noResults, setNoResults] = useState(false);
  const searching = query.trim().length > 0;

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-filter whenever the rendered section set or query changes
  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    setNoResults(applyFilter(el, searching ? query : "") === 0);
  }, [query, searching, section]);

  return (
    <div className="settings-view">
      <nav className="settings-nav" aria-label="Settings sections">
        <div className="settings-search">
          <Search
            size={13}
            strokeWidth={1.75}
            className="settings-search-icon"
          />
          <input
            type="search"
            className="settings-input"
            placeholder="Search settings…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {SETTINGS_SECTIONS.map((s) => (
          <button
            type="button"
            key={s.id}
            className={
              s.id === section && !searching
                ? "settings-nav-item settings-nav-item-active"
                : "settings-nav-item"
            }
            onClick={() => {
              setQuery("");
              settingsNav.set(s.id);
            }}
          >
            {s.label}
          </button>
        ))}
      </nav>
      <div className="settings-content" ref={contentRef}>
        {searching ? (
          <>
            {noResults && (
              <div className="settings-status">
                No settings match "{query}".
              </div>
            )}
            {SETTINGS_SECTIONS.map((s) => (
              <div key={s.id} className="settings-group" data-section={s.id}>
                <div className="settings-group-title">{s.label}</div>
                <SectionBody id={s.id} rootPath={rootPath} />
              </div>
            ))}
          </>
        ) : (
          <SectionBody id={section} rootPath={rootPath} />
        )}
      </div>
    </div>
  );
}
