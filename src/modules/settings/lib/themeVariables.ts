import type { MessageKey } from "@/lib/i18n/en";

/**
 * The CSS custom properties a custom theme can override (issue #3). Kept in
 * sync by hand with the `:root` block in `styles/globals.css`; the theme
 * editor's autocomplete and the "new theme" template are both built from
 * this list.
 */
export type ThemeVariable = {
  name: `--${string}`;
  descKey: MessageKey;
  /** Colors get the color-aware completion/preview; the rest are free-form. */
  kind: "color" | "length" | "font" | "other";
};

export const THEME_VARIABLES: readonly ThemeVariable[] = [
  { name: "--background", descKey: "themeVar.background", kind: "color" },
  { name: "--foreground", descKey: "themeVar.foreground", kind: "color" },
  { name: "--card", descKey: "themeVar.card", kind: "color" },
  {
    name: "--card-foreground",
    descKey: "themeVar.cardForeground",
    kind: "color",
  },
  { name: "--primary", descKey: "themeVar.primary", kind: "color" },
  {
    name: "--primary-foreground",
    descKey: "themeVar.primaryForeground",
    kind: "color",
  },
  { name: "--secondary", descKey: "themeVar.secondary", kind: "color" },
  {
    name: "--secondary-foreground",
    descKey: "themeVar.secondaryForeground",
    kind: "color",
  },
  { name: "--muted", descKey: "themeVar.muted", kind: "color" },
  {
    name: "--muted-foreground",
    descKey: "themeVar.mutedForeground",
    kind: "color",
  },
  { name: "--accent", descKey: "themeVar.accent", kind: "color" },
  {
    name: "--accent-foreground",
    descKey: "themeVar.accentForeground",
    kind: "color",
  },
  { name: "--destructive", descKey: "themeVar.destructive", kind: "color" },
  { name: "--border", descKey: "themeVar.border", kind: "color" },
  { name: "--input", descKey: "themeVar.input", kind: "color" },
  { name: "--ring", descKey: "themeVar.ring", kind: "color" },
  {
    name: "--syntax-keyword",
    descKey: "themeVar.syntaxKeyword",
    kind: "color",
  },
  { name: "--syntax-string", descKey: "themeVar.syntaxString", kind: "color" },
  { name: "--syntax-number", descKey: "themeVar.syntaxNumber", kind: "color" },
  {
    name: "--syntax-function",
    descKey: "themeVar.syntaxFunction",
    kind: "color",
  },
  { name: "--syntax-type", descKey: "themeVar.syntaxType", kind: "color" },
  {
    name: "--syntax-comment",
    descKey: "themeVar.syntaxComment",
    kind: "color",
  },
  { name: "--radius", descKey: "themeVar.radius", kind: "length" },
  { name: "--font-sans", descKey: "themeVar.fontSans", kind: "font" },
  { name: "--font-mono", descKey: "themeVar.fontMono", kind: "font" },
];

/** Current computed value of a theme variable on <html>, or "" if unset. */
export function currentThemeValue(name: string): string {
  if (typeof document === "undefined") return "";
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

/** CSS declarations for every variable at its current computed value, so a
 * new custom theme starts out looking exactly like the active palette. */
export function snapshotCurrentTheme(): string {
  return THEME_VARIABLES.filter((v) => v.kind === "color")
    .map((v) => `${v.name}: ${currentThemeValue(v.name) || "inherit"};`)
    .join("\n");
}
