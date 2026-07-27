import { fuzzyMatch } from "@/modules/editor/lib/fuzzyMatch";
import { Command as CommandIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { HighlightedText } from "./lib/HighlightedText";
import type { AppCommand } from "./lib/commands";

type Props = {
  commands: AppCommand[];
  onClose: () => void;
};

type Ranked = { command: AppCommand; indices: number[]; score: number };

export function CommandPalette({ commands, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results: Ranked[] = useMemo(() => {
    const q = query.trim();
    if (!q) {
      return commands.map((command) => ({ command, indices: [], score: 0 }));
    }
    const ranked: Ranked[] = [];
    for (const command of commands) {
      const titleMatch = fuzzyMatch(q, command.title);
      if (titleMatch.matched) {
        ranked.push({
          command,
          indices: titleMatch.indices,
          score: titleMatch.score + 1, // slight bump: title hits beat keyword-only hits
        });
        continue;
      }
      const keywordMatch = (command.keywords ?? []).find(
        (kw) => fuzzyMatch(q, kw).matched,
      );
      if (keywordMatch) {
        ranked.push({ command, indices: [], score: 0 });
      }
    }
    ranked.sort((a, b) => b.score - a.score);
    return ranked;
  }, [commands, query]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset selection whenever the filtered result set changes
  useEffect(() => {
    setActiveIndex(0);
  }, [results]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const run = (command: AppCommand) => {
    onClose();
    command.run();
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
          placeholder="Run a command…"
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
              if (r) run(r.command);
            }
          }}
        />
        <div className="palette-overlay-list">
          {results.length === 0 && (
            <div className="palette-overlay-empty">No matching commands</div>
          )}
          {results.map((r, i) => (
            <button
              key={r.command.id}
              type="button"
              className={`palette-overlay-item${i === activeIndex ? " palette-overlay-item-active" : ""}`}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => run(r.command)}
            >
              <CommandIcon
                size={13}
                strokeWidth={1.75}
                className="palette-overlay-icon"
              />
              <HighlightedText
                className="palette-overlay-text"
                text={r.command.title}
                indices={r.indices}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
