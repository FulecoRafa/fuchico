import { usePrefersDark } from "@/lib/usePrefersDark";
import { useEffect } from "react";
import { useEditorSettings } from "./editorSettings";

const CUSTOM_STYLE_ID = "fuchico-custom-theme";

function applyCustomThemeCss(css: string) {
  let tag = document.getElementById(CUSTOM_STYLE_ID) as HTMLStyleElement | null;
  if (!css.trim()) {
    tag?.remove();
    return;
  }
  if (!tag) {
    tag = document.createElement("style");
    tag.id = CUSTOM_STYLE_ID;
    document.head.appendChild(tag);
  }
  tag.textContent = `:root[data-palette="custom"] {\n${css}\n}`;
}

/** Applies `data-palette`/`data-mode` to <html> from the shared editor
 * settings store, and keeps the injected custom-theme <style> tag in sync.
 * Call once near the app root -- it has no visual output of its own. */
export function useTheme() {
  const { settings } = useEditorSettings();
  const prefersDark = usePrefersDark();

  useEffect(() => {
    const resolvedMode =
      settings.mode === "system"
        ? prefersDark
          ? "dark"
          : "light"
        : settings.mode;
    document.documentElement.dataset.palette = settings.palette;
    document.documentElement.dataset.mode = resolvedMode;
  }, [settings.palette, settings.mode, prefersDark]);

  useEffect(() => {
    applyCustomThemeCss(settings.customThemeCss);
  }, [settings.customThemeCss]);

  useEffect(() => {
    if (settings.uiFont.trim()) {
      document.documentElement.style.setProperty(
        "--font-sans",
        `"${settings.uiFont}", var(--font-sans-fallback)`,
      );
    } else {
      document.documentElement.style.removeProperty("--font-sans");
    }
  }, [settings.uiFont]);

  useEffect(() => {
    if (settings.editorFont.trim()) {
      document.documentElement.style.setProperty(
        "--font-mono",
        `"${settings.editorFont}", var(--font-mono-fallback)`,
      );
    } else {
      document.documentElement.style.removeProperty("--font-mono");
    }
  }, [settings.editorFont]);
}
