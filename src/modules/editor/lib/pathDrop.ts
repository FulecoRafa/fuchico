import { PATH_DRAG_TYPE, readDraggedPaths } from "@/lib/dragTypes";
import { EditorSelection, Prec } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { relativePath } from "./imageAttachments";

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|bmp)$/i;

function dirname(p: string): string {
  const i = p.lastIndexOf("/");
  return i <= 0 ? "/" : p.slice(0, i);
}

/** Markdown to insert for a vault file dragged from the explorer into the
 * note at `currentPath` (issue #44 item 5): notes become `[[wikilinks]]`,
 * images embed, anything else becomes a relative link. */
export function linkForDroppedPath(path: string, currentPath: string): string {
  const name = path.slice(path.lastIndexOf("/") + 1);
  if (/\.md$/i.test(name)) return `[[${name.replace(/\.md$/i, "")}]]`;
  const rel = relativePath(dirname(currentPath), path);
  const label = name.replace(/\.[^.]+$/, "");
  return IMAGE_EXT.test(name) ? `![${label}](${rel})` : `[${label}](${rel})`;
}

export function pathDropExtension(opts: { currentPath: string }) {
  return Prec.high(
    EditorView.domEventHandlers({
      dragover(event) {
        const dt = event.dataTransfer;
        if (!dt || !Array.from(dt.types).includes(PATH_DRAG_TYPE)) return false;
        event.preventDefault();
        dt.dropEffect = "copy";
        return true;
      },
      drop(event, view) {
        const paths = readDraggedPaths(event.dataTransfer);
        if (paths.length === 0) return false;
        event.preventDefault();
        const pos =
          view.posAtCoords({ x: event.clientX, y: event.clientY }) ??
          view.state.selection.main.head;
        const links = paths
          .map((p) => linkForDroppedPath(p, opts.currentPath))
          .join("\n");
        // Separate from adjacent text so `foo[[bar]]` doesn't glue together.
        const before = pos > 0 ? view.state.doc.sliceString(pos - 1, pos) : "";
        const insert = before && !/\s/.test(before) ? ` ${links}` : links;
        view.dispatch({
          changes: { from: pos, insert },
          selection: EditorSelection.cursor(pos + insert.length),
        });
        view.focus();
        return true;
      },
    }),
  );
}
