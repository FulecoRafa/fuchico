import { getCurrentWindow } from "@tauri-apps/api/window";
import { emit, listen } from "@tauri-apps/api/event";
import { PanelRightOpen } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MermaidDiagramView } from "./MermaidDiagramView";
import type { MermaidBlockState } from "./lib/types";

type Props = { blockKey: string; title: string };

/** Entry point rendered in a popped-out diagram window (see mermaidWindow.ts / main.tsx). */
export function MermaidWindowApp({ blockKey, title }: Props) {
  const [state, setState] = useState<MermaidBlockState>({ status: "loading" });
  // Docking hands the block back to the main window rather than truly
  // closing it -- skip the "mermaid:closed" GC signal in that case.
  const dockingRef = useRef(false);
  // React 18 StrictMode double-invokes effects in dev (mount -> cleanup ->
  // mount, synchronously). Emitting "mermaid:closed" straight from cleanup
  // made that spurious first pass permanently stop the source editor from
  // tracking this block. Deferring the emission by a tick lets the
  // immediate remount cancel it.
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    document.title = title;
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
    void emit("mermaid:request", { blockKey });
    return () => {
      unlisten?.();
      if (!dockingRef.current) {
        closeTimerRef.current = setTimeout(() => {
          void emit("mermaid:closed", { blockKey });
        }, 0);
      }
    };
  }, [blockKey, title]);

  return (
    <div className="mermaid-window">
      <div className="mermaid-window-header">
        <button
          type="button"
          className="mermaid-pane-btn"
          title="Dock back into main window"
          onClick={() => {
            dockingRef.current = true;
            void emit("mermaid:dock-request", { blockKey, label: title });
            void getCurrentWindow().close();
          }}
        >
          <PanelRightOpen size={14} strokeWidth={1.75} />
          Dock
        </button>
      </div>
      <MermaidDiagramView state={state} />
    </div>
  );
}
