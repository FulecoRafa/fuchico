import { Search } from "lucide-react";
import { useState } from "react";
import { type SearchMatch, useSearch } from "./lib/useSearch";

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

function SearchRow({
  match,
  query,
  onOpen,
}: {
  match: SearchMatch;
  query: string;
  onOpen: (match: SearchMatch) => void;
}) {
  return (
    <button type="button" className="search-row" onClick={() => onOpen(match)}>
      <div className="search-row-text">{highlight(match.text, query)}</div>
      <div className="search-row-meta" title={match.file}>
        {basename(match.file)}:{match.line}
      </div>
    </button>
  );
}

export function SearchPanel({ rootPath, onOpenMatch }: Props) {
  const [query, setQuery] = useState("");
  const state = useSearch(rootPath, query);

  if (!rootPath) {
    return <div className="search-empty">Open a folder to search</div>;
  }

  return (
    <div className="search-view">
      <div className="search-input-row">
        <Search size={14} strokeWidth={1.75} className="search-input-icon" />
        <input
          type="text"
          className="search-input"
          placeholder="Search files…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="search-results">
        {state.status === "loading" && (
          <div className="search-status">Searching…</div>
        )}
        {state.status === "error" && (
          <div className="search-status search-status-error">
            {state.message}
          </div>
        )}
        {state.status === "idle" && query.trim().length === 0 && (
          <div className="search-status">Type to search across files.</div>
        )}
        {state.status === "loaded" && state.matches.length === 0 && (
          <div className="search-status">No matches.</div>
        )}
        {state.status === "loaded" &&
          state.matches.map((match) => (
            <SearchRow
              key={`${match.file}:${match.line}:${match.column}`}
              match={match}
              query={query}
              onOpen={(m) => onOpenMatch(m.file, m.line)}
            />
          ))}
      </div>
    </div>
  );
}
