import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useState } from "react";

export type SyncReport = {
  folder: string;
  pushedNew: number;
  pushedUpdated: number;
  pulledUpdated: number;
  pulledNew: number;
  pendingDeletes: number;
  confirmedDeletesRemote: number;
  deletedOnServer: number;
  touchedFiles: string[];
  errors: string[];
};

export type FolderSyncStatus = {
  folderPath: string;
  calendarDisplayName: string;
  lastSyncedAt: string | null;
  taskCount: number;
  pendingDeletes: number;
};

/** Drives "Sync Now" and the per-folder status table. Also refreshes status
 * whenever a `caldav:sync-complete` fires -- covers the periodic/on-save
 * sync triggers (Phase 7) updating the same status this view reads. */
export function useCalDavSync() {
  const [status, setStatus] = useState<FolderSyncStatus[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [lastReports, setLastReports] = useState<SyncReport[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const s = await invoke<FolderSyncStatus[]>("caldav_get_sync_status");
      setStatus(s);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    const unlisten = listen("caldav:sync-complete", () => {
      void refreshStatus();
    });
    return () => {
      void unlisten.then((stop) => stop());
    };
  }, [refreshStatus]);

  const syncNow = useCallback(async (folderPath?: string) => {
    setSyncing(true);
    setError(null);
    try {
      const reports = await invoke<SyncReport[]>("caldav_sync_now", {
        folderPath: folderPath ?? null,
      });
      setLastReports(reports);
      return reports;
    } catch (e) {
      setError(String(e));
      return null;
    } finally {
      setSyncing(false);
    }
  }, []);

  return { status, syncing, lastReports, error, syncNow, refreshStatus };
}
