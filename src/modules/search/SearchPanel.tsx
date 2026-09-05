import { ContextMenu } from "@/lib/ContextMenu";
import { fileRowMenuItems } from "@/lib/fileRowMenu";
import { useI18n } from "@/lib/i18n";
import { useContextMenu } from "@/lib/useContextMenu";
import { Replace, Search } from "lucide-react";
import { useMemo, useState } from "react";
import {
  type ReplaceResult,
  replaceInFiles,
  type SearchMatch,
  useSearch,
} from "./lib/useSearch";

type Props = {
  rootPath: string | null;
  onOpenMatch: (path: string, line: number) => void;
};

function basename(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : path;
}

function highlight(text: string, query: string) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="search-match-highlight">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

type FileGroup = { file: string; matches: SearchMatch[] };

function groupByFile(matches: SearchMatch[]): FileGroup[] {
  const groups = new Map<string, SearchMatch[]>();
  for (const m of matches) {
    const list = groups.get(m.file);
    if (list) list.push(m);
    else groups.set(m.file, [m]);
  }
  return [...groups].map(([file, ms]) => ({ file, matches: ms }));
}

export function SearchPanel({ rootPath, onOpenMatch }: Props) {
  const { t, tn } = useI18n();
  const [query, setQuery] = useState("");
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [replacement, setReplacement] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const state = useSearch(rootPath, query, refreshToken);
  const menu = useContextMenu<{ file: string; line: number }>();

  const groups = useMemo(
    () => (state.status === "loaded" ? groupByFile(state.matches) : []),
    [state],
  );
  const matchCount = state.status === "loaded" ? state.matches.length : 0;

  if (!rootPath) {
    return <div className="search-empty">{t("search.openFolderToSearch")}</div>;
  }

  const runReplace = async (files?: string[]) => {
    const scope = files
      ? t("search.scopeInFile", { file: basename(files[0]) })
      : t("search.scopeAcrossFiles", {
          files: tn(groups.length, "count.fileOne", "count.fileMany"),
        });
    if (
      !window.confirm(t("search.confirmReplace", { query, replacement, scope }))
    ) {
      return;
    }
    setBusy(true);
    try {
      const r: ReplaceResult = await replaceInFiles(
        rootPath,
        query,
        replacement,
        files,
      );
      setNotice(
        t("search.replaced", {
          occurrences: tn(
            r.replacements,
            "count.occurrenceOne",
            "count.occurrenceMany",
          ),
          files: tn(r.filesChanged, "count.fileOne", "count.fileMany"),
        }),
      );
      setRefreshToken((t) => t + 1);
    } catch (e) {
      setNotice(t("search.replaceFailed", { error: String(e) }));
    } finally {
      setBusy(false);
    }
  };

  const canReplace = query.trim().length > 0 && matchCount > 0 && !busy;

  return (
    <div className="search-view">
      <div className="search-input-row">
        <Search size={14} strokeWidth={1.75} className="search-input-icon" />
        <input
          type="text"
          className="search-input"
          placeholder={t("search.placeholder")}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setNotice(null);
          }}
        />
        <button
          type="button"
          className={
            replaceOpen
              ? "search-replace-toggle search-replace-toggle-active"
              : "search-replace-toggle"
          }
          title={t("search.findReplaceTitle")}
          aria-pressed={replaceOpen}
          onClick={() => setReplaceOpen((v) => !v)}
        >
          <Replace size={14} strokeWidth={1.75} />
        </button>
      </div>
      {replaceOpen && (
        <div className="search-replace-row">
          <input
            type="text"
            className="search-input"
            placeholder={t("search.replaceWith")}
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canReplace) void runReplace();
            }}
          />
          <button
            type="button"
            className="search-replace-btn"
            disabled={!canReplace}
            onClick={() => void runReplace()}
          >
            {t("search.replaceAll")}
            {matchCount > 0 ? ` (${matchCount})` : ""}
          </button>
        </div>
      )}
      <div className="search-results">
        {notice && <div className="search-notice">{notice}</div>}
        {state.status === "loading" && (
          <div className="search-status">{t("search.searching")}</div>
        )}
        {state.status === "error" && (
          <div className="search-status search-status-error">
            {state.message}
          </div>
        )}
        {state.status === "idle" && query.trim().length === 0 && !notice && (
          <div className="search-status">{t("search.typeToSearch")}</div>
        )}
        {state.status === "loaded" && matchCount === 0 && (
          <div className="search-status">{t("search.noMatches")}</div>
        )}
        {groups.map((group) => (
          <div key={group.file} className="search-file-group">
            <button
              type="button"
              className="search-file-header"
              title={group.file}
              onClick={() => onOpenMatch(group.file, group.matches[0].line)}
              onContextMenu={(e) =>
                menu.open(e, { file: group.file, line: group.matches[0].line })
              }
            >
              <span className="search-file-name">{basename(group.file)}</span>
              <span className="search-file-count">{group.matches.length}</span>
            </button>
            {group.matches.map((match) => (
              <button
                type="button"
                key={`${match.line}:${match.column}`}
                className="search-row"
                onClick={() => onOpenMatch(match.file, match.line)}
                onContextMenu={(e) =>
                  menu.open(e, { file: match.file, line: match.line })
                }
              >
                <div className="search-row-text">
                  {highlight(match.text, query)}
                </div>
                <div className="search-row-meta">
                  {t("search.line", { n: match.line })}
                </div>
              </button>
            ))}
          </div>
        ))}
      </div>
      {menu.menu && (
        <ContextMenu
          x={menu.menu.x}
          y={menu.menu.y}
          items={fileRowMenuItems(menu.menu.data.file, {
            onOpen: (file) => onOpenMatch(file, menu.menu?.data.line ?? 1),
            extra: [
              {
                label: replaceOpen
                  ? t("search.replaceAllInFile", {
                      file: basename(menu.menu.data.file),
                    })
                  : t("search.replaceInThisFile"),
                icon: Replace,
                disabled: replaceOpen && !canReplace,
                onSelect: () => {
                  const file = menu.menu?.data.file;
                  if (!file) return;
                  if (!replaceOpen) {
                    setReplaceOpen(true);
                    return;
                  }
                  void runReplace([file]);
                },
              },
            ],
          })}
          onClose={menu.close}
        />
      )}
    </div>
  );
}
