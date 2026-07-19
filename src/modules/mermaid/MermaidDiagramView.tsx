import { usePrefersDark } from "@/lib/usePrefersDark";
import { RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { renderMermaid } from "./lib/renderMermaid";
import type { MermaidBlockState } from "./lib/types";
import { usePanZoom } from "./lib/usePanZoom";

type Props = {
  state: MermaidBlockState;
};

export function MermaidDiagramView({ state }: Props) {
  const dark = usePrefersDark();
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const {
    containerRef,
    contentRef,
    reset,
    applyTransform,
    zoomIn,
    zoomOut,
    handlers,
  } = usePanZoom();
  const hasCenteredRef = useRef(false);
  const text = state.status === "ready" ? state.text : null;

  useEffect(() => {
    if (text === null) return;
    let cancelled = false;
    renderMermaid(text, dark ? "dark" : "light")
      .then(({ svg }) => {
        if (cancelled) return;
        setSvg(svg);
        setError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [text, dark]);

  useEffect(() => {
    if (!svg) return;
    if (!hasCenteredRef.current) {
      hasCenteredRef.current = true;
      reset();
    } else {
      // Re-assert the current pan/zoom onto the (possibly refreshed) content
      // node after a live-edit re-render, rather than assuming it survived
      // untouched -- keeps the view from jumping back to start on edits.
      applyTransform();
    }
  }, [svg, reset, applyTransform]);

  return (
    <div className="mermaid-view">
      <div className="mermaid-toolbar">
        <button type="button" onClick={zoomOut} title="Zoom out">
          <ZoomOut size={14} strokeWidth={1.75} />
        </button>
        <button type="button" onClick={zoomIn} title="Zoom in">
          <ZoomIn size={14} strokeWidth={1.75} />
        </button>
        <button type="button" onClick={reset} title="Reset view">
          <RotateCcw size={14} strokeWidth={1.75} />
        </button>
      </div>
      {state.status === "loading" && svg === null && (
        <div className="mermaid-banner">Loading…</div>
      )}
      {state.status === "removed" && (
        <div className="mermaid-banner">Source block no longer available</div>
      )}
      {error && (
        <div className="mermaid-banner mermaid-banner-error">{error}</div>
      )}
      <div
        ref={containerRef}
        className="mermaid-canvas"
        onPointerDown={handlers.onPointerDown}
        onPointerMove={handlers.onPointerMove}
        onPointerUp={handlers.onPointerUp}
      >
        <div
          ref={contentRef}
          className="mermaid-canvas-content"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: mermaid.render's SVG output, sanitized via securityLevel: "strict"
          dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
        />
      </div>
    </div>
  );
}
