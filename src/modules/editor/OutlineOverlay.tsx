import { EditorView } from "@codemirror/view";
import { Hash } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { fuzzyMatch } from "./lib/fuzzyMatch";
import { extractOutline, type OutlineHeader } from "./lib/outline";

type Props = {
  view: EditorView | null;
  onClose: () => void;
};

type Ranked = { header: OutlineHeader; indices: number[]; score: number };

export function OutlineOverlay({ view, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const headers = useMemo(() => (view ? extractOutline(view) : []), [view]);

  const results: Ranked[] = useMemo(() => {
    if (!query.trim()) {
      return headers.map((header) => ({ header, indices: [], score: 0 }));
    }
    const ranked: Ranked[] = [];
    for (const header of headers) {
      const m = fuzzyMatch(query, header.text);
      if (m.matched)
        ranked.push({ header, indices: m.indices, score: m.score });
    }
    ranked.sort((a, b) => b.score - a.score);
    return ranked;
  }, [headers, query]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset selection whenever the filtered result set changes
  useEffect(() => {
    setActiveIndex(0);
  }, [results]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const goTo = (header: OutlineHeader) => {
    if (!view) return;
    const line = view.state.doc.line(header.line);
    view.dispatch({
      selection: { anchor: line.from, head: line.to },
      effects: EditorView.scrollIntoView(line.from, { y: "center" }),
    });
    view.focus();
    onClose();
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: click-outside-to-close backdrop; Escape is handled by the always-focused input below
    <div className="outline-overlay-backdrop" onMouseDown={onClose}>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: swallows clicks so they don't bubble to the backdrop's close handler */}
      <div className="outline-overlay" onMouseDown={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="outline-overlay-input"
          type="text"
          placeholder="Go to header…"
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
              if (r) goTo(r.header);
            }
          }}
        />
        <div className="outline-overlay-list">
          {results.length === 0 && (
            <div className="outline-overlay-empty">No headers found</div>
          )}
          {results.map((r, i) => (
            <button
              key={r.header.from}
              type="button"
              className={`outline-overlay-item${i === activeIndex ? " outline-overlay-item-active" : ""}`}
              style={{ paddingLeft: `${10 + (r.header.level - 1) * 14}px` }}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => goTo(r.header)}
            >
              <Hash
                size={11}
                strokeWidth={2}
                className="outline-overlay-icon"
              />
              <HighlightedText text={r.header.text} indices={r.indices} />
              <span className="outline-overlay-line">L{r.header.line}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function HighlightedText({
  text,
  indices,
}: {
  text: string;
  indices: number[];
}) {
  if (indices.length === 0) {
    return <span className="outline-overlay-text">{text}</span>;
  }
  const indexSet = new Set(indices);
  return (
    <span className="outline-overlay-text">
      {[...text].map((ch, i) =>
        indexSet.has(i) ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: text is static per render
          <mark key={i} className="outline-overlay-highlight">
            {ch}
          </mark>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: text is static per render
          <span key={i}>{ch}</span>
        ),
      )}
    </span>
  );
}
