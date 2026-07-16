import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { CalendarClock, Files, FolderOpen } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AgendaView } from "@/modules/agenda";
import { EditorPane } from "@/modules/editor";
import { FileExplorer } from "@/modules/explorer";
import { TabBar, useTabs } from "@/modules/tabs";

const LAST_ROOT_KEY = "helix.lastRootPath";

type MainView = "editor" | "agenda";

function App() {
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
          {mainView === "agenda" ? (
            <AgendaView rootPath={rootPath} onOpenItem={openFile} />
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
                <EditorPane
                  key={activeTab.path}
                  path={activeTab.path}
                  focusLine={activeTab.focusLine}
                  focusToken={activeTab.focusToken}
                  onDirtyChange={(dirty) => setDirty(activeTab.path, dirty)}
                  onClose={() => closeTab(activeTab.path)}
                />
              ) : (
                <div className="editor-status">No file open</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
