import type { DocStats } from "@/modules/editor/lib/docStats";

type Props = {
  stats: DocStats;
};

/** Bottom-of-editor status bar. Currently shows live word count and an
 * estimated reading time for the active document; a natural spot to grow
 * more indicators (cursor position, encoding, etc.) later. */
export function StatusBar({ stats }: Props) {
  return (
    <div className="status-bar">
      <span className="status-bar-item">
        {stats.words} {stats.words === 1 ? "word" : "words"}
      </span>
      <span className="status-bar-sep" aria-hidden="true">
        ·
      </span>
      <span className="status-bar-item">
        {stats.words === 0 ? "0 min read" : `${stats.readingTimeMin} min read`}
      </span>
    </div>
  );
}
