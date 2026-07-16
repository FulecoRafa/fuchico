import { ChevronRight, File, Folder, PenTool } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";

export type RowActions = {
  toggle: (path: string) => void;
  beginRename: (path: string) => void;
  commitRename: (newName: string) => void | Promise<void>;
  cancelRename: () => void;
  deletePath: (path: string) => void | Promise<void>;
};

function InlineInput({
  initial,
  placeholder,
  onCommit,
  onCancel,
}: {
  initial: string;
  placeholder?: string;
  onCommit: (name: string) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  return (
    <input
      ref={ref}
      className="tree-inline-input"
      value={value}
      placeholder={placeholder}
      onChange={(e) => setValue(e.currentTarget.value)}
      onBlur={() => onCommit(value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          void onCommit(value);
        } else if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
        e.stopPropagation();
      }}
    />
  );
}

export type EntryRowProps = {
  path: string;
  name: string;
  isDir: boolean;
  isExpanded: boolean;
  depth: number;
  actions: RowActions;
  renameInProgress: boolean;
  isSelected: boolean;
  isRenaming: boolean;
  onOpenFile: (path: string) => void;
  onSelectPath: (path: string) => void;
};

function EntryRowImpl(props: EntryRowProps) {
  const {
    path,
    name,
    isDir,
    isExpanded,
    depth,
    actions,
    renameInProgress,
    isSelected,
    isRenaming,
    onOpenFile,
    onSelectPath,
  } = props;

  const paddingLeft = 6 + depth * 12;
  const isExcalidraw = !isDir && name.toLowerCase().endsWith(".excalidraw");
  const icon = isDir ? (
    <Folder size={14} />
  ) : isExcalidraw ? (
    <PenTool size={14} />
  ) : (
    <File size={14} />
  );

  if (isRenaming) {
    return (
      <div className="tree-row" style={{ paddingLeft }}>
        <span className="tree-row-disclosure" />
        <span className="tree-row-icon">{icon}</span>
        <InlineInput
          initial={name}
          onCommit={actions.commitRename}
          onCancel={actions.cancelRename}
        />
      </div>
    );
  }

  const handleClick = () => {
    if (renameInProgress) return;
    onSelectPath(path);
    if (isDir) actions.toggle(path);
    else onOpenFile(path);
  };

  return (
    <button
      type="button"
      data-fs-path={path}
      onClick={handleClick}
      onDoubleClick={() => actions.beginRename(path)}
      className={`tree-row tree-row-button${isSelected ? " tree-row-selected" : ""}`}
      style={{ paddingLeft }}
      title={path}
    >
      <span
        className={`tree-row-disclosure${isExpanded ? " tree-row-disclosure-expanded" : ""}`}
      >
        {isDir && <ChevronRight size={12} strokeWidth={2.25} />}
      </span>
      <span className="tree-row-icon">{icon}</span>
      <span className="tree-row-name">{name}</span>
    </button>
  );
}

export const EntryRow = memo(EntryRowImpl);

export function PendingRow({
  depth,
  kind,
  placeholder,
  onCommit,
  onCancel,
}: {
  depth: number;
  kind: "file" | "dir";
  placeholder?: string;
  onCommit: (name: string) => void | Promise<void>;
  onCancel: () => void;
}) {
  return (
    <div className="tree-row" style={{ paddingLeft: 6 + depth * 12 }}>
      <span className="tree-row-disclosure" />
      <span className="tree-row-icon">
        {kind === "dir" ? <Folder size={14} /> : <File size={14} />}
      </span>
      <InlineInput
        initial=""
        placeholder={placeholder ?? (kind === "dir" ? "New folder" : "New file")}
        onCommit={onCommit}
        onCancel={onCancel}
      />
    </div>
  );
}

export function StatusRow({
  depth,
  message,
  tone,
}: {
  depth: number;
  message: string;
  tone: "muted" | "error";
}) {
  return (
    <div
      className={`tree-status-row${tone === "error" ? " tree-status-error" : ""}`}
      style={{ paddingLeft: 6 + depth * 12 + 18 }}
    >
      {message}
    </div>
  );
}
