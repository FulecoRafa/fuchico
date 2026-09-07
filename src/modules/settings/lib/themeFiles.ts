import type { CustomTheme } from "./editorSettings";

/**
 * Import/export of custom themes as plain `.css` files (issue #3). The file
 * body is exactly the declarations block the app injects, with the theme
 * name carried in a leading comment so re-importing keeps it.
 */

const NAME_RE = /^\s*\/\*\s*fuchico-theme:\s*(.+?)\s*\*\/\s*\n?/;

export function serializeTheme(theme: CustomTheme): string {
  return `/* fuchico-theme: ${theme.name.replace(/\*\//g, "")} */\n${theme.css.trim()}\n`;
}

/** Parses a theme file; `fallbackName` (usually the file stem) is used when
 * the header comment is missing. */
export function parseThemeFile(
  text: string,
  fallbackName: string,
): { name: string; css: string } {
  const m = NAME_RE.exec(text);
  const name = m?.[1].trim() || fallbackName;
  const css = (m ? text.slice(m[0].length) : text).trim();
  return { name, css };
}

export function themeFileName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "theme"}.fuchico-theme.css`;
}
