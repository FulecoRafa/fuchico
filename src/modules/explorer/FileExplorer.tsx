import { ContextMenu, type ContextMenuItem } from "@/lib/ContextMenu";
import { hasExternalFiles, PATH_DRAG_TYPE } from "@/lib/dragTypes";
import {
  copyPathToClipboard,
  openWithExternalTool,
  revealInFileManager,
} from "@/lib/fileActions";
import { useEditorSettings } from "@/modules/settings/lib/editorSettings";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Copy,
  ExternalLink,
  Eye,
  FilePlus,
  FolderOpen,
  FolderPlus,
  Pencil,
  PenTool,
  RefreshCw,
  Scissors,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { externalFiles, importFiles } from "./lib/importFiles";
import { dirname, useFileTree } from "./lib/useFileTree";
import {
  EntryRow,
  PendingRow,
  type RowActions,
  type SelectModifiers,
  StatusRow,
} from "./TreeRow";

type Props = {
  rootPath: string | null;
  activeFilePath?: string | null;
  onOpenFile: (path: string) => void;
  onOpenFolder: () => void;
  onPathRenamed?: (from: string, to: string) => void;
  onPathDeleted?: (path: string) => void;
};

type MenuState = { x: number; y: number; path: string; isDir: boolean } | null;

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
const TYPE_AHEAD_RESET_MS = 700;
/** Hovering a collapsed folder while dragging expands it after this long. */
const DROP_EXPAND_MS = 600;
const NOTICE_MS = 4000;

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
  onPathRenamed,
  onPathDeleted,
}: Props) {
  const treeOptions = useMemo(
    () => ({ onPathRenamed, onPathDeleted }),
    [onPathRenamed, onPathDeleted],
  );
  const tree = useFileTree(rootPath, treeOptions);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [menu, setMenu] = useState<MenuState>(null);
  const externalTool = useEditorSettings().settings.externalTool;
  // Multi-select (issue #44): `selectedPath` is the focused row (keyboard
  // anchor for arrows), `selectedPaths` the full set an action applies to.
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(
    () => new Set(),
  );
  const anchorRef = useRef<string | null>(null);
  const [dragPaths, setDragPaths] = useState<string[]>([]);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [cutPaths, setCutPaths] = useState<string[]>([]);
  const [notice, setNotice] = useState<{
    text: string;
    tone: "muted" | "error";
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Type-ahead: printable keys typed in quick succession build a prefix that
  // jumps to the next entry whose name starts with it (issue #8).
  const typeAheadRef = useRef<{ buffer: string; at: number }>({
    buffer: "",
    at: 0,
  });

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
    setSelectedPaths((prev) => {
      if ([...prev].every((p) => entryIndexByPath.has(p))) return prev;
      return new Set([...prev].filter((p) => entryIndexByPath.has(p)));
    });
    setCutPaths((prev) =>
      prev.every((p) => entryIndexByPath.has(p))
        ? prev
        : prev.filter((p) => entryIndexByPath.has(p)),
    );
  }, [entryIndexByPath, selectedPath]);

  useEffect(() => {
    if (activeFilePath && entryIndexByPath.has(activeFilePath)) {
      setSelectedPath(activeFilePath);
      setSelectedPaths((prev) =>
        prev.size === 1 && prev.has(activeFilePath)
          ? prev
          : new Set([activeFilePath]),
      );
      anchorRef.current = activeFilePath;
    }
  }, [activeFilePath, entryIndexByPath]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(t);
  }, [notice]);

  const selectPath = useCallback(
    (path: string, mods?: SelectModifiers) => {
      setSelectedPath(path);
      if (mods?.shift && anchorRef.current) {
        const a = entryPaths.indexOf(anchorRef.current);
        const b = entryPaths.indexOf(path);
        if (a >= 0 && b >= 0) {
          setSelectedPaths(
            new Set(entryPaths.slice(Math.min(a, b), Math.max(a, b) + 1)),
          );
          return;
        }
      }
      anchorRef.current = path;
      if (mods?.toggle) {
        setSelectedPaths((prev) => {
          const next = new Set(prev);
          if (next.has(path) && next.size > 1) next.delete(path);
          else next.add(path);
          return next;
        });
        return;
      }
      setSelectedPaths(new Set([path]));
    },
    [entryPaths],
  );

  /** Paths an action on `path` applies to: the whole selection when the row
   * is part of it, otherwise just that row. */
  const targetsFor = useCallback(
    (path: string): string[] =>
      selectedPaths.has(path) ? [...selectedPaths] : [path],
    [selectedPaths],
  );

  const moveAll = useCallback(
    async (paths: string[], toDir: string) => {
      for (const p of paths) await tree.movePath(p, toDir);
    },
    [tree.movePath],
  );

  const deleteAll = useCallback(
    (paths: string[]) => {
      const label =
        paths.length === 1
          ? `"${basename(paths[0])}"`
          : `${paths.length} items`;
      if (!window.confirm(`Delete ${label}?`)) return;
      void (async () => {
        for (const p of paths) await tree.deletePath(p);
      })();
    },
    [tree.deletePath],
  );

  const pasteCutInto = useCallback(
    (toDir: string) => {
      if (cutPaths.length === 0) return;
      const movable = cutPaths.filter(
        (p) => dirname(p) !== toDir && !`${toDir}/`.startsWith(`${p}/`),
      );
      setCutPaths([]);
      void moveAll(movable, toDir);
    },
    [cutPaths, moveAll],
  );

  const runImport = useCallback(
    async (files: File[], toDir: string) => {
      const result = await importFiles(files, toDir);
      if (toDir !== rootPath && !tree.expanded.has(toDir)) tree.toggle(toDir);
      else tree.refresh(toDir);
      if (result.errors.length > 0) {
        setNotice({
          text: `Import failed: ${result.errors.join("; ")}`,
          tone: "error",
        });
      } else {
        setNotice({
          text: `Imported ${result.imported.length} file${result.imported.length === 1 ? "" : "s"} into ${basename(toDir)}`,
          tone: "muted",
        });
      }
    },
    [rootPath, tree.expanded, tree.refresh, tree.toggle],
  );

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

  const openContextMenu = useCallback(
    (path: string, e: React.MouseEvent) => {
      const idx = entryIndexByPath.get(path);
      const row = idx !== undefined ? rows[idx] : undefined;
      const isDir = row?.kind === "entry" ? row.isDir : false;
      setMenu({ x: e.clientX, y: e.clientY, path, isDir });
    },
    [entryIndexByPath, rows],
  );

  // Where a drag over this row would land: directories receive the drop
  // themselves, files stand in for their parent directory.
  const dropDirFor = useCallback(
    (path: string, isDir: boolean) => (isDir ? path : dirname(path)),
    [],
  );

  // OS file drags can always land (they copy in); tree drags must not land in
  // their own parent or inside themselves.
  const canDropInto = useCallback(
    (toDir: string, e: React.DragEvent) => {
      if (hasExternalFiles(e.dataTransfer)) return true;
      if (dragPaths.length === 0) return false;
      return dragPaths.every(
        (p) => toDir !== dirname(p) && !`${toDir}/`.startsWith(`${p}/`),
      );
    },
    [dragPaths],
  );

  const handleDragOverDir = useCallback(
    (toDir: string, e: React.DragEvent) => {
      if (!canDropInto(toDir, e)) return;
      e.preventDefault();
      // Rows sit inside the scroll area (a root drop target): stop here so
      // the container doesn't re-target the drop to the vault root.
      e.stopPropagation();
      e.dataTransfer.dropEffect = hasExternalFiles(e.dataTransfer)
        ? "copy"
        : "move";
      setDropTarget(toDir);
    },
    [canDropInto],
  );

  const handleDropDir = useCallback(
    (toDir: string, e: React.DragEvent) => {
      if (!canDropInto(toDir, e)) return;
      e.preventDefault();
      e.stopPropagation();
      const files = externalFiles(e.dataTransfer);
      if (files.length > 0) void runImport(files, toDir);
      else void moveAll(dragPaths, toDir);
      setDragPaths([]);
      setDropTarget(null);
    },
    [canDropInto, dragPaths, moveAll, runImport],
  );

  const handleDragOverPath = useCallback(
    (path: string, isDir: boolean, e: React.DragEvent) =>
      handleDragOverDir(dropDirFor(path, isDir), e),
    [dropDirFor, handleDragOverDir],
  );

  const handleDropPath = useCallback(
    (path: string, isDir: boolean, e: React.DragEvent) =>
      handleDropDir(dropDirFor(path, isDir), e),
    [dropDirFor, handleDropDir],
  );

  const handleDragStart = useCallback(
    (path: string, e: React.DragEvent) => {
      const paths = targetsFor(path);
      setDragPaths(paths);
      e.dataTransfer.setData(PATH_DRAG_TYPE, paths.join("\n"));
      // Drag image: just the name (or the count), not the whole row.
      const ghost = document.createElement("div");
      ghost.className = "tree-drag-ghost";
      ghost.textContent =
        paths.length > 1 ? `${paths.length} items` : basename(path);
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 8, 12);
      requestAnimationFrame(() => ghost.remove());
    },
    [targetsFor],
  );

  const handleDragEnd = useCallback(() => {
    setDragPaths([]);
    setDropTarget(null);
  }, []);

  // Spring-loaded folders: hovering a collapsed folder mid-drag opens it.
  useEffect(() => {
    if (!dropTarget || dropTarget === rootPath || tree.expanded.has(dropTarget))
      return;
    const t = setTimeout(() => tree.toggle(dropTarget), DROP_EXPAND_MS);
    return () => clearTimeout(t);
  }, [dropTarget, rootPath, tree.expanded, tree.toggle]);

  if (!rootPath) {
    return <div className="explorer-empty">No folder open</div>;
  }

  const menuItems: ContextMenuItem[] = menu
    ? [
        ...(menu.isDir
          ? ([
              {
                label: "New file",
                icon: FilePlus,
                onSelect: () => tree.beginCreate(menu.path, "file"),
              },
              {
                label: "New folder",
                icon: FolderPlus,
                onSelect: () => tree.beginCreate(menu.path, "dir"),
              },
              {
                label: "New drawing",
                icon: PenTool,
                onSelect: () =>
                  tree.beginCreate(menu.path, "file", {
                    defaultExt: "excalidraw",
                    placeholder: "New drawing",
                  }),
              },
              { kind: "separator" },
            ] satisfies ContextMenuItem[])
          : []),
        {
          label: "Rename",
          icon: Pencil,
          onSelect: () => tree.beginRename(menu.path),
        },
        {
          label:
            targetsFor(menu.path).length > 1
              ? `Cut ${targetsFor(menu.path).length} items`
              : "Cut",
          icon: Scissors,
          onSelect: () => setCutPaths(targetsFor(menu.path)),
        },
        ...(cutPaths.length > 0
          ? ([
              {
                label: `Paste ${cutPaths.length === 1 ? basename(cutPaths[0]) : `${cutPaths.length} items`} here`,
                icon: Copy,
                onSelect: () => pasteCutInto(dropDirFor(menu.path, menu.isDir)),
              },
            ] satisfies ContextMenuItem[])
          : []),
        { kind: "separator" },
        {
          label: "Reveal in file manager",
          icon: Eye,
          onSelect: () => void revealInFileManager(menu.path),
        },
        {
          label: externalTool.trim()
            ? `Open with ${externalTool.trim()}`
            : "Open with default app",
          icon: ExternalLink,
          onSelect: () => void openWithExternalTool(menu.path, externalTool),
        },
        {
          label:
            targetsFor(menu.path).length > 1
              ? `Copy ${targetsFor(menu.path).length} paths`
              : "Copy path",
          icon: Copy,
          onSelect: () =>
            void copyPathToClipboard(targetsFor(menu.path).join("\n")),
        },
        { kind: "separator" },
        {
          label:
            targetsFor(menu.path).length > 1
              ? `Delete ${targetsFor(menu.path).length} items`
              : "Delete",
          icon: Trash2,
          danger: true,
          onSelect: () => deleteAll(targetsFor(menu.path)),
        },
      ]
    : [];

  const root = tree.nodes[rootPath];
  const pendingAtRoot =
    tree.pendingCreate?.parentPath === rootPath ? tree.pendingCreate : null;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (tree.renaming || tree.pendingCreate) return;
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.isContentEditable) return;
    if (entryPaths.length === 0) return;

    const currentIdx = selectedPath ? entryPaths.indexOf(selectedPath) : -1;
    const move = (next: number, extend = false) => {
      const clamped = Math.max(0, Math.min(entryPaths.length - 1, next));
      const path = entryPaths[clamped];
      selectPath(path, { shift: extend, toggle: false });
      requestAnimationFrame(() => scrollEntryIntoView(path));
    };

    // Cmd/Ctrl-X cuts the selection, Cmd/Ctrl-V moves it into the focused
    // folder (or the focused file's folder) — issue #44 item 7.
    if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey) {
      if (e.key === "x" && currentIdx >= 0) {
        e.preventDefault();
        setCutPaths(targetsFor(entryPaths[currentIdx]));
        return;
      }
      if (e.key === "v" && cutPaths.length > 0) {
        e.preventDefault();
        const target = currentIdx >= 0 ? entryPaths[currentIdx] : rootPath;
        const idx = entryIndexByPath.get(target);
        const row = idx !== undefined ? rows[idx] : undefined;
        const isDir = row?.kind === "entry" ? row.isDir : true;
        pasteCutInto(dropDirFor(target, isDir));
        return;
      }
      if (e.key === "a") {
        e.preventDefault();
        setSelectedPaths(new Set(entryPaths));
        if (currentIdx < 0) setSelectedPath(entryPaths[0]);
        return;
      }
    }
    if (e.key === "Escape" && cutPaths.length > 0) {
      e.preventDefault();
      setCutPaths([]);
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        move(currentIdx < 0 ? 0 : currentIdx + 1, e.shiftKey);
        break;
      case "ArrowUp":
        e.preventDefault();
        move(
          currentIdx < 0 ? entryPaths.length - 1 : currentIdx - 1,
          e.shiftKey,
        );
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
        deleteAll(targetsFor(entryPaths[currentIdx]));
        break;
      }
      case "F2": {
        if (currentIdx < 0) return;
        e.preventDefault();
        tree.beginRename(entryPaths[currentIdx]);
        break;
      }
      default: {
        if (e.key.length !== 1 || e.metaKey || e.ctrlKey || e.altKey) return;
        e.preventDefault();
        const now = Date.now();
        const ta = typeAheadRef.current;
        const buffer =
          now - ta.at < TYPE_AHEAD_RESET_MS
            ? ta.buffer + e.key.toLowerCase()
            : e.key.toLowerCase();
        typeAheadRef.current = { buffer, at: now };
        // Repeating the same letter cycles through entries starting with it.
        const cycling =
          buffer.length > 1 && buffer === buffer[0].repeat(buffer.length);
        const prefix = cycling ? buffer[0] : buffer;
        const start =
          cycling || buffer.length === 1 ? currentIdx + 1 : currentIdx;
        const n = entryPaths.length;
        for (let step = 0; step < n; step++) {
          const idx = (Math.max(0, start) + step) % n;
          if (basename(entryPaths[idx]).toLowerCase().startsWith(prefix)) {
            move(idx);
            break;
          }
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
            isSelected={selectedPaths.has(row.path)}
            isRenaming={row.kind === "rename"}
            isDropTarget={dropTarget === row.path && row.isDir}
            isCut={cutPaths.includes(row.path)}
            onOpenFile={onOpenFile}
            onSelectPath={selectPath}
            onContextMenu={openContextMenu}
            onDragStartPath={handleDragStart}
            onDragOverPath={handleDragOverPath}
            onDropPath={handleDropPath}
            onDragEnd={handleDragEnd}
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
      {/* biome-ignore lint/a11y/noStaticElementInteractions: the header doubles as the "move to vault root" drop target (issue #44 item 3) */}
      <div
        className={`explorer-header${dropTarget === rootPath ? " explorer-header-drop-target" : ""}`}
        onDragOver={(e) => handleDragOverDir(rootPath, e)}
        onDrop={(e) => handleDropDir(rootPath, e)}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setDropTarget(null);
        }}
      >
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

      {/* biome-ignore lint/a11y/noStaticElementInteractions: drag-and-drop fallback target only; keyboard equivalents live on the tree rows */}
      <div
        ref={scrollRef}
        className="explorer-scroll"
        // Fallback target: empty space below the tree moves into the root.
        onDragOver={(e) => handleDragOverDir(rootPath, e)}
        onDrop={(e) => handleDropDir(rootPath, e)}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setDropTarget(null);
        }}
      >
        {notice ? (
          <div
            className={`explorer-notice${notice.tone === "error" ? " explorer-notice-error" : ""}`}
          >
            {notice.text}
          </div>
        ) : null}
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

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}
