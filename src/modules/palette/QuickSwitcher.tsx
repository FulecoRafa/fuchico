import { useI18n } from "@/lib/i18n";
import { fuzzyMatch } from "@/modules/editor/lib/fuzzyMatch";
import { FileText } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { HighlightedText } from "./lib/HighlightedText";
import { useVaultFiles } from "./lib/useVaultFiles";

type Props = {
  rootPath: string | null;
  onOpenFile: (path: string) => void;
  onClose: () => void;
};

type Ranked = {
  path: string;
  relPath: string;
  indices: number[];
  score: number;
};

const MAX_RESULTS = 200;

function relativeTo(root: string, path: string): string {
  if (path === root) return path.split("/").pop() ?? path;
  const prefix = root.endsWith("/") ? root : `${root}/`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

export function QuickSwitcher({ rootPath, onOpenFile, onClose }: Props) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filesState = useVaultFiles(rootPath, true);

  const results: Ranked[] = useMemo(() => {
    if (filesState.status !== "loaded" || !rootPath) return [];
    const q = query.trim();
    const entries = filesState.files.map((path) => ({
      path,
      relPath: relativeTo(rootPath, path),
    }));
    if (!q) {
      return entries
        .slice(0, MAX_RESULTS)
        .map((e) => ({ ...e, indices: [], score: 0 }));
    }
    const ranked: Ranked[] = [];
    for (const e of entries) {
      const m = fuzzyMatch(q, e.relPath);
      if (m.matched) ranked.push({ ...e, indices: m.indices, score: m.score });
    }
    ranked.sort((a, b) => b.score - a.score);
    return ranked.slice(0, MAX_RESULTS);
  }, [filesState, query, rootPath]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset selection whenever the filtered result set changes
  useEffect(() => {
    setActiveIndex(0);
  }, [results]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const select = (path: string) => {
    onOpenFile(path);
    onClose();
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: click-outside-to-close backdrop; Escape is handled by the always-focused input below
    <div className="palette-overlay-backdrop" onMouseDown={onClose}>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: swallows clicks so they don't bubble to the backdrop's close handler */}
      <div className="palette-overlay" onMouseDown={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="palette-overlay-input"
          type="text"
          placeholder={t("palette.goToFile")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              onClose();
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIndex((i) => Math.min(i + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              const r = results[activeIndex];
              if (r) select(r.path);
            }
          }}
        />
        <div className="palette-overlay-list">
          {!rootPath && (
            <div className="palette-overlay-empty">
              {t("palette.openFolderFirst")}
            </div>
          )}
          {rootPath && filesState.status === "loading" && (
            <div className="palette-overlay-empty">
              {t("palette.scanningVault")}
            </div>
          )}
          {rootPath && filesState.status === "error" && (
            <div className="palette-overlay-empty">
              {t("palette.cantReadVault", { message: filesState.message })}
            </div>
          )}
          {rootPath &&
            filesState.status === "loaded" &&
            results.length === 0 && (
              <div className="palette-overlay-empty">
                {t("palette.noFilesFound")}
              </div>
            )}
          {results.map((r, i) => (
            <button
              key={r.path}
              type="button"
              className={`palette-overlay-item${i === activeIndex ? " palette-overlay-item-active" : ""}`}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => select(r.path)}
            >
              <FileText
                size={13}
                strokeWidth={1.75}
                className="palette-overlay-icon"
              />
              <HighlightedText
                className="palette-overlay-text"
                text={r.relPath}
                indices={r.indices}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
