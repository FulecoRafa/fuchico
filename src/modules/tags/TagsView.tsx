import { Hash } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { type TagEntry, useTagIndex } from "./lib/useTagIndex";

type Props = {
  rootPath: string | null;
  onOpenFile: (path: string) => void;
  /** Pre-selects a tag, e.g. when navigated here from a clicked `#tag`
   * pill in the editor. `token` bumps on every click so re-selecting the
   * same tag still re-applies the filter. */
  selectedTag?: string | null;
  selectedTagToken?: number;
};

function basename(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : path;
}

function TagChip({
  entry,
  active,
  onClick,
}: {
  entry: TagEntry;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={active ? "tags-chip tags-chip-active" : "tags-chip"}
      onClick={onClick}
    >
      <Hash size={11} strokeWidth={2} className="tags-chip-icon" />
      {entry.tag}
      <span className="tags-chip-count">{entry.count}</span>
    </button>
  );
}

export function TagsView({
  rootPath,
  onOpenFile,
  selectedTag,
  selectedTagToken,
}: Props) {
  const { state } = useTagIndex(rootPath);
  const [active, setActive] = useState<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: selectedTagToken is the re-trigger signal even when selectedTag repeats
  useEffect(() => {
    if (selectedTag) setActive(selectedTag);
  }, [selectedTag, selectedTagToken]);

  const entries = state.status === "loaded" ? state.entries : [];
  const activeEntry = useMemo(
    () => entries.find((e) => e.tag === active) ?? null,
    [entries, active],
  );

  if (!rootPath) {
    return <div className="tags-empty">Open a folder to see tags</div>;
  }

  return (
    <div className="tags-view">
      <div className="tags-list">
        {state.status === "loading" && (
          <div className="tags-status">Scanning…</div>
        )}
        {state.status === "error" && (
          <div className="tags-status tags-status-error">{state.message}</div>
        )}
        {state.status === "loaded" && entries.length === 0 && (
          <div className="tags-status">
            No tags yet. Use <code>#tag</code> in a note or a frontmatter{" "}
            <code>tags:</code> list.
          </div>
        )}
        {entries.map((entry) => (
          <TagChip
            key={entry.tag}
            entry={entry}
            active={entry.tag === active}
            onClick={() => setActive(entry.tag === active ? null : entry.tag)}
          />
        ))}
      </div>
      <div className="tags-files">
        {!activeEntry && (
          <div className="tags-status">Select a tag to see its notes.</div>
        )}
        {activeEntry?.files.map((file) => (
          <button
            type="button"
            key={file}
            className="tags-file-row"
            onClick={() => onOpenFile(file)}
          >
            <span className="tags-file-name">{basename(file)}</span>
            <span className="tags-file-path" title={file}>
              {file}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
