import { open } from "@tauri-apps/plugin-dialog";
import { FolderOpen, RefreshCw, Unlink } from "lucide-react";
import { useEffect, useState } from "react";
import type { CalendarInfo, useCalDavAccounts } from "./lib/useCalDavAccounts";
import type { useCalDavLinks } from "./lib/useCalDavLinks";
import type { FolderSyncStatus, useCalDavSync } from "./lib/useCalDavSync";

type Props = {
  accounts: ReturnType<typeof useCalDavAccounts>;
  links: ReturnType<typeof useCalDavLinks>;
  sync: ReturnType<typeof useCalDavSync>;
  defaultFolderPath: string | null;
};

function basename(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : path;
}

function statusFor(status: FolderSyncStatus[], folderPath: string) {
  return status.find((s) => s.folderPath === folderPath) ?? null;
}

export function FolderLinkTable({
  accounts,
  links,
  sync,
  defaultFolderPath,
}: Props) {
  const accountList =
    accounts.state.status === "loaded" ? accounts.state.accounts : [];
  const linkList = links.state.status === "loaded" ? links.state.links : [];

  const [selectedAccount, setSelectedAccount] = useState("");
  const [calendars, setCalendars] = useState<CalendarInfo[]>([]);
  const [selectedCalendar, setSelectedCalendar] = useState("");
  const [folderPath, setFolderPath] = useState<string | null>(
    defaultFolderPath,
  );
  const [loadingCalendars, setLoadingCalendars] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedAccount && accountList.length > 0) {
      setSelectedAccount(accountList[0].id);
    }
  }, [accountList, selectedAccount]);

  const handleDiscover = async () => {
    if (!selectedAccount) return;
    setLoadingCalendars(true);
    setError(null);
    try {
      const found = await accounts.discoverCalendarsForAccount(selectedAccount);
      setCalendars(found);
      setSelectedCalendar(found[0]?.href ?? "");
    } catch (e) {
      setError(String(e));
    } finally {
      setLoadingCalendars(false);
    }
  };

  const handlePickFolder = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === "string") setFolderPath(selected);
  };

  const handleLink = async () => {
    if (!selectedAccount || !selectedCalendar || !folderPath) return;
    const calendar = calendars.find((c) => c.href === selectedCalendar);
    setError(null);
    try {
      await links.linkFolder(
        selectedAccount,
        selectedCalendar,
        calendar?.displayName ?? selectedCalendar,
        folderPath,
      );
    } catch (e) {
      setError(String(e));
    }
  };

  if (accountList.length === 0) {
    return (
      <div className="settings-hint">
        Save an account above to link a folder.
      </div>
    );
  }

  return (
    <div className="settings-form">
      <div className="settings-field">
        <label className="settings-label" htmlFor="caldav-link-account">
          Account
        </label>
        <select
          id="caldav-link-account"
          className="settings-input"
          value={selectedAccount}
          onChange={(e) => {
            setSelectedAccount(e.target.value);
            setCalendars([]);
            setSelectedCalendar("");
          }}
        >
          {accountList.map((a) => (
            <option key={a.id} value={a.id}>
              {a.username} ({a.serverUrl})
            </option>
          ))}
        </select>
      </div>

      <div className="settings-actions">
        <button
          type="button"
          className="btn btn-secondary"
          disabled={!selectedAccount || loadingCalendars}
          onClick={() => void handleDiscover()}
        >
          <RefreshCw size={13} strokeWidth={1.75} />
          {loadingCalendars ? "Discovering…" : "Discover Calendars"}
        </button>
      </div>

      {calendars.length > 0 && (
        <div className="settings-field">
          <label className="settings-label" htmlFor="caldav-link-calendar">
            Calendar
          </label>
          <select
            id="caldav-link-calendar"
            className="settings-input"
            value={selectedCalendar}
            onChange={(e) => setSelectedCalendar(e.target.value)}
          >
            {calendars.map((c) => (
              <option key={c.href} value={c.href}>
                {c.displayName}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="settings-field">
        <span className="settings-label">Folder</span>
        <div className="settings-folder-picker">
          <span className="settings-folder-path" title={folderPath ?? ""}>
            {folderPath ?? "No folder selected"}
          </span>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void handlePickFolder()}
          >
            <FolderOpen size={13} strokeWidth={1.75} />
            Choose…
          </button>
        </div>
      </div>

      <div className="settings-actions">
        <button
          type="button"
          className="btn"
          disabled={!selectedAccount || !selectedCalendar || !folderPath}
          onClick={() => void handleLink()}
        >
          Link Folder
        </button>
      </div>

      {error && (
        <div className="settings-status settings-status-error">{error}</div>
      )}

      <div className="settings-links-table">
        {linkList.length === 0 && (
          <div className="settings-hint">No folders linked yet.</div>
        )}
        {linkList.map((link) => {
          const st = statusFor(sync.status, link.folderPath);
          return (
            <div key={link.folderPath} className="settings-link-row">
              <div className="settings-link-row-main">
                <div
                  className="settings-link-row-folder"
                  title={link.folderPath}
                >
                  {basename(link.folderPath)}
                </div>
                <div className="settings-link-row-calendar">
                  {link.calendarDisplayName}
                </div>
              </div>
              <div className="settings-link-row-meta">
                {st
                  ? `${st.taskCount} tasks${st.pendingDeletes ? `, ${st.pendingDeletes} pending delete` : ""}${
                      st.lastSyncedAt
                        ? ` · synced ${new Date(st.lastSyncedAt).toLocaleString()}`
                        : ""
                    }`
                  : "Never synced"}
              </div>
              <div className="settings-link-row-actions">
                <button
                  type="button"
                  className="settings-icon-btn"
                  title="Sync this folder now"
                  onClick={() => void sync.syncNow(link.folderPath)}
                >
                  <RefreshCw size={13} strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  className="settings-icon-btn"
                  title="Unlink folder"
                  onClick={() => void links.unlinkFolder(link.folderPath)}
                >
                  <Unlink size={13} strokeWidth={1.75} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
