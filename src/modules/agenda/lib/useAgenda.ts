import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useState } from "react";

export type ItemKind = "task" | "todo" | "event";

export type AgendaItem = {
  kind: ItemKind;
  checked: boolean;
  text: string;
  date: string | null;
  time: string | null;
  file: string;
  line: number;
  /** `daily` | `weekdays` | `weekends` | comma-separated weekday abbrevs. */
  recurrence: string | null;
  recurTime: string | null;
};

const WEEKDAY_ABBREVS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** Whether a recurrence rule (see `recurrence`) covers today's weekday. */
export function isRecurrenceDueOn(rule: string, date: Date): boolean {
  const day = date.getDay();
  if (rule === "daily") return true;
  if (rule === "weekdays") return day >= 1 && day <= 5;
  if (rule === "weekends") return day === 0 || day === 6;
  return rule
    .split(",")
    .map((s) => s.trim())
    .includes(WEEKDAY_ABBREVS[day]);
}

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; items: AgendaItem[] }
  | { status: "error"; message: string };

/**
 * Scans the open folder's Markdown files for task checkboxes, `TODO:`
 * lines, and `📅`-dated events (see `tasks_scan` in the Rust backend for
 * the exact syntax). Re-scans whenever a file is saved.
 */
export function useAgenda(rootPath: string | null) {
  const [state, setState] = useState<State>({ status: "idle" });

  const scan = useCallback(async (root: string) => {
    setState((s) => (s.status === "loaded" ? s : { status: "loading" }));
    try {
      const items = await invoke<AgendaItem[]>("tasks_scan", { root });
      setState({ status: "loaded", items });
    } catch (e) {
      setState({ status: "error", message: String(e) });
    }
  }, []);

  useEffect(() => {
    if (!rootPath) {
      setState({ status: "idle" });
      return;
    }
    void scan(rootPath);
  }, [rootPath, scan]);

  useEffect(() => {
    if (!rootPath) return;
    const unlisten = listen("fs:file-written", () => {
      void scan(rootPath);
    });
    return () => {
      void unlisten.then((stop) => stop());
    };
  }, [rootPath, scan]);

  const toggle = useCallback(
    async (item: AgendaItem) => {
      if (item.kind !== "task") return;
      try {
        await invoke("tasks_toggle", { path: item.file, line: item.line });
        if (rootPath) await scan(rootPath);
      } catch (e) {
        console.error("tasks_toggle failed:", e);
      }
    },
    [rootPath, scan],
  );

  return {
    state,
    refresh: useCallback(() => {
      if (rootPath) void scan(rootPath);
    }, [rootPath, scan]),
    toggle,
  };
}
