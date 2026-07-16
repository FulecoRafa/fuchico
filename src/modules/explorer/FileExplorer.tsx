import { useVirtualizer } from "@tanstack/react-virtual";
import {
  FilePlus,
  FolderOpen,
  FolderPlus,
  PenTool,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EntryRow, PendingRow, type RowActions, StatusRow } from "./TreeRow";
import { useFileTree } from "./lib/useFileTree";

type Props = {
  rootPath: string | null;
  activeFilePath?: string | null;
  onOpenFile: (path: string) => void;
  onOpenFolder: () => void;
};

type Row =
  | {
      kind: "entry";
      key: string;
      path: string;
      name: string;
      isDir: boolean;
      isExpanded: boolean;
      depth: number;
    }
  | {
      kind: "rename";
      key: string;
      path: string;
      name: string;
      isDir: boolean;
      depth: number;
    }
  | {
      kind: "pending";
      key: string;
      depth: number;
      pendingKind: "file" | "dir";
      placeholder?: string;
    }
  | {
      kind: "status";
      key: string;
      depth: number;
      tone: "muted" | "error";
      message: string;
    };

const ROW_HEIGHT = 24;
const OVERSCAN = 8;

function basename(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : path;
}

function buildRows(
  rootPath: string,
  tree: ReturnType<typeof useFileTree>,
): { rows: Row[]; entryIndexByPath: Map<string, number> } {
  const rows: Row[] = [];
  const entryIndexByPath = new Map<string, number>();

  const walk = (parent: string, depth: number) => {
    const node = tree.nodes[parent];
    if (node?.status !== "loaded") return;
    for (const entry of node.entries) {
      const path = tree.joinPath(parent, entry.name);
      const isDir = entry.kind === "dir";
      const expanded = isDir && tree.expanded.has(path);
      const isRenaming = tree.renaming === path;
      if (isRenaming) {
        rows.push({
          kind: "rename",
          key: `rename:${path}`,
          path,
          name: entry.name,
          isDir,
          depth,
        });
      } else {
        entryIndexByPath.set(path, rows.length);
        rows.push({
          kind: "entry",
          key: path,
          path,
          name: entry.name,
          isDir,
          isExpanded: expanded,
          depth,
        });
      }
      if (isDir && expanded) {
        const child = tree.nodes[path];
        if (tree.pendingCreate?.parentPath === path) {
          rows.push({
            kind: "pending",
            key: `pending:${path}`,
            depth: depth + 1,
            pendingKind: tree.pendingCreate.kind,
            placeholder: tree.pendingCreate.placeholder,
          });
        }
        if (child?.status === "loading") {
          rows.push({
            kind: "status",
            key: `loading:${path}`,
            depth: depth + 1,
            tone: "muted",
            message: "Loading…",
          });
        } else if (child?.status === "error") {
          rows.push({
            kind: "status",
            key: `error:${path}`,
            depth: depth + 1,
            tone: "error",
            message: child.message,
          });
        } else if (child?.status === "loaded") {
          walk(path, depth + 1);
        }
      }
    }
  };

  walk(rootPath, 0);
  return { rows, entryIndexByPath };
}

export function FileExplorer({
  rootPath,
  activeFilePath,
  onOpenFile,
  onOpenFolder,
}: Props) {
  const tree = useFileTree(rootPath);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `tree` changes identity every render; only these fields matter.
  const { rows, entryIndexByPath } = useMemo(() => {
    if (!rootPath)
      return { rows: [] as Row[], entryIndexByPath: new Map<string, number>() };
    return buildRows(rootPath, tree);
  }, [rootPath, tree.nodes, tree.expanded, tree.renaming, tree.pendingCreate]);

  const rowActions = useMemo<RowActions>(
    () => ({
      toggle: tree.toggle,
      beginRename: tree.beginRename,
      commitRename: tree.commitRename,
      cancelRename: tree.cancelRename,
      deletePath: tree.deletePath,
    }),
    [
      tree.toggle,
      tree.beginRename,
      tree.commitRename,
      tree.cancelRename,
      tree.deletePath,
    ],
  );
  const renameInProgress =
    tree.renaming !== null || tree.pendingCreate !== null;

  const entryPaths = useMemo<string[]>(() => {
    const out: string[] = [];
    for (const row of rows) if (row.kind === "entry") out.push(row.path);
    return out;
  }, [rows]);

  useEffect(() => {
    if (selectedPath && !entryIndexByPath.has(selectedPath)) {
      setSelectedPath(null);
    }
  }, [entryIndexByPath, selectedPath]);

  useEffect(() => {
    if (activeFilePath && entryIndexByPath.has(activeFilePath)) {
      setSelectedPath(activeFilePath);
    }
  }, [activeFilePath, entryIndexByPath]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
    getItemKey: (index) => rows[index]?.key ?? index,
  });

  const scrollEntryIntoView = useCallback(
    (path: string) => {
      const index = entryIndexByPath.get(path);
      if (index === undefined) return;
      virtualizer.scrollToIndex(index, { align: "auto" });
    },
    [entryIndexByPath, virtualizer],
  );

  if (!rootPath) {
    return <div className="explorer-empty">No folder open</div>;
  }

  const root = tree.nodes[rootPath];
  const pendingAtRoot =
    tree.pendingCreate?.parentPath === rootPath ? tree.pendingCreate : null;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (tree.renaming || tree.pendingCreate) return;
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.isContentEditable) return;
    if (entryPaths.length === 0) return;

    const currentIdx = selectedPath ? entryPaths.indexOf(selectedPath) : -1;
    const move = (next: number) => {
      const clamped = Math.max(0, Math.min(entryPaths.length - 1, next));
      const path = entryPaths[clamped];
      setSelectedPath(path);
      requestAnimationFrame(() => scrollEntryIntoView(path));
    };

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        move(currentIdx < 0 ? 0 : currentIdx + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        move(currentIdx < 0 ? entryPaths.length - 1 : currentIdx - 1);
        break;
      case "ArrowRight": {
        if (currentIdx < 0) return;
        e.preventDefault();
        const idx = entryIndexByPath.get(entryPaths[currentIdx]);
        const row = idx !== undefined ? rows[idx] : undefined;
        if (row?.kind !== "entry") break;
        if (row.isDir) {
          if (!row.isExpanded) tree.toggle(row.path);
          else move(currentIdx + 1);
        }
        break;
      }
      case "ArrowLeft": {
        if (currentIdx < 0) return;
        e.preventDefault();
        const idx = entryIndexByPath.get(entryPaths[currentIdx]);
        const row = idx !== undefined ? rows[idx] : undefined;
        if (row?.kind !== "entry") break;
        if (row.isDir && row.isExpanded) {
          tree.toggle(row.path);
        } else {
          const parent = row.path.slice(0, row.path.lastIndexOf("/"));
          if (parent && parent !== rootPath) setSelectedPath(parent);
        }
        break;
      }
      case "Enter": {
        if (currentIdx < 0) return;
        e.preventDefault();
        const idx = entryIndexByPath.get(entryPaths[currentIdx]);
        const row = idx !== undefined ? rows[idx] : undefined;
        if (row?.kind !== "entry") break;
        if (row.isDir) tree.toggle(row.path);
        else onOpenFile(row.path);
        break;
      }
      case "Delete":
      case "Backspace": {
        if (currentIdx < 0) return;
        e.preventDefault();
        const path = entryPaths[currentIdx];
        if (window.confirm(`Delete "${basename(path)}"?`)) {
          void tree.deletePath(path);
        }
        break;
      }
    }
  };

  const renderRow = (row: Row) => {
    switch (row.kind) {
      case "entry":
      case "rename":
        return (
          <EntryRow
            path={row.path}
            name={row.name}
            isDir={row.isDir}
            isExpanded={row.kind === "entry" ? row.isExpanded : false}
            depth={row.depth}
            actions={rowActions}
            renameInProgress={renameInProgress}
            isSelected={selectedPath === row.path}
            isRenaming={row.kind === "rename"}
            onOpenFile={onOpenFile}
            onSelectPath={setSelectedPath}
          />
        );
      case "pending":
        return (
          <PendingRow
            depth={row.depth}
            kind={row.pendingKind}
            placeholder={row.placeholder}
            onCommit={tree.commitCreate}
            onCancel={tree.cancelCreate}
          />
        );
      case "status":
        return (
          <StatusRow depth={row.depth} message={row.message} tone={row.tone} />
        );
    }
  };

  return (
    <div
      ref={containerRef}
      className="explorer"
      role="tree"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="explorer-header">
        <span className="explorer-title" title={rootPath}>
          {basename(rootPath)}
        </span>
        <button
          type="button"
          className="explorer-header-btn"
          title="Open folder…"
          onClick={onOpenFolder}
        >
          <FolderOpen size={14} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          className="explorer-header-btn"
          title="New file"
          onClick={() => tree.beginCreate(rootPath, "file")}
        >
          <FilePlus size={14} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          className="explorer-header-btn"
          title="New folder"
          onClick={() => tree.beginCreate(rootPath, "dir")}
        >
          <FolderPlus size={14} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          className="explorer-header-btn"
          title="New drawing"
          onClick={() =>
            tree.beginCreate(rootPath, "file", {
              defaultExt: "excalidraw",
              placeholder: "New drawing",
            })
          }
        >
          <PenTool size={14} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          className="explorer-header-btn"
          title="Refresh"
          onClick={() => tree.refresh(rootPath)}
        >
          <RefreshCw size={14} strokeWidth={1.75} />
        </button>
      </div>

      <div ref={scrollRef} className="explorer-scroll">
        {pendingAtRoot ? (
          <PendingRow
            depth={0}
            kind={pendingAtRoot.kind}
            placeholder={pendingAtRoot.placeholder}
            onCommit={tree.commitCreate}
            onCancel={tree.cancelCreate}
          />
        ) : null}
        {root?.status === "loading" && (
          <div className="explorer-status">Loading…</div>
        )}
        {root?.status === "error" && (
          <div className="explorer-status explorer-status-error">
            {root.message}
          </div>
        )}
        {root?.status === "loaded" ? (
          <div
            style={{
              height: virtualizer.getTotalSize(),
              position: "relative",
              width: "100%",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];
              if (!row) return null;
              return (
                <div
                  key={virtualRow.key}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: virtualRow.size,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {renderRow(row)}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
