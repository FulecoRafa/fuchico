import { EditorSelection } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { invoke } from "@tauri-apps/api/core";

/** Pasting or dropping an image into the editor saves it under the vault's
 * attachments folder and inserts a Markdown image reference (issue #2). */
export type ImageAttachmentOptions = {
  /** Absolute path of the file being edited. */
  currentPath: string;
  /** Absolute directory to save attachments into, or null when no vault is
   * open (the extension then does nothing and the event falls through). */
  getAttachmentsDir: () => string | null;
};

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/bmp": "bmp",
};

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

function sanitize(name: string): string {
  return name.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Picks the on-disk name: keep a meaningful original filename, but
 * generic clipboard names ("image.png", "Screenshot ….png") get a timestamp. */
function attachmentName(file: File): string {
  const ext = EXT_BY_MIME[file.type] ?? file.name.split(".").pop() ?? "png";
  const base = sanitize(file.name.replace(/\.[^.]+$/, ""));
  const generic = !base || /^(image|screenshot|pasted|clipboard)/i.test(base);
  return generic ? `pasted-${timestamp()}.${ext}` : `${base}.${ext}`;
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

function dirname(p: string): string {
  const i = p.lastIndexOf("/");
  return i <= 0 ? "/" : p.slice(0, i);
}

/** Relative path from `fromDir` to `toPath`, POSIX-style, for the link. */
export function relativePath(fromDir: string, toPath: string): string {
  const a = fromDir.split("/").filter(Boolean);
  const b = toPath.split("/").filter(Boolean);
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const up = a.slice(i).map(() => "..");
  return [...up, ...b.slice(i)].join("/");
}

async function saveImage(
  file: File,
  dir: string,
): Promise<{ path: string; name: string }> {
  const name = attachmentName(file);
  const data = toBase64(await file.arrayBuffer());
  let path = `${dir}/${name}`;
  try {
    await invoke("fs_write_binary", { path, dataBase64: data });
  } catch (e) {
    if (!String(e).includes("already exists")) throw e;
    // Same name already there (e.g. re-pasting a screenshot): suffix it.
    const dot = name.lastIndexOf(".");
    const unique = `${name.slice(0, dot)}-${timestamp()}${name.slice(dot)}`;
    path = `${dir}/${unique}`;
    await invoke("fs_write_binary", { path, dataBase64: data });
  }
  return { path, name: name.replace(/\.[^.]+$/, "") };
}

function imageFiles(list: FileList | DataTransferItemList | null): File[] {
  if (!list) return [];
  const out: File[] = [];
  for (const item of Array.from(list as ArrayLike<File | DataTransferItem>)) {
    const file = item instanceof File ? item : item.getAsFile?.();
    if (file?.type.startsWith("image/")) out.push(file);
  }
  return out;
}

export function imageAttachmentsExtension(opts: ImageAttachmentOptions) {
  const handle = (view: EditorView, files: File[], at?: number): boolean => {
    const dir = opts.getAttachmentsDir();
    if (!dir || files.length === 0) return false;
    const pos = at ?? view.state.selection.main.head;
    // Insert a placeholder immediately so the paste feels instant, then
    // swap it for the real link once the bytes hit disk.
    const placeholder = `![uploading ${files.length > 1 ? `${files.length} images` : "image"}…]()`;
    view.dispatch({
      changes: { from: pos, insert: placeholder },
      selection: EditorSelection.cursor(pos + placeholder.length),
    });
    void (async () => {
      const links: string[] = [];
      try {
        for (const file of files) {
          const saved = await saveImage(file, dir);
          const rel = relativePath(dirname(opts.currentPath), saved.path);
          links.push(`![${saved.name}](${rel})`);
        }
      } catch (e) {
        links.push(`<!-- image upload failed: ${String(e)} -->`);
      }
      const text = view.state.doc.toString();
      const idx = text.indexOf(placeholder);
      if (idx === -1) return; // user removed it meanwhile
      const insert = links.join("\n");
      view.dispatch({
        changes: { from: idx, to: idx + placeholder.length, insert },
        selection: EditorSelection.cursor(idx + insert.length),
      });
    })();
    return true;
  };

  return EditorView.domEventHandlers({
    paste(event, view) {
      const files = imageFiles(event.clipboardData?.items ?? null);
      if (!handle(view, files)) return false;
      event.preventDefault();
      return true;
    },
    drop(event, view) {
      const files = imageFiles(event.dataTransfer?.files ?? null);
      const at = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (!handle(view, files, at ?? undefined)) return false;
      event.preventDefault();
      return true;
    },
  });
}
