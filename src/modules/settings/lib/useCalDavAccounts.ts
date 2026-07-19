import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";

export type Account = {
  id: string;
  serverUrl: string;
  username: string;
};

export type CalendarInfo = {
  href: string;
  displayName: string;
};

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; accounts: Account[] }
  | { status: "error"; message: string };

/** Account CRUD against `caldav::commands` -- passwords never round-trip
 * through this hook's state, only through the save/test calls that forward
 * them straight to the Rust command. */
export function useCalDavAccounts() {
  const [state, setState] = useState<State>({ status: "idle" });

  const refresh = useCallback(async () => {
    setState((s) => (s.status === "loaded" ? s : { status: "loading" }));
    try {
      const accounts = await invoke<Account[]>("caldav_list_accounts");
      setState({ status: "loaded", accounts });
    } catch (e) {
      setState({ status: "error", message: String(e) });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const testConnection = useCallback(
    (serverUrl: string, username: string, password: string) =>
      invoke<{ calendarHomeUrl: string }>("caldav_test_connection", {
        serverUrl,
        username,
        password,
      }),
    [],
  );

  const discoverCalendars = useCallback(
    (serverUrl: string, username: string, password: string) =>
      invoke<CalendarInfo[]>("caldav_discover_calendars", {
        serverUrl,
        username,
        password,
      }),
    [],
  );

  const discoverCalendarsForAccount = useCallback(
    (accountId: string) =>
      invoke<CalendarInfo[]>("caldav_discover_calendars_for_account", {
        accountId,
      }),
    [],
  );

  const saveAccount = useCallback(
    async (serverUrl: string, username: string, password: string) => {
      const id = await invoke<string>("caldav_save_account", {
        input: { serverUrl, username, password },
      });
      await refresh();
      return id;
    },
    [refresh],
  );

  const removeAccount = useCallback(
    async (accountId: string) => {
      await invoke("caldav_remove_account", { accountId });
      await refresh();
    },
    [refresh],
  );

  return {
    state,
    refresh,
    testConnection,
    discoverCalendars,
    discoverCalendarsForAccount,
    saveAccount,
    removeAccount,
  };
}
