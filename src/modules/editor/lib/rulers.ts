import { Compartment, type Extension } from "@codemirror/state";
import { type EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";

/**
 * Vertical ruler(s): a thin guide line at one or more configurable columns
 * (issue #18), e.g. 80 for a wrap target. Drawn as absolutely positioned
 * elements inside the scroller so they scroll with the content and span its
 * full height; positioned from the editor's default character width, so
 * they line up with monospaced text.
 */

export const rulersCompartment = new Compartment();

/** Parses the settings text ("80, 120") into unique ascending columns.
 * Anything that isn't a positive integer is dropped. */
export function parseRulers(text: string): number[] {
  const cols = new Set<number>();
  for (const part of text.split(/[\s,;]+/)) {
    if (!part) continue;
    const n = Number(part);
    if (Number.isInteger(n) && n > 0 && n <= 1000) cols.add(n);
  }
  return [...cols].sort((a, b) => a - b);
}

export function formatRulers(columns: readonly number[]): string {
  return columns.join(", ");
}

class RulersPlugin {
  private container: HTMLDivElement;
  private lines: HTMLDivElement[] = [];

  constructor(
    private view: EditorView,
    private columns: readonly number[],
  ) {
    this.container = document.createElement("div");
    this.container.className = "cm-rulers";
    this.container.setAttribute("aria-hidden", "true");
    for (const col of columns) {
      const line = document.createElement("div");
      line.className = "cm-ruler";
      line.dataset.column = String(col);
      this.container.appendChild(line);
      this.lines.push(line);
    }
    view.scrollDOM.appendChild(this.container);
    // Font metrics aren't final until the view has measured once.
    view.requestMeasure({
      read: () => this.measure(),
      write: (m) => this.apply(m),
    });
  }

  update(update: ViewUpdate) {
    if (update.geometryChanged || update.viewportChanged) {
      this.view.requestMeasure({
        read: () => this.measure(),
        write: (m) => this.apply(m),
      });
    }
  }

  private measure() {
    const { contentDOM, scrollDOM } = this.view;
    const content = contentDOM.getBoundingClientRect();
    const scroller = scrollDOM.getBoundingClientRect();
    const padding = Number.parseFloat(
      getComputedStyle(contentDOM).paddingLeft || "0",
    );
    const left = content.left - scroller.left + scrollDOM.scrollLeft;
    return {
      left: left + padding,
      charWidth: this.view.defaultCharacterWidth,
      height: Math.max(scrollDOM.scrollHeight, scrollDOM.clientHeight),
      // Clip to the content's width so a ruler past the last column never
      // widens the scroller (which would add a horizontal scrollbar).
      width: Math.max(scrollDOM.clientWidth, left + content.width),
    };
  }

  private apply(m: {
    left: number;
    charWidth: number;
    height: number;
    width: number;
  }) {
    this.container.style.height = `${m.height}px`;
    this.container.style.width = `${m.width}px`;
    this.lines.forEach((line, i) => {
      line.style.left = `${m.left + this.columns[i] * m.charWidth}px`;
    });
  }

  destroy() {
    this.container.remove();
  }
}

export function rulersExtension(columns: readonly number[]): Extension {
  if (columns.length === 0) return [];
  return ViewPlugin.define((view) => new RulersPlugin(view, columns));
}
