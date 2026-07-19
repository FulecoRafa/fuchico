import type { EditorView } from "@codemirror/view";

export type OutlineHeader = {
  level: number;
  text: string;
  line: number;
  from: number;
};

const HEADER_RE = /^(#{1,6})\s+(.+?)\s*$/;

export function extractOutline(view: EditorView): OutlineHeader[] {
  const doc = view.state.doc;
  const headers: OutlineHeader[] = [];
  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    const m = HEADER_RE.exec(line.text);
    if (m) {
      headers.push({
        level: m[1].length,
        text: m[2],
        line: i,
        from: line.from,
      });
    }
  }
  return headers;
}
