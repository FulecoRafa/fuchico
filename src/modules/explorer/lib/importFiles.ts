import { timestamp, toBase64 } from "@/modules/editor/lib/imageAttachments";
import { invoke } from "@tauri-apps/api/core";
import { joinPath } from "./useFileTree";

export type ImportResult = { imported: string[]; errors: string[] };

/** Files dropped from the OS (the webview only sees `File` objects, so the
 * bytes travel over IPC via `fs_write_binary`; issue #44 item 4). */
export function externalFiles(dt: DataTransfer | null): File[] {
  if (!dt) return [];
  return Array.from(dt.files ?? []).filter((f) => f.name);
}

/** Copies each file into `toDir`. An existing name gets a timestamp suffix
 * instead of being overwritten. */
export async function importFiles(
  files: File[],
  toDir: string,
): Promise<ImportResult> {
  const out: ImportResult = { imported: [], errors: [] };
  for (const file of files) {
    try {
      const data = toBase64(await file.arrayBuffer());
      let path = joinPath(toDir, file.name);
      try {
        await invoke("fs_write_binary", { path, dataBase64: data });
      } catch (e) {
        if (!String(e).includes("already exists")) throw e;
        const dot = file.name.lastIndexOf(".");
        const unique =
          dot > 0
            ? `${file.name.slice(0, dot)}-${timestamp()}${file.name.slice(dot)}`
            : `${file.name}-${timestamp()}`;
        path = joinPath(toDir, unique);
        await invoke("fs_write_binary", { path, dataBase64: data });
      }
      out.imported.push(path);
    } catch (e) {
      out.errors.push(`${file.name}: ${String(e)}`);
    }
  }
  return out;
}
