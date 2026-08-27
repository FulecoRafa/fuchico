/** MIME type carrying dragged vault path(s), newline-separated. Set by the
 * explorer rows so drop targets outside the tree (the editor) can tell a note
 * drag from OS files (issue #44). */
export const PATH_DRAG_TYPE = "application/x-fuchico-paths";

export function readDraggedPaths(dt: DataTransfer | null): string[] {
  const raw = dt?.getData(PATH_DRAG_TYPE);
  return raw ? raw.split("\n").filter(Boolean) : [];
}

/** True when the drag carries files from the OS (Finder/Explorer). */
export function hasExternalFiles(dt: DataTransfer | null): boolean {
  if (!dt) return false;
  if (Array.from(dt.types).includes(PATH_DRAG_TYPE)) return false;
  return Array.from(dt.types).includes("Files");
}
