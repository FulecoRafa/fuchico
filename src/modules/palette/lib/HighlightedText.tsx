/** Renders `text` with the characters at `indices` wrapped in <mark>,
 * matching the highlight styling used by the editor's OutlineOverlay. */
export function HighlightedText({
  text,
  indices,
  className,
}: {
  text: string;
  indices: number[];
  className?: string;
}) {
  if (indices.length === 0) {
    return <span className={className}>{text}</span>;
  }
  const indexSet = new Set(indices);
  return (
    <span className={className}>
      {[...text].map((ch, i) =>
        indexSet.has(i) ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: text is static per render
          <mark key={i} className="palette-overlay-highlight">
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
