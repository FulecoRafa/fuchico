import { parseFrontmatter } from "@/modules/frontmatter";
import { THEME_VARIABLES } from "@/modules/settings/lib/themeVariables";
import { Marked } from "marked";

/**
 * Markdown → standalone HTML document (issue #28). The page carries the
 * app's current theme (the resolved values of every theme variable are
 * inlined, so a custom theme exports too) plus a small reading stylesheet;
 * fonts fall back to the system stacks so the file stays self-contained.
 */

export type RenderOptions = {
  title: string;
  /** Rewrites relative image/link hrefs (e.g. to `asset://` URLs for the
   * in-app print preview). Return the input to leave it alone. */
  resolveHref?: (href: string, kind: "image" | "link") => string;
  /** Extra markup appended to <body> (the print window's toolbar). */
  bodyExtra?: string;
  /** Theme values to inline; defaults to the live document's. */
  themeVars?: Record<string, string>;
  mode?: "light" | "dark";
};

const WIKILINK_RE = /\[\[([^[\]|#]+)(#[^[\]|]*)?(?:\|([^[\]]+))?\]\]/g;
const EMBED_RE = /!\[\[([^[\]|]+)(?:\|([^[\]]+))?\]\]/g;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** `[[Note|alias]]` → `[alias](Note.html)`, `![[img.png]]` → image. Done
 * as a source rewrite so marked handles escaping/nesting. */
export function rewriteWikilinks(markdown: string): string {
  return markdown
    .replace(EMBED_RE, (_m, target: string, alt?: string) => {
      const t = target.trim();
      return `![${alt?.trim() ?? t}](${encodeURI(t)})`;
    })
    .replace(
      WIKILINK_RE,
      (_m, target: string, heading?: string, alias?: string) => {
        const t = target.trim();
        const label = alias?.trim() ?? (heading ? `${t}${heading}` : t);
        const anchor = heading
          ? `#${heading
              .slice(1)
              .trim()
              .toLowerCase()
              .replace(/[^\w]+/g, "-")}`
          : "";
        return `[${label}](${encodeURI(t)}.html${anchor})`;
      },
    );
}

/** Live values of every theme variable, for inlining. */
export function currentThemeVars(): Record<string, string> {
  if (typeof document === "undefined") return {};
  const style = getComputedStyle(document.documentElement);
  const out: Record<string, string> = {};
  for (const v of THEME_VARIABLES) {
    const value = style.getPropertyValue(v.name).trim();
    if (value) out[v.name] = value;
  }
  return out;
}

export function currentMode(): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.mode === "dark" ? "dark" : "light";
}

const READING_CSS = `
:root { color-scheme: light dark; }
html { background: var(--background); color: var(--foreground); }
body {
  margin: 0; padding: 48px 24px 96px;
  font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
  font-size: 16px; line-height: 1.65;
}
main { max-width: 760px; margin: 0 auto; }
h1, h2, h3, h4, h5, h6 { line-height: 1.25; margin: 1.6em 0 0.6em; color: var(--syntax-keyword); }
h1 { font-size: 2em; margin-top: 0; } h2 { font-size: 1.5em; } h3 { font-size: 1.25em; }
a { color: var(--syntax-function); text-decoration: none; }
a:hover { text-decoration: underline; }
code, pre, kbd { font-family: var(--font-mono, ui-monospace, SFMono-Regular, monospace); font-size: 0.9em; }
code { background: var(--muted); padding: 0.1em 0.35em; border-radius: 4px; }
pre { background: var(--muted); padding: 14px 16px; border-radius: 8px; overflow-x: auto; }
pre code { background: none; padding: 0; }
blockquote { margin: 1em 0; padding: 0.2em 1em; border-left: 3px solid var(--border); color: var(--muted-foreground); }
table { border-collapse: collapse; width: 100%; margin: 1em 0; }
th, td { border: 1px solid var(--border); padding: 6px 10px; text-align: left; }
th { background: var(--muted); }
img { max-width: 100%; height: auto; }
hr { border: none; border-top: 1px solid var(--border); margin: 2em 0; }
input[type="checkbox"] { margin-right: 0.5em; }
li.task { list-style: none; margin-left: -1.4em; }
.tag { color: var(--syntax-type); }
@media print {
  body { padding: 0; font-size: 12pt; }
  pre { white-space: pre-wrap; }
  a { color: inherit; }
  .no-print { display: none !important; }
}
`;

export function renderHtml(markdown: string, opts: RenderOptions): string {
  const fm = parseFrontmatter(markdown);
  const body = fm ? markdown.slice(fm.bodyStart) : markdown;
  const resolve = opts.resolveHref ?? ((h) => h);
  const marked = new Marked({ gfm: true, breaks: false });
  marked.use({
    renderer: {
      image({ href, title, text }) {
        const t = title ? ` title="${escapeHtml(title)}"` : "";
        return `<img src="${escapeHtml(resolve(href, "image"))}" alt="${escapeHtml(text)}"${t}>`;
      },
      link({ href, title, tokens }) {
        const t = title ? ` title="${escapeHtml(title)}"` : "";
        return `<a href="${escapeHtml(resolve(href, "link"))}"${t}>${this.parser.parseInline(tokens)}</a>`;
      },
      listitem(item) {
        const inner = this.parser.parse(item.tokens);
        if (!item.task) return `<li>${inner}</li>\n`;
        const box = `<input type="checkbox" disabled${item.checked ? " checked" : ""}> `;
        return `<li class="task">${box}${inner}</li>\n`;
      },
    },
  });
  const html = marked.parse(rewriteWikilinks(body), { async: false }) as string;
  const vars = opts.themeVars ?? currentThemeVars();
  const varCss = Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");
  const mode = opts.mode ?? currentMode();
  return `<!doctype html>
<html lang="en" data-mode="${mode}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(opts.title)}</title>
<style>
:root {
${varCss}
}
${READING_CSS}
</style>
</head>
<body>
<main>
${html}
</main>
${opts.bodyExtra ?? ""}
</body>
</html>
`;
}
