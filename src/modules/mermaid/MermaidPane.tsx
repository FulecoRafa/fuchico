import { emit, listen } from "@tauri-apps/api/event";
import { ExternalLink } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { openMermaidWindow } from "./lib/mermaidWindow";
import type { MermaidBlockState } from "./lib/types";
import { MermaidDiagramView } from "./MermaidDiagramView";

type Props = {
  blockKey: string;
  label: string;
  initialText?: string;
  onClose: () => void;
};

/** Docked tab rendering of a live mermaid diagram. See mermaidPreviewExtension.ts for the source-side half of the update protocol. */
export function MermaidPane({ blockKey, label, initialText, onClose }: Props) {
  const [state, setState] = useState<MermaidBlockState>(
    initialText !== undefined
      ? { status: "ready", text: initialText }
      : { status: "loading" },
  );
  // Popping out hands the same blockKey off to a new window rather than
  // closing it -- skip the usual "mermaid:closed" GC signal in that case.
  const poppingOutRef = useRef(false);
  // React 18 StrictMode double-invokes effects in dev (mount -> cleanup ->
  // mount, synchronously) to surface unsafe cleanups. Emitting
  // "mermaid:closed" straight from cleanup made that spurious first pass
  // permanently stop the source editor from tracking this block, so live
  // updates never arrived again -- only the initial snapshot rendered.
  // Deferring the emission by a tick lets the immediate remount cancel it.
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: initialText only seeds the first render, re-running on its change would refetch needlessly
  useEffect(() => {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    let unlisten: (() => void) | undefined;
    void listen<{ blockKey: string; text: string | null }>(
      "mermaid:update",
      ({ payload }) => {
        if (payload.blockKey !== blockKey) return;
        setState(
          payload.text === null
            ? { status: "removed" }
            : { status: "ready", text: payload.text },
        );
      },
    ).then((fn) => {
      unlisten = fn;
    });
    if (initialText === undefined) {
      void emit("mermaid:request", { blockKey });
    }
    return () => {
      unlisten?.();
      if (!poppingOutRef.current) {
        closeTimerRef.current = setTimeout(() => {
          void emit("mermaid:closed", { blockKey });
        }, 0);
      }
    };
  }, [blockKey]);

  return (
    <div className="mermaid-pane">
      <div className="mermaid-pane-header">
        <span className="mermaid-pane-title">{label}</span>
        <button
          type="button"
          className="mermaid-pane-btn"
          title="Open in new window"
          onClick={() => {
            poppingOutRef.current = true;
            openMermaidWindow(blockKey, label);
            onClose();
          }}
        >
          <ExternalLink size={14} strokeWidth={1.75} />
        </button>
      </div>
      <MermaidDiagramView state={state} />
    </div>
  );
}
