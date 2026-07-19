import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";

export type FolderLink = {
  accountId: string;
  calendarHref: string;
  calendarDisplayName: string;
  folderPath: string;
};

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; links: FolderLink[] }
  | { status: "error"; message: string };

/** Folder<->calendar link CRUD against `caldav::commands`. Linking creates
 * the folder's `.fuchico-sync.json` sidecar on the Rust side if missing;
 * unlinking only drops the config entry, leaving the sidecar intact. */
export function useCalDavLinks() {
  const [state, setState] = useState<State>({ status: "idle" });

  const refresh = useCallback(async () => {
    setState((s) => (s.status === "loaded" ? s : { status: "loading" }));
    try {
      const links = await invoke<FolderLink[]>("caldav_list_links");
      setState({ status: "loaded", links });
    } catch (e) {
      setState({ status: "error", message: String(e) });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const linkFolder = useCallback(
    async (
      accountId: string,
      calendarHref: string,
      calendarDisplayName: string,
      folderPath: string,
    ) => {
      await invoke("caldav_link_folder", {
        accountId,
        calendarHref,
        calendarDisplayName,
        folderPath,
      });
      await refresh();
    },
    [refresh],
  );

  const unlinkFolder = useCallback(
    async (folderPath: string) => {
      await invoke("caldav_unlink_folder", { folderPath });
      await refresh();
    },
    [refresh],
  );

  return { state, refresh, linkFolder, unlinkFolder };
}
