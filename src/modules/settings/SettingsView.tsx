import { RefreshCw, Trash2 } from "lucide-react";
import { AccountForm } from "./AccountForm";
import { FolderLinkTable } from "./FolderLinkTable";
import { FoldingSection } from "./FoldingSection";
import { FontSection } from "./FontSection";
import { KeybindingSection } from "./KeybindingSection";
import { useCalDavAccounts } from "./lib/useCalDavAccounts";
import { useCalDavLinks } from "./lib/useCalDavLinks";
import { useCalDavSync } from "./lib/useCalDavSync";
import { ShortcutsSection } from "./ShortcutsSection";
import { ThemeSection } from "./ThemeSection";

type Props = {
  rootPath: string | null;
};

export function SettingsView({ rootPath }: Props) {
  const accounts = useCalDavAccounts();
  const links = useCalDavLinks();
  const sync = useCalDavSync();

  const accountList =
    accounts.state.status === "loaded" ? accounts.state.accounts : [];
  const lastReports = sync.lastReports;

  return (
    <div className="settings-view">
      <ThemeSection />

      <FontSection />

      <KeybindingSection />

      <ShortcutsSection />

      <FoldingSection />

      <div className="settings-section">
        <div className="settings-section-title">CalDAV Sync</div>
        <p className="settings-section-desc">
          Link folders to a CalDAV calendar (e.g. iCloud Reminders) so checkbox
          tasks in your notes sync to your phone and back.
        </p>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">Accounts</div>
        {accountList.length > 0 && (
          <div className="settings-account-list">
            {accountList.map((a) => (
              <div key={a.id} className="settings-account-row">
                <span className="settings-account-row-user">{a.username}</span>
                <span className="settings-account-row-server">
                  {a.serverUrl}
                </span>
                <button
                  type="button"
                  className="settings-icon-btn"
                  title="Remove account"
                  onClick={() => void accounts.removeAccount(a.id)}
                >
                  <Trash2 size={13} strokeWidth={1.75} />
                </button>
              </div>
            ))}
          </div>
        )}
        <AccountForm accounts={accounts} />
      </div>

      <div className="settings-section">
        <div className="settings-section-title">Linked Folders</div>
        <FolderLinkTable
          accounts={accounts}
          links={links}
          sync={sync}
          defaultFolderPath={rootPath}
        />
      </div>

      <div className="settings-section">
        <div className="settings-section-title">Sync</div>
        <div className="settings-actions">
          <button
            type="button"
            className="btn"
            disabled={sync.syncing}
            onClick={() => void sync.syncNow()}
          >
            <RefreshCw size={13} strokeWidth={1.75} />
            {sync.syncing ? "Syncing…" : "Sync Now"}
          </button>
        </div>
        {sync.error && (
          <div className="settings-status settings-status-error">
            {sync.error}
          </div>
        )}
        {lastReports && (
          <div className="settings-sync-log">
            {lastReports.map((r) => (
              <div key={r.folder} className="settings-sync-log-row">
                <span className="settings-sync-log-folder" title={r.folder}>
                  {r.folder.split(/[\\/]/).filter(Boolean).pop() ?? r.folder}
                </span>
                <span className="settings-sync-log-summary">
                  +{r.pushedNew} new, {r.pushedUpdated} pushed,{" "}
                  {r.pulledUpdated} pulled, {r.pulledNew} from server
                  {r.errors.length > 0 ? `, ${r.errors.length} error(s)` : ""}
                </span>
                {r.errors.map((err) => (
                  <div
                    key={err}
                    className="settings-status settings-status-error"
                  >
                    {err}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
