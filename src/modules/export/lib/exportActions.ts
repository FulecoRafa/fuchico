import { t } from "@/lib/i18n";
import {
  isExternalLink,
  resolveRelativePath,
} from "@/modules/editor/lib/wikilinks";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { message, save } from "@tauri-apps/plugin-dialog";
import { renderHtml } from "./renderHtml";

/** Palette entry points for issue #28. */

export const EXPORT_WINDOW_PREFIX = "export-";
const REQUEST_EVENT = "export:request";
const HTML_EVENT = "export:html";

function stem(path: string): string {
  const base = path.slice(path.lastIndexOf("/") + 1);
  return base.replace(/\.(md|markdown)$/i, "");
}

function dirname(path: string): string {
  const i = path.lastIndexOf("/");
  return i <= 0 ? "" : path.slice(0, i);
}

/** Standalone HTML next to the note (save dialog picks the final path).
 * Relative hrefs are kept relative, so images next to the note keep
 * working when the .html is saved beside it. */
export async function exportAsHtml(
  path: string,
  markdown: string,
): Promise<void> {
  const target = await save({
    defaultPath: `${dirname(path)}/${stem(path)}.html`,
    filters: [{ name: "HTML", extensions: ["html"] }],
  });
  if (!target) return;
  const html = renderHtml(markdown, { title: stem(path) });
  try {
    await invoke("fs_write_file", {
      path: target,
      content: html,
      source: "export",
    });
    await message(t("export.saved", { path: target }), { kind: "info" });
  } catch (e) {
    // window.alert is a no-op in the macOS webview; use the native dialog.
    await message(t("export.failed", { message: String(e) }), {
      kind: "error",
    });
  }
}

// HTML handed to print windows on request, keyed by window label. Events
// are the same request/reply pattern the mermaid pop-out uses.
const pending = new Map<string, string>();
let replying = false;

function ensureReplyListener() {
  if (replying) return;
  replying = true;
  void listen<{ key: string }>(REQUEST_EVENT, ({ payload }) => {
    const html = pending.get(payload.key);
    if (html !== undefined) void emit(HTML_EVENT, { key: payload.key, html });
  });
}

/** Opens a print-preview window with the rendered note; its toolbar calls
 * the OS print dialog, where "Save as PDF" lives. */
export async function exportAsPdf(
  path: string,
  markdown: string,
): Promise<void> {
  const key = `${EXPORT_WINDOW_PREFIX}${Date.now().toString(36)}`;
  const toolbar = `<div class="no-print" style="position:fixed;top:0;left:0;right:0;display:flex;align-items:center;gap:12px;padding:8px 16px;background:var(--card);color:var(--card-foreground);border-bottom:1px solid var(--border);font-size:13px;z-index:10">
  <button type="button" id="print" style="padding:6px 14px;border-radius:999px;border:none;background:var(--primary);color:var(--primary-foreground);font:inherit;cursor:pointer">${t("export.print")}</button>
  <span style="opacity:.75">${t("export.printHint")}</span>
</div>`;
  const html = renderHtml(markdown, {
    title: stem(path),
    bodyExtra: toolbar,
    resolveHref: (href, kind) => {
      if (kind !== "image" || isExternalLink(href) || href.startsWith("data:"))
        return href;
      return convertFileSrc(resolveRelativePath(path, decodeURI(href)));
    },
  });
  pending.set(key, html);
  ensureReplyListener();
  const win = new WebviewWindow(key, {
    url: `index.html?window=print&key=${encodeURIComponent(key)}`,
    title: `${stem(path)} — PDF`,
    width: 860,
    height: 900,
  });
  void win.once("tauri://destroyed", () => pending.delete(key));
}
