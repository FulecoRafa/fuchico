import { AgendaView } from "@/modules/agenda";
import { EditorPane } from "@/modules/editor";
import { FileExplorer } from "@/modules/explorer";
import { SearchPanel } from "@/modules/search";
import { SettingsView } from "@/modules/settings";
import { useTheme } from "@/modules/settings/lib/useTheme";
import { TabBar, useTabs } from "@/modules/tabs";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import {
  CalendarClock,
  Files,
  FolderOpen,
  Search,
  Settings,
} from "lucide-react";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

// Excalidraw and mermaid both drag in a few MB of transitive deps -- code-split
// them so opening a folder without any drawings/diagrams stays lightweight.
const ExcalidrawPane = lazy(() =>
  import("@/modules/excalidraw").then((m) => ({ default: m.ExcalidrawPane })),
);
const MermaidPane = lazy(() =>
  import("@/modules/mermaid").then((m) => ({ default: m.MermaidPane })),
);

const LAST_ROOT_KEY = "helix.lastRootPath";
const MIN_DOCK_WIDTH = 240;
const MAX_DOCK_WIDTH = 800;
const DEFAULT_DOCK_WIDTH = 380;

type MainView = "editor" | "agenda" | "search" | "settings";

type MermaidDock = { blockKey: string; label: string; initialText?: string };

function App() {
  useTheme();
  const [rootPath, setRootPath] = useState<string | null>(null);
  const {
    tabs,
    activePath,
    setActivePath,
    openFile: openTab,
    closeTab,
    setDirty,
    closeAll,
  } = useTabs();
  const [restoring, setRestoring] = useState(true);
  const [mainView, setMainView] = useState<MainView>("editor");
  const [mermaidDock, setMermaidDock] = useState<MermaidDock | null>(null);
  const dockPanelRef = useRef<HTMLDivElement>(null);
  const dockWidthRef = useRef(DEFAULT_DOCK_WIDTH);
  const dockResizeRef = useRef<{
    pointerId: number;
    startX: number;
    startWidth: number;
  } | null>(null);

  const onDockResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      dockResizeRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startWidth: dockWidthRef.current,
      };
    },
    [],
  );
  const onDockResizePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dockResizeRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      const next = Math.min(
        MAX_DOCK_WIDTH,
        Math.max(MIN_DOCK_WIDTH, drag.startWidth - (e.clientX - drag.startX)),
      );
      dockWidthRef.current = next;
      if (dockPanelRef.current) dockPanelRef.current.style.width = `${next}px`;
    },
    [],
  );
  const onDockResizePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (dockResizeRef.current?.pointerId === e.pointerId) {
        dockResizeRef.current = null;
      }
    },
    [],
  );

  // Restore the last opened folder on launch, verifying it still exists
  // (moved/deleted vaults should fall back to the empty state, not a
  // broken explorer).
  useEffect(() => {
    const cached = localStorage.getItem(LAST_ROOT_KEY);
    if (!cached) {
      setRestoring(false);
      return;
    }
    let cancelled = false;
    void invoke("fs_stat", { path: cached })
      .then(() => {
        if (!cancelled) setRootPath(cached);
      })
      .catch(() => {
        localStorage.removeItem(LAST_ROOT_KEY);
      })
      .finally(() => {
        if (!cancelled) setRestoring(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleOpenFolder = useCallback(async () => {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === "string") {
      setRootPath(selected);
      closeAll();
      localStorage.setItem(LAST_ROOT_KEY, selected);
    }
  }, [closeAll]);

  const openFile = useCallback(
    (path: string, focusLine?: number) => {
      openTab(path, focusLine);
      setMainView("editor");
    },
    [openTab],
  );

  const openMermaid = useCallback(
    (payload: { blockKey: string; text: string }) => {
      setMermaidDock({
        blockKey: payload.blockKey,
        label: "Diagram",
        initialText: payload.text,
      });
    },
    [],
  );

  // A popped-out diagram window asking to be docked back as a side panel; it
  // closes itself once this fires, and MermaidPane self-requests the current
  // text since we don't have it here.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listen<{ blockKey: string; label: string }>(
      "mermaid:dock-request",
      ({ payload }) => {
        setMermaidDock({ blockKey: payload.blockKey, label: payload.label });
      },
    ).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, []);

  const activeTab = tabs.find((t) => t.path === activePath) ?? null;

  if (restoring) {
    return <div className="app-layout" />;
  }

  return (
    <div className="app-shell">
      <div className="app-activitybar">
        <button
          type="button"
          className={
            mainView === "editor"
              ? "app-activitybar-btn app-activitybar-btn-active"
              : "app-activitybar-btn"
          }
          title="Files"
          onClick={() => setMainView("editor")}
        >
          <Files size={17} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          className={
            mainView === "agenda"
              ? "app-activitybar-btn app-activitybar-btn-active"
              : "app-activitybar-btn"
          }
          title="Tasks & Calendar"
          onClick={() => setMainView("agenda")}
        >
          <CalendarClock size={17} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          className={
            mainView === "search"
              ? "app-activitybar-btn app-activitybar-btn-active"
              : "app-activitybar-btn"
          }
          title="Search"
          onClick={() => setMainView("search")}
        >
          <Search size={17} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          className={
            mainView === "settings"
              ? "app-activitybar-btn app-activitybar-btn-active"
              : "app-activitybar-btn"
          }
          title="Settings"
          onClick={() => setMainView("settings")}
        >
          <Settings size={17} strokeWidth={1.75} />
        </button>
      </div>
      <div className="app-layout">
        <div className="app-sidebar">
          {rootPath ? (
            <FileExplorer
              rootPath={rootPath}
              activeFilePath={activePath}
              onOpenFile={(path) => openFile(path)}
              onOpenFolder={() => void handleOpenFolder()}
            />
          ) : (
            <div className="app-sidebar-empty">
              <button
                type="button"
                className="btn"
                onClick={() => void handleOpenFolder()}
              >
                <FolderOpen size={14} strokeWidth={1.75} />
                Open Folder
              </button>
            </div>
          )}
        </div>
        <div className="app-main">
          <div className="app-main-content">
            {mainView === "agenda" ? (
              <AgendaView rootPath={rootPath} onOpenItem={openFile} />
            ) : mainView === "search" ? (
              <SearchPanel rootPath={rootPath} onOpenMatch={openFile} />
            ) : mainView === "settings" ? (
              <SettingsView rootPath={rootPath} />
            ) : (
              <div className="editor-area">
                {tabs.length > 0 && (
                  <TabBar
                    tabs={tabs}
                    activePath={activePath}
                    onSelect={setActivePath}
                    onClose={closeTab}
                  />
                )}
                {activeTab ? (
                  activeTab.path.toLowerCase().endsWith(".excalidraw") ? (
                    <Suspense
                      fallback={<div className="editor-status">Loading…</div>}
                    >
                      <ExcalidrawPane
                        key={activeTab.path}
                        path={activeTab.path}
                        onDirtyChange={(dirty) =>
                          setDirty(activeTab.path, dirty)
                        }
                      />
                    </Suspense>
                  ) : (
                    <EditorPane
                      key={activeTab.path}
                      path={activeTab.path}
                      focusLine={activeTab.focusLine}
                      focusToken={activeTab.focusToken}
                      onDirtyChange={(dirty) => setDirty(activeTab.path, dirty)}
                      onClose={() => closeTab(activeTab.path)}
                      onOpenMermaid={openMermaid}
                    />
                  )
                ) : (
                  <div className="editor-status">No file open</div>
                )}
              </div>
            )}
          </div>
          {mermaidDock && (
            <>
              <div
                className="mermaid-dock-resizer"
                onPointerDown={onDockResizePointerDown}
                onPointerMove={onDockResizePointerMove}
                onPointerUp={onDockResizePointerUp}
              />
              <div
                ref={dockPanelRef}
                className="mermaid-dock-panel"
                style={{ width: dockWidthRef.current }}
              >
                <Suspense
                  fallback={<div className="editor-status">Loading…</div>}
                >
                  <MermaidPane
                    key={mermaidDock.blockKey}
                    blockKey={mermaidDock.blockKey}
                    label={mermaidDock.label}
                    initialText={mermaidDock.initialText}
                    onClose={() => setMermaidDock(null)}
                  />
                </Suspense>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
