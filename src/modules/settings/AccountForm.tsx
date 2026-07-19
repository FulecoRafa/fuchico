import { openUrl } from "@tauri-apps/plugin-opener";
import { useState } from "react";
import type { useCalDavAccounts } from "./lib/useCalDavAccounts";

const APPLE_ICLOUD_URL = "https://caldav.icloud.com";
const APPLE_APP_PASSWORD_URL = "https://appleid.apple.com/account/manage";

type Props = {
  accounts: ReturnType<typeof useCalDavAccounts>;
};

type TestState =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "ok"; calendarHomeUrl: string }
  | { status: "error"; message: string };

export function AccountForm({ accounts }: Props) {
  const [serverUrl, setServerUrl] = useState(APPLE_ICLOUD_URL);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [test, setTest] = useState<TestState>({ status: "idle" });
  const [saving, setSaving] = useState(false);

  const canSubmit = serverUrl.trim() && username.trim() && password.trim();

  const handleTest = async () => {
    setTest({ status: "testing" });
    try {
      const info = await accounts.testConnection(
        serverUrl.trim(),
        username.trim(),
        password,
      );
      setTest({ status: "ok", calendarHomeUrl: info.calendarHomeUrl });
    } catch (e) {
      setTest({ status: "error", message: String(e) });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await accounts.saveAccount(serverUrl.trim(), username.trim(), password);
      setUsername("");
      setPassword("");
      setTest({ status: "idle" });
    } catch (e) {
      setTest({ status: "error", message: String(e) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-form">
      <div className="settings-field">
        <label className="settings-label" htmlFor="caldav-server-url">
          Server URL
        </label>
        <input
          id="caldav-server-url"
          type="text"
          className="settings-input"
          value={serverUrl}
          onChange={(e) => setServerUrl(e.target.value)}
        />
      </div>
      <div className="settings-field">
        <label className="settings-label" htmlFor="caldav-username">
          Username
        </label>
        <input
          id="caldav-username"
          type="text"
          className="settings-input"
          placeholder="you@icloud.com"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>
      <div className="settings-field">
        <label className="settings-label" htmlFor="caldav-password">
          Password
        </label>
        <input
          id="caldav-password"
          type="password"
          className="settings-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {serverUrl.includes("icloud.com") && (
        <div className="settings-hint">
          iCloud requires an app-specific password, not your Apple ID password.{" "}
          <button
            type="button"
            className="settings-link"
            onClick={() => void openUrl(APPLE_APP_PASSWORD_URL)}
          >
            Generate one at appleid.apple.com
          </button>
        </div>
      )}

      <div className="settings-actions">
        <button
          type="button"
          className="btn btn-secondary"
          disabled={!canSubmit || test.status === "testing"}
          onClick={() => void handleTest()}
        >
          {test.status === "testing" ? "Testing…" : "Test Connection"}
        </button>
        <button
          type="button"
          className="btn"
          disabled={!canSubmit || saving}
          onClick={() => void handleSave()}
        >
          {saving ? "Saving…" : "Save Account"}
        </button>
      </div>

      {test.status === "ok" && (
        <div className="settings-status settings-status-ok">
          Connected. Calendar home: {test.calendarHomeUrl}
        </div>
      )}
      {test.status === "error" && (
        <div className="settings-status settings-status-error">
          {test.message}
        </div>
      )}
    </div>
  );
}
