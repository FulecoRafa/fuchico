import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { usePrefersDark } from "@/lib/usePrefersDark";
import { useExcalidrawDocument } from "./lib/useExcalidrawDocument";

type Props = {
  path: string;
  onDirtyChange?: (dirty: boolean) => void;
};

export function ExcalidrawPane({ path, onDirtyChange }: Props) {
  const { doc, onChange, apiRef } = useExcalidrawDocument({
    path,
    onDirtyChange,
  });
  const dark = usePrefersDark();

  if (doc.status === "loading") {
    return <div className="editor-status">Loading…</div>;
  }
  if (doc.status === "error") {
    return (
      <div className="editor-status editor-status-error">{doc.message}</div>
    );
  }

  return (
    <div className="excalidraw-pane">
      <Excalidraw
        excalidrawAPI={(api) => {
          apiRef.current = api;
        }}
        initialData={doc.initialData}
        onChange={onChange}
        theme={dark ? "dark" : "light"}
      />
    </div>
  );
}
