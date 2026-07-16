import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

export function openMermaidWindow(blockKey: string, title: string): void {
  const url = `index.html?mermaidBlockKey=${encodeURIComponent(blockKey)}&title=${encodeURIComponent(title)}`;
  new WebviewWindow(`mermaid-${blockKey}`, {
    url,
    title,
    width: 720,
    height: 560,
  });
}
