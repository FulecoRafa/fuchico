import {
  autocompletion,
  type CompletionContext,
  type CompletionResult,
  startCompletion,
} from "@codemirror/autocomplete";
import { syntaxTree } from "@codemirror/language";
import type { Extension, Range } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { fuzzyMatch } from "./fuzzyMatch";

/**
 * Wikilinks (`[[note]]`, `[[note|alias]]`) plus click-to-navigate for
 * relative Markdown links (`[text](./path.md)`). Ported pattern-wise from
 * markdownStyle.ts's LinkWidget: replace the raw syntax with a clickable
 * widget on every line except the one the cursor is on, so the source text
 * stays editable in place.
 *
 * `[[`-completion owns a dedicated `autocompletion()` instance (basicSetup's
 * is turned off in EditorPane) rather than registering through the
 * `EditorState.languageData` facet: basicSetup bundles its own
 * `@codemirror/autocomplete` copy that never picked up the facet entry, and
 * `codemirror-helix` neither emits the `input.type` userEvent that drives
 * `activateOnTyping` nor lets Ctrl-Space through -- so the popup is opened
 * explicitly via `startCompletion` from an update listener (see below).
 */

// ─── Path helpers ──────────────────────────────────────────────────────────

function dirnameOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i <= 0 ? "" : path.slice(0, i);
}

function basenameOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? path : path.slice(i + 1);
}

function basenameNoExt(path: string): string {
  const base = basenameOf(path);
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(0, dot) : base;
}

/** Joins `relative` onto the directory of `basePath`, resolving `.`/`..`. */
export function resolveRelativePath(basePath: string, relative: string): string {
  const isAbsolute = basePath.startsWith("/");
  const dir = dirnameOf(basePath);
  const parts = dir.split("/").filter(Boolean);
  for (const seg of relative.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      parts.pop();
      continue;
    }
    parts.push(seg);
  }
  const joined = parts.join("/");
  return isAbsolute ? `/${joined}` : joined;
}

const SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;

export function isExternalLink(href: string): boolean {
  return SCHEME_RE.test(href) || href.startsWith("//");
}

/** Resolves a relative Markdown link's href against the file it appears in.
 * Returns null for external (schemed) links, bare in-doc anchors, or empty
 * hrefs -- those are left for the browser's default handling. */
export function resolveRelativeMarkdownLink(
  href: string,
  currentPath: string,
): string | null {
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith("#") || isExternalLink(trimmed))
    return null;
  const [pathPart] = trimmed.split("#");
  if (!pathPart) return null;
  try {
    return resolveRelativePath(currentPath, decodeURIComponent(pathPart));
  } catch {
    return resolveRelativePath(currentPath, pathPart);
  }
}

/** Resolves a `[[target]]` wikilink to a vault file, matching by basename
 * with or without a `.md` extension (case-insensitive). `target` may still
 * carry a `#heading` suffix or `|alias` -- both are stripped before
 * matching. Returns the first match, preferring an exact-case basename hit. */
export function resolveWikilinkTarget(
  target: string,
  vaultFiles: readonly string[],
): string | null {
  const cleaned = target.split("|")[0].split("#")[0].trim();
  if (!cleaned) return null;
  const want = cleaned.toLowerCase().endsWith(".md")
    ? cleaned.slice(0, -3)
    : cleaned;
  const wantLower = want.toLowerCase();

  let caseInsensitiveMatch: string | null = null;
  for (const path of vaultFiles) {
    const base = basenameNoExt(path);
    if (base === want) return path;
    if (!caseInsensitiveMatch && base.toLowerCase() === wantLower) {
      caseInsensitiveMatch = path;
    }
  }
  return caseInsensitiveMatch;
}

// ─── Widgets ────────────────────────────────────────────────────────────────

class WikilinkWidget extends WidgetType {
  constructor(
    readonly label: string,
    readonly resolvedPath: string | null,
    readonly onNavigate: (path: string, focusLine?: number) => void,
  ) {
    super();
  }

  eq(other: WikilinkWidget): boolean {
    return other.label === this.label && other.resolvedPath === this.resolvedPath;
  }

  toDOM(): HTMLElement {
    const a = document.createElement("a");
    a.href = "#";
    a.textContent = this.label;
    a.className = this.resolvedPath
      ? "cm-wikilink"
      : "cm-wikilink cm-wikilink-unresolved";
    a.title = this.resolvedPath ?? `No note named "${this.label}"`;
    if (this.resolvedPath) a.dataset.resolvedPath = this.resolvedPath;
    // Navigate straight from the widget's own DOM. CM's central event
    // pipeline skips events from widgets whose `ignoreEvent` is true, so a
    // top-level `EditorView.domEventHandlers({click})` never fires for these
    // replaced ranges -- handling it here is the reliable path.
    const resolved = this.resolvedPath;
    if (resolved) {
      a.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.onNavigate(resolved);
      });
    }
    return a;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

// ─── Decorations ────────────────────────────────────────────────────────────

const WIKILINK_RE = /\[\[([^[\]\n]+)\]\]/g;

function isInsideCode(view: EditorView, pos: number): boolean {
  return /Code/.test(syntaxTree(view.state).resolveInner(pos, 1).name);
}

function buildDecorations(
  view: EditorView,
  getVaultFiles: () => readonly string[],
  onNavigate: (path: string, focusLine?: number) => void,
): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  const cursorLine = view.state.doc.lineAt(view.state.selection.main.head).number;
  const files = getVaultFiles();

  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = view.state.doc.lineAt(pos);
      if (line.number !== cursorLine) {
        WIKILINK_RE.lastIndex = 0;
        let m: RegExpExecArray | null;
        // biome-ignore lint/suspicious/noAssignInExpressions: standard regex-exec loop
        while ((m = WIKILINK_RE.exec(line.text))) {
          const start = line.from + m.index;
          const end = start + m[0].length;
          if (!isInsideCode(view, start)) {
            const inner = m[1];
            const pipeIdx = inner.indexOf("|");
            const target = pipeIdx === -1 ? inner : inner.slice(0, pipeIdx);
            const alias = pipeIdx === -1 ? null : inner.slice(pipeIdx + 1);
            const resolved = resolveWikilinkTarget(target, files);
            decorations.push(
              Decoration.replace({
                widget: new WikilinkWidget(
                  (alias ?? target).trim() || target.trim(),
                  resolved,
                  onNavigate,
                ),
              }).range(start, end),
            );
          }
        }
      }
      pos = line.to + 1;
    }
  }

  decorations.sort((a, b) => a.from - b.from || a.to - a.from - (b.to - b.from));
  return Decoration.set(decorations, true);
}

// ─── Click-to-navigate ──────────────────────────────────────────────────────

function wikilinkClickHandler(
  currentPath: string,
  onNavigate: (path: string, focusLine?: number) => void,
) {
  return (event: MouseEvent): boolean => {
    const target = event.target;
    if (!(target instanceof Element)) return false;
    const anchor = target.closest("a.cm-wikilink, a.cm-md-link-widget");
    if (!(anchor instanceof HTMLAnchorElement)) return false;

    if (anchor.classList.contains("cm-wikilink")) {
      event.preventDefault();
      const resolved = anchor.dataset.resolvedPath;
      if (resolved) onNavigate(resolved);
      return true;
    }

    // Existing `[text](url)` markdown link widget from markdownStyle.ts --
    // only intercept relative (local) hrefs; leave http(s)/mailto/etc. to
    // the anchor's own target="_blank" default handling.
    const href = anchor.getAttribute("href") ?? "";
    const resolved = resolveRelativeMarkdownLink(href, currentPath);
    if (!resolved) return false;
    event.preventDefault();
    onNavigate(resolved);
    return true;
  };
}

// ─── Autocomplete ───────────────────────────────────────────────────────────

const WIKILINK_TRIGGER_RE = /\[\[([^[\]]*)$/;
const MAX_COMPLETIONS = 50;

function wikilinkCompletionSource(getVaultFiles: () => readonly string[]) {
  return (context: CompletionContext): CompletionResult | null => {
    const before = context.matchBefore(WIKILINK_TRIGGER_RE);
    if (!before) return null;

    const query = before.text.replace(/^\[\[/, "");
    const from = before.to - query.length;
    const files = getVaultFiles();

    const scored = files
      .map((path) => {
        const label = basenameNoExt(path);
        const match = fuzzyMatch(query, label);
        return match.matched ? { path, label, score: match.score } : null;
      })
      .filter((x): x is { path: string; label: string; score: number } => x !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_COMPLETIONS);

    if (scored.length === 0) return null;

    // De-dupe same-basename notes in different folders by keeping the
    // fuller path visible in `detail` rather than dropping either.
    const options = scored.map(({ path, label }) => ({
      label,
      detail: path,
      type: "text",
      apply: (view: EditorView, _completion: unknown, from: number, to: number) => {
        const after = view.state.doc.sliceString(to, to + 2);
        const hasClose = after === "]]";
        const insert = hasClose ? label : `${label}]]`;
        view.dispatch({
          changes: { from, to, insert },
          selection: { anchor: from + insert.length },
        });
      },
    }));

    return { from, options, filter: false };
  };
}

// ─── Extension ──────────────────────────────────────────────────────────────

export type WikilinksOptions = {
  /** Absolute paths of every Markdown file in the vault. Read lazily on
   * every rebuild so the caller can keep this list fresh via a ref/callback
   * without changing the extension's identity. */
  getVaultFiles: () => readonly string[];
  /** Absolute path of the file this editor instance is showing. */
  currentPath: string;
  onNavigate: (path: string, focusLine?: number) => void;
};

export function wikilinksExtension(opts: WikilinksOptions): Extension {
  const { getVaultFiles, currentPath, onNavigate } = opts;

  const decorationPlugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = buildDecorations(view, getVaultFiles, onNavigate);
      }
      update(u: ViewUpdate) {
        if (u.docChanged || u.viewportChanged || u.selectionSet) {
          this.decorations = buildDecorations(u.view, getVaultFiles, onNavigate);
        }
      }
    },
    { decorations: (v) => v.decorations },
  );

  const clickHandler = EditorView.domEventHandlers({
    click: wikilinkClickHandler(currentPath, onNavigate),
  });

  // Own the autocompletion instance (basicSetup's is disabled in EditorPane)
  // so the source, the popup, and `startCompletion` below all come from the
  // same `@codemirror/autocomplete` module -- registering via `languageData`
  // for basicSetup's bundled copy silently did nothing.
  const completion = autocompletion({
    override: [wikilinkCompletionSource(getVaultFiles)],
    activateOnTyping: true,
  });

  // `codemirror-helix`'s insert-mode input doesn't emit the `input.type`
  // userEvent that autocompletion's `activateOnTyping` listens for, and it
  // swallows Ctrl-Space, so neither the automatic nor the manual trigger
  // fires. Detect a `[[…` context after each edit and open the popup
  // explicitly instead.
  const completionTrigger = EditorView.updateListener.of((u) => {
    if (!u.docChanged) return;
    const { state } = u;
    const head = state.selection.main.head;
    const line = state.doc.lineAt(head);
    const before = line.text.slice(0, head - line.from);
    if (WIKILINK_TRIGGER_RE.test(before)) startCompletion(u.view);
  });

  return [decorationPlugin, clickHandler, completion, completionTrigger];
}
