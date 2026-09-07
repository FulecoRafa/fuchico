import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";

/**
 * Entry for `?window=print&key=…` (issue #28): asks the opener for the
 * rendered HTML, replaces this document with it, and wires the toolbar's
 * button to the webview's native print (whose dialog offers Save as PDF).
 * No React -- the exported page is a plain document.
 */
export async function mountPrintWindow(key: string): Promise<void> {
  const html = await new Promise<string>((resolve) => {
    void listen<{ key: string; html: string }>("export:html", (e) => {
      if (e.payload.key === key) resolve(e.payload.html);
    }).then(() => emit("export:request", { key }));
  });
  document.open();
  document.write(html);
  document.close();
  // Native print via Rust (`WebviewWindow::print`); the JS API has no
  // equivalent in Tauri 2.
  const print = () => invoke("export_print").catch(() => window.print());
  document.getElementById("print")?.addEventListener("click", () => {
    void print();
  });
  document.body.style.paddingTop = "64px";
}
