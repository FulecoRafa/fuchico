import { useI18n } from "@/lib/i18n";
import { fuzzyMatch } from "@/modules/editor/lib/fuzzyMatch";
import { formatBinding } from "@/modules/settings/lib/fixedShortcuts";
import { Command as CommandIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AppCommand } from "./lib/commands";
import { HighlightedText } from "./lib/HighlightedText";

type Props = {
  commands: AppCommand[];
  /** Pre-filled query, e.g. ":" when opened via `:` in Helix normal mode. */
  initialQuery?: string;
  /** Enables `:<line>` (e.g. ":42") to jump the active editor to a line. */
  onGoToLine?: (line: number) => void;
  onClose: () => void;
};

type Ranked = {
  command: AppCommand;
  indices: number[];
  score: number;
  /** The `:` alias this command matched on (shown as a row chip). */
  alias?: string;
};

export function CommandPalette({
  commands,
  initialQuery,
  onGoToLine,
  onClose,
}: Props) {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState(initialQuery ?? "");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `t` is a stable module-level function that reads the locale; `locale` stands in for it so results re-rank when the language changes
  const results: Ranked[] = useMemo(() => {
    const q = query.trim();
    if (!q) {
      return commands.map((command) => ({ command, indices: [], score: 0 }));
    }
    // Helix/vim-style command-line queries: `:q` matches aliases by prefix,
    // `:42` becomes a go-to-line entry, and the part after `:` still fuzzy
    // matches titles so `:close` works too.
    if (q.startsWith(":")) {
      const ranked: Ranked[] = [];
      const lineMatch = /^:(\d+)$/.exec(q);
      if (lineMatch && onGoToLine) {
        const line = Number(lineMatch[1]);
        ranked.push({
          command: {
            id: "go-to-line",
            title: t("command.goToLine", { n: line }),
            run: () => onGoToLine(line),
          },
          indices: [],
          score: 1000,
        });
      }
      const body = q.slice(1);
      for (const command of commands) {
        const alias = (command.aliases ?? []).find((a) => a.startsWith(q));
        if (alias) {
          ranked.push({
            command,
            indices: [],
            score: alias === q ? 200 : 100,
            alias,
          });
          continue;
        }
        if (!body) continue;
        const titleMatch = fuzzyMatch(body, command.title);
        if (titleMatch.matched) {
          ranked.push({
            command,
            indices: titleMatch.indices,
            score: titleMatch.score,
            alias: command.aliases?.[0],
          });
        }
      }
      ranked.sort((a, b) => b.score - a.score);
      return ranked;
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
      const extras = command.binding
        ? [command.binding.replace(/-/g, " "), formatBinding(command.binding)]
        : [];
      const keywordMatch = [...(command.keywords ?? []), ...extras].find(
        (kw) => fuzzyMatch(q, kw).matched,
      );
      if (keywordMatch) {
        ranked.push({ command, indices: [], score: 0 });
      }
    }
    ranked.sort((a, b) => b.score - a.score);
    return ranked;
  }, [commands, query, onGoToLine, locale]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset selection whenever the filtered result set changes
  useEffect(() => {
    setActiveIndex(0);
  }, [results]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    // Put the caret after any pre-filled ":" so typing appends to it.
    input.setSelectionRange(input.value.length, input.value.length);
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
          placeholder={t("palette.runCommand")}
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
            <div className="palette-overlay-empty">
              {t("palette.noMatchingCommands")}
            </div>
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
              {r.alias && (
                <span className="palette-overlay-alias">{r.alias}</span>
              )}
              {r.command.binding && (
                <kbd className="palette-overlay-keys">
                  {formatBinding(r.command.binding)}
                </kbd>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
