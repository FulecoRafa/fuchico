import { syntaxTree } from "@codemirror/language";
import type { Range } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  type EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";

/**
 * Visually boxes fenced code blocks (header/body/footer line classes) and
 * adds a floating toolbar on the opening fence to change the language or
 * copy the block's contents. Ported from
 * ~/Documents/Dev/codemirror-helix/step-2's codeBlock.ts.
 */

const LANGUAGES = [
  "typescript",
  "javascript",
  "tsx",
  "jsx",
  "python",
  "rust",
  "go",
  "java",
  "c",
  "cpp",
  "css",
  "html",
  "json",
  "yaml",
  "toml",
  "xml",
  "sql",
  "bash",
  "sh",
  "markdown",
  "dockerfile",
];

class FenceToolbarWidget extends WidgetType {
  constructor(
    readonly language: string,
    readonly langFrom: number,
    readonly langTo: number,
    readonly contentFrom: number,
    readonly contentTo: number,
  ) {
    super();
  }

  eq(other: FenceToolbarWidget): boolean {
    return (
      other.language === this.language &&
      other.langFrom === this.langFrom &&
      other.contentFrom === this.contentFrom
    );
  }

  toDOM(view: EditorView): HTMLElement {
    const toolbar = document.createElement("span");
    toolbar.className = "cm-fence-toolbar";
    toolbar.contentEditable = "false";

    const select = document.createElement("select");
    select.className = "cm-fence-lang";
    select.title = "Change language";

    const currentLang = this.language.toLowerCase();
    let found = false;

    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = "plain";
    if (!currentLang) {
      blank.selected = true;
      found = true;
    }
    select.appendChild(blank);

    for (const lang of LANGUAGES) {
      const opt = document.createElement("option");
      opt.value = lang;
      opt.textContent = lang;
      if (lang === currentLang) {
        opt.selected = true;
        found = true;
      }
      select.appendChild(opt);
    }

    if (!found && currentLang) {
      const opt = document.createElement("option");
      opt.value = currentLang;
      opt.textContent = currentLang;
      opt.selected = true;
      select.insertBefore(opt, select.children[1]);
    }

    const { langFrom, langTo } = this;
    select.addEventListener("mousedown", (e) => e.stopPropagation());
    select.addEventListener("change", (e) => {
      const newLang = (e.target as HTMLSelectElement).value;
      view.dispatch({
        changes: { from: langFrom, to: langTo, insert: newLang },
      });
    });

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cm-fence-copy";
    btn.textContent = "Copy";
    btn.title = "Copy code to clipboard";

    const { contentFrom, contentTo } = this;
    btn.addEventListener("mousedown", (e) => e.preventDefault());
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const code = view.state.doc.sliceString(contentFrom, contentTo).trimEnd();
      void navigator.clipboard.writeText(code).then(() => {
        btn.textContent = "Copied";
        setTimeout(() => {
          btn.textContent = "Copy";
        }, 2000);
      });
    });

    toolbar.appendChild(select);
    toolbar.appendChild(btn);
    return toolbar;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

function buildDecorations(view: EditorView): DecorationSet {
  const decs: Range<Decoration>[] = [];

  syntaxTree(view.state).iterate({
    from: view.viewport.from,
    to: view.viewport.to,
    enter(node) {
      if (node.name !== "FencedCode") return;

      const openingLine = view.state.doc.lineAt(node.from);
      const closingLine = view.state.doc.lineAt(node.to);

      for (let i = openingLine.number; i <= closingLine.number; i++) {
        const line = view.state.doc.line(i);
        const cls =
          i === openingLine.number
            ? "cm-fence-header"
            : i === closingLine.number
              ? "cm-fence-footer"
              : "cm-fence-body";
        decs.push(Decoration.line({ class: cls }).range(line.from));
      }

      let langText = "";
      let langFrom = node.from + 3;
      let langTo = openingLine.to;

      const cursor = node.node.cursor();
      if (cursor.firstChild()) {
        do {
          if (cursor.name === "CodeInfo") {
            langText = view.state.doc
              .sliceString(cursor.from, cursor.to)
              .trim();
            langFrom = cursor.from;
            langTo = cursor.to;
            break;
          }
        } while (cursor.nextSibling());
      }

      const contentFrom = openingLine.to + 1;
      const contentTo = closingLine.from;
      decs.push(
        Decoration.widget({
          widget: new FenceToolbarWidget(
            langText,
            langFrom,
            langTo,
            contentFrom,
            contentTo,
          ),
          side: 1,
        }).range(openingLine.to),
      );

      return false;
    },
  });

  decs.sort((a, b) => {
    if (a.from !== b.from) return a.from - b.from;
    return a.to - a.from - (b.to - b.from);
  });

  return Decoration.set(decs, true);
}

export const codeBlockStyle = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.viewportChanged || u.selectionSet) {
        this.decorations = buildDecorations(u.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);
